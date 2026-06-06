package service

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
	"github.com/isw2-unileon/MeRenta/backend/internal/sqlcdb"
)

type addressQuerierStub struct {
	addresses []sqlcdb.Address
	current   sqlcdb.Address
	createArg sqlcdb.CreateAddressParams
	updateArg sqlcdb.UpdateAddressParams
	deletedID uuid.UUID
	getErr    error
	deleteErr error
}

func (s *addressQuerierStub) CreateAddress(_ context.Context, arg sqlcdb.CreateAddressParams) (sqlcdb.Address, error) {
	s.createArg = arg
	return sqlcdb.Address{
		AddressID:  uuid.MustParse("11111111-1111-1111-1111-111111111111"),
		CustomerID: arg.CustomerID,
		Street:     arg.Street,
		Number:     arg.Number,
		Floor:      arg.Floor,
		City:       arg.City,
		Province:   arg.Province,
		PostalCode: arg.PostalCode,
		Country:    arg.Country,
		Latitude:   arg.Latitude,
		Longitude:  arg.Longitude,
	}, nil
}

func (s *addressQuerierStub) DeleteAddress(_ context.Context, addressID uuid.UUID) error {
	s.deletedID = addressID
	return s.deleteErr
}

func (s *addressQuerierStub) GetAddressByID(_ context.Context, _ uuid.UUID) (sqlcdb.Address, error) {
	if s.getErr != nil {
		return sqlcdb.Address{}, s.getErr
	}
	return s.current, nil
}

func (s *addressQuerierStub) GetAddressesByCustomer(_ context.Context, _ uuid.UUID) ([]sqlcdb.Address, error) {
	return s.addresses, nil
}

func (s *addressQuerierStub) UpdateAddress(_ context.Context, arg sqlcdb.UpdateAddressParams) (sqlcdb.Address, error) {
	s.updateArg = arg
	row := s.current
	row.Street = arg.Street
	row.Number = arg.Number
	row.Floor = arg.Floor
	row.City = arg.City
	row.Province = arg.Province
	row.PostalCode = arg.PostalCode
	row.Country = arg.Country
	row.Latitude = arg.Latitude
	row.Longitude = arg.Longitude
	return row, nil
}

func TestAddressServiceCreateListUpdateDelete(t *testing.T) {
	t.Parallel()

	customerID := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	addressID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	lat := 42.6
	lon := -5.57
	stub := &addressQuerierStub{
		current: sqlcdb.Address{
			AddressID:  addressID,
			CustomerID: customerID,
			Street:     "Calle Luna",
			Number:     "1",
			City:       "Leon",
			Province:   "Leon",
			PostalCode: "24001",
			Country:    "Spain",
		},
		addresses: []sqlcdb.Address{{
			AddressID:  addressID,
			CustomerID: customerID,
			Street:     "Calle Luna",
			Number:     "1",
			Floor:      pgtype.Text{String: "2A", Valid: true},
			City:       "Leon",
			Province:   "Leon",
			PostalCode: "24001",
			Country:    "Spain",
		}},
	}
	svc := NewAddressService(stub)

	list, err := svc.ListAddresses(context.Background(), customerID)
	if err != nil {
		t.Fatalf("ListAddresses returned error: %v", err)
	}
	if len(list) != 1 || list[0].Floor != "2A" {
		t.Fatalf("unexpected list response: %+v", list)
	}

	created, err := svc.CreateAddress(context.Background(), customerID, model.CreateAddressRequest{
		Street: "Calle Sol", Number: "5", City: "Leon", Province: "Leon", PostalCode: "24002", Latitude: &lat, Longitude: &lon,
	})
	if err != nil {
		t.Fatalf("CreateAddress returned error: %v", err)
	}
	if created.Country != "Spain" || created.Latitude == nil || *created.Latitude != 42.6 {
		t.Fatalf("unexpected create response: %+v", created)
	}

	updated, err := svc.UpdateAddress(context.Background(), customerID, addressID, model.CreateAddressRequest{
		Street: "Calle Nueva", Number: "7", Floor: "1B", City: "Leon", Province: "Leon", PostalCode: "24003",
	})
	if err != nil {
		t.Fatalf("UpdateAddress returned error: %v", err)
	}
	if updated.Street != "Calle Nueva" || stub.updateArg.Country != "Spain" {
		t.Fatalf("unexpected update response: %+v arg=%+v", updated, stub.updateArg)
	}

	if err := svc.DeleteAddress(context.Background(), customerID, addressID); err != nil {
		t.Fatalf("DeleteAddress returned error: %v", err)
	}
	if stub.deletedID != addressID {
		t.Fatalf("deletedID = %s", stub.deletedID)
	}
}

func TestAddressServiceOwnershipAndNotFound(t *testing.T) {
	t.Parallel()

	customerID := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	otherID := uuid.MustParse("33333333-3333-3333-3333-333333333333")
	addressID := uuid.MustParse("11111111-1111-1111-1111-111111111111")

	stub := &addressQuerierStub{current: sqlcdb.Address{AddressID: addressID, CustomerID: otherID}}
	svc := NewAddressService(stub)

	if err := svc.DeleteAddress(context.Background(), customerID, addressID); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected forbidden, got %v", err)
	}

	stub.getErr = pgx.ErrNoRows
	if _, err := svc.UpdateAddress(context.Background(), customerID, addressID, model.CreateAddressRequest{}); !errors.Is(err, ErrAddressNotFound) {
		t.Fatalf("expected address not found, got %v", err)
	}
}

func TestAddressServiceDeleteInUse(t *testing.T) {
	t.Parallel()

	customerID := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	addressID := uuid.MustParse("11111111-1111-1111-1111-111111111111")

	stub := &addressQuerierStub{
		current:   sqlcdb.Address{AddressID: addressID, CustomerID: customerID},
		deleteErr: &pgconn.PgError{Code: "23503"},
	}
	svc := NewAddressService(stub)

	if err := svc.DeleteAddress(context.Background(), customerID, addressID); !errors.Is(err, ErrAddressInUse) {
		t.Fatalf("expected address in use, got %v", err)
	}
}

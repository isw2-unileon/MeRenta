// Package service contains business logic for the API.
package service

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
	"github.com/isw2-unileon/MeRenta/backend/internal/sqlcdb"
)

// addressQuerier is the minimal DB interface needed by AddressService.
type addressQuerier interface {
	CreateAddress(ctx context.Context, arg sqlcdb.CreateAddressParams) (sqlcdb.Address, error)
	GetAddressesByCustomer(ctx context.Context, customerID uuid.UUID) ([]sqlcdb.Address, error)
}

// AddressService handles customer address use cases.
type AddressService struct {
	q addressQuerier
}

// NewAddressService creates an AddressService with its dependencies.
func NewAddressService(q addressQuerier) *AddressService {
	return &AddressService{q: q}
}

// ListAddresses returns all addresses owned by customerID.
func (s *AddressService) ListAddresses(
	ctx context.Context,
	customerID uuid.UUID,
) ([]model.AddressResponse, error) {
	rows, err := s.q.GetAddressesByCustomer(ctx, customerID)
	if err != nil {
		return nil, err
	}

	result := make([]model.AddressResponse, 0, len(rows))
	for _, row := range rows {
		result = append(result, toAddressResponse(row))
	}

	return result, nil
}

// CreateAddress inserts a new address for the given customer.
func (s *AddressService) CreateAddress(
	ctx context.Context,
	customerID uuid.UUID,
	req model.CreateAddressRequest,
) (*model.AddressResponse, error) {
	country := req.Country
	if country == "" {
		country = "Spain"
	}

	lat, err := optionalFloat64ToNumeric(req.Latitude)
	if err != nil {
		return nil, fmt.Errorf("invalid latitude: %w", err)
	}

	lon, err := optionalFloat64ToNumeric(req.Longitude)
	if err != nil {
		return nil, fmt.Errorf("invalid longitude: %w", err)
	}

	row, err := s.q.CreateAddress(ctx, sqlcdb.CreateAddressParams{
		CustomerID: customerID,
		Street:     req.Street,
		Number:     req.Number,
		Floor:      pgtype.Text{String: req.Floor, Valid: req.Floor != ""},
		City:       req.City,
		Province:   req.Province,
		PostalCode: req.PostalCode,
		Country:    country,
		Latitude:   lat,
		Longitude:  lon,
	})
	if err != nil {
		return nil, err
	}

	resp := toAddressResponse(row)
	return &resp, nil
}

// toAddressResponse maps a sqlcdb.Address to the API response model.
func toAddressResponse(a sqlcdb.Address) model.AddressResponse {
	resp := model.AddressResponse{
		AddressID:  a.AddressID.String(),
		CustomerID: a.CustomerID.String(),
		Street:     a.Street,
		Number:     a.Number,
		City:       a.City,
		Province:   a.Province,
		PostalCode: a.PostalCode,
		Country:    a.Country,
	}

	if a.Floor.Valid {
		resp.Floor = a.Floor.String
	}

	if a.Latitude.Valid {
		f, err := numericToFloat64(a.Latitude)
		if err == nil {
			resp.Latitude = &f
		}
	}

	if a.Longitude.Valid {
		f, err := numericToFloat64(a.Longitude)
		if err == nil {
			resp.Longitude = &f
		}
	}

	return resp
}

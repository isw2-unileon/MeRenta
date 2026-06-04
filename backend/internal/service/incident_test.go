package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
	"github.com/isw2-unileon/MeRenta/backend/internal/sqlcdb"
)

type incidentQuerierStub struct {
	booking           sqlcdb.BookingDetailRow
	item              sqlcdb.GetItemByIDRow
	customer          sqlcdb.GetCustomerByIDRow
	row               sqlcdb.IncidentRow
	rows              []sqlcdb.IncidentRow
	bookingErr        error
	itemErr           error
	customerErr       error
	updateStatusErr   error
	updatePriorityErr error
	createIncidentArg sqlcdb.CreateIncidentParams
	productArg        sqlcdb.CreateProductIncidentParams
	userArg           sqlcdb.CreateUserIncidentParams
}

func (s *incidentQuerierStub) GetBookingByID(context.Context, uuid.UUID) (sqlcdb.BookingDetailRow, error) {
	if s.bookingErr != nil {
		return sqlcdb.BookingDetailRow{}, s.bookingErr
	}
	return s.booking, nil
}

func (s *incidentQuerierStub) GetOrCreateRentalForBooking(context.Context, uuid.UUID) (uuid.UUID, error) {
	return uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"), nil
}

func (s *incidentQuerierStub) CreateIncident(_ context.Context, arg sqlcdb.CreateIncidentParams) (uuid.UUID, error) {
	s.createIncidentArg = arg
	return s.row.IncidentID, nil
}

func (s *incidentQuerierStub) GetIncidentByID(context.Context, uuid.UUID) (sqlcdb.IncidentRow, error) {
	return s.row, nil
}

func (s *incidentQuerierStub) ListIncidentsByReporter(context.Context, uuid.UUID, int32, int32) ([]sqlcdb.IncidentRow, error) {
	return s.rows, nil
}

func (s *incidentQuerierStub) ListIncidentsAdmin(context.Context, sqlcdb.ListIncidentsAdminParams) ([]sqlcdb.IncidentRow, error) {
	return s.rows, nil
}

func (s *incidentQuerierStub) UpdateIncidentStatus(_ context.Context, _ uuid.UUID, status sqlcdb.IncidentStatus) (sqlcdb.IncidentStatus, error) {
	return status, s.updateStatusErr
}

func (s *incidentQuerierStub) UpdateIncidentPriority(_ context.Context, _ uuid.UUID, priority string) (string, error) {
	return priority, s.updatePriorityErr
}

func (s *incidentQuerierStub) GetItemByID(context.Context, uuid.UUID) (sqlcdb.GetItemByIDRow, error) {
	if s.itemErr != nil {
		return sqlcdb.GetItemByIDRow{}, s.itemErr
	}
	return s.item, nil
}

func (s *incidentQuerierStub) GetCustomerByID(context.Context, uuid.UUID) (sqlcdb.GetCustomerByIDRow, error) {
	if s.customerErr != nil {
		return sqlcdb.GetCustomerByIDRow{}, s.customerErr
	}
	return s.customer, nil
}

func (s *incidentQuerierStub) CreateProductIncident(_ context.Context, arg sqlcdb.CreateProductIncidentParams) (uuid.UUID, error) {
	s.productArg = arg
	return s.row.IncidentID, nil
}

func (s *incidentQuerierStub) CreateUserIncident(_ context.Context, arg sqlcdb.CreateUserIncidentParams) (uuid.UUID, error) {
	s.userArg = arg
	return s.row.IncidentID, nil
}

func TestIncidentServiceCreateReportsAndList(t *testing.T) {
	t.Parallel()

	reporterID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	ownerID := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	itemID := uuid.MustParse("33333333-3333-3333-3333-333333333333")
	bookingID := uuid.MustParse("44444444-4444-4444-4444-444444444444")
	incidentID := uuid.MustParse("55555555-5555-5555-5555-555555555555")
	row := sampleIncidentRow(incidentID, reporterID, itemID, bookingID)
	stub := &incidentQuerierStub{
		booking: sqlcdb.BookingDetailRow{
			BookingID:     bookingID,
			RenterID:      reporterID,
			OwnerID:       pgtype.UUID{Bytes: ownerID, Valid: true},
			BookingStatus: sqlcdb.BookingStatusAccepted,
		},
		item:     sqlcdb.GetItemByIDRow{ItemID: itemID, OwnerID: ownerID},
		customer: sqlcdb.GetCustomerByIDRow{CustomerID: ownerID},
		row:      row,
		rows:     []sqlcdb.IncidentRow{row},
	}
	svc := NewIncidentService(stub)

	created, err := svc.Create(context.Background(), reporterID, model.CreateIncidentRequest{
		BookingID: bookingID.String(), Type: string(sqlcdb.IncidentTypeDamage), Description: "Producto danado", Cost: 12.5,
	})
	if err != nil {
		t.Fatalf("Create returned error: %v", err)
	}
	if created.IncidentID != incidentID.String() || stub.createIncidentArg.ReporterID != reporterID {
		t.Fatalf("unexpected created incident: %+v arg=%+v", created, stub.createIncidentArg)
	}

	product, err := svc.CreateProductReport(context.Background(), reporterID, itemID, model.CreateProductReportRequest{
		Type: string(sqlcdb.IncidentTypeForbiddenItem), Description: "Producto prohibido",
	})
	if err != nil {
		t.Fatalf("CreateProductReport returned error: %v", err)
	}
	if product.IncidentID != incidentID.String() || stub.productArg.Priority != "high" {
		t.Fatalf("unexpected product report: %+v arg=%+v", product, stub.productArg)
	}

	user, err := svc.CreateUserReport(context.Background(), reporterID, ownerID, model.CreateUserReportRequest{
		Type: string(sqlcdb.IncidentTypeLateReturn), Description: "Devolucion tarde",
	})
	if err != nil {
		t.Fatalf("CreateUserReport returned error: %v", err)
	}
	if user.IncidentID != incidentID.String() || stub.userArg.Priority != "low" {
		t.Fatalf("unexpected user report: %+v arg=%+v", user, stub.userArg)
	}

	list, err := svc.ListMine(context.Background(), reporterID, 2, 10)
	if err != nil {
		t.Fatalf("ListMine returned error: %v", err)
	}
	if list.Total != 1 || list.Page != 2 {
		t.Fatalf("unexpected list: %+v", list)
	}
}

func TestIncidentServiceValidationAndUpdates(t *testing.T) {
	t.Parallel()

	reporterID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	ownerID := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	itemID := uuid.MustParse("33333333-3333-3333-3333-333333333333")
	incidentID := uuid.MustParse("55555555-5555-5555-5555-555555555555")
	stub := &incidentQuerierStub{
		item: sqlcdb.GetItemByIDRow{ItemID: itemID, OwnerID: reporterID},
		row:  sampleIncidentRow(incidentID, reporterID, itemID, uuid.New()),
	}
	svc := NewIncidentService(stub)

	if _, err := svc.Create(context.Background(), reporterID, model.CreateIncidentRequest{BookingID: "bad", Type: "bad"}); !errors.Is(err, ErrIncidentForbidden) {
		t.Fatalf("expected forbidden for bad booking id, got %v", err)
	}
	if _, err := svc.CreateProductReport(context.Background(), reporterID, itemID, model.CreateProductReportRequest{Type: string(sqlcdb.IncidentTypeDamage)}); !errors.Is(err, ErrCannotReportOwnItem) {
		t.Fatalf("expected own item report error, got %v", err)
	}
	if _, err := svc.CreateUserReport(context.Background(), reporterID, reporterID, model.CreateUserReportRequest{Type: string(sqlcdb.IncidentTypeOther)}); !errors.Is(err, ErrIncidentForbidden) {
		t.Fatalf("expected self report forbidden, got %v", err)
	}
	if _, err := svc.UpdateStatus(context.Background(), incidentID, "bad"); !errors.Is(err, ErrIncidentInvalidStatus) {
		t.Fatalf("expected invalid status, got %v", err)
	}
	if _, err := svc.UpdatePriority(context.Background(), incidentID, "urgent"); !errors.Is(err, ErrIncidentInvalidPriority) {
		t.Fatalf("expected invalid priority, got %v", err)
	}

	stub.item.OwnerID = ownerID
	stub.itemErr = pgx.ErrNoRows
	if _, err := svc.CreateProductReport(context.Background(), reporterID, itemID, model.CreateProductReportRequest{Type: string(sqlcdb.IncidentTypeOther)}); !errors.Is(err, ErrIncidentForbidden) {
		t.Fatalf("expected missing item forbidden, got %v", err)
	}
}

func sampleIncidentRow(incidentID, reporterID, itemID, bookingID uuid.UUID) sqlcdb.IncidentRow {
	rentalID := uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
	reportedID := uuid.MustParse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
	return sqlcdb.IncidentRow{
		IncidentID:     incidentID,
		RentalID:       rentalID,
		ReporterID:     reporterID,
		ReporterName:   "Laura Garcia",
		ReportedID:     reportedID,
		ReportedName:   "Diego Perez",
		BookingID:      bookingID,
		ItemID:         itemID,
		ItemTitle:      "Taladro",
		StartDate:      time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC),
		EndDate:        time.Date(2026, 6, 3, 0, 0, 0, 0, time.UTC),
		IncidentType:   sqlcdb.IncidentTypeDamage,
		Description:    "Producto danado",
		IncidentStatus: sqlcdb.IncidentStatusOpen,
		Priority:       "medium",
		AssociatedCost: costToNumeric(12.5),
		ReportedAt:     pgtype.Timestamptz{Time: time.Date(2026, 6, 4, 12, 0, 0, 0, time.UTC), Valid: true},
		TotalCount:     1,
	}
}

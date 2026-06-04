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

type bookingQuerierStub struct {
	item                  sqlcdb.GetItemByIDRow
	booking               sqlcdb.BookingDetailRow
	row                   sqlcdb.BookingRow
	detailRows            []sqlcdb.BookingDetailRow
	ranges                []sqlcdb.BookingDateRange
	expiredRows           []sqlcdb.ExpiredBookingRow
	autoCompleteIDs       []uuid.UUID
	getBookingErr         error
	activeCount           int64
	updateStatusArg       sqlcdb.UpdateBookingStatusParams
	updateAvailabilityArg sqlcdb.UpdateItemAvailabilityParams
	updateItemStatusArg   sqlcdb.UpdateItemStatusParams
	rentalCreatedFor      uuid.UUID
	syncedAll             bool
}

func (s *bookingQuerierStub) CreateBooking(_ context.Context, arg sqlcdb.CreateBookingParams) (sqlcdb.BookingRow, error) {
	s.row.BookingID = uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
	s.row.ItemID = pgtype.UUID{Bytes: arg.ItemID, Valid: true}
	s.row.RenterID = arg.RenterID
	s.row.StartDate = arg.StartDate
	s.row.EndDate = arg.EndDate
	s.row.EstimatedTotal = arg.EstimatedTotal
	s.row.Notes = arg.Notes
	s.row.PaymentIntentID = arg.PaymentIntentID
	s.row.ExpiresAt = arg.ExpiresAt
	s.row.RequestedAt = pgtype.Timestamptz{Time: time.Date(2026, 6, 1, 9, 0, 0, 0, time.UTC), Valid: true}
	s.row.BookingStatus = sqlcdb.BookingStatusPending
	return s.row, nil
}

func (s *bookingQuerierStub) GetBookingByID(context.Context, uuid.UUID) (sqlcdb.BookingDetailRow, error) {
	if s.getBookingErr != nil {
		return sqlcdb.BookingDetailRow{}, s.getBookingErr
	}
	return s.booking, nil
}

func (s *bookingQuerierStub) ListBookingsByRenter(context.Context, sqlcdb.ListBookingsParams) ([]sqlcdb.BookingDetailRow, error) {
	return s.detailRows, nil
}

func (s *bookingQuerierStub) ListBookingsByOwner(context.Context, sqlcdb.ListBookingsParams) ([]sqlcdb.BookingDetailRow, error) {
	return s.detailRows, nil
}

func (s *bookingQuerierStub) UpdateBookingStatus(_ context.Context, arg sqlcdb.UpdateBookingStatusParams) (sqlcdb.BookingRow, error) {
	s.updateStatusArg = arg
	row := s.row
	row.BookingID = arg.BookingID
	row.BookingStatus = arg.Status
	if !row.ItemID.Valid {
		row.ItemID = s.booking.ItemID
	}
	if row.RenterID == uuid.Nil {
		row.RenterID = s.booking.RenterID
	}
	if row.StartDate.IsZero() {
		row.StartDate = s.booking.StartDate
		row.EndDate = s.booking.EndDate
		row.RequestedAt = s.booking.RequestedAt
	}
	return row, nil
}

func (s *bookingQuerierStub) GetItemByID(context.Context, uuid.UUID) (sqlcdb.GetItemByIDRow, error) {
	return s.item, nil
}

func (s *bookingQuerierStub) GetItemBookedRanges(context.Context, uuid.UUID) ([]sqlcdb.BookingDateRange, error) {
	return s.ranges, nil
}

func (s *bookingQuerierStub) ListExpiredPendingBookings(context.Context) ([]sqlcdb.ExpiredBookingRow, error) {
	return s.expiredRows, nil
}

func (s *bookingQuerierStub) ListAcceptedBookingsPastDeadline(context.Context) ([]uuid.UUID, error) {
	return s.autoCompleteIDs, nil
}

func (s *bookingQuerierStub) CountActiveBookingsForItem(context.Context, uuid.UUID) (int64, error) {
	return s.activeCount, nil
}

func (s *bookingQuerierStub) UpdateItemAvailability(_ context.Context, arg sqlcdb.UpdateItemAvailabilityParams) error {
	s.updateAvailabilityArg = arg
	return nil
}

func (s *bookingQuerierStub) UpdateItemStatus(_ context.Context, arg sqlcdb.UpdateItemStatusParams) (sqlcdb.UpdateItemStatusRow, error) {
	s.updateItemStatusArg = arg
	return sqlcdb.UpdateItemStatusRow{ItemID: arg.ItemID, ItemStatus: arg.ItemStatus}, nil
}

func (s *bookingQuerierStub) SyncAllItemAvailabilities(context.Context) error {
	s.syncedAll = true
	return nil
}

func (s *bookingQuerierStub) GetOrCreateRentalForBooking(_ context.Context, bookingID uuid.UUID) (uuid.UUID, error) {
	s.rentalCreatedFor = bookingID
	return uuid.MustParse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"), nil
}

type refunderStub struct {
	refunded []string
	err      error
}

func (s *refunderStub) RefundPayment(_ context.Context, paymentIntentID string) error {
	s.refunded = append(s.refunded, paymentIntentID)
	return s.err
}

func TestBookingServiceCreateListDatesAndSync(t *testing.T) {
	t.Parallel()

	renterID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	ownerID := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	itemID := uuid.MustParse("33333333-3333-3333-3333-333333333333")
	total := 42.5
	stub := &bookingQuerierStub{
		item:        sqlcdb.GetItemByIDRow{ItemID: itemID, OwnerID: ownerID, ItemStatus: sqlcdb.ItemStatusAvailable},
		activeCount: 1,
		ranges: []sqlcdb.BookingDateRange{{
			StartDate: time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC),
			EndDate:   time.Date(2026, 6, 4, 0, 0, 0, 0, time.UTC),
		}},
		detailRows: []sqlcdb.BookingDetailRow{sampleBookingDetail(uuid.New(), itemID, renterID, ownerID, sqlcdb.BookingStatusPending, time.Now().Add(24*time.Hour))},
	}
	svc := NewBookingService(stub, &refunderStub{})

	created, err := svc.Create(context.Background(), renterID, model.CreateBookingRequest{
		ItemID: itemID.String(), StartDate: "2026-06-01", EndDate: "2026-06-04", EstimatedTotal: &total, Notes: "Gracias", PaymentIntentID: "pi_123",
	})
	if err != nil {
		t.Fatalf("Create returned error: %v", err)
	}
	if created.ItemID != itemID.String() || created.EstimatedTotal == nil || *created.EstimatedTotal != 42.5 {
		t.Fatalf("unexpected create response: %+v", created)
	}
	if stub.updateItemStatusArg.ItemStatus != sqlcdb.ItemStatusRented {
		t.Fatalf("expected rented status sync, got %+v", stub.updateItemStatusArg)
	}

	list, err := svc.ListMine(context.Background(), renterID, 1, 10)
	if err != nil {
		t.Fatalf("ListMine returned error: %v", err)
	}
	if list.Total != 1 || len(list.Items) != 1 {
		t.Fatalf("unexpected list: %+v", list)
	}

	ranges, err := svc.GetUnavailableDates(context.Background(), itemID)
	if err != nil {
		t.Fatalf("GetUnavailableDates returned error: %v", err)
	}
	if ranges[0].StartDate != "2026-06-01" || ranges[0].EndDate != "2026-06-04" {
		t.Fatalf("unexpected ranges: %+v", ranges)
	}

	if err := svc.SyncAllAvailabilities(context.Background()); err != nil {
		t.Fatalf("SyncAllAvailabilities returned error: %v", err)
	}
	if !stub.syncedAll {
		t.Fatal("expected sync all to be called")
	}
}

func TestBookingServiceTransitionsAndRefunds(t *testing.T) {
	t.Parallel()

	renterID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	ownerID := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	itemID := uuid.MustParse("33333333-3333-3333-3333-333333333333")
	bookingID := uuid.MustParse("44444444-4444-4444-4444-444444444444")
	refunder := &refunderStub{}
	stub := &bookingQuerierStub{
		item:        sqlcdb.GetItemByIDRow{ItemID: itemID, OwnerID: ownerID, ItemStatus: sqlcdb.ItemStatusRented},
		booking:     sampleBookingDetail(bookingID, itemID, renterID, ownerID, sqlcdb.BookingStatusPending, time.Now().Add(24*time.Hour)),
		row:         sampleBookingRow(bookingID, itemID, renterID, sqlcdb.BookingStatusPending),
		activeCount: 0,
	}
	svc := NewBookingService(stub, refunder)

	accepted, err := svc.Accept(context.Background(), ownerID, bookingID)
	if err != nil {
		t.Fatalf("Accept returned error: %v", err)
	}
	if accepted.BookingStatus != string(sqlcdb.BookingStatusAccepted) || stub.rentalCreatedFor != bookingID {
		t.Fatalf("unexpected accept response: %+v rental=%s", accepted, stub.rentalCreatedFor)
	}
	if stub.updateItemStatusArg.ItemStatus != sqlcdb.ItemStatusAvailable {
		t.Fatalf("expected available restore, got %+v", stub.updateItemStatusArg)
	}

	stub.booking.BookingStatus = sqlcdb.BookingStatusPending
	stub.booking.PaymentIntentID = pgtype.Text{String: "pi_refund", Valid: true}
	rejected, err := svc.Reject(context.Background(), ownerID, bookingID)
	if err != nil {
		t.Fatalf("Reject returned error: %v", err)
	}
	if rejected.BookingStatus != string(sqlcdb.BookingStatusRejected) || len(refunder.refunded) != 1 || refunder.refunded[0] != "pi_refund" {
		t.Fatalf("unexpected reject/refund: %+v refunds=%+v", rejected, refunder.refunded)
	}

	refunder.err = errors.New("stripe down")
	if _, err := svc.Cancel(context.Background(), renterID, bookingID); err == nil {
		t.Fatal("expected refund failure to abort cancel")
	}
}

func TestBookingServiceTransitionValidationAndMaintenance(t *testing.T) {
	t.Parallel()

	renterID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	ownerID := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	itemID := uuid.MustParse("33333333-3333-3333-3333-333333333333")
	bookingID := uuid.MustParse("44444444-4444-4444-4444-444444444444")
	stub := &bookingQuerierStub{
		item:            sqlcdb.GetItemByIDRow{ItemID: itemID, OwnerID: ownerID, ItemStatus: sqlcdb.ItemStatusAvailable},
		booking:         sampleBookingDetail(bookingID, itemID, renterID, ownerID, sqlcdb.BookingStatusAccepted, time.Now().Add(24*time.Hour)),
		row:             sampleBookingRow(bookingID, itemID, renterID, sqlcdb.BookingStatusAccepted),
		expiredRows:     []sqlcdb.ExpiredBookingRow{{BookingID: bookingID, PaymentIntentID: pgtype.Text{String: "pi_old", Valid: true}}},
		autoCompleteIDs: []uuid.UUID{bookingID},
	}
	refunder := &refunderStub{}
	svc := NewBookingService(stub, refunder)

	if _, err := svc.Complete(context.Background(), renterID, bookingID); !errors.Is(err, ErrBookingNotEnded) {
		t.Fatalf("expected booking not ended, got %v", err)
	}
	if _, err := svc.Accept(context.Background(), renterID, bookingID); !errors.Is(err, ErrBookingClosed) {
		t.Fatalf("expected closed accepted booking, got %v", err)
	}

	stub.getBookingErr = pgx.ErrNoRows
	if _, err := svc.Accept(context.Background(), ownerID, bookingID); !errors.Is(err, ErrBookingNotFound) {
		t.Fatalf("expected booking not found, got %v", err)
	}
	stub.getBookingErr = nil

	if err := svc.ExpireOldBookings(context.Background()); err != nil {
		t.Fatalf("ExpireOldBookings returned error: %v", err)
	}
	if len(refunder.refunded) != 1 || refunder.refunded[0] != "pi_old" {
		t.Fatalf("unexpected expired refunds: %+v", refunder.refunded)
	}
	if err := svc.AutoCompleteExpiredBookings(context.Background()); err != nil {
		t.Fatalf("AutoCompleteExpiredBookings returned error: %v", err)
	}
	if stub.updateStatusArg.Status != sqlcdb.BookingStatusCompleted {
		t.Fatalf("expected completed auto status, got %+v", stub.updateStatusArg)
	}
}

func sampleBookingRow(bookingID, itemID, renterID uuid.UUID, status sqlcdb.BookingStatus) sqlcdb.BookingRow {
	return sqlcdb.BookingRow{
		BookingID:     bookingID,
		ItemID:        pgtype.UUID{Bytes: itemID, Valid: true},
		RenterID:      renterID,
		StartDate:     time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC),
		EndDate:       time.Date(2026, 6, 3, 0, 0, 0, 0, time.UTC),
		RequestedAt:   pgtype.Timestamptz{Time: time.Date(2026, 5, 30, 12, 0, 0, 0, time.UTC), Valid: true},
		BookingStatus: status,
	}
}

func sampleBookingDetail(bookingID, itemID, renterID, ownerID uuid.UUID, status sqlcdb.BookingStatus, endDate time.Time) sqlcdb.BookingDetailRow {
	return sqlcdb.BookingDetailRow{
		BookingID:                bookingID,
		ItemID:                   pgtype.UUID{Bytes: itemID, Valid: true},
		ItemTitle:                "Taladro",
		RenterID:                 renterID,
		RenterFirstName:          "Laura",
		RenterLastName:           "Garcia",
		RenterVerificationStatus: sqlcdb.VerificationStatus("unverified"),
		OwnerID:                  pgtype.UUID{Bytes: ownerID, Valid: true},
		StartDate:                time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC),
		EndDate:                  endDate,
		RequestedAt:              pgtype.Timestamptz{Time: time.Date(2026, 5, 30, 12, 0, 0, 0, time.UTC), Valid: true},
		BookingStatus:            status,
		PaymentIntentID:          pgtype.Text{String: "pi_123", Valid: true},
		TotalCount:               1,
	}
}

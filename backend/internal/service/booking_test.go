package service

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/isw2-unileon/MeRenta/backend/internal/sqlcdb"
)

func TestParseBookingDates(t *testing.T) {
	t.Parallel()

	start, end, err := parseBookingDates("2026-06-01", "2026-06-04")
	if err != nil {
		t.Fatalf("parseBookingDates returned error: %v", err)
	}
	if got := start.Format(bookingDateLayout); got != "2026-06-01" {
		t.Fatalf("start = %s", got)
	}
	if got := end.Format(bookingDateLayout); got != "2026-06-04" {
		t.Fatalf("end = %s", got)
	}
}

func TestParseBookingDatesRejectsInvalidInput(t *testing.T) {
	t.Parallel()

	if _, _, err := parseBookingDates("01/06/2026", "2026-06-04"); err == nil {
		t.Fatal("expected invalid start date error")
	}
	if _, _, err := parseBookingDates("2026-06-01", "bad"); err == nil {
		t.Fatal("expected invalid end date error")
	}
}

func TestBookingPaginationHelpers(t *testing.T) {
	t.Parallel()

	if got := normaliseBookingLimit(0); got != defaultBookingLimit {
		t.Fatalf("normaliseBookingLimit(0) = %d", got)
	}
	if got := normaliseBookingLimit(7); got != 7 {
		t.Fatalf("normaliseBookingLimit(7) = %d", got)
	}
	if got := bookingPageOffset(-3, 20); got != 0 {
		t.Fatalf("bookingPageOffset(-3, 20) = %d", got)
	}
	if got := bookingPageOffset(3, 20); got != 40 {
		t.Fatalf("bookingPageOffset(3, 20) = %d", got)
	}
}

func TestNullableUUIDString(t *testing.T) {
	t.Parallel()

	id := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	if got := nullableUUIDString(pgtype.UUID{}); got != "" {
		t.Fatalf("invalid UUID rendered as %q", got)
	}
	if got := nullableUUIDString(pgtype.UUID{Bytes: id, Valid: true}); got != id.String() {
		t.Fatalf("valid UUID rendered as %q", got)
	}
}

func TestBookingRowToResponseAllowsDeletedItem(t *testing.T) {
	t.Parallel()

	bookingID := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	renterID := uuid.MustParse("33333333-3333-3333-3333-333333333333")
	requestedAt := time.Date(2026, 6, 1, 10, 0, 0, 0, time.UTC)

	resp, err := bookingRowToResponse(sqlcdb.BookingRow{
		BookingID:     bookingID,
		ItemID:        pgtype.UUID{},
		RenterID:      renterID,
		StartDate:     time.Date(2026, 6, 2, 0, 0, 0, 0, time.UTC),
		EndDate:       time.Date(2026, 6, 3, 0, 0, 0, 0, time.UTC),
		RequestedAt:   pgtype.Timestamptz{Time: requestedAt, Valid: true},
		BookingStatus: sqlcdb.BookingStatusPending,
	})
	if err != nil {
		t.Fatalf("bookingRowToResponse returned error: %v", err)
	}
	if resp.ItemID != "" {
		t.Fatalf("deleted item should render empty item id, got %q", resp.ItemID)
	}
	if resp.BookingID != bookingID.String() || resp.RenterID != renterID.String() {
		t.Fatalf("unexpected ids in response: %+v", resp)
	}
}

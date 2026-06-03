package sqlcdb

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// ── Types ─────────────────────────────────────────────────────────────────────

// RentalStatus mirrors the public.rental_status enum in the database.
type RentalStatus string

const (
	// RentalStatusOngoing means the rental is currently active.
	RentalStatusOngoing RentalStatus = "ongoing"
	// RentalStatusCompleted means the rental ended with the item returned.
	RentalStatusCompleted RentalStatus = "completed"
	// RentalStatusDisputed means an open incident is blocking the rental.
	RentalStatusDisputed RentalStatus = "disputed"
)

// Scan implements the Scanner interface for RentalStatus.
func (e *RentalStatus) Scan(src interface{}) error {
	switch s := src.(type) {
	case []byte:
		*e = RentalStatus(s)
	case string:
		*e = RentalStatus(s)
	default:
		return fmt.Errorf("unsupported scan type for RentalStatus: %T", src)
	}
	return nil
}

// RentalRow is a full row from the rental table.
type RentalRow struct {
	RentalID         uuid.UUID
	BookingID        uuid.UUID
	RentalStatus     RentalStatus
	ActualStartDate  pgtype.Date
	ActualEndDate    pgtype.Date
	ActualReturnDate pgtype.Date
	FinalAmount      pgtype.Numeric
	LateReturnFee    pgtype.Numeric
}

// ── Queries ───────────────────────────────────────────────────────────────────

// GetOrCreateRentalForBooking returns the rental_id linked to bookingID,
// creating a minimal rental record (status='ongoing') if none exists yet.
// The INSERT uses only booking_id; all other columns carry their DB defaults.
func (q *Queries) GetOrCreateRentalForBooking(ctx context.Context, bookingID uuid.UUID) (uuid.UUID, error) {
	// Fast-path: read existing rental without acquiring a write-lock.
	existing, err := q.getRentalIDByBookingID(ctx, bookingID)
	if err == nil {
		return existing, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return uuid.UUID{}, err
	}

	// INSERT, ignoring the conflict if another goroutine beat us.
	const insert = `
INSERT INTO rental (booking_id)
VALUES ($1)
ON CONFLICT (booking_id) DO NOTHING
RETURNING rental_id
`
	var id uuid.UUID
	err = q.db.QueryRow(ctx, insert, bookingID).Scan(&id)
	if err == nil {
		return id, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return uuid.UUID{}, err
	}

	// Another goroutine inserted first; read back the existing row.
	return q.getRentalIDByBookingID(ctx, bookingID)
}

// GetRentalIDForBooking returns the rental_id for a booking, or pgx.ErrNoRows.
func (q *Queries) GetRentalIDForBooking(ctx context.Context, bookingID uuid.UUID) (uuid.UUID, error) {
	return q.getRentalIDByBookingID(ctx, bookingID)
}

// GetRentalByBookingID returns the full rental row for a booking.
func (q *Queries) GetRentalByBookingID(ctx context.Context, bookingID uuid.UUID) (RentalRow, error) {
	const sel = `
SELECT rental_id, booking_id, rental_status,
       actual_start_date, actual_end_date, actual_return_date,
       final_amount, late_return_fee
FROM rental
WHERE booking_id = $1
LIMIT 1
`
	row := q.db.QueryRow(ctx, sel, bookingID)
	return scanRentalRow(row)
}

// ── Private helpers ───────────────────────────────────────────────────────────

func (q *Queries) getRentalIDByBookingID(ctx context.Context, bookingID uuid.UUID) (uuid.UUID, error) {
	const sel = `SELECT rental_id FROM rental WHERE booking_id = $1 LIMIT 1`
	var id uuid.UUID
	err := q.db.QueryRow(ctx, sel, bookingID).Scan(&id)
	return id, err
}

func scanRentalRow(row pgx.Row) (RentalRow, error) {
	var r RentalRow
	err := row.Scan(
		&r.RentalID,
		&r.BookingID,
		&r.RentalStatus,
		&r.ActualStartDate,
		&r.ActualEndDate,
		&r.ActualReturnDate,
		&r.FinalAmount,
		&r.LateReturnFee,
	)
	return r, err
}

// NullableDate converts a pgtype.Date to a *time.Time for JSON serialisation.
func NullableDate(d pgtype.Date) *time.Time {
	if !d.Valid {
		return nil
	}
	t := d.Time
	return &t
}

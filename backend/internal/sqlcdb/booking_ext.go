package sqlcdb

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

// BookingStatus represents the lifecycle state of a booking.
type BookingStatus string

const (
	// BookingStatusPending is the initial state — awaiting owner approval.
	BookingStatusPending BookingStatus = "pending"
	// BookingStatusAccepted means the owner has approved the booking.
	BookingStatusAccepted BookingStatus = "accepted"
	// BookingStatusRejected means the owner declined the booking.
	BookingStatusRejected BookingStatus = "rejected"
	// BookingStatusCancelled means the booking was cancelled (by renter or auto-expired).
	BookingStatusCancelled BookingStatus = "cancelled"
	// BookingStatusCompleted means the rental period ended successfully.
	BookingStatusCompleted BookingStatus = "completed"
)

// Scan implements the Scanner interface for BookingStatus.
func (e *BookingStatus) Scan(src interface{}) error {
	switch s := src.(type) {
	case []byte:
		*e = BookingStatus(s)
	case string:
		*e = BookingStatus(s)
	default:
		return fmt.Errorf("unsupported scan type for BookingStatus: %T", src)
	}
	return nil
}

// ─── Row types ────────────────────────────────────────────────────────────────

// CreateBookingParams holds all fields required to insert a new booking.
type CreateBookingParams struct {
	ItemID          uuid.UUID          `json:"item_id"`
	RenterID        uuid.UUID          `json:"renter_id"`
	StartDate       time.Time          `json:"start_date"`
	EndDate         time.Time          `json:"end_date"`
	EstimatedTotal  pgtype.Numeric     `json:"estimated_total"`
	Notes           pgtype.Text        `json:"notes"`
	PaymentIntentID pgtype.Text        `json:"payment_intent_id"`
	ExpiresAt       pgtype.Timestamptz `json:"expires_at"`
}

// BookingRow is a raw row from the booking table.
type BookingRow struct {
	BookingID       uuid.UUID          `json:"booking_id"`
	ItemID          uuid.UUID          `json:"item_id"`
	RenterID        uuid.UUID          `json:"renter_id"`
	StartDate       time.Time          `json:"start_date"`
	EndDate         time.Time          `json:"end_date"`
	RequestedAt     pgtype.Timestamptz `json:"requested_at"`
	BookingStatus   BookingStatus      `json:"booking_status"`
	EstimatedTotal  pgtype.Numeric     `json:"estimated_total"`
	Notes           pgtype.Text        `json:"notes"`
	PaymentIntentID pgtype.Text        `json:"payment_intent_id"`
	ExpiresAt       pgtype.Timestamptz `json:"expires_at"`
}

// BookingDetailRow is a booking joined with item and renter display data.
type BookingDetailRow struct {
	BookingID       uuid.UUID          `json:"booking_id"`
	ItemID          uuid.UUID          `json:"item_id"`
	ItemTitle       string             `json:"item_title"`
	ItemImageURL    string             `json:"item_image_url"`
	RenterID        uuid.UUID          `json:"renter_id"`
	RenterFirstName string             `json:"renter_first_name"`
	RenterLastName  string             `json:"renter_last_name"`
	OwnerID         uuid.UUID          `json:"owner_id"`
	StartDate       time.Time          `json:"start_date"`
	EndDate         time.Time          `json:"end_date"`
	RequestedAt     pgtype.Timestamptz `json:"requested_at"`
	BookingStatus   BookingStatus      `json:"booking_status"`
	EstimatedTotal  pgtype.Numeric     `json:"estimated_total"`
	Notes           pgtype.Text        `json:"notes"`
	PaymentIntentID pgtype.Text        `json:"payment_intent_id"`
	ExpiresAt       pgtype.Timestamptz `json:"expires_at"`
	TotalCount      int64              `json:"total_count"`
}

// BookingDateRange is a booked date interval for an item.
type BookingDateRange struct {
	StartDate time.Time `json:"start_date"`
	EndDate   time.Time `json:"end_date"`
}

// ExpiredBookingRow carries the minimal data needed to auto-cancel a booking.
type ExpiredBookingRow struct {
	BookingID       uuid.UUID   `json:"booking_id"`
	PaymentIntentID pgtype.Text `json:"payment_intent_id"`
}

// ListBookingsParams defines the anchor ID and pagination for booking list queries.
type ListBookingsParams struct {
	ID     uuid.UUID `json:"id"`
	Limit  int       `json:"limit"`
	Offset int       `json:"offset"`
}

// UpdateBookingStatusParams holds the fields needed to change a booking's status.
type UpdateBookingStatusParams struct {
	BookingID uuid.UUID     `json:"booking_id"`
	Status    BookingStatus `json:"status"`
}

// ─── SQL ─────────────────────────────────────────────────────────────────────

const createBooking = `
INSERT INTO booking (item_id, renter_id, start_date, end_date, estimated_total, notes,
                     payment_intent_id, expires_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING booking_id, item_id, renter_id, start_date, end_date,
          requested_at, booking_status, estimated_total, notes,
          payment_intent_id, expires_at
`

const getBookingByID = `
SELECT
    b.booking_id,
    b.item_id,
    i.title                            AS item_title,
    COALESCE(img.image_url, '')        AS item_image_url,
    b.renter_id,
    c.first_name                       AS renter_first_name,
    c.last_name                        AS renter_last_name,
    i.owner_id,
    b.start_date,
    b.end_date,
    b.requested_at,
    b.booking_status,
    b.estimated_total,
    b.notes,
    b.payment_intent_id,
    b.expires_at,
    0::bigint                          AS total_count
FROM booking  b
JOIN item     i ON i.item_id     = b.item_id
JOIN customer c ON c.customer_id = b.renter_id
LEFT JOIN LATERAL (
    SELECT image_url FROM item_image
    WHERE item_id = i.item_id
    ORDER BY display_order, image_id
    LIMIT 1
) img ON true
WHERE b.booking_id = $1
`

const listBookingsByRenter = `
SELECT
    b.booking_id,
    b.item_id,
    i.title                            AS item_title,
    COALESCE(img.image_url, '')        AS item_image_url,
    b.renter_id,
    c.first_name                       AS renter_first_name,
    c.last_name                        AS renter_last_name,
    i.owner_id,
    b.start_date,
    b.end_date,
    b.requested_at,
    b.booking_status,
    b.estimated_total,
    b.notes,
    b.payment_intent_id,
    b.expires_at,
    COUNT(*) OVER()                    AS total_count
FROM booking  b
JOIN item     i ON i.item_id     = b.item_id
JOIN customer c ON c.customer_id = b.renter_id
LEFT JOIN LATERAL (
    SELECT image_url FROM item_image
    WHERE item_id = i.item_id
    ORDER BY display_order, image_id
    LIMIT 1
) img ON true
WHERE b.renter_id = $1
ORDER BY b.requested_at DESC
LIMIT $2 OFFSET $3
`

const listBookingsByOwner = `
SELECT
    b.booking_id,
    b.item_id,
    i.title                            AS item_title,
    COALESCE(img.image_url, '')        AS item_image_url,
    b.renter_id,
    c.first_name                       AS renter_first_name,
    c.last_name                        AS renter_last_name,
    i.owner_id,
    b.start_date,
    b.end_date,
    b.requested_at,
    b.booking_status,
    b.estimated_total,
    b.notes,
    b.payment_intent_id,
    b.expires_at,
    COUNT(*) OVER()                    AS total_count
FROM booking  b
JOIN item     i ON i.item_id     = b.item_id
JOIN customer c ON c.customer_id = b.renter_id
LEFT JOIN LATERAL (
    SELECT image_url FROM item_image
    WHERE item_id = i.item_id
    ORDER BY display_order, image_id
    LIMIT 1
) img ON true
WHERE i.owner_id = $1
ORDER BY b.requested_at DESC
LIMIT $2 OFFSET $3
`

const updateBookingStatus = `
UPDATE booking
SET    booking_status = $2
WHERE  booking_id = $1
RETURNING booking_id, item_id, renter_id, start_date, end_date,
          requested_at, booking_status, estimated_total, notes,
          payment_intent_id, expires_at
`

const getItemBookedRanges = `
SELECT start_date, end_date
FROM booking
WHERE item_id = $1
  AND booking_status IN ('pending', 'accepted')
`

const listExpiredPendingBookings = `
SELECT booking_id, payment_intent_id
FROM booking
WHERE booking_status = 'pending'
  AND expires_at IS NOT NULL
  AND expires_at < NOW()
`

const countActiveBookingsForItem = `
SELECT COUNT(*)
FROM booking
WHERE item_id = $1
  AND booking_status IN ('pending', 'accepted')
`

// syncAllItemAvailabilities reconciles is_available and item_status for every
// item that has at least one booking. Items with no bookings are untouched.
// Only transitions to/from 'rented' are performed; 'withdrawn'/'under_review'
// statuses are preserved when no active booking is present.
const syncAllItemAvailabilities = `
UPDATE item
SET
    is_available = CASE
        WHEN EXISTS (
            SELECT 1 FROM booking b
            WHERE b.item_id = item.item_id
              AND b.booking_status IN ('pending', 'accepted')
        ) THEN false
        WHEN item_status = 'rented' THEN true
        ELSE is_available
    END,
    item_status = CASE
        WHEN EXISTS (
            SELECT 1 FROM booking b
            WHERE b.item_id = item.item_id
              AND b.booking_status IN ('pending', 'accepted')
        ) THEN 'rented'::item_status
        WHEN item_status = 'rented' THEN 'available'::item_status
        ELSE item_status
    END
WHERE EXISTS (
    SELECT 1 FROM booking b2 WHERE b2.item_id = item.item_id
)
`

// ─── Methods ─────────────────────────────────────────────────────────────────

// CreateBooking inserts a new booking record and returns the created row.
func (q *Queries) CreateBooking(ctx context.Context, arg CreateBookingParams) (BookingRow, error) {
	row := q.db.QueryRow(ctx, createBooking,
		arg.ItemID, arg.RenterID,
		arg.StartDate, arg.EndDate,
		arg.EstimatedTotal, arg.Notes,
		arg.PaymentIntentID, arg.ExpiresAt,
	)
	return scanBookingRow(row)
}

// GetBookingByID fetches a single booking with joined item and renter data.
func (q *Queries) GetBookingByID(ctx context.Context, bookingID uuid.UUID) (BookingDetailRow, error) {
	return scanBookingDetailRow(q.db.QueryRow(ctx, getBookingByID, bookingID))
}

// ListBookingsByRenter returns paginated bookings where the customer is the renter.
func (q *Queries) ListBookingsByRenter(ctx context.Context, arg ListBookingsParams) ([]BookingDetailRow, error) {
	rows, err := q.db.Query(ctx, listBookingsByRenter, arg.ID, arg.Limit, arg.Offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return collectBookingDetailRows(rows)
}

// ListBookingsByOwner returns paginated bookings for items owned by the customer.
func (q *Queries) ListBookingsByOwner(ctx context.Context, arg ListBookingsParams) ([]BookingDetailRow, error) {
	rows, err := q.db.Query(ctx, listBookingsByOwner, arg.ID, arg.Limit, arg.Offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return collectBookingDetailRows(rows)
}

// UpdateBookingStatus changes the status of a booking and returns the updated row.
func (q *Queries) UpdateBookingStatus(ctx context.Context, arg UpdateBookingStatusParams) (BookingRow, error) {
	row := q.db.QueryRow(ctx, updateBookingStatus, arg.BookingID, arg.Status)
	return scanBookingRow(row)
}

// GetItemBookedRanges returns active date ranges for an item (pending + accepted bookings).
func (q *Queries) GetItemBookedRanges(ctx context.Context, itemID uuid.UUID) ([]BookingDateRange, error) {
	rows, err := q.db.Query(ctx, getItemBookedRanges, itemID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (BookingDateRange, error) {
		var r BookingDateRange
		return r, row.Scan(&r.StartDate, &r.EndDate)
	})
}

// ListExpiredPendingBookings returns pending bookings whose 5-day window has passed.
func (q *Queries) ListExpiredPendingBookings(ctx context.Context) ([]ExpiredBookingRow, error) {
	rows, err := q.db.Query(ctx, listExpiredPendingBookings)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (ExpiredBookingRow, error) {
		var r ExpiredBookingRow
		return r, row.Scan(&r.BookingID, &r.PaymentIntentID)
	})
}

// CountActiveBookingsForItem returns the number of pending/accepted bookings for an item.
func (q *Queries) CountActiveBookingsForItem(ctx context.Context, itemID uuid.UUID) (int64, error) {
	row := q.db.QueryRow(ctx, countActiveBookingsForItem, itemID)
	var count int64
	return count, row.Scan(&count)
}

// SyncAllItemAvailabilities reconciles is_available and item_status for all
// items that have booking history, based on their current active bookings.
func (q *Queries) SyncAllItemAvailabilities(ctx context.Context) error {
	_, err := q.db.Exec(ctx, syncAllItemAvailabilities)
	return err
}

// ─── Private helpers ──────────────────────────────────────────────────────────

func scanBookingRow(row pgx.Row) (BookingRow, error) {
	var b BookingRow
	err := row.Scan(
		&b.BookingID, &b.ItemID, &b.RenterID,
		&b.StartDate, &b.EndDate, &b.RequestedAt,
		&b.BookingStatus, &b.EstimatedTotal, &b.Notes,
		&b.PaymentIntentID, &b.ExpiresAt,
	)
	return b, err
}

func scanBookingDetailRow(row pgx.Row) (BookingDetailRow, error) {
	var b BookingDetailRow
	err := row.Scan(
		&b.BookingID, &b.ItemID, &b.ItemTitle, &b.ItemImageURL,
		&b.RenterID, &b.RenterFirstName, &b.RenterLastName, &b.OwnerID,
		&b.StartDate, &b.EndDate, &b.RequestedAt, &b.BookingStatus,
		&b.EstimatedTotal, &b.Notes, &b.PaymentIntentID, &b.ExpiresAt,
		&b.TotalCount,
	)
	return b, err
}

func collectBookingDetailRows(rows pgx.Rows) ([]BookingDetailRow, error) {
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (BookingDetailRow, error) {
		var b BookingDetailRow
		err := row.Scan(
			&b.BookingID, &b.ItemID, &b.ItemTitle, &b.ItemImageURL,
			&b.RenterID, &b.RenterFirstName, &b.RenterLastName, &b.OwnerID,
			&b.StartDate, &b.EndDate, &b.RequestedAt, &b.BookingStatus,
			&b.EstimatedTotal, &b.Notes, &b.PaymentIntentID, &b.ExpiresAt,
			&b.TotalCount,
		)
		return b, err
	})
}

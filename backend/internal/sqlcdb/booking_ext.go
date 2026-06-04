package sqlcdb

import (
	"context"
	"fmt"
	"strings"
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
	// BookingStatusCancelled means the booking was canceled (by renter or auto-expired).
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
	BookingID                uuid.UUID          `json:"booking_id"`
	ItemID                   uuid.UUID          `json:"item_id"`
	ItemTitle                string             `json:"item_title"`
	ItemImageURL             string             `json:"item_image_url"`
	RenterID                 uuid.UUID          `json:"renter_id"`
	RenterFirstName          string             `json:"renter_first_name"`
	RenterLastName           string             `json:"renter_last_name"`
	RenterVerificationStatus VerificationStatus `json:"renter_verification_status"`
	OwnerID                  uuid.UUID          `json:"owner_id"`
	StartDate                time.Time          `json:"start_date"`
	EndDate                  time.Time          `json:"end_date"`
	RequestedAt              pgtype.Timestamptz `json:"requested_at"`
	BookingStatus            BookingStatus      `json:"booking_status"`
	EstimatedTotal           pgtype.Numeric     `json:"estimated_total"`
	Notes                    pgtype.Text        `json:"notes"`
	PaymentIntentID          pgtype.Text        `json:"payment_intent_id"`
	ExpiresAt                pgtype.Timestamptz `json:"expires_at"`
	TotalCount               int64              `json:"total_count"`
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

// AdminListBookingsParams holds all optional filters and pagination for the
// admin booking list. Zero-value fields mean "no filter / default".
type AdminListBookingsParams struct {
	Status string `json:"status"` // "" = all statuses
	Query  string `json:"query"`  // "" = no search; matches title, first/last name
	Sort   string `json:"sort"`   // "recent"|"oldest"|"amount_desc"|"amount_asc"
	Limit  int    `json:"limit"`
	Offset int    `json:"offset"`
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
    c.verification_status              AS renter_verification_status,
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
    c.verification_status              AS renter_verification_status,
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
    c.verification_status              AS renter_verification_status,
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
  AND start_date <= NOW()
  AND end_date >= NOW()
`

// syncAllItemAvailabilities reconciles is_available and item_status for every
// item that has at least one booking. Items with no bookings are untouched.
// Only transitions to/from 'rented' are performed; 'withdrawn'/'under_review'
// statuses are preserved when no active booking is present.
// Only bookings whose date range overlaps with NOW() are considered active.
const syncAllItemAvailabilities = `
UPDATE item
SET
    is_available = CASE
        WHEN EXISTS (
            SELECT 1 FROM booking b
            WHERE b.item_id = item.item_id
              AND b.booking_status IN ('pending', 'accepted')
              AND b.start_date <= NOW()
              AND b.end_date >= NOW()
        ) THEN false
        WHEN item_status = 'rented' THEN true
        ELSE is_available
    END,
    item_status = CASE
        WHEN EXISTS (
            SELECT 1 FROM booking b
            WHERE b.item_id = item.item_id
              AND b.booking_status IN ('pending', 'accepted')
              AND b.start_date <= NOW()
              AND b.end_date >= NOW()
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
	var b BookingDetailRow
	err := q.db.QueryRow(ctx, getBookingByID, bookingID).Scan(
		&b.BookingID, &b.ItemID, &b.ItemTitle, &b.ItemImageURL,
		&b.RenterID, &b.RenterFirstName, &b.RenterLastName, &b.RenterVerificationStatus, &b.OwnerID,
		&b.StartDate, &b.EndDate, &b.RequestedAt, &b.BookingStatus,
		&b.EstimatedTotal, &b.Notes, &b.PaymentIntentID, &b.ExpiresAt,
		&b.TotalCount,
	)
	return b, err
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

func collectBookingDetailRows(rows pgx.Rows) ([]BookingDetailRow, error) {
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (BookingDetailRow, error) {
		var b BookingDetailRow
		err := row.Scan(
			&b.BookingID, &b.ItemID, &b.ItemTitle, &b.ItemImageURL,
			&b.RenterID, &b.RenterFirstName, &b.RenterLastName, &b.RenterVerificationStatus, &b.OwnerID,
			&b.StartDate, &b.EndDate, &b.RequestedAt, &b.BookingStatus,
			&b.EstimatedTotal, &b.Notes, &b.PaymentIntentID, &b.ExpiresAt,
			&b.TotalCount,
		)
		return b, err
	})
}

// ─── Admin payments queries ───────────────────────────────────────────────────

// AdminListPaymentsParams filters paginated payment records for admin use.
// PaymentStatus: "" = all, "paid" = charged, "refunded" = canceled/rejected.
type AdminListPaymentsParams struct {
	PaymentStatus string `json:"payment_status"`
	Query         string `json:"query"` // product title or renter name
	Limit         int    `json:"limit"`
	Offset        int    `json:"offset"`
}

// buildAdminPaymentsSQL constructs the payments query from params.
// Hard-coded IN clauses are used for payment status; no user data in SQL structure.
func buildAdminPaymentsSQL(arg AdminListPaymentsParams) (string, []interface{}) {
	sql := bookingListSelect + "WHERE b.payment_intent_id IS NOT NULL\n"
	var args []interface{}
	n := 1

	switch arg.PaymentStatus {
	case "paid":
		sql += "  AND b.booking_status NOT IN ('cancelled', 'rejected')\n"
	case "refunded":
		sql += "  AND b.booking_status IN ('cancelled', 'rejected')\n"
	}

	if arg.Query != "" {
		like := "%" + arg.Query + "%"
		sql += fmt.Sprintf(
			"  AND (i.title ILIKE $%d OR c.first_name ILIKE $%d OR c.last_name ILIKE $%d)\n", n, n, n,
		)
		args = append(args, like)
		n++
	}

	sql += "ORDER BY b.requested_at DESC\n"
	sql += fmt.Sprintf("LIMIT $%d OFFSET $%d", n, n+1)
	args = append(args, arg.Limit, arg.Offset)
	return sql, args
}

// AdminListPayments returns paginated payment records (bookings with a Stripe
// payment_intent_id) for the admin panel, with optional status and search filters.
func (q *Queries) AdminListPayments(ctx context.Context, arg AdminListPaymentsParams) ([]BookingDetailRow, error) {
	sql, args := buildAdminPaymentsSQL(arg)
	rows, err := q.db.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return collectBookingDetailRows(rows)
}

// ─── Monthly revenue query ────────────────────────────────────────────────────

// MonthlyRevenueRow holds aggregated revenue for a single calendar month.
type MonthlyRevenueRow struct {
	Month   time.Time      `json:"month"`
	Revenue pgtype.Numeric `json:"revenue"`
}

const monthlyRevenue = `
WITH months AS (
    SELECT generate_series(
        DATE_TRUNC('month', NOW()) - INTERVAL '5 months',
        DATE_TRUNC('month', NOW()),
        INTERVAL '1 month'
    ) AS month
)
SELECT
    m.month,
    COALESCE(SUM(b.estimated_total) FILTER (WHERE b.booking_status = 'completed'), 0) AS revenue
FROM months m
LEFT JOIN booking b ON DATE_TRUNC('month', b.requested_at) = m.month
GROUP BY m.month
ORDER BY m.month ASC
`

// GetMonthlyRevenue returns completed-booking revenue for the last 6 months,
// always returning one row per month (zero when no data).
func (q *Queries) GetMonthlyRevenue(ctx context.Context) ([]MonthlyRevenueRow, error) {
	rows, err := q.db.Query(ctx, monthlyRevenue)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (MonthlyRevenueRow, error) {
		var r MonthlyRevenueRow
		return r, row.Scan(&r.Month, &r.Revenue)
	})
}

// ─── Booking stats query ──────────────────────────────────────────────────────

// BookingStatsRow holds aggregate booking counts and total confirmed revenue.
type BookingStatsRow struct {
	Total        int64          `json:"total"`
	Pending      int64          `json:"pending"`
	Accepted     int64          `json:"accepted"`
	Completed    int64          `json:"completed"`
	Cancelled    int64          `json:"cancelled"`
	Rejected     int64          `json:"rejected"`
	TotalRevenue pgtype.Numeric `json:"total_revenue"`
}

const bookingStats = `
SELECT
    COUNT(*)                                                              AS total,
    COUNT(*) FILTER (WHERE booking_status = 'pending')                   AS pending,
    COUNT(*) FILTER (WHERE booking_status = 'accepted')                  AS accepted,
    COUNT(*) FILTER (WHERE booking_status = 'completed')                 AS completed,
    COUNT(*) FILTER (WHERE booking_status = 'cancelled')                 AS cancelled,
    COUNT(*) FILTER (WHERE booking_status = 'rejected')                  AS rejected,
    COALESCE(SUM(estimated_total) FILTER (WHERE booking_status = 'completed'), 0) AS total_revenue
FROM booking
`

// GetBookingStats returns a single row of aggregate booking counts and revenue.
func (q *Queries) GetBookingStats(ctx context.Context) (BookingStatsRow, error) {
	var r BookingStatsRow
	err := q.db.QueryRow(ctx, bookingStats).Scan(
		&r.Total, &r.Pending, &r.Accepted,
		&r.Completed, &r.Cancelled, &r.Rejected,
		&r.TotalRevenue,
	)
	return r, err
}

// ─── Auto-complete query ──────────────────────────────────────────────────────

const listAcceptedBookingsPastDeadline = `
SELECT booking_id
FROM booking
WHERE booking_status = 'accepted'
  AND end_date + INTERVAL '5 days' <= CURRENT_DATE
`

// ListAcceptedBookingsPastDeadline returns booking IDs for accepted bookings whose
// rental period ended 5 or more days ago and have not been completed yet.
func (q *Queries) ListAcceptedBookingsPastDeadline(ctx context.Context) ([]uuid.UUID, error) {
	rows, err := q.db.Query(ctx, listAcceptedBookingsPastDeadline)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (uuid.UUID, error) {
		var id uuid.UUID
		return id, row.Scan(&id)
	})
}

// ─── Admin booking queries ────────────────────────────────────────────────────

// bookingListSelect is the SELECT … FROM … JOIN base shared by all admin list queries.
const bookingListSelect = `
SELECT
    b.booking_id,
    b.item_id,
    i.title                            AS item_title,
    COALESCE(img.image_url, '')        AS item_image_url,
    b.renter_id,
    c.first_name                       AS renter_first_name,
    c.last_name                        AS renter_last_name,
    c.verification_status              AS renter_verification_status,
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
`

// adminBookingOrderBy maps the sort key to a safe ORDER BY fragment.
// Only hard-coded strings are returned — no user data is injected.
func adminBookingOrderBy(sort string) string {
	switch sort {
	case "oldest":
		return "b.requested_at ASC"
	case "amount_desc":
		return "b.estimated_total DESC NULLS LAST"
	case "amount_asc":
		return "b.estimated_total ASC NULLS FIRST"
	default:
		return "b.requested_at DESC"
	}
}

// buildAdminBookingsSQL constructs the full query and argument list from params.
// Status and query are parameterized; ORDER BY uses validated constant strings.
func buildAdminBookingsSQL(arg AdminListBookingsParams) (string, []interface{}) {
	var conds []string
	var args []interface{}
	n := 1

	if arg.Status != "" {
		conds = append(conds, fmt.Sprintf("b.booking_status = $%d", n))
		args = append(args, arg.Status)
		n++
	}
	if arg.Query != "" {
		like := "%" + arg.Query + "%"
		conds = append(conds, fmt.Sprintf(
			"(i.title ILIKE $%d OR c.first_name ILIKE $%d OR c.last_name ILIKE $%d)", n, n, n,
		))
		args = append(args, like)
		n++
	}

	sql := bookingListSelect
	if len(conds) > 0 {
		sql += "WHERE " + strings.Join(conds, " AND ") + "\n"
	}
	sql += "ORDER BY " + adminBookingOrderBy(arg.Sort) + "\n"
	sql += fmt.Sprintf("LIMIT $%d OFFSET $%d", n, n+1)
	args = append(args, arg.Limit, arg.Offset)
	return sql, args
}

// AdminListBookings returns bookings for the admin panel with optional status
// filter, full-text search and configurable sort order.
func (q *Queries) AdminListBookings(ctx context.Context, arg AdminListBookingsParams) ([]BookingDetailRow, error) {
	sql, args := buildAdminBookingsSQL(arg)
	rows, err := q.db.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return collectBookingDetailRows(rows)
}

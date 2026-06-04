// Package service contains business logic for the API.
package service

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
	"github.com/isw2-unileon/MeRenta/backend/internal/sqlcdb"
)

// Sentinel errors for the booking service.
var (
	// ErrBookingNotFound is returned when the requested booking does not exist.
	ErrBookingNotFound = errors.New("booking not found")
	// ErrBookingForbidden is returned when the user is not authorized to act on the booking.
	ErrBookingForbidden = errors.New("not authorised to modify this booking")
	// ErrBookingClosed is returned when the booking status does not allow the requested transition.
	ErrBookingClosed = errors.New("booking cannot be modified in its current state")
	// ErrCannotBookOwnItem is returned when a user tries to book their own listing.
	ErrCannotBookOwnItem = errors.New("cannot book your own item")
	// ErrBookingNotEnded is returned when a completion is attempted before the rental period ends.
	ErrBookingNotEnded = errors.New("booking period has not ended yet")
)

const (
	bookingDateLayout   = "2006-01-02"
	defaultBookingLimit = 20
	bookingExpiryDays   = 5
)

// PaymentRefunder issues refunds for paid bookings.
type PaymentRefunder interface {
	RefundPayment(ctx context.Context, paymentIntentID string) error
}

// bookingQuerier is the minimal DB interface needed by BookingService.
type bookingQuerier interface {
	CreateBooking(ctx context.Context, arg sqlcdb.CreateBookingParams) (sqlcdb.BookingRow, error)
	GetBookingByID(ctx context.Context, bookingID uuid.UUID) (sqlcdb.BookingDetailRow, error)
	ListBookingsByRenter(ctx context.Context, arg sqlcdb.ListBookingsParams) ([]sqlcdb.BookingDetailRow, error)
	ListBookingsByOwner(ctx context.Context, arg sqlcdb.ListBookingsParams) ([]sqlcdb.BookingDetailRow, error)
	UpdateBookingStatus(ctx context.Context, arg sqlcdb.UpdateBookingStatusParams) (sqlcdb.BookingRow, error)
	GetItemByID(ctx context.Context, itemID uuid.UUID) (sqlcdb.GetItemByIDRow, error)
	GetItemBookedRanges(ctx context.Context, itemID uuid.UUID) ([]sqlcdb.BookingDateRange, error)
	ListExpiredPendingBookings(ctx context.Context) ([]sqlcdb.ExpiredBookingRow, error)
	ListAcceptedBookingsPastDeadline(ctx context.Context) ([]uuid.UUID, error)
	CountActiveBookingsForItem(ctx context.Context, itemID uuid.UUID) (int64, error)
	UpdateItemAvailability(ctx context.Context, arg sqlcdb.UpdateItemAvailabilityParams) error
	UpdateItemStatus(ctx context.Context, arg sqlcdb.UpdateItemStatusParams) (sqlcdb.UpdateItemStatusRow, error)
	SyncAllItemAvailabilities(ctx context.Context) error
	// GetOrCreateRentalForBooking creates a rental record when a booking is accepted.
	GetOrCreateRentalForBooking(ctx context.Context, bookingID uuid.UUID) (uuid.UUID, error)
}

// BookingService handles business logic for bookings.
type BookingService struct {
	q        bookingQuerier
	refunder PaymentRefunder
}

// NewBookingService wires up a BookingService.
func NewBookingService(q bookingQuerier, refunder PaymentRefunder) *BookingService {
	return &BookingService{q: q, refunder: refunder}
}

// Create registers a new booking after a successful Stripe payment.
func (s *BookingService) Create(
	ctx context.Context,
	renterID uuid.UUID,
	req model.CreateBookingRequest,
) (model.BookingResponse, error) {
	itemID, err := uuid.Parse(req.ItemID)
	if err != nil {
		return model.BookingResponse{}, fmt.Errorf("invalid item_id: %w", err)
	}

	item, err := s.q.GetItemByID(ctx, itemID)
	if err != nil {
		return model.BookingResponse{}, fmt.Errorf("get item: %w", err)
	}
	if item.OwnerID == renterID {
		return model.BookingResponse{}, ErrCannotBookOwnItem
	}

	start, end, err := parseBookingDates(req.StartDate, req.EndDate)
	if err != nil {
		return model.BookingResponse{}, err
	}

	total, err := optionalFloat64ToNumeric(req.EstimatedTotal)
	if err != nil {
		return model.BookingResponse{}, fmt.Errorf("convert estimated_total: %w", err)
	}

	expiresAt := pgtype.Timestamptz{
		Time:  time.Now().UTC().Add(bookingExpiryDays * 24 * time.Hour),
		Valid: true,
	}

	row, err := s.q.CreateBooking(ctx, sqlcdb.CreateBookingParams{
		ItemID:          itemID,
		RenterID:        renterID,
		StartDate:       start,
		EndDate:         end,
		EstimatedTotal:  total,
		Notes:           pgtype.Text{String: req.Notes, Valid: req.Notes != ""},
		PaymentIntentID: pgtype.Text{String: req.PaymentIntentID, Valid: req.PaymentIntentID != ""},
		ExpiresAt:       expiresAt,
	})
	if err != nil {
		return model.BookingResponse{}, fmt.Errorf("create booking: %w", err)
	}

	// Mark item as unavailable as soon as the first booking is pending
	if syncErr := s.syncItemAvailability(ctx, itemID); syncErr != nil {
		slog.Warn("sync item availability failed", "item_id", itemID, "error", syncErr)
	}

	return bookingRowToResponse(row)
}

// ListMine returns paginated bookings where the caller is the renter.
func (s *BookingService) ListMine(
	ctx context.Context,
	renterID uuid.UUID,
	page, limit int,
) (model.BookingListResponse, error) {
	lim := normaliseBookingLimit(limit)
	rows, err := s.q.ListBookingsByRenter(ctx, sqlcdb.ListBookingsParams{
		ID: renterID, Limit: lim, Offset: bookingPageOffset(page, lim),
	})
	if err != nil {
		return model.BookingListResponse{}, fmt.Errorf("list bookings by renter: %w", err)
	}
	return buildBookingListResponse(rows)
}

// ListAsOwner returns paginated bookings for items owned by the caller.
func (s *BookingService) ListAsOwner(
	ctx context.Context,
	ownerID uuid.UUID,
	page, limit int,
) (model.BookingListResponse, error) {
	lim := normaliseBookingLimit(limit)
	rows, err := s.q.ListBookingsByOwner(ctx, sqlcdb.ListBookingsParams{
		ID: ownerID, Limit: lim, Offset: bookingPageOffset(page, lim),
	})
	if err != nil {
		return model.BookingListResponse{}, fmt.Errorf("list bookings by owner: %w", err)
	}
	return buildBookingListResponse(rows)
}

// GetUnavailableDates returns the booked date ranges for an item (pending + accepted).
func (s *BookingService) GetUnavailableDates(
	ctx context.Context,
	itemID uuid.UUID,
) ([]model.DateRangeResponse, error) {
	ranges, err := s.q.GetItemBookedRanges(ctx, itemID)
	if err != nil {
		return nil, fmt.Errorf("get booked ranges: %w", err)
	}
	result := make([]model.DateRangeResponse, len(ranges))
	for i, r := range ranges {
		result[i] = model.DateRangeResponse{
			StartDate: r.StartDate.Format(bookingDateLayout),
			EndDate:   r.EndDate.Format(bookingDateLayout),
		}
	}
	return result, nil
}

// Accept marks a booking as accepted. Only the item owner may do this.
func (s *BookingService) Accept(
	ctx context.Context,
	ownerID uuid.UUID,
	bookingID uuid.UUID,
) (model.BookingResponse, error) {
	return s.updateStatus(ctx, ownerID, bookingID, sqlcdb.BookingStatusAccepted, false,
		[]sqlcdb.BookingStatus{sqlcdb.BookingStatusPending})
}

// Reject marks a booking as rejected and refunds the renter.
func (s *BookingService) Reject(
	ctx context.Context,
	ownerID uuid.UUID,
	bookingID uuid.UUID,
) (model.BookingResponse, error) {
	return s.updateStatus(ctx, ownerID, bookingID, sqlcdb.BookingStatusRejected, false,
		[]sqlcdb.BookingStatus{sqlcdb.BookingStatusPending})
}

// Cancel marks a booking as canceled and refunds the renter.
func (s *BookingService) Cancel(
	ctx context.Context,
	renterID uuid.UUID,
	bookingID uuid.UUID,
) (model.BookingResponse, error) {
	return s.updateStatus(ctx, renterID, bookingID, sqlcdb.BookingStatusCancelled, true,
		[]sqlcdb.BookingStatus{sqlcdb.BookingStatusPending, sqlcdb.BookingStatusAccepted})
}

// Complete marks a booking as completed. Either the owner or the renter may call
// this, but only on or after the rental end date.
func (s *BookingService) Complete(
	ctx context.Context,
	userID uuid.UUID,
	bookingID uuid.UUID,
) (model.BookingResponse, error) {
	booking, err := s.q.GetBookingByID(ctx, bookingID)
	if errors.Is(err, pgx.ErrNoRows) {
		return model.BookingResponse{}, ErrBookingNotFound
	}
	if err != nil {
		return model.BookingResponse{}, fmt.Errorf("get booking: %w", err)
	}
	if !bookingStatusAllowed(booking.BookingStatus, []sqlcdb.BookingStatus{sqlcdb.BookingStatusAccepted}) {
		return model.BookingResponse{}, ErrBookingClosed
	}
	if booking.RenterID != userID && (!booking.OwnerID.Valid || uuid.UUID(booking.OwnerID.Bytes) != userID) {
		return model.BookingResponse{}, ErrBookingForbidden
	}

	// Allow completion only on or after the end date.
	today := time.Now().UTC().Truncate(24 * time.Hour)
	endDate := booking.EndDate.UTC().Truncate(24 * time.Hour)
	if today.Before(endDate) {
		return model.BookingResponse{}, ErrBookingNotEnded
	}

	row, err := s.q.UpdateBookingStatus(ctx, sqlcdb.UpdateBookingStatusParams{
		BookingID: bookingID,
		Status:    sqlcdb.BookingStatusCompleted,
	})
	if err != nil {
		return model.BookingResponse{}, fmt.Errorf("update booking status: %w", err)
	}

	if syncErr := s.syncItemAvailabilityIfPresent(ctx, row.ItemID); syncErr != nil {
		slog.Warn("sync item availability failed", "item_id", row.ItemID, "error", syncErr)
	}

	return bookingRowToResponse(row)
}

// ExpireOldBookings auto-cancels pending bookings that have passed their 5-day window.
// It issues a full Stripe refund for each expired booking and logs failures without stopping.
func (s *BookingService) ExpireOldBookings(ctx context.Context) error {
	rows, err := s.q.ListExpiredPendingBookings(ctx)
	if err != nil {
		return fmt.Errorf("list expired bookings: %w", err)
	}
	for _, row := range rows {
		if expErr := s.expireOne(ctx, row); expErr != nil {
			slog.Error("auto-expire booking failed", "booking_id", row.BookingID, "error", expErr)
		}
	}
	return nil
}

// AutoCompleteExpiredBookings marks accepted bookings as completed when the rental
// period ended 5 or more days ago and neither party completed it manually.
// Called by the hourly maintenance job alongside ExpireOldBookings.
func (s *BookingService) AutoCompleteExpiredBookings(ctx context.Context) error {
	ids, err := s.q.ListAcceptedBookingsPastDeadline(ctx)
	if err != nil {
		return fmt.Errorf("list accepted bookings past deadline: %w", err)
	}
	for _, id := range ids {
		updated, updateErr := s.q.UpdateBookingStatus(ctx, sqlcdb.UpdateBookingStatusParams{
			BookingID: id,
			Status:    sqlcdb.BookingStatusCompleted,
		})
		if updateErr != nil {
			slog.Error("auto-complete booking failed", "booking_id", id, "error", updateErr)
			continue
		}
		if syncErr := s.syncItemAvailabilityIfPresent(ctx, updated.ItemID); syncErr != nil {
			slog.Warn("sync item availability failed after auto-complete", "item_id", updated.ItemID, "error", syncErr)
		}
	}
	return nil
}

// ─── Private helpers ──────────────────────────────────────────────────────────

// updateStatus is the shared state-machine step for Accept, Reject, and Cancel.
func (s *BookingService) updateStatus(
	ctx context.Context,
	userID uuid.UUID,
	bookingID uuid.UUID,
	next sqlcdb.BookingStatus,
	renterAction bool,
	validFrom []sqlcdb.BookingStatus,
) (model.BookingResponse, error) {
	booking, err := s.q.GetBookingByID(ctx, bookingID)
	if errors.Is(err, pgx.ErrNoRows) {
		return model.BookingResponse{}, ErrBookingNotFound
	}
	if err != nil {
		return model.BookingResponse{}, fmt.Errorf("get booking: %w", err)
	}
	if !bookingStatusAllowed(booking.BookingStatus, validFrom) {
		return model.BookingResponse{}, ErrBookingClosed
	}
	if authErr := authoriseBookingTransition(booking, userID, renterAction); authErr != nil {
		return model.BookingResponse{}, authErr
	}
	if isRefundStatus(next) {
		if refErr := s.issueRefundIfPaid(ctx, booking.PaymentIntentID); refErr != nil {
			return model.BookingResponse{}, refErr
		}
	}

	row, err := s.q.UpdateBookingStatus(ctx, sqlcdb.UpdateBookingStatusParams{
		BookingID: bookingID,
		Status:    next,
	})
	if err != nil {
		return model.BookingResponse{}, fmt.Errorf("update booking status: %w", err)
	}

	// Create the rental record as soon as the booking is accepted.
	// Best-effort: a failure here does not roll back the status change.
	if next == sqlcdb.BookingStatusAccepted {
		if _, rentalErr := s.q.GetOrCreateRentalForBooking(ctx, bookingID); rentalErr != nil {
			slog.Warn("create rental on accept failed", "booking_id", bookingID, "error", rentalErr)
		}
	}

	// Best-effort: keep item availability in sync (non-fatal if it fails)
	if syncErr := s.syncItemAvailabilityIfPresent(ctx, row.ItemID); syncErr != nil {
		slog.Warn("sync item availability failed", "item_id", row.ItemID, "error", syncErr)
	}

	return bookingRowToResponse(row)
}

// expireOne issues a refund, cancels a single expired booking, and resync availability.
func (s *BookingService) expireOne(ctx context.Context, row sqlcdb.ExpiredBookingRow) error {
	if err := s.issueRefundIfPaid(ctx, row.PaymentIntentID); err != nil {
		return err
	}
	updated, err := s.q.UpdateBookingStatus(ctx, sqlcdb.UpdateBookingStatusParams{
		BookingID: row.BookingID,
		Status:    sqlcdb.BookingStatusCancelled,
	})
	if err != nil {
		return err
	}
	return s.syncItemAvailabilityIfPresent(ctx, updated.ItemID)
}

// SyncAllAvailabilities reconciles is_available and item_status for all items
// that have booking history. Called on startup and hourly to fix any stale data.
func (s *BookingService) SyncAllAvailabilities(ctx context.Context) error {
	return s.q.SyncAllItemAvailabilities(ctx)
}

// syncItemAvailability updates is_available and item_status for a single item
// based on whether it has any pending/accepted bookings.
func (s *BookingService) syncItemAvailability(ctx context.Context, itemID uuid.UUID) error {
	count, err := s.q.CountActiveBookingsForItem(ctx, itemID)
	if err != nil {
		return fmt.Errorf("count active bookings: %w", err)
	}
	if err := s.q.UpdateItemAvailability(ctx, sqlcdb.UpdateItemAvailabilityParams{
		ItemID:      itemID,
		IsAvailable: count == 0,
	}); err != nil {
		return fmt.Errorf("update item availability: %w", err)
	}
	return s.syncItemStatus(ctx, itemID, count > 0)
}

func (s *BookingService) syncItemAvailabilityIfPresent(ctx context.Context, itemID pgtype.UUID) error {
	if !itemID.Valid {
		return nil
	}
	return s.syncItemAvailability(ctx, uuid.UUID(itemID.Bytes))
}

// syncItemStatus sets item_status to 'rented' when occupied, or restores it
// to 'available' — but only when the current status is already 'rented'.
func (s *BookingService) syncItemStatus(ctx context.Context, itemID uuid.UUID, occupied bool) error {
	if occupied {
		_, err := s.q.UpdateItemStatus(ctx, sqlcdb.UpdateItemStatusParams{
			ItemID:     itemID,
			ItemStatus: sqlcdb.ItemStatusRented,
		})
		return err
	}
	item, err := s.q.GetItemByID(ctx, itemID)
	if err != nil {
		return fmt.Errorf("get item: %w", err)
	}
	if item.ItemStatus != sqlcdb.ItemStatusRented {
		return nil // withdrawn/under_review items keep their status
	}
	_, err = s.q.UpdateItemStatus(ctx, sqlcdb.UpdateItemStatusParams{
		ItemID:     itemID,
		ItemStatus: sqlcdb.ItemStatusAvailable,
	})
	return err
}

// issueRefundIfPaid calls the Stripe refund API when a payment_intent_id is present.
func (s *BookingService) issueRefundIfPaid(ctx context.Context, pi pgtype.Text) error {
	if !pi.Valid || pi.String == "" {
		return nil
	}
	if err := s.refunder.RefundPayment(ctx, pi.String); err != nil {
		return fmt.Errorf("refund payment: %w", err)
	}
	return nil
}

// authoriseBookingTransition checks that the user is the expected party.
func authoriseBookingTransition(b sqlcdb.BookingDetailRow, userID uuid.UUID, renterAction bool) error {
	if renterAction && b.RenterID != userID {
		return ErrBookingForbidden
	}
	if !renterAction && (!b.OwnerID.Valid || uuid.UUID(b.OwnerID.Bytes) != userID) {
		return ErrBookingForbidden
	}
	return nil
}

// bookingStatusAllowed reports whether the current status is in the allowed set.
func bookingStatusAllowed(current sqlcdb.BookingStatus, allowed []sqlcdb.BookingStatus) bool {
	for _, s := range allowed {
		if current == s {
			return true
		}
	}
	return false
}

// isRefundStatus reports whether transitioning to next should trigger a refund.
func isRefundStatus(next sqlcdb.BookingStatus) bool {
	return next == sqlcdb.BookingStatusRejected || next == sqlcdb.BookingStatusCancelled
}

// bookingRowToResponse converts a raw BookingRow into a JSON-ready response.
func bookingRowToResponse(b sqlcdb.BookingRow) (model.BookingResponse, error) {
	total, err := numericToOptionalFloat64(b.EstimatedTotal)
	if err != nil {
		return model.BookingResponse{}, fmt.Errorf("convert estimated_total: %w", err)
	}
	return model.BookingResponse{
		BookingID:       b.BookingID.String(),
		ItemID:          nullableUUIDString(b.ItemID),
		RenterID:        b.RenterID.String(),
		StartDate:       b.StartDate.Format(bookingDateLayout),
		EndDate:         b.EndDate.Format(bookingDateLayout),
		RequestedAt:     b.RequestedAt.Time.Format(time.RFC3339),
		BookingStatus:   string(b.BookingStatus),
		EstimatedTotal:  total,
		Notes:           b.Notes.String,
		PaymentIntentID: b.PaymentIntentID.String,
		ExpiresAt:       optionalTime(b.ExpiresAt),
	}, nil
}

// bookingDetailToResponse converts a BookingDetailRow into a JSON-ready response.
func bookingDetailToResponse(b sqlcdb.BookingDetailRow) (model.BookingDetailResponse, error) {
	total, err := numericToOptionalFloat64(b.EstimatedTotal)
	if err != nil {
		return model.BookingDetailResponse{}, fmt.Errorf("convert estimated_total: %w", err)
	}
	return model.BookingDetailResponse{
		BookingID:                b.BookingID.String(),
		ItemID:                   nullableUUIDString(b.ItemID),
		ItemTitle:                b.ItemTitle,
		ItemImageURL:             b.ItemImageURL,
		RenterID:                 b.RenterID.String(),
		RenterFirstName:          b.RenterFirstName,
		RenterLastName:           b.RenterLastName,
		RenterVerificationStatus: string(b.RenterVerificationStatus),
		OwnerID:                  nullableUUIDString(b.OwnerID),
		StartDate:                b.StartDate.Format(bookingDateLayout),
		EndDate:                  b.EndDate.Format(bookingDateLayout),
		RequestedAt:              b.RequestedAt.Time.Format(time.RFC3339),
		BookingStatus:            string(b.BookingStatus),
		EstimatedTotal:           total,
		Notes:                    b.Notes.String,
		PaymentIntentID:          b.PaymentIntentID.String,
		ExpiresAt:                optionalTime(b.ExpiresAt),
	}, nil
}

// buildBookingListResponse converts a slice of detail rows into the list response.
func buildBookingListResponse(rows []sqlcdb.BookingDetailRow) (model.BookingListResponse, error) {
	items := make([]model.BookingDetailResponse, 0, len(rows))
	var total int64
	for _, r := range rows {
		detail, err := bookingDetailToResponse(r)
		if err != nil {
			return model.BookingListResponse{}, err
		}
		items = append(items, detail)
		total = r.TotalCount
	}
	return model.BookingListResponse{Items: items, Total: total}, nil
}

// numericToOptionalFloat64 converts a nullable pgtype.Numeric to *float64.
func numericToOptionalFloat64(n pgtype.Numeric) (*float64, error) {
	if !n.Valid {
		return nil, nil
	}
	f, err := numericToFloat64(n)
	if err != nil {
		return nil, err
	}
	return &f, nil
}

// optionalTime formats a nullable timestamp as RFC3339, or returns empty string.
func optionalTime(t pgtype.Timestamptz) string {
	if !t.Valid {
		return ""
	}
	return t.Time.Format(time.RFC3339)
}

func nullableUUIDString(id pgtype.UUID) string {
	if !id.Valid {
		return ""
	}
	return uuid.UUID(id.Bytes).String()
}

// parseBookingDates validates and parses both date strings.
func parseBookingDates(startStr, endStr string) (start, end time.Time, err error) {
	start, err = time.Parse(bookingDateLayout, startStr)
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("invalid start_date: %w", err)
	}
	end, err = time.Parse(bookingDateLayout, endStr)
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("invalid end_date: %w", err)
	}
	return start, end, nil
}

// normaliseBookingLimit returns the limit, or the default when it is non-positive.
func normaliseBookingLimit(limit int) int {
	if limit <= 0 {
		return defaultBookingLimit
	}
	return limit
}

// bookingPageOffset computes the SQL OFFSET from a 1-based page number and limit.
func bookingPageOffset(page, limit int) int {
	if page < 1 {
		page = 1
	}
	return (page - 1) * limit
}

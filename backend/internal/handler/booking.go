// Package handler provides HTTP handlers for the API.
package handler

import (
	"context"
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
	"github.com/isw2-unileon/MeRenta/backend/internal/service"
	"github.com/isw2-unileon/MeRenta/backend/pkg/response"
)

// bookingService is the subset of the booking service used by the handler.
type bookingService interface {
	Create(ctx context.Context, renterID uuid.UUID, req model.CreateBookingRequest) (model.BookingResponse, error)
	ListMine(ctx context.Context, renterID uuid.UUID, page, limit int) (model.BookingListResponse, error)
	ListAsOwner(ctx context.Context, ownerID uuid.UUID, page, limit int) (model.BookingListResponse, error)
	GetUnavailableDates(ctx context.Context, itemID uuid.UUID) ([]model.DateRangeResponse, error)
	Accept(ctx context.Context, ownerID uuid.UUID, bookingID uuid.UUID) (model.BookingResponse, error)
	Reject(ctx context.Context, ownerID uuid.UUID, bookingID uuid.UUID) (model.BookingResponse, error)
	Cancel(ctx context.Context, renterID uuid.UUID, bookingID uuid.UUID) (model.BookingResponse, error)
	Complete(ctx context.Context, userID uuid.UUID, bookingID uuid.UUID) (model.BookingResponse, error)
}

// bookingAction distinguishes the three status-change operations.
type bookingAction int

const (
	bookingActionAccept bookingAction = iota // owner accepts a pending booking
	bookingActionReject                      // owner rejects a pending booking
	bookingActionCancel                      // renter cancels their booking
)

// BookingHandler exposes booking-related endpoints.
type BookingHandler struct {
	svc bookingService
}

// NewBookingHandler builds a new BookingHandler.
func NewBookingHandler(svc bookingService) *BookingHandler {
	return &BookingHandler{svc: svc}
}

// Create handles POST /api/bookings.
// Creates a booking after a successful Stripe payment.
func (h *BookingHandler) Create(c *gin.Context) {
	bindAndCreate(c, h.svc.Create, bookingErrStatus)
}

// ListMine handles GET /api/bookings/mine.
func (h *BookingHandler) ListMine(c *gin.Context) {
	customerID, ok := getCustomerID(c)
	if !ok {
		return
	}

	page, limit := bookingPaginationParams(c)
	res, err := h.svc.ListMine(c.Request.Context(), customerID, page, limit)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.OK(c, http.StatusOK, res)
}

// ListAsOwner handles GET /api/bookings/as-owner.
func (h *BookingHandler) ListAsOwner(c *gin.Context) {
	customerID, ok := getCustomerID(c)
	if !ok {
		return
	}

	page, limit := bookingPaginationParams(c)
	res, err := h.svc.ListAsOwner(c.Request.Context(), customerID, page, limit)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.OK(c, http.StatusOK, res)
}

// UnavailableDates handles GET /api/items/:id/unavailable-dates.
// Returns blocked date ranges for the given item (pending + accepted bookings).
func (h *BookingHandler) UnavailableDates(c *gin.Context) {
	itemID, ok := parseUUIDParam(c)
	if !ok {
		return
	}

	res, err := h.svc.GetUnavailableDates(c.Request.Context(), itemID)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.OK(c, http.StatusOK, res)
}

// Accept handles PATCH /api/bookings/:id/accept — owner only.
func (h *BookingHandler) Accept(c *gin.Context) {
	h.changeStatus(c, bookingActionAccept)
}

// Reject handles PATCH /api/bookings/:id/reject — owner only.
func (h *BookingHandler) Reject(c *gin.Context) {
	h.changeStatus(c, bookingActionReject)
}

// Cancel handles PATCH /api/bookings/:id/cancel — renter only.
func (h *BookingHandler) Cancel(c *gin.Context) {
	h.changeStatus(c, bookingActionCancel)
}

// Complete handles PATCH /api/bookings/:id/complete — owner or renter, on/after end date.
func (h *BookingHandler) Complete(c *gin.Context) {
	customerID, ok := getCustomerID(c)
	if !ok {
		return
	}
	bookingID, ok := parseBookingID(c)
	if !ok {
		return
	}

	res, err := h.svc.Complete(c.Request.Context(), customerID, bookingID)
	if err != nil {
		response.Error(c, bookingErrStatus(err), err.Error())
		return
	}

	response.OK(c, http.StatusOK, res)
}

// ─── Private helpers ──────────────────────────────────────────────────────────

// changeStatus authenticates the caller, parses the booking ID and applies the
// requested status-change action, writing the updated booking or an error.
func (h *BookingHandler) changeStatus(c *gin.Context, action bookingAction) {
	customerID, ok := getCustomerID(c)
	if !ok {
		return
	}

	bookingID, ok := parseBookingID(c)
	if !ok {
		return
	}

	res, err := h.dispatchAction(c, customerID, bookingID, action)
	if err != nil {
		response.Error(c, bookingErrStatus(err), err.Error())
		return
	}

	response.OK(c, http.StatusOK, res)
}

// dispatchAction routes a bookingAction to the matching service method.
func (h *BookingHandler) dispatchAction(
	c *gin.Context,
	customerID uuid.UUID,
	bookingID uuid.UUID,
	action bookingAction,
) (model.BookingResponse, error) {
	ctx := c.Request.Context()
	switch action {
	case bookingActionAccept:
		return h.svc.Accept(ctx, customerID, bookingID)
	case bookingActionReject:
		return h.svc.Reject(ctx, customerID, bookingID)
	default:
		return h.svc.Cancel(ctx, customerID, bookingID)
	}
}

// parseBookingID parses the ":id" route param as a booking UUID, writing 400
// and returning false on failure.
func parseBookingID(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, http.StatusBadRequest, "invalid booking id")
		return uuid.UUID{}, false
	}
	return id, true
}

// bookingPaginationParams reads the page and limit query params, defaulting to
// page 1 and a limit of 20.
func bookingPaginationParams(c *gin.Context) (page, limit int) {
	page, _ = strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ = strconv.Atoi(c.DefaultQuery("limit", "20"))
	return page, limit
}

// bookingErrStatus maps a booking service error to the appropriate HTTP status.
func bookingErrStatus(err error) int {
	switch {
	case errors.Is(err, service.ErrBookingNotFound):
		return http.StatusNotFound
	case errors.Is(err, service.ErrBookingForbidden):
		return http.StatusForbidden
	case errors.Is(err, service.ErrBookingClosed):
		return http.StatusConflict
	case errors.Is(err, service.ErrCannotBookOwnItem),
		errors.Is(err, service.ErrBookingNotEnded):
		return http.StatusUnprocessableEntity
	default:
		return http.StatusInternalServerError
	}
}

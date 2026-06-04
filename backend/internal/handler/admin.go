// Package handler provides HTTP handlers for the API.
package handler

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/isw2-unileon/MeRenta/backend/internal/service"
	"github.com/isw2-unileon/MeRenta/backend/internal/sqlcdb"
	"github.com/isw2-unileon/MeRenta/backend/pkg/response"
)

// AdminHandler exposes admin-only endpoints.
type AdminHandler struct {
	svc *service.AdminService
}

// NewAdminHandler builds a new AdminHandler.
func NewAdminHandler(svc *service.AdminService) *AdminHandler {
	return &AdminHandler{svc: svc}
}

// ListUsers handles GET /api/admin/users.
// Query params: q (name/email search), status (account filter), page, limit.
func (h *AdminHandler) ListUsers(c *gin.Context) {
	query := c.DefaultQuery("q", "")
	status := c.DefaultQuery("status", "")
	page := parsePositiveInt(c.DefaultQuery("page", "1"), 1, 500)
	limit := parsePositiveInt(c.DefaultQuery("limit", "20"), 20, 100)

	if status != "" && !isValidAccountStatus(status) {
		response.Error(c, http.StatusBadRequest, "invalid status value")
		return
	}

	res, err := h.svc.ListUsers(c.Request.Context(), query, status, page, limit)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "internal server error")
		return
	}

	response.OK(c, http.StatusOK, res)
}

// ListAuditLog handles GET /api/admin/audit.
// Query params: action (filter), page, limit.
func (h *AdminHandler) ListAuditLog(c *gin.Context) {
	action := strings.TrimSpace(c.Query("action"))
	page := parsePositiveInt(c.DefaultQuery("page", "1"), 1, 500)
	limit := parsePositiveInt(c.DefaultQuery("limit", "20"), 20, 100)

	if action != "" && !isValidAuditAction(action) {
		response.Error(c, http.StatusBadRequest, "invalid action value")
		return
	}

	res, err := h.svc.ListAuditLog(c.Request.Context(), action, page, limit)
	if err != nil {
		slog.Error("admin list audit log failed", "error", err)
		response.Error(c, http.StatusInternalServerError, "internal server error")
		return
	}

	response.OK(c, http.StatusOK, res)
}

// ListVerification handles GET /api/admin/verification.
// Query params: status (pending|verified|rejected), page, limit.
func (h *AdminHandler) ListVerification(c *gin.Context) {
	status := c.DefaultQuery("status", "pending")
	page := parsePositiveInt(c.DefaultQuery("page", "1"), 1, 500)
	limit := parsePositiveInt(c.DefaultQuery("limit", "20"), 20, 100)

	if !isValidAdminVerificationStatus(status) {
		response.Error(c, http.StatusBadRequest, "invalid verification status value")
		return
	}

	res, err := h.svc.ListVerification(c.Request.Context(), status, page, limit)
	if err != nil {
		slog.Error("admin list verification failed", "error", err)
		response.Error(c, http.StatusInternalServerError, "internal server error")
		return
	}

	response.OK(c, http.StatusOK, res)
}

// UpdateVerification handles PATCH /api/admin/verification/:id.
// Body: { "status": "verified"|"rejected" }.
func (h *AdminHandler) UpdateVerification(c *gin.Context) {
	customerID, ok := parseUUIDParam(c)
	if !ok {
		return
	}

	var body struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.Error(c, http.StatusBadRequest, "status is required")
		return
	}
	if !isValidVerificationDecision(body.Status) {
		response.Error(c, http.StatusBadRequest, "invalid verification status value")
		return
	}

	status, err := h.svc.UpdateVerification(
		c.Request.Context(), customerID, sqlcdb.VerificationStatus(body.Status),
	)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrAdminUserNotFound):
			response.Error(c, http.StatusNotFound, err.Error())
		default:
			slog.Error("admin update verification failed", "error", err)
			response.Error(c, http.StatusInternalServerError, "internal server error")
		}
		return
	}

	adminID, adminEmail, ok := getAdminAuditIdentity(c)
	if ok {
		h.svc.LogAuditEntry(
			c.Request.Context(),
			adminID,
			adminEmail,
			"verification_updated",
			"verification",
			customerID.String(),
			"",
			string(status),
			customerID.String()[:8],
		)
	}

	response.OK(c, http.StatusOK, gin.H{
		"customer_id": customerID,
		"status":      status,
	})
}

// ListBookings handles GET /api/admin/bookings.
// Query params: status, q (search), sort, page, limit.
func (h *AdminHandler) ListBookings(c *gin.Context) {
	status := c.DefaultQuery("status", "")
	query := strings.TrimSpace(c.Query("q"))
	sort := c.DefaultQuery("sort", "recent")
	page := parsePositiveInt(c.DefaultQuery("page", "1"), 1, 500)
	limit := parsePositiveInt(c.DefaultQuery("limit", "20"), 20, 100)

	if status != "" && !isValidBookingStatus(status) {
		response.Error(c, http.StatusBadRequest, "invalid booking status value")
		return
	}
	if !isValidBookingSort(sort) {
		sort = "recent"
	}

	res, err := h.svc.ListBookings(c.Request.Context(), status, query, sort, page, limit)
	if err != nil {
		slog.Error("admin list bookings failed", "error", err)
		response.Error(c, http.StatusInternalServerError, "internal server error")
		return
	}

	response.OK(c, http.StatusOK, res)
}

// GetStats handles GET /api/admin/stats — returns platform KPIs.
func (h *AdminHandler) GetStats(c *gin.Context) {
	stats, err := h.svc.GetStats(c.Request.Context())
	if err != nil {
		slog.Error("admin get stats failed", "error", err)
		response.Error(c, http.StatusInternalServerError, "internal server error")
		return
	}
	response.OK(c, http.StatusOK, stats)
}

// ListPayments handles GET /api/admin/payments.
// Query params: payment_status (""|"paid"|"refunded"), q (search), page, limit.
func (h *AdminHandler) ListPayments(c *gin.Context) {
	paymentStatus := c.DefaultQuery("payment_status", "")
	query := strings.TrimSpace(c.Query("q"))
	page := parsePositiveInt(c.DefaultQuery("page", "1"), 1, 500)
	limit := parsePositiveInt(c.DefaultQuery("limit", "20"), 20, 100)

	if paymentStatus != "" && !isValidPaymentStatus(paymentStatus) {
		response.Error(c, http.StatusBadRequest, "invalid payment_status value")
		return
	}

	res, err := h.svc.ListPayments(c.Request.Context(), paymentStatus, query, page, limit)
	if err != nil {
		slog.Error("admin list payments failed", "error", err)
		response.Error(c, http.StatusInternalServerError, "internal server error")
		return
	}

	response.OK(c, http.StatusOK, res)
}

func isValidPaymentStatus(s string) bool {
	return s == "paid" || s == "refunded"
}

func isValidAuditAction(s string) bool {
	switch s {
	case "user_status_changed", "booking_status_changed", "verification_updated":
		return true
	}
	return false
}

// AdminUpdateBookingStatus handles PATCH /api/admin/bookings/:id/status.
func (h *AdminHandler) AdminUpdateBookingStatus(c *gin.Context) {
	bookingID, ok := parseUUIDParam(c)
	if !ok {
		return
	}

	var body struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.Error(c, http.StatusBadRequest, "status is required")
		return
	}
	if !isValidBookingStatus(body.Status) {
		response.Error(c, http.StatusBadRequest, "invalid booking status value")
		return
	}

	res, err := h.svc.AdminUpdateBookingStatus(c.Request.Context(), bookingID, sqlcdb.BookingStatus(body.Status))
	if err != nil {
		switch {
		case errors.Is(err, service.ErrAdminBookingNotFound):
			response.Error(c, http.StatusNotFound, err.Error())
		default:
			slog.Error("admin update booking status failed", "error", err)
			response.Error(c, http.StatusInternalServerError, "internal server error")
		}
		return
	}

	adminID, adminEmail, ok := getAdminAuditIdentity(c)
	if ok {
		h.svc.LogAuditEntry(
			c.Request.Context(),
			adminID,
			adminEmail,
			"booking_status_changed",
			"booking",
			bookingID.String(),
			"",
			body.Status,
			bookingID.String()[:8],
		)
	}

	response.OK(c, http.StatusOK, res)
}

// ListProducts handles GET /api/admin/items.
// Query params: q, page, limit. Unlike the public item list, this includes every DB item.
func (h *AdminHandler) ListProducts(c *gin.Context) {
	query := strings.TrimSpace(c.Query("q"))
	page := parsePositiveInt(c.DefaultQuery("page", "1"), 1, 500)
	limit := parsePositiveInt(c.DefaultQuery("limit", "20"), 20, 100)

	res, err := h.svc.ListProducts(c.Request.Context(), query, page, limit)
	if err != nil {
		slog.Error("admin list products failed", "error", err)
		response.Error(c, http.StatusInternalServerError, "internal server error")
		return
	}

	response.OK(c, http.StatusOK, res)
}

// UpdateUserStatus handles PATCH /api/admin/users/:id/status.
// Body: { "status": "active"|"inactive"|"suspended"|"banned", "suspended_until": "2024-06-15T00:00:00Z" }.
// suspended_until is required when status = "suspended".
func (h *AdminHandler) UpdateUserStatus(c *gin.Context) {
	customerID, ok := parseUUIDParam(c)
	if !ok {
		return
	}

	var body struct {
		Status         string  `json:"status"         binding:"required"`
		SuspendedUntil *string `json:"suspended_until"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.Error(c, http.StatusBadRequest, "status is required")
		return
	}

	if !isValidAccountStatus(body.Status) {
		response.Error(c, http.StatusBadRequest, "invalid status value")
		return
	}

	var suspendedUntil *time.Time
	if body.SuspendedUntil != nil && *body.SuspendedUntil != "" {
		t, parseErr := time.Parse(time.RFC3339, *body.SuspendedUntil)
		if parseErr != nil {
			response.Error(c, http.StatusBadRequest, "suspended_until must be RFC3339")
			return
		}
		suspendedUntil = &t
	}

	row, err := h.svc.UpdateUserStatus(
		c.Request.Context(), customerID, sqlcdb.AccountStatus(body.Status), suspendedUntil,
	)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrAdminUserNotFound):
			response.Error(c, http.StatusNotFound, err.Error())
		default:
			response.Error(c, http.StatusInternalServerError, "internal server error")
		}
		return
	}

	adminID, adminEmail, ok := getAdminAuditIdentity(c)
	if ok {
		h.svc.LogAuditEntry(
			c.Request.Context(),
			adminID,
			adminEmail,
			"user_status_changed",
			"user",
			customerID.String(),
			"",
			body.Status,
			customerID.String()[:8],
		)
	}

	response.OK(c, http.StatusOK, gin.H{
		"customer_id": row.CustomerID,
		"status":      row.AccountStatus,
	})
}

// GetPlatformConfig handles GET /api/admin/config.
// Returns editable flags (from DB) and read-only constants (from service layer).
func (h *AdminHandler) GetPlatformConfig(c *gin.Context) {
	cfg, err := h.svc.GetPlatformConfig(c.Request.Context())
	if err != nil {
		slog.Error("admin get platform config failed", "error", err)
		response.Error(c, http.StatusInternalServerError, "internal server error")
		return
	}
	response.OK(c, http.StatusOK, cfg)
}

// UpdatePlatformConfig handles PATCH /api/admin/config.
// Body: { "allow_new_registrations": bool }.
func (h *AdminHandler) UpdatePlatformConfig(c *gin.Context) {
	adminID, ok := getCustomerID(c)
	if !ok {
		return
	}

	var body struct {
		AllowNewRegistrations bool `json:"allow_new_registrations"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.Error(c, http.StatusBadRequest, "allow_new_registrations is required")
		return
	}

	cfg, err := h.svc.UpdatePlatformConfig(c.Request.Context(), body.AllowNewRegistrations, adminID)
	if err != nil {
		slog.Error("admin update platform config failed", "error", err)
		response.Error(c, http.StatusInternalServerError, "internal server error")
		return
	}
	response.OK(c, http.StatusOK, cfg)
}

func getAdminAuditIdentity(c *gin.Context) (uuid.UUID, string, bool) {
	rawID, ok := c.Get("customer_id")
	if !ok {
		return uuid.UUID{}, "", false
	}
	customerID, ok := rawID.(uuid.UUID)
	if !ok {
		return uuid.UUID{}, "", false
	}
	rawEmail, ok := c.Get("email")
	if !ok {
		return uuid.UUID{}, "", false
	}
	email, ok := rawEmail.(string)
	if !ok || email == "" {
		return uuid.UUID{}, "", false
	}
	return customerID, email, true
}

func isValidAccountStatus(s string) bool {
	switch sqlcdb.AccountStatus(s) {
	case sqlcdb.AccountStatusActive,
		sqlcdb.AccountStatusSuspended,
		sqlcdb.AccountStatusBanned:
		return true
	}
	return false
}

func isValidAdminVerificationStatus(s string) bool {
	switch sqlcdb.VerificationStatus(s) {
	case sqlcdb.VerificationStatusPending,
		sqlcdb.VerificationStatusVerified,
		sqlcdb.VerificationStatusRejected:
		return true
	}
	return false
}

func isValidVerificationDecision(s string) bool {
	switch sqlcdb.VerificationStatus(s) {
	case sqlcdb.VerificationStatusVerified,
		sqlcdb.VerificationStatusRejected:
		return true
	}
	return false
}

func isValidBookingSort(s string) bool {
	switch s {
	case "recent", "oldest", "amount_desc", "amount_asc":
		return true
	}
	return false
}

func isValidBookingStatus(s string) bool {
	switch sqlcdb.BookingStatus(s) {
	case sqlcdb.BookingStatusPending,
		sqlcdb.BookingStatusAccepted,
		sqlcdb.BookingStatusRejected,
		sqlcdb.BookingStatusCancelled,
		sqlcdb.BookingStatusCompleted:
		return true
	}
	return false
}

// Package handler provides HTTP handlers for the API.
package handler

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

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

	response.OK(c, http.StatusOK, gin.H{
		"customer_id": row.CustomerID,
		"status":      row.AccountStatus,
	})
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

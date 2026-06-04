// Package handler provides HTTP handlers for the API.
package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
	"github.com/isw2-unileon/MeRenta/backend/internal/service"
	"github.com/isw2-unileon/MeRenta/backend/pkg/response"
)

// IncidentHandler exposes incident-related endpoints.
type IncidentHandler struct {
	svc *service.IncidentService
}

// NewIncidentHandler builds a new IncidentHandler.
func NewIncidentHandler(svc *service.IncidentService) *IncidentHandler {
	return &IncidentHandler{svc: svc}
}

// Create handles POST /api/incidents.
func (h *IncidentHandler) Create(c *gin.Context) {
	bindAndCreate(c, h.svc.Create, incidentErrStatus)
}

// CreateProductReport handles POST /api/items/:id/reports.
func (h *IncidentHandler) CreateProductReport(c *gin.Context) {
	bindAndCreateForTarget(c, h.svc.CreateProductReport, incidentErrStatus)
}

// CreateUserReport handles POST /api/customers/:id/reports.
func (h *IncidentHandler) CreateUserReport(c *gin.Context) {
	bindAndCreateForTarget(c, h.svc.CreateUserReport, incidentErrStatus)
}

// ListMine handles GET /api/incidents/mine.
func (h *IncidentHandler) ListMine(c *gin.Context) {
	reporterID, ok := getCustomerID(c)
	if !ok {
		return
	}
	respondWithPaginated(c, 20, 50,
		"list incidents", "reporter_id", reporterID,
		func(page, limit int) (any, error) {
			return h.svc.ListMine(c.Request.Context(), reporterID, page, limit)
		},
	)
}

// AdminList handles GET /api/admin/incidents.
func (h *IncidentHandler) AdminList(c *gin.Context) {
	status := c.DefaultQuery("status", "")
	itype := c.DefaultQuery("type", "")
	respondWithPaginated(c, 20, 50,
		"admin list incidents", "filters", nil,
		func(page, limit int) (any, error) {
			return h.svc.ListAdmin(c.Request.Context(), status, itype, page, limit)
		},
	)
}

// AdminGet handles GET /api/admin/incidents/:id.
func (h *IncidentHandler) AdminGet(c *gin.Context) {
	id, ok := parseUUIDParam(c)
	if !ok {
		return
	}

	res, err := h.svc.GetByID(c.Request.Context(), id)
	switch {
	case err == nil:
		response.OK(c, http.StatusOK, res)
	case errors.Is(err, service.ErrIncidentNotFound):
		response.Error(c, http.StatusNotFound, err.Error())
	default:
		response.Error(c, http.StatusInternalServerError, "internal server error")
	}
}

// AdminUpdateStatus handles PATCH /api/admin/incidents/:id/status.
func (h *IncidentHandler) AdminUpdateStatus(c *gin.Context) {
	id, ok := parseUUIDParam(c)
	if !ok {
		return
	}

	var req model.UpdateIncidentStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "status is required")
		return
	}

	res, err := h.svc.UpdateStatus(c.Request.Context(), id, req.Status)
	respondIncidentMutation(c, res, err, service.ErrIncidentInvalidStatus)
}

// AdminUpdatePriority handles PATCH /api/admin/incidents/:id/priority.
func (h *IncidentHandler) AdminUpdatePriority(c *gin.Context) {
	id, ok := parseUUIDParam(c)
	if !ok {
		return
	}

	var req model.UpdateIncidentPriorityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "priority is required")
		return
	}

	res, err := h.svc.UpdatePriority(c.Request.Context(), id, req.Priority)
	respondIncidentMutation(c, res, err, service.ErrIncidentInvalidPriority)
}

func respondIncidentMutation(c *gin.Context, res *model.IncidentResponse, err error, invalidErr error) {
	switch {
	case err == nil:
		response.OK(c, http.StatusOK, res)
	case errors.Is(err, service.ErrIncidentNotFound):
		response.Error(c, http.StatusNotFound, err.Error())
	case errors.Is(err, invalidErr):
		response.Error(c, http.StatusBadRequest, err.Error())
	default:
		response.Error(c, http.StatusInternalServerError, "internal server error")
	}
}

// ── helpers ───────────────────────────────────────────────────────────────────

func incidentErrStatus(err error) int {
	switch {
	case errors.Is(err, service.ErrIncidentForbidden),
		errors.Is(err, service.ErrCannotReportOwnItem):
		return http.StatusForbidden
	case errors.Is(err, service.ErrIncidentInvalidState),
		errors.Is(err, service.ErrIncidentInvalidType),
		errors.Is(err, service.ErrIncidentRentalUnavailable),
		errors.Is(err, service.ErrProductReportInvalidType),
		errors.Is(err, service.ErrIncidentInvalidPriority):
		return http.StatusUnprocessableEntity
	default:
		return http.StatusInternalServerError
	}
}

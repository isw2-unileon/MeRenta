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
//
//nolint:dupl // structurally mirrors BookingHandler.Create; intentional by design
func (h *IncidentHandler) Create(c *gin.Context) {
	reporterID, ok := getCustomerID(c)
	if !ok {
		return
	}

	var req model.CreateIncidentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, formatBindError(err))
		return
	}

	res, err := h.svc.Create(c.Request.Context(), reporterID, req)
	if err != nil {
		response.Error(c, incidentErrStatus(err), err.Error())
		return
	}
	response.OK(c, http.StatusCreated, res)
}

// CreateProductReport handles POST /api/items/:id/reports.
func (h *IncidentHandler) CreateProductReport(c *gin.Context) {
	reporterID, ok := getCustomerID(c)
	if !ok {
		return
	}
	itemID, ok := parseUUIDParam(c)
	if !ok {
		return
	}

	var req model.CreateProductReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, formatBindError(err))
		return
	}

	res, err := h.svc.CreateProductReport(c.Request.Context(), reporterID, itemID, req)
	if err != nil {
		response.Error(c, incidentErrStatus(err), err.Error())
		return
	}
	response.OK(c, http.StatusCreated, res)
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
	switch {
	case err == nil:
		response.OK(c, http.StatusOK, res)
	case errors.Is(err, service.ErrIncidentNotFound):
		response.Error(c, http.StatusNotFound, err.Error())
	case errors.Is(err, service.ErrIncidentInvalidStatus):
		response.Error(c, http.StatusBadRequest, err.Error())
	default:
		response.Error(c, http.StatusInternalServerError, "internal server error")
	}
}

// ── helpers ───────────────────────────────────────────────────────────────────

func incidentErrStatus(err error) int {
	switch {
	case errors.Is(err, service.ErrIncidentForbidden):
		return http.StatusForbidden
	case errors.Is(err, service.ErrIncidentInvalidState),
		errors.Is(err, service.ErrIncidentInvalidType),
		errors.Is(err, service.ErrIncidentRentalUnavailable),
		errors.Is(err, service.ErrProductReportInvalidType):
		return http.StatusUnprocessableEntity
	default:
		return http.StatusInternalServerError
	}
}

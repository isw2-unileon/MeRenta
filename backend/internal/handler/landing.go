// Package handler provides HTTP handlers for the API.
package handler

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/isw2-unileon/MeRenta/backend/internal/service"
	"github.com/isw2-unileon/MeRenta/backend/pkg/response"
)

// LandingHandler serves the public landing-page payload.
type LandingHandler struct {
	svc *service.LandingService
}

// NewLandingHandler builds a new LandingHandler.
func NewLandingHandler(svc *service.LandingService) *LandingHandler {
	return &LandingHandler{svc: svc}
}

// Get handles GET /api/landing -- returns public marketplace stats,
// top categories and a few featured listings for the marketing landing page.
//
// Response 200: model.LandingResponse
func (h *LandingHandler) Get(c *gin.Context) {
	res, err := h.svc.GetLanding(c.Request.Context())
	if err != nil {
		slog.Error("get landing failed", "error", err)
		response.Error(c, http.StatusInternalServerError, "internal server error")
		return
	}

	response.OK(c, http.StatusOK, res)
}

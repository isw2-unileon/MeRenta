package handler

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/isw2-unileon/MeRenta/backend/internal/service"
	"github.com/isw2-unileon/MeRenta/backend/pkg/response"
)

// ReviewHandler wires review endpoints to the review service.
type ReviewHandler struct {
	svc *service.ReviewService
}

// NewReviewHandler builds a new ReviewHandler.
func NewReviewHandler(svc *service.ReviewService) *ReviewHandler {
	return &ReviewHandler{svc: svc}
}

// ListReceived handles GET /api/reviews/received -- returns reviews received by the current user.
func (h *ReviewHandler) ListReceived(c *gin.Context) {
	customerID, ok := getCustomerID(c)
	if !ok {
		return
	}

	page := parsePositiveInt(c.DefaultQuery("page", "1"), 1, 500)
	limit := parsePositiveInt(c.DefaultQuery("limit", "4"), 4, 24)

	res, err := h.svc.ListReceivedReviews(c.Request.Context(), customerID, page, limit)
	if err != nil {
		slog.Error("list received reviews failed", "customer_id", customerID, "error", err)
		response.Error(c, http.StatusInternalServerError, "internal server error")
		return
	}

	response.OK(c, http.StatusOK, res)
}

// SummaryByCustomer handles GET /api/reviews/summary/:id -- returns review summary for a customer.
func (h *ReviewHandler) SummaryByCustomer(c *gin.Context) {
	reviewedID, ok := parseUUIDParam(c)
	if !ok {
		return
	}

	res, err := h.svc.GetReceivedReviewSummary(c.Request.Context(), reviewedID)
	if err != nil {
		slog.Error("get review summary failed", "customer_id", reviewedID, "error", err)
		response.Error(c, http.StatusInternalServerError, "internal server error")
		return
	}

	response.OK(c, http.StatusOK, res)
}

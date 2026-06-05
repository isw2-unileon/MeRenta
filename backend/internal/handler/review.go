package handler

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
	"github.com/isw2-unileon/MeRenta/backend/internal/service"
	"github.com/isw2-unileon/MeRenta/backend/pkg/response"
)

type reviewService interface {
	CreateReview(ctx context.Context, reviewerID uuid.UUID, req model.CreateReviewRequest) (*model.ReceivedReviewResponse, error)
	ListReceivedReviews(ctx context.Context, reviewedID uuid.UUID, page int, limit int) (*model.ReceivedReviewsResponse, error)
	GetReceivedReviewSummary(ctx context.Context, reviewedID uuid.UUID) (*model.ReviewSummaryResponse, error)
}

// ReviewHandler wires review endpoints to the review service.
type ReviewHandler struct {
	svc reviewService
}

// NewReviewHandler builds a new ReviewHandler.
func NewReviewHandler(svc reviewService) *ReviewHandler {
	return &ReviewHandler{svc: svc}
}

// Create handles POST /api/reviews -- creates a review for another customer.
func (h *ReviewHandler) Create(c *gin.Context) {
	customerID, ok := getCustomerID(c)
	if !ok {
		return
	}

	var req model.CreateReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, formatBindError(err))
		return
	}

	res, err := h.svc.CreateReview(c.Request.Context(), customerID, req)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidReviewRating):
			response.Error(c, http.StatusBadRequest, err.Error())
		case errors.Is(err, service.ErrCannotReviewSelf):
			response.Error(c, http.StatusBadRequest, err.Error())
		default:
			slog.Error("create review failed", "customer_id", customerID, "reviewed_id", req.ReviewedID, "error", err)
			response.Error(c, http.StatusInternalServerError, "internal server error")
		}
		return
	}

	response.OK(c, http.StatusCreated, res)
}

// ListReceived handles GET /api/reviews/received -- returns reviews received by the current user.
func (h *ReviewHandler) ListReceived(c *gin.Context) {
	customerID, ok := getCustomerID(c)
	if !ok {
		return
	}

	h.respondWithReceivedReviews(c, customerID, "list received reviews failed")
}

// ListReceivedByCustomer handles GET /api/reviews/received/:id -- returns public reviews received by a customer.
func (h *ReviewHandler) ListReceivedByCustomer(c *gin.Context) {
	reviewedID, ok := parseUUIDParam(c)
	if !ok {
		return
	}

	h.respondWithReceivedReviews(c, reviewedID, "list public received reviews failed")
}

func (h *ReviewHandler) respondWithReceivedReviews(c *gin.Context, reviewedID uuid.UUID, logMessage string) {
	respondWithPaginated(c, 4, 24, logMessage, "customer_id", reviewedID, func(page int, limit int) (any, error) {
		return h.svc.ListReceivedReviews(c.Request.Context(), reviewedID, page, limit)
	})
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

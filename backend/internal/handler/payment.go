// Package handler provides HTTP handlers for the API.
package handler

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
	"github.com/isw2-unileon/MeRenta/backend/pkg/response"
)

type paymentService interface {
	CreatePaymentIntent(ctx context.Context, req model.CreatePaymentIntentRequest) (model.CreatePaymentIntentResponse, error)
}

// PaymentHandler exposes payment-related endpoints.
type PaymentHandler struct {
	svc paymentService
}

// NewPaymentHandler builds a new PaymentHandler.
func NewPaymentHandler(svc paymentService) *PaymentHandler {
	return &PaymentHandler{svc: svc}
}

// CreateIntent handles POST /api/payment/intent.
// It creates a Stripe PaymentIntent and returns the client secret so the
// browser can confirm the charge without exposing the Stripe secret key.
func (h *PaymentHandler) CreateIntent(c *gin.Context) {
	var req model.CreatePaymentIntentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, formatBindError(err))
		return
	}

	res, err := h.svc.CreatePaymentIntent(c.Request.Context(), req)
	if err != nil {
		response.Error(c, http.StatusUnprocessableEntity, err.Error())
		return
	}

	response.OK(c, http.StatusOK, res)
}

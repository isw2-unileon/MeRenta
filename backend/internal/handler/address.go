// Package handler provides HTTP handlers for the API.
package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
	"github.com/isw2-unileon/MeRenta/backend/internal/service"
	"github.com/isw2-unileon/MeRenta/backend/pkg/response"
)

// AddressHandler wires address endpoints to the address service.
type AddressHandler struct {
	svc *service.AddressService
}

// NewAddressHandler builds a new AddressHandler.
func NewAddressHandler(svc *service.AddressService) *AddressHandler {
	return &AddressHandler{svc: svc}
}

// List handles GET /api/addresses — returns all addresses for the authenticated user.
//
// Response 200: []model.AddressResponse
func (h *AddressHandler) List(c *gin.Context) {
	ownerID, ok := extractCustomerID(c)
	if !ok {
		return
	}

	addrs, err := h.svc.ListAddresses(c.Request.Context(), ownerID)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "internal server error")
		return
	}

	response.OK(c, http.StatusOK, addrs)
}

// Create handles POST /api/addresses — saves a new address for the authenticated user.
//
// Request body: model.CreateAddressRequest (JSON)
// Response 201: model.AddressResponse
// Response 400: invalid body
func (h *AddressHandler) Create(c *gin.Context) {
	ownerID, ok := extractCustomerID(c)
	if !ok {
		return
	}

	var req model.CreateAddressRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, formatBindError(err))
		return
	}

	addr, err := h.svc.CreateAddress(c.Request.Context(), ownerID, req)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "internal server error")
		return
	}

	response.OK(c, http.StatusCreated, addr)
}

// extractCustomerID pulls the customer_id UUID from the Gin context (set by JWTAuth).
// It writes a 401 response and returns false when the value is absent or malformed.
func extractCustomerID(c *gin.Context) (uuid.UUID, bool) {
	raw, ok := c.Get("customer_id")
	if !ok {
		response.Error(c, http.StatusUnauthorized, "missing auth context")
		return uuid.UUID{}, false
	}

	id, ok := raw.(uuid.UUID)
	if !ok {
		response.Error(c, http.StatusUnauthorized, "invalid auth context")
		return uuid.UUID{}, false
	}

	return id, true
}

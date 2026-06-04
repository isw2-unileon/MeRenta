// Package handler provides HTTP handlers for the API.
package handler

import (
	"errors"
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
	ownerID, ok := getCustomerID(c)
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
	ownerID, ok := getCustomerID(c)
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

// Update handles PATCH /api/addresses/:id for the authenticated user's address.
func (h *AddressHandler) Update(c *gin.Context) {
	ownerID, ok := getCustomerID(c)
	if !ok {
		return
	}

	addressID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, http.StatusBadRequest, "invalid address id")
		return
	}

	var req model.CreateAddressRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, formatBindError(err))
		return
	}

	addr, err := h.svc.UpdateAddress(c.Request.Context(), ownerID, addressID, req)
	switch {
	case err == nil:
		response.OK(c, http.StatusOK, addr)
	case errors.Is(err, service.ErrAddressNotFound):
		response.Error(c, http.StatusNotFound, err.Error())
	case errors.Is(err, service.ErrForbidden):
		response.Error(c, http.StatusForbidden, err.Error())
	default:
		response.Error(c, http.StatusInternalServerError, "internal server error")
	}
}

// Delete handles DELETE /api/addresses/:id for the authenticated user's address.
func (h *AddressHandler) Delete(c *gin.Context) {
	ownerID, ok := getCustomerID(c)
	if !ok {
		return
	}

	addressID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, http.StatusBadRequest, "invalid address id")
		return
	}

	err = h.svc.DeleteAddress(c.Request.Context(), ownerID, addressID)
	switch {
	case err == nil:
		response.OK(c, http.StatusOK, gin.H{"message": "address deleted successfully"})
	case errors.Is(err, service.ErrAddressNotFound):
		response.Error(c, http.StatusNotFound, err.Error())
	case errors.Is(err, service.ErrForbidden):
		response.Error(c, http.StatusForbidden, err.Error())
	default:
		response.Error(c, http.StatusConflict, "An address used by a product cannot be deleted")
	}
}

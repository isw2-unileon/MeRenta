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

// ItemHandler wires item endpoints to the item service.
type ItemHandler struct {
	svc *service.ItemService
}

// NewItemHandler builds a new ItemHandler.
func NewItemHandler(svc *service.ItemService) *ItemHandler {
	return &ItemHandler{svc: svc}
}

// Get handles GET /api/items/:id — returns a single item listing.
//
// Response 200: model.ItemResponse
// Response 400: invalid UUID in path
// Response 404: item not found
func (h *ItemHandler) Get(c *gin.Context) {
	itemID, ok := parseUUIDParam(c)
	if !ok {
		return
	}

	res, err := h.svc.GetItem(c.Request.Context(), itemID)
	if err != nil {
		if errors.Is(err, service.ErrItemNotFound) {
			response.Error(c, http.StatusNotFound, err.Error())
			return
		}

		response.Error(c, http.StatusInternalServerError, "internal server error")

		return
	}

	response.OK(c, http.StatusOK, res)
}

// Create handles POST /api/items — creates a new item listing for the
// authenticated customer.
//
// Request body: model.CreateItemRequest (JSON)
// Response 201: model.ItemResponse
// Response 400: invalid request body or unrecognised category
// Response 422: address_id does not exist in the database
func (h *ItemHandler) Create(c *gin.Context) {
	var req model.CreateItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, formatBindError(err))
		return
	}

	ownerID, ok := c.Get("customer_id")
	if !ok {
		response.Error(c, http.StatusUnauthorized, "missing auth context")
		return
	}

	id, ok := ownerID.(uuid.UUID)
	if !ok {
		response.Error(c, http.StatusUnauthorized, "invalid auth context")
		return
	}

	res, err := h.svc.CreateItem(c.Request.Context(), id, req)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidCategory):
			response.Error(c, http.StatusBadRequest, err.Error())
		case errors.Is(err, service.ErrAddressNotFound):
			response.Error(c, http.StatusUnprocessableEntity, err.Error())
		default:
			response.Error(c, http.StatusInternalServerError, "internal server error")
		}
		return
	}

	response.OK(c, http.StatusCreated, res)
}

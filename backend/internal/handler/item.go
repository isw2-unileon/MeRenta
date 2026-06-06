// Package handler provides HTTP handlers for the API.
package handler

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
	"github.com/isw2-unileon/MeRenta/backend/internal/service"
	"github.com/isw2-unileon/MeRenta/backend/internal/sqlcdb"
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

// List handles GET /api/items -- returns paginated item cards for search.
//
// Query params: q, category, city, min_price, max_price, sort, page, limit.
// Response 200: model.SearchItemsResponse
func (h *ItemHandler) List(c *gin.Context) {
	page := parsePositiveInt(c.DefaultQuery("page", "1"), 1, 500)
	limit := parsePositiveInt(c.DefaultQuery("limit", "12"), 12, 48)
	offset := (page - 1) * limit

	minPrice, ok := parseOptionalFloatQuery(c, "min_price")
	if !ok {
		return
	}
	maxPrice, ok := parseOptionalFloatQuery(c, "max_price")
	if !ok {
		return
	}

	sort := strings.TrimSpace(c.DefaultQuery("sort", "recent"))
	switch sort {
	case "recent", "oldest", "price_asc", "price_desc":
	default:
		sort = "recent"
	}

	res, err := h.svc.SearchItems(c.Request.Context(), sqlcdb.SearchItemCardsParams{
		RequireAvailable: strings.TrimSpace(c.Query("date_from")) != "" || strings.TrimSpace(c.Query("date_to")) != "",
		Query:            strings.TrimSpace(c.Query("q")),
		Category:         strings.TrimSpace(c.Query("category")),
		City:             strings.TrimSpace(c.Query("city")),
		Condition:        strings.TrimSpace(c.Query("condition")),
		MinPrice:         minPrice,
		MaxPrice:         maxPrice,
		Sort:             sort,
		Limit:            limit,
		Offset:           offset,
	}, page, limit)
	if err != nil {
		slog.Error("list items failed", "error", err)
		response.Error(c, http.StatusInternalServerError, "internal server error")
		return
	}

	response.OK(c, http.StatusOK, res)
}

// ListMine handles GET /api/items/mine -- returns item cards owned by the current user.
//
// Query params: page, limit.
// Response 200: model.SearchItemsResponse
func (h *ItemHandler) ListMine(c *gin.Context) {
	ownerID, ok := getCustomerID(c)
	if !ok {
		return
	}

	h.respondWithOwnerItems(c, ownerID, "list owner items failed")
}

// ListByOwner handles GET /api/customers/:id/items -- returns item cards owned by a public profile.
//
// Query params: page, limit.
// Response 200: model.SearchItemsResponse
func (h *ItemHandler) ListByOwner(c *gin.Context) {
	ownerID, ok := parseUUIDParam(c)
	if !ok {
		return
	}

	h.respondWithOwnerItems(c, ownerID, "list public owner items failed")
}

// respondWithOwnerItems writes a paginated list of the items owned by ownerID,
// shared by ListMine and ListByOwner.
func (h *ItemHandler) respondWithOwnerItems(c *gin.Context, ownerID uuid.UUID, logMessage string) {
	respondWithPaginated(c, 48, 48, logMessage, "owner_id", ownerID, func(page int, limit int) (any, error) {
		return h.svc.ListOwnerItems(c.Request.Context(), ownerID, page, limit)
	})
}

// Get handles GET /api/items/:id -- returns a single item listing.
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

		slog.Error("get item failed", "item_id", itemID, "error", err)
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
// Response 400: invalid request body or unrecognized category
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
		case errors.Is(err, service.ErrInvalidCondition):
			response.Error(c, http.StatusBadRequest, err.Error())
		case errors.Is(err, service.ErrInvalidItemStatus):
			response.Error(c, http.StatusBadRequest, err.Error())
		case errors.Is(err, service.ErrInvalidRentalPeriod):
			response.Error(c, http.StatusBadRequest, err.Error())
		case errors.Is(err, service.ErrAddressNotFound):
			response.Error(c, http.StatusUnprocessableEntity, err.Error())
		default:
			slog.Error("create item failed", "error", err)
			response.Error(c, http.StatusInternalServerError, "internal server error")
		}
		return
	}

	response.OK(c, http.StatusCreated, res)
}

// Update handles PATCH /api/items/:id -- updates an item listing owned by the
// authenticated customer.
//
// Request body: model.UpdateItemRequest (JSON)
// Response 200: model.ItemResponse
// Response 403: caller does not own the item
// Response 404: item not found
func (h *ItemHandler) Update(c *gin.Context) {
	itemID, ok := parseUUIDParam(c)
	if !ok {
		return
	}

	var req model.UpdateItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, formatBindError(err))
		return
	}

	ownerID, ok := getCustomerID(c)
	if !ok {
		return
	}

	res, err := h.svc.UpdateItem(c.Request.Context(), ownerID, itemID, req)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidCategory):
			response.Error(c, http.StatusBadRequest, err.Error())
		case errors.Is(err, service.ErrInvalidCondition):
			response.Error(c, http.StatusBadRequest, err.Error())
		case errors.Is(err, service.ErrInvalidRentalPeriod):
			response.Error(c, http.StatusBadRequest, err.Error())
		case errors.Is(err, service.ErrAddressNotFound):
			response.Error(c, http.StatusUnprocessableEntity, err.Error())
		case errors.Is(err, service.ErrForbidden):
			response.Error(c, http.StatusForbidden, err.Error())
		case errors.Is(err, service.ErrItemNotFound):
			response.Error(c, http.StatusNotFound, err.Error())
		default:
			slog.Error("update item failed", "item_id", itemID, "owner_id", ownerID, "error", err)
			response.Error(c, http.StatusInternalServerError, "internal server error")
		}
		return
	}

	response.OK(c, http.StatusOK, res)
}

// Delete handles DELETE /api/items/:id -- permanently deletes an item listing
// owned by the authenticated customer.
func (h *ItemHandler) Delete(c *gin.Context) {
	itemID, ok := parseUUIDParam(c)
	if !ok {
		return
	}

	ownerID, ok := getCustomerID(c)
	if !ok {
		return
	}

	if err := h.svc.DeleteItem(c.Request.Context(), ownerID, itemID); err != nil {
		switch {
		case errors.Is(err, service.ErrForbidden):
			response.Error(c, http.StatusForbidden, err.Error())
		case errors.Is(err, service.ErrItemNotFound):
			response.Error(c, http.StatusNotFound, err.Error())
		default:
			slog.Error("delete item failed", "item_id", itemID, "owner_id", ownerID, "error", err)
			response.Error(c, http.StatusInternalServerError, "internal server error")
		}
		return
	}

	response.OK(c, http.StatusOK, gin.H{"message": "item deleted"})
}

// parsePositiveInt parses raw as a positive int, returning fallback when it is
// invalid or below 1 and clamping the result to maxValue.
func parsePositiveInt(raw string, fallback int, maxValue int) int {
	value, err := strconv.Atoi(raw)
	if err != nil || value < 1 {
		return fallback
	}
	if value > maxValue {
		return maxValue
	}
	return value
}

// parseOptionalFloatQuery parses an optional non-negative float query param.
// A missing param yields (nil, true); an invalid one writes 400 and returns
// (nil, false).
func parseOptionalFloatQuery(c *gin.Context, key string) (*float64, bool) {
	raw := strings.TrimSpace(c.Query(key))
	if raw == "" {
		return nil, true
	}

	value, err := strconv.ParseFloat(raw, 64)
	if err != nil || value < 0 {
		response.Error(c, http.StatusBadRequest, "invalid "+key)
		return nil, false
	}

	return &value, true
}

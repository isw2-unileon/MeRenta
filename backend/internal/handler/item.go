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
		Limit:            int32(limit),
		Offset:           int32(offset),
	}, page, limit)
	if err != nil {
		slog.Error("list items failed", "error", err)
		response.Error(c, http.StatusInternalServerError, "internal server error")
		return
	}

	response.OK(c, http.StatusOK, res)
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
		case errors.Is(err, service.ErrInvalidCondition):
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

func parsePositiveInt(raw string, fallback int, max int) int {
	value, err := strconv.Atoi(raw)
	if err != nil || value < 1 {
		return fallback
	}
	if value > max {
		return max
	}
	return value
}

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

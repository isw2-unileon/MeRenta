// Package handler provides HTTP handlers for the API.
package handler

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/isw2-unileon/MeRenta/backend/internal/service"
	"github.com/isw2-unileon/MeRenta/backend/pkg/response"
)

// FavoriteHandler wires favorite endpoints to the favorite service.
type FavoriteHandler struct {
	svc *service.FavoriteService
}

// NewFavoriteHandler builds a new FavoriteHandler.
func NewFavoriteHandler(svc *service.FavoriteService) *FavoriteHandler {
	return &FavoriteHandler{svc: svc}
}

// List handles GET /api/favorites — returns all saved items for the current user.
//
// Response 200: model.FavoritesResponse
func (h *FavoriteHandler) List(c *gin.Context) {
	customerID, ok := getCustomerID(c)
	if !ok {
		return
	}

	res, err := h.svc.ListFavorites(c.Request.Context(), customerID)
	if err != nil {
		slog.Error("list favorites failed", "error", err)
		response.Error(c, http.StatusInternalServerError, "internal server error")
		return
	}

	response.OK(c, http.StatusOK, res)
}

// Add handles POST /api/favorites/:id — saves an item to the current user's favorites.
//
// Response 204: saved
// Response 400: invalid UUID
// Response 404: item not found
func (h *FavoriteHandler) Add(c *gin.Context) {
	customerID, ok := getCustomerID(c)
	if !ok {
		return
	}

	itemID, ok := parseUUIDParam(c)
	if !ok {
		return
	}

	if err := h.svc.AddFavorite(c.Request.Context(), customerID, itemID); err != nil {
		if errors.Is(err, service.ErrItemNotFound) {
			response.Error(c, http.StatusNotFound, err.Error())
			return
		}
		slog.Error("add favorite failed", "error", err)
		response.Error(c, http.StatusInternalServerError, "internal server error")
		return
	}

	response.OK(c, http.StatusNoContent, nil)
}

// Remove handles DELETE /api/favorites/:id — removes an item from the current user's favorites.
//
// Response 204: removed (or was already absent)
// Response 400: invalid UUID
func (h *FavoriteHandler) Remove(c *gin.Context) {
	customerID, ok := getCustomerID(c)
	if !ok {
		return
	}

	itemID, ok := parseUUIDParam(c)
	if !ok {
		return
	}

	if err := h.svc.RemoveFavorite(c.Request.Context(), customerID, itemID); err != nil {
		slog.Error("remove favorite failed", "error", err)
		response.Error(c, http.StatusInternalServerError, "internal server error")
		return
	}

	response.OK(c, http.StatusNoContent, nil)
}

// Check handles GET /api/favorites/:id/check — reports whether the item is saved.
//
// Response 200: model.FavoriteCheckResponse
// Response 400: invalid UUID
func (h *FavoriteHandler) Check(c *gin.Context) {
	customerID, ok := getCustomerID(c)
	if !ok {
		return
	}

	itemID, ok := parseUUIDParam(c)
	if !ok {
		return
	}

	isFav, err := h.svc.IsFavorite(c.Request.Context(), customerID, itemID)
	if err != nil {
		slog.Error("check favorite failed", "error", err)
		response.Error(c, http.StatusInternalServerError, "internal server error")
		return
	}

	response.OK(c, http.StatusOK, gin.H{"is_favorite": isFav})
}

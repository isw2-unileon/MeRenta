package handler

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
	"github.com/isw2-unileon/MeRenta/backend/internal/service"
)

type favoriteServiceStub struct {
	listErr   error
	addErr    error
	removeErr error
	checkErr  error
	isFav     bool
}

func (s *favoriteServiceStub) ListFavorites(context.Context, uuid.UUID) (*model.FavoritesResponse, error) {
	if s.listErr != nil {
		return nil, s.listErr
	}
	return &model.FavoritesResponse{
		Items: []model.FavoriteItemResponse{{
			ItemID:      "11111111-1111-1111-1111-111111111111",
			Title:       "Taladro",
			PricePerDay: 8.5,
			SavedAt:     time.Date(2026, 6, 1, 10, 0, 0, 0, time.UTC),
		}},
		Total: 1,
	}, nil
}

func (s *favoriteServiceStub) AddFavorite(context.Context, uuid.UUID, uuid.UUID) error {
	return s.addErr
}

func (s *favoriteServiceStub) RemoveFavorite(context.Context, uuid.UUID, uuid.UUID) error {
	return s.removeErr
}

func (s *favoriteServiceStub) IsFavorite(context.Context, uuid.UUID, uuid.UUID) (bool, error) {
	return s.isFav, s.checkErr
}

func TestFavoriteHandlerHappyPaths(t *testing.T) {
	t.Parallel()

	customerID := uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
	itemID := "11111111-1111-1111-1111-111111111111"
	stub := &favoriteServiceStub{isFav: true}
	router := gin.New()
	router.Use(setCustomer(customerID))
	h := NewFavoriteHandler(stub)
	router.GET("/favorites", h.List)
	router.POST("/favorites/:id", h.Add)
	router.DELETE("/favorites/:id", h.Remove)
	router.GET("/favorites/:id/check", h.Check)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/favorites", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("list status = %d", w.Code)
	}

	w = httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/favorites/"+itemID, nil))
	if w.Code != http.StatusNoContent {
		t.Fatalf("add status = %d body=%s", w.Code, w.Body.String())
	}

	w = httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodDelete, "/favorites/"+itemID, nil))
	if w.Code != http.StatusNoContent {
		t.Fatalf("remove status = %d", w.Code)
	}

	w = httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/favorites/"+itemID+"/check", nil))
	if w.Code != http.StatusOK || !containsBody(w, `"is_favorite":true`) {
		t.Fatalf("check status = %d body=%s", w.Code, w.Body.String())
	}
}

func TestFavoriteHandlerErrors(t *testing.T) {
	t.Parallel()

	customerID := uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
	itemID := "11111111-1111-1111-1111-111111111111"

	tests := []struct {
		name   string
		stub   *favoriteServiceStub
		method string
		path   string
		status int
	}{
		{name: "missing auth", stub: &favoriteServiceStub{}, method: http.MethodGet, path: "/favorites", status: http.StatusUnauthorized},
		{name: "invalid uuid", stub: &favoriteServiceStub{}, method: http.MethodPost, path: "/favorites/bad", status: http.StatusBadRequest},
		{name: "not found", stub: &favoriteServiceStub{addErr: service.ErrItemNotFound}, method: http.MethodPost, path: "/favorites/" + itemID, status: http.StatusNotFound},
		{name: "own item", stub: &favoriteServiceStub{addErr: service.ErrOwnFavorite}, method: http.MethodPost, path: "/favorites/" + itemID, status: http.StatusForbidden},
		{name: "list internal", stub: &favoriteServiceStub{listErr: errors.New("db")}, method: http.MethodGet, path: "/favorites", status: http.StatusInternalServerError},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			router := gin.New()
			if tt.name != "missing auth" {
				router.Use(setCustomer(customerID))
			}
			h := NewFavoriteHandler(tt.stub)
			router.GET("/favorites", h.List)
			router.POST("/favorites/:id", h.Add)

			w := httptest.NewRecorder()
			router.ServeHTTP(w, httptest.NewRequest(tt.method, tt.path, nil))
			if w.Code != tt.status {
				t.Fatalf("status = %d want %d body=%s", w.Code, tt.status, w.Body.String())
			}
		})
	}
}

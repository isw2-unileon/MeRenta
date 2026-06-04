package handler

import (
	"context"
	"errors"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
	"github.com/isw2-unileon/MeRenta/backend/internal/service"
)

type itemImageServiceStub struct {
	err       error
	imageURL  string
	deleteErr error
}

func (s *itemImageServiceStub) GetImages(context.Context, uuid.UUID) ([]model.ItemImageResponse, error) {
	if s.err != nil {
		return nil, s.err
	}
	return []model.ItemImageResponse{{
		ImageID:      "22222222-2222-2222-2222-222222222222",
		ItemID:       "11111111-1111-1111-1111-111111111111",
		ImageURL:     "https://storage.example.com/raw.jpg",
		DisplayOrder: 1,
	}}, nil
}

func (s *itemImageServiceStub) AddItemImages(context.Context, uuid.UUID, uuid.UUID, []*multipart.FileHeader) ([]model.ItemImageResponse, error) {
	if s.err != nil {
		return nil, s.err
	}
	return []model.ItemImageResponse{{ImageID: "22222222-2222-2222-2222-222222222222"}}, nil
}

func (s *itemImageServiceStub) DeleteImage(context.Context, uuid.UUID, uuid.UUID, uuid.UUID) error {
	return s.deleteErr
}

func (s *itemImageServiceStub) GetImageURL(context.Context, uuid.UUID, uuid.UUID) (string, error) {
	if s.err != nil {
		return "", s.err
	}
	return s.imageURL, nil
}

func TestItemImageHandlerListDeleteAndProxy(t *testing.T) {
	t.Parallel()

	itemID := "11111111-1111-1111-1111-111111111111"
	imageID := "22222222-2222-2222-2222-222222222222"
	customerID := uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "image/png")
		_, _ = w.Write([]byte("image-bytes"))
	}))
	defer upstream.Close()

	h := NewItemImageHandler(&itemImageServiceStub{imageURL: upstream.URL})
	router := gin.New()
	router.Use(setCustomer(customerID))
	router.GET("/items/:id/images", h.ListImages)
	router.DELETE("/items/:id/images/:imageId", h.DeleteImage)
	router.GET("/items/:id/images/:imageId/content", h.ProxyImage)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/items/"+itemID+"/images", nil))
	if w.Code != http.StatusOK || !containsBody(w, "/content") {
		t.Fatalf("list status = %d body=%s", w.Code, w.Body.String())
	}

	w = httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodDelete, "/items/"+itemID+"/images/"+imageID, nil))
	if w.Code != http.StatusOK {
		t.Fatalf("delete status = %d", w.Code)
	}

	w = httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/items/"+itemID+"/images/"+imageID+"/content", nil))
	if w.Code != http.StatusOK || w.Body.String() != "image-bytes" || w.Header().Get("Content-Type") != "image/png" {
		t.Fatalf("proxy status=%d ct=%s body=%s", w.Code, w.Header().Get("Content-Type"), w.Body.String())
	}
}

func TestItemImageHandlerErrors(t *testing.T) {
	t.Parallel()

	itemID := "11111111-1111-1111-1111-111111111111"
	imageID := "22222222-2222-2222-2222-222222222222"
	customerID := uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
	tests := []struct {
		name   string
		stub   *itemImageServiceStub
		method string
		path   string
		status int
	}{
		{"bad item id", &itemImageServiceStub{}, http.MethodGet, "/items/bad/images", http.StatusBadRequest},
		{"list internal", &itemImageServiceStub{err: errors.New("db")}, http.MethodGet, "/items/" + itemID + "/images", http.StatusInternalServerError},
		{"delete bad image", &itemImageServiceStub{}, http.MethodDelete, "/items/" + itemID + "/images/bad", http.StatusBadRequest},
		{"delete not found", &itemImageServiceStub{deleteErr: service.ErrImageNotFound}, http.MethodDelete, "/items/" + itemID + "/images/" + imageID, http.StatusNotFound},
		{"proxy not found", &itemImageServiceStub{err: service.ErrImageNotFound}, http.MethodGet, "/items/" + itemID + "/images/" + imageID + "/content", http.StatusNotFound},
		{"proxy upstream bad", &itemImageServiceStub{imageURL: "http://127.0.0.1:1/not-open"}, http.MethodGet, "/items/" + itemID + "/images/" + imageID + "/content", http.StatusBadGateway},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			router := gin.New()
			router.Use(setCustomer(customerID))
			h := NewItemImageHandler(tt.stub)
			router.GET("/items/:id/images", h.ListImages)
			router.DELETE("/items/:id/images/:imageId", h.DeleteImage)
			router.GET("/items/:id/images/:imageId/content", h.ProxyImage)

			w := httptest.NewRecorder()
			router.ServeHTTP(w, httptest.NewRequest(tt.method, tt.path, nil))
			if w.Code != tt.status {
				t.Fatalf("status = %d want %d body=%s", w.Code, tt.status, w.Body.String())
			}
		})
	}
}

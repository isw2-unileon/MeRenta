package handler

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
	"github.com/isw2-unileon/MeRenta/backend/internal/service"
)

type addressServiceStub struct {
	err error
}

func (s *addressServiceStub) ListAddresses(context.Context, uuid.UUID) ([]model.AddressResponse, error) {
	if s.err != nil {
		return nil, s.err
	}
	return []model.AddressResponse{{AddressID: "11111111-1111-1111-1111-111111111111", City: "Leon"}}, nil
}

func (s *addressServiceStub) CreateAddress(context.Context, uuid.UUID, model.CreateAddressRequest) (*model.AddressResponse, error) {
	if s.err != nil {
		return nil, s.err
	}
	return &model.AddressResponse{AddressID: "11111111-1111-1111-1111-111111111111", City: "Leon"}, nil
}

func (s *addressServiceStub) UpdateAddress(context.Context, uuid.UUID, uuid.UUID, model.CreateAddressRequest) (*model.AddressResponse, error) {
	if s.err != nil {
		return nil, s.err
	}
	return &model.AddressResponse{AddressID: "11111111-1111-1111-1111-111111111111", City: "Astorga"}, nil
}

func (s *addressServiceStub) DeleteAddress(context.Context, uuid.UUID, uuid.UUID) error {
	return s.err
}

func TestAddressHandlerHappyPaths(t *testing.T) {
	t.Parallel()

	customerID := uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
	addressID := "11111111-1111-1111-1111-111111111111"
	router := gin.New()
	router.Use(setCustomer(customerID))
	h := NewAddressHandler(&addressServiceStub{})
	router.GET("/addresses", h.List)
	router.POST("/addresses", h.Create)
	router.PATCH("/addresses/:id", h.Update)
	router.DELETE("/addresses/:id", h.Delete)

	body := `{"street":"Calle Luna","number":"1","city":"Leon","province":"Leon","postal_code":"24001"}`
	for _, req := range []struct {
		method string
		path   string
		body   string
		status int
	}{
		{http.MethodGet, "/addresses", "", http.StatusOK},
		{http.MethodPost, "/addresses", body, http.StatusCreated},
		{http.MethodPatch, "/addresses/" + addressID, body, http.StatusOK},
		{http.MethodDelete, "/addresses/" + addressID, "", http.StatusOK},
	} {
		w := httptest.NewRecorder()
		router.ServeHTTP(w, httptest.NewRequest(req.method, req.path, strings.NewReader(req.body)))
		if w.Code != req.status {
			t.Fatalf("%s %s status = %d body=%s", req.method, req.path, w.Code, w.Body.String())
		}
	}
}

func TestAddressHandlerErrors(t *testing.T) {
	t.Parallel()

	customerID := uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
	validID := "11111111-1111-1111-1111-111111111111"
	body := `{"street":"Calle Luna","number":"1","city":"Leon","province":"Leon","postal_code":"24001"}`
	tests := []struct {
		name   string
		stub   *addressServiceStub
		method string
		path   string
		body   string
		status int
	}{
		{"missing auth", &addressServiceStub{}, http.MethodGet, "/addresses", "", http.StatusUnauthorized},
		{"bad create body", &addressServiceStub{}, http.MethodPost, "/addresses", `{}`, http.StatusBadRequest},
		{"bad update id", &addressServiceStub{}, http.MethodPatch, "/addresses/bad", body, http.StatusBadRequest},
		{"update not found", &addressServiceStub{err: service.ErrAddressNotFound}, http.MethodPatch, "/addresses/" + validID, body, http.StatusNotFound},
		{"update forbidden", &addressServiceStub{err: service.ErrForbidden}, http.MethodPatch, "/addresses/" + validID, body, http.StatusForbidden},
		{"delete in use", &addressServiceStub{err: service.ErrAddressInUse}, http.MethodDelete, "/addresses/" + validID, "", http.StatusConflict},
		{"delete internal error", &addressServiceStub{err: errors.New("boom")}, http.MethodDelete, "/addresses/" + validID, "", http.StatusInternalServerError},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			router := gin.New()
			if tt.name != "missing auth" {
				router.Use(setCustomer(customerID))
			}
			h := NewAddressHandler(tt.stub)
			router.GET("/addresses", h.List)
			router.POST("/addresses", h.Create)
			router.PATCH("/addresses/:id", h.Update)
			router.DELETE("/addresses/:id", h.Delete)

			w := httptest.NewRecorder()
			router.ServeHTTP(w, httptest.NewRequest(tt.method, tt.path, strings.NewReader(tt.body)))
			if w.Code != tt.status {
				t.Fatalf("status = %d want %d body=%s", w.Code, tt.status, w.Body.String())
			}
		})
	}
}

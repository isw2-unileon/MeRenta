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

type bookingServiceStub struct {
	err error
}

func (s *bookingServiceStub) Create(context.Context, uuid.UUID, model.CreateBookingRequest) (model.BookingResponse, error) {
	if s.err != nil {
		return model.BookingResponse{}, s.err
	}
	return sampleBookingResponse("pending"), nil
}

func (s *bookingServiceStub) ListMine(context.Context, uuid.UUID, int, int) (model.BookingListResponse, error) {
	if s.err != nil {
		return model.BookingListResponse{}, s.err
	}
	return model.BookingListResponse{Items: []model.BookingDetailResponse{{BookingID: "b1"}}, Total: 1}, nil
}

func (s *bookingServiceStub) ListAsOwner(context.Context, uuid.UUID, int, int) (model.BookingListResponse, error) {
	return s.ListMine(context.Background(), uuid.Nil, 1, 20)
}

func (s *bookingServiceStub) GetUnavailableDates(context.Context, uuid.UUID) ([]model.DateRangeResponse, error) {
	if s.err != nil {
		return nil, s.err
	}
	return []model.DateRangeResponse{{StartDate: "2026-06-01", EndDate: "2026-06-04"}}, nil
}

func (s *bookingServiceStub) Accept(context.Context, uuid.UUID, uuid.UUID) (model.BookingResponse, error) {
	if s.err != nil {
		return model.BookingResponse{}, s.err
	}
	return sampleBookingResponse("accepted"), nil
}

func (s *bookingServiceStub) Reject(context.Context, uuid.UUID, uuid.UUID) (model.BookingResponse, error) {
	return sampleBookingResponse("rejected"), s.err
}

func (s *bookingServiceStub) Cancel(context.Context, uuid.UUID, uuid.UUID) (model.BookingResponse, error) {
	return sampleBookingResponse("cancelled"), s.err
}

func (s *bookingServiceStub) Complete(context.Context, uuid.UUID, uuid.UUID) (model.BookingResponse, error) {
	if s.err != nil {
		return model.BookingResponse{}, s.err
	}
	return sampleBookingResponse("completed"), nil
}

func TestBookingHandlerHappyPaths(t *testing.T) {
	t.Parallel()

	customerID := uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
	bookingID := "11111111-1111-1111-1111-111111111111"
	itemID := "22222222-2222-2222-2222-222222222222"
	router := gin.New()
	router.Use(setCustomer(customerID))
	h := NewBookingHandler(&bookingServiceStub{})
	router.POST("/bookings", h.Create)
	router.GET("/bookings/mine", h.ListMine)
	router.GET("/bookings/as-owner", h.ListAsOwner)
	router.GET("/items/:id/unavailable-dates", h.UnavailableDates)
	router.PATCH("/bookings/:id/accept", h.Accept)
	router.PATCH("/bookings/:id/reject", h.Reject)
	router.PATCH("/bookings/:id/cancel", h.Cancel)
	router.PATCH("/bookings/:id/complete", h.Complete)

	createBody := `{"item_id":"` + itemID + `","start_date":"2026-06-01","end_date":"2026-06-04","payment_intent_id":"pi_123"}`
	requests := []struct {
		method string
		path   string
		body   string
		status int
	}{
		{http.MethodPost, "/bookings", createBody, http.StatusCreated},
		{http.MethodGet, "/bookings/mine?page=2&limit=5", "", http.StatusOK},
		{http.MethodGet, "/bookings/as-owner", "", http.StatusOK},
		{http.MethodGet, "/items/" + itemID + "/unavailable-dates", "", http.StatusOK},
		{http.MethodPatch, "/bookings/" + bookingID + "/accept", "", http.StatusOK},
		{http.MethodPatch, "/bookings/" + bookingID + "/reject", "", http.StatusOK},
		{http.MethodPatch, "/bookings/" + bookingID + "/cancel", "", http.StatusOK},
		{http.MethodPatch, "/bookings/" + bookingID + "/complete", "", http.StatusOK},
	}

	for _, req := range requests {
		w := httptest.NewRecorder()
		router.ServeHTTP(w, httptest.NewRequest(req.method, req.path, strings.NewReader(req.body)))
		if w.Code != req.status {
			t.Fatalf("%s %s status = %d body=%s", req.method, req.path, w.Code, w.Body.String())
		}
	}
}

func TestBookingHandlerErrors(t *testing.T) {
	t.Parallel()

	customerID := uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
	bookingID := "11111111-1111-1111-1111-111111111111"
	tests := []struct {
		name   string
		stub   *bookingServiceStub
		method string
		path   string
		body   string
		status int
	}{
		{"missing auth", &bookingServiceStub{}, http.MethodGet, "/bookings/mine", "", http.StatusUnauthorized},
		{"bad booking id", &bookingServiceStub{}, http.MethodPatch, "/bookings/bad/accept", "", http.StatusBadRequest},
		{"not found", &bookingServiceStub{err: service.ErrBookingNotFound}, http.MethodPatch, "/bookings/" + bookingID + "/accept", "", http.StatusNotFound},
		{"forbidden", &bookingServiceStub{err: service.ErrBookingForbidden}, http.MethodPatch, "/bookings/" + bookingID + "/accept", "", http.StatusForbidden},
		{"closed", &bookingServiceStub{err: service.ErrBookingClosed}, http.MethodPatch, "/bookings/" + bookingID + "/accept", "", http.StatusConflict},
		{"not ended", &bookingServiceStub{err: service.ErrBookingNotEnded}, http.MethodPatch, "/bookings/" + bookingID + "/complete", "", http.StatusUnprocessableEntity},
		{"list internal", &bookingServiceStub{err: errors.New("db")}, http.MethodGet, "/bookings/mine", "", http.StatusInternalServerError},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			router := gin.New()
			if tt.name != "missing auth" {
				router.Use(setCustomer(customerID))
			}
			h := NewBookingHandler(tt.stub)
			router.GET("/bookings/mine", h.ListMine)
			router.PATCH("/bookings/:id/accept", h.Accept)
			router.PATCH("/bookings/:id/complete", h.Complete)

			w := httptest.NewRecorder()
			router.ServeHTTP(w, httptest.NewRequest(tt.method, tt.path, strings.NewReader(tt.body)))
			if w.Code != tt.status {
				t.Fatalf("status = %d want %d body=%s", w.Code, tt.status, w.Body.String())
			}
		})
	}
}

func sampleBookingResponse(status string) model.BookingResponse {
	return model.BookingResponse{
		BookingID:     "11111111-1111-1111-1111-111111111111",
		ItemID:        "22222222-2222-2222-2222-222222222222",
		RenterID:      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
		StartDate:     "2026-06-01",
		EndDate:       "2026-06-04",
		BookingStatus: status,
	}
}

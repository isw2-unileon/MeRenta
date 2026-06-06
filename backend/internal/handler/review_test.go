package handler

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
	"github.com/isw2-unileon/MeRenta/backend/internal/service"
)

type reviewServiceStub struct {
	createErr  error
	listErr    error
	summaryErr error
}

func (s *reviewServiceStub) CreateReview(context.Context, uuid.UUID, model.CreateReviewRequest) (*model.ReceivedReviewResponse, error) {
	if s.createErr != nil {
		return nil, s.createErr
	}
	return &model.ReceivedReviewResponse{
		ReviewID:          "11111111-1111-1111-1111-111111111111",
		ReviewerID:        "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
		ReviewerFirstName: "Laura",
		ReviewerLastName:  "Garcia",
		Rating:            5,
		Comment:           "Todo perfecto",
		ReviewedAt:        time.Date(2026, 6, 1, 10, 0, 0, 0, time.UTC),
	}, nil
}

func (s *reviewServiceStub) ListReceivedReviews(context.Context, uuid.UUID, int, int) (*model.ReceivedReviewsResponse, error) {
	if s.listErr != nil {
		return nil, s.listErr
	}
	return &model.ReceivedReviewsResponse{
		Items: []model.ReceivedReviewResponse{},
		Total: 0,
		Page:  1,
		Limit: 4,
		Summary: model.ReviewSummaryResponse{
			Distribution: map[string]int64{"5": 0, "4": 0, "3": 0, "2": 0, "1": 0},
		},
	}, nil
}

func (s *reviewServiceStub) GetReceivedReviewSummary(context.Context, uuid.UUID) (*model.ReviewSummaryResponse, error) {
	if s.summaryErr != nil {
		return nil, s.summaryErr
	}
	return &model.ReviewSummaryResponse{AverageRating: 4.5, Total: 2, Distribution: map[string]int64{"5": 1, "4": 1, "3": 0, "2": 0, "1": 0}}, nil
}

func TestReviewHandlerHappyPaths(t *testing.T) {
	t.Parallel()

	customerID := uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
	targetID := "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
	router := gin.New()
	router.Use(setCustomer(customerID))
	h := NewReviewHandler(&reviewServiceStub{})
	router.POST("/reviews", h.Create)
	router.GET("/reviews/received", h.ListReceived)
	router.GET("/reviews/received/:id", h.ListReceivedByCustomer)
	router.GET("/reviews/summary/:id", h.SummaryByCustomer)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/reviews", strings.NewReader(`{"reviewed_id":"`+targetID+`","rating":5,"comment":"Todo perfecto"}`)))
	if w.Code != http.StatusCreated {
		t.Fatalf("create status = %d body=%s", w.Code, w.Body.String())
	}

	w = httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/reviews/received?page=2&limit=99", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("list received status = %d", w.Code)
	}

	w = httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/reviews/received/"+targetID, nil))
	if w.Code != http.StatusOK {
		t.Fatalf("public received status = %d", w.Code)
	}

	w = httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/reviews/summary/"+targetID, nil))
	if w.Code != http.StatusOK || !containsBody(w, `"average_rating":4.5`) {
		t.Fatalf("summary status = %d body=%s", w.Code, w.Body.String())
	}
}

func TestReviewHandlerErrors(t *testing.T) {
	t.Parallel()

	customerID := uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
	targetID := "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

	tests := []struct {
		name   string
		stub   *reviewServiceStub
		method string
		path   string
		body   string
		status int
	}{
		{name: "missing auth", stub: &reviewServiceStub{}, method: http.MethodPost, path: "/reviews", body: `{}`, status: http.StatusUnauthorized},
		{name: "bad body", stub: &reviewServiceStub{}, method: http.MethodPost, path: "/reviews", body: `{}`, status: http.StatusBadRequest},
		{name: "invalid rating", stub: &reviewServiceStub{createErr: service.ErrInvalidReviewRating}, method: http.MethodPost, path: "/reviews", body: `{"reviewed_id":"` + targetID + `","rating":5,"comment":"x"}`, status: http.StatusBadRequest},
		{name: "list error", stub: &reviewServiceStub{listErr: errors.New("db")}, method: http.MethodGet, path: "/reviews/received", status: http.StatusInternalServerError},
		{name: "summary invalid uuid", stub: &reviewServiceStub{}, method: http.MethodGet, path: "/reviews/summary/bad", status: http.StatusBadRequest},
		{name: "summary error", stub: &reviewServiceStub{summaryErr: errors.New("db")}, method: http.MethodGet, path: "/reviews/summary/" + targetID, status: http.StatusInternalServerError},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			router := gin.New()
			if tt.name != "missing auth" {
				router.Use(setCustomer(customerID))
			}
			h := NewReviewHandler(tt.stub)
			router.POST("/reviews", h.Create)
			router.GET("/reviews/received", h.ListReceived)
			router.GET("/reviews/summary/:id", h.SummaryByCustomer)

			w := httptest.NewRecorder()
			router.ServeHTTP(w, httptest.NewRequest(tt.method, tt.path, strings.NewReader(tt.body)))
			if w.Code != tt.status {
				t.Fatalf("status = %d want %d body=%s", w.Code, tt.status, w.Body.String())
			}
		})
	}
}

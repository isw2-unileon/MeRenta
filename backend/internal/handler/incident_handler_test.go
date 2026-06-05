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

type incidentServiceStub struct {
	err error
}

func (s *incidentServiceStub) Create(context.Context, uuid.UUID, model.CreateIncidentRequest) (*model.IncidentResponse, error) {
	return s.responseOrErr()
}

func (s *incidentServiceStub) CreateProductReport(context.Context, uuid.UUID, uuid.UUID, model.CreateProductReportRequest) (*model.IncidentResponse, error) {
	return s.responseOrErr()
}

func (s *incidentServiceStub) CreateUserReport(context.Context, uuid.UUID, uuid.UUID, model.CreateUserReportRequest) (*model.IncidentResponse, error) {
	return s.responseOrErr()
}

func (s *incidentServiceStub) ListMine(context.Context, uuid.UUID, int, int) (*model.IncidentListResponse, error) {
	if s.err != nil {
		return nil, s.err
	}
	return &model.IncidentListResponse{Items: []model.IncidentResponse{sampleIncidentResponse()}, Total: 1, Page: 1, Limit: 20}, nil
}

func (s *incidentServiceStub) ListAdmin(context.Context, string, string, int, int) (*model.IncidentListResponse, error) {
	return s.ListMine(context.Background(), uuid.Nil, 1, 20)
}

func (s *incidentServiceStub) GetByID(context.Context, uuid.UUID) (*model.IncidentResponse, error) {
	return s.responseOrErr()
}

func (s *incidentServiceStub) UpdateStatus(context.Context, uuid.UUID, string) (*model.IncidentResponse, error) {
	return s.responseOrErr()
}

func (s *incidentServiceStub) UpdatePriority(context.Context, uuid.UUID, string) (*model.IncidentResponse, error) {
	return s.responseOrErr()
}

func (s *incidentServiceStub) responseOrErr() (*model.IncidentResponse, error) {
	if s.err != nil {
		return nil, s.err
	}
	resp := sampleIncidentResponse()
	return &resp, nil
}

func TestIncidentHandlerHappyPaths(t *testing.T) {
	t.Parallel()

	customerID := uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
	incidentID := "11111111-1111-1111-1111-111111111111"
	targetID := "22222222-2222-2222-2222-222222222222"
	bookingID := "33333333-3333-3333-3333-333333333333"
	router := gin.New()
	router.Use(setCustomer(customerID))
	h := NewIncidentHandler(&incidentServiceStub{})
	router.POST("/incidents", h.Create)
	router.POST("/items/:id/reports", h.CreateProductReport)
	router.POST("/customers/:id/reports", h.CreateUserReport)
	router.GET("/incidents/mine", h.ListMine)
	router.GET("/admin/incidents", h.AdminList)
	router.GET("/admin/incidents/:id", h.AdminGet)
	router.PATCH("/admin/incidents/:id/status", h.AdminUpdateStatus)
	router.PATCH("/admin/incidents/:id/priority", h.AdminUpdatePriority)

	requests := []struct {
		method string
		path   string
		body   string
		status int
	}{
		{http.MethodPost, "/incidents", `{"booking_id":"` + bookingID + `","type":"damage","description":"Articulo danado"}`, http.StatusCreated},
		{http.MethodPost, "/items/" + targetID + "/reports", `{"type":"damage","description":"Articulo danado"}`, http.StatusCreated},
		{http.MethodPost, "/customers/" + targetID + "/reports", `{"type":"other","description":"Mal comportamiento"}`, http.StatusCreated},
		{http.MethodGet, "/incidents/mine", "", http.StatusOK},
		{http.MethodGet, "/admin/incidents?status=open&type=damage", "", http.StatusOK},
		{http.MethodGet, "/admin/incidents/" + incidentID, "", http.StatusOK},
		{http.MethodPatch, "/admin/incidents/" + incidentID + "/status", `{"status":"resolved"}`, http.StatusOK},
		{http.MethodPatch, "/admin/incidents/" + incidentID + "/priority", `{"priority":"high"}`, http.StatusOK},
	}

	for _, req := range requests {
		w := httptest.NewRecorder()
		router.ServeHTTP(w, httptest.NewRequest(req.method, req.path, strings.NewReader(req.body)))
		if w.Code != req.status {
			t.Fatalf("%s %s status = %d body=%s", req.method, req.path, w.Code, w.Body.String())
		}
	}
}

func TestIncidentHandlerErrors(t *testing.T) {
	t.Parallel()

	customerID := uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
	incidentID := "11111111-1111-1111-1111-111111111111"
	tests := []struct {
		name   string
		stub   *incidentServiceStub
		method string
		path   string
		body   string
		status int
	}{
		{"missing auth", &incidentServiceStub{}, http.MethodGet, "/incidents/mine", "", http.StatusUnauthorized},
		{"bad target", &incidentServiceStub{}, http.MethodPost, "/items/bad/reports", `{}`, http.StatusBadRequest},
		{"invalid type", &incidentServiceStub{err: service.ErrIncidentInvalidType}, http.MethodPost, "/incidents", `{"booking_id":"33333333-3333-3333-3333-333333333333","type":"bad","description":"Valid description"}`, http.StatusUnprocessableEntity},
		{"admin get not found", &incidentServiceStub{err: service.ErrIncidentNotFound}, http.MethodGet, "/admin/incidents/" + incidentID, "", http.StatusNotFound},
		{"bad status body", &incidentServiceStub{}, http.MethodPatch, "/admin/incidents/" + incidentID + "/status", `{}`, http.StatusBadRequest},
		{"invalid status", &incidentServiceStub{err: service.ErrIncidentInvalidStatus}, http.MethodPatch, "/admin/incidents/" + incidentID + "/status", `{"status":"bad"}`, http.StatusBadRequest},
		{"invalid priority", &incidentServiceStub{err: service.ErrIncidentInvalidPriority}, http.MethodPatch, "/admin/incidents/" + incidentID + "/priority", `{"priority":"bad"}`, http.StatusBadRequest},
		{"list internal", &incidentServiceStub{err: errors.New("db")}, http.MethodGet, "/incidents/mine", "", http.StatusInternalServerError},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			router := gin.New()
			if tt.name != "missing auth" {
				router.Use(setCustomer(customerID))
			}
			h := NewIncidentHandler(tt.stub)
			router.POST("/incidents", h.Create)
			router.POST("/items/:id/reports", h.CreateProductReport)
			router.GET("/incidents/mine", h.ListMine)
			router.GET("/admin/incidents/:id", h.AdminGet)
			router.PATCH("/admin/incidents/:id/status", h.AdminUpdateStatus)
			router.PATCH("/admin/incidents/:id/priority", h.AdminUpdatePriority)

			w := httptest.NewRecorder()
			router.ServeHTTP(w, httptest.NewRequest(tt.method, tt.path, strings.NewReader(tt.body)))
			if w.Code != tt.status {
				t.Fatalf("status = %d want %d body=%s", w.Code, tt.status, w.Body.String())
			}
		})
	}
}

func sampleIncidentResponse() model.IncidentResponse {
	now := time.Date(2026, 6, 1, 10, 0, 0, 0, time.UTC)
	return model.IncidentResponse{
		IncidentID:  "11111111-1111-1111-1111-111111111111",
		ReporterID:  "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
		ItemID:      "22222222-2222-2222-2222-222222222222",
		BookingID:   "33333333-3333-3333-3333-333333333333",
		Type:        "damage",
		Description: "Product damaged",
		Status:      "open",
		Priority:    "medium",
		ReportedAt:  &now,
	}
}

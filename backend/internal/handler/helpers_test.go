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
)

func TestParseUUIDParam(t *testing.T) {
	t.Parallel()

	router := gin.New()
	router.GET("/:id", func(c *gin.Context) {
		id, ok := parseUUIDParam(c)
		if !ok {
			return
		}
		c.String(http.StatusOK, id.String())
	})

	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/11111111-1111-1111-1111-111111111111", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}

	w = httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/bad-id", nil))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("invalid status = %d", w.Code)
	}
}

func TestGetCustomerID(t *testing.T) {
	t.Parallel()

	customerID := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	tests := []struct {
		name   string
		value  any
		status int
	}{
		{name: "valid", value: customerID, status: http.StatusOK},
		{name: "missing", value: nil, status: http.StatusUnauthorized},
		{name: "wrong type", value: "22222222-2222-2222-2222-222222222222", status: http.StatusUnauthorized},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			router := gin.New()
			router.Use(func(c *gin.Context) {
				if tt.value != nil {
					c.Set("customer_id", tt.value)
				}
				c.Next()
			})
			router.GET("/", func(c *gin.Context) {
				id, ok := getCustomerID(c)
				if !ok {
					return
				}
				c.String(http.StatusOK, id.String())
			})

			w := httptest.NewRecorder()
			router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/", nil))
			if w.Code != tt.status {
				t.Fatalf("status = %d, want %d", w.Code, tt.status)
			}
		})
	}
}

func TestRespondByIDMapsResults(t *testing.T) {
	t.Parallel()

	notFound := errors.New("not found")
	tests := []struct {
		name   string
		err    error
		status int
	}{
		{name: "ok", status: http.StatusOK},
		{name: "not found", err: notFound, status: http.StatusNotFound},
		{name: "internal", err: errors.New("boom"), status: http.StatusInternalServerError},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			router := gin.New()
			router.GET("/:id", func(c *gin.Context) {
				respondByID(c, notFound, func(uuid.UUID) (any, error) {
					if tt.err != nil {
						return nil, tt.err
					}
					return gin.H{"id": c.Param("id")}, nil
				})
			})

			w := httptest.NewRecorder()
			router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/33333333-3333-3333-3333-333333333333", nil))
			if w.Code != tt.status {
				t.Fatalf("status = %d, want %d", w.Code, tt.status)
			}
		})
	}
}

func TestBindAndCreate(t *testing.T) {
	t.Parallel()

	type request struct {
		Name string `json:"name" binding:"required"`
	}

	customerID := uuid.MustParse("44444444-4444-4444-4444-444444444444")
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("customer_id", customerID)
		c.Next()
	})
	router.POST("/", func(c *gin.Context) {
		bindAndCreate(c, func(_ context.Context, actorID uuid.UUID, req request) (gin.H, error) {
			if actorID != customerID {
				t.Fatalf("actorID = %s", actorID)
			}
			return gin.H{"name": req.Name}, nil
		}, func(error) int { return http.StatusConflict })
	})

	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"name":"mesa"}`)))
	if w.Code != http.StatusCreated {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}

	w = httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{}`)))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("invalid status = %d", w.Code)
	}
}

func TestRespondWithPaginated(t *testing.T) {
	t.Parallel()

	router := gin.New()
	router.GET("/", func(c *gin.Context) {
		respondWithPaginated(c, 20, 50, "fetch failed", "test", "value", func(page int, limit int) (any, error) {
			return gin.H{"page": page, "limit": limit}, nil
		})
	})
	router.GET("/error", func(c *gin.Context) {
		respondWithPaginated(c, 20, 50, "fetch failed", "test", "value", func(int, int) (any, error) {
			return nil, errors.New("boom")
		})
	})

	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/?page=2&limit=999", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), `"limit":50`) {
		t.Fatalf("body = %s", w.Body.String())
	}

	w = httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/error", nil))
	if w.Code != http.StatusInternalServerError {
		t.Fatalf("error status = %d", w.Code)
	}
}

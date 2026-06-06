package router

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestCoreRoutes(t *testing.T) {
	t.Parallel()

	r := gin.New()
	addCoreRoutes(r, nil)

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/health", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("health status = %d", w.Code)
	}

	w = httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/ready", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("ready status = %d", w.Code)
	}
}

func TestReadyRouteReportsReadinessFailure(t *testing.T) {
	t.Parallel()

	r := gin.New()
	addCoreRoutes(r, func(context.Context) error { return errors.New("db down") })

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/ready", nil))
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("ready status = %d", w.Code)
	}
}

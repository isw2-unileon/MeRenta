package handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestParsePositiveInt(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		raw      string
		fallback int
		max      int
		want     int
	}{
		{name: "valid", raw: "7", fallback: 1, max: 20, want: 7},
		{name: "invalid", raw: "abc", fallback: 3, max: 20, want: 3},
		{name: "zero", raw: "0", fallback: 3, max: 20, want: 3},
		{name: "negative", raw: "-2", fallback: 3, max: 20, want: 3},
		{name: "capped", raw: "200", fallback: 3, max: 48, want: 48},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := parsePositiveInt(tt.raw, tt.fallback, tt.max); got != tt.want {
				t.Fatalf("parsePositiveInt(%q) = %d, want %d", tt.raw, got, tt.want)
			}
		})
	}
}

func TestParseOptionalFloatQuery(t *testing.T) {
	t.Parallel()

	router := gin.New()
	router.GET("/", func(c *gin.Context) {
		value, ok := parseOptionalFloatQuery(c, "min_price")
		if !ok {
			return
		}
		if value == nil {
			c.String(http.StatusOK, "nil")
			return
		}
		c.String(http.StatusOK, "%.2f", *value)
	})

	tests := []struct {
		name   string
		path   string
		status int
		body   string
	}{
		{name: "missing", path: "/", status: http.StatusOK, body: "nil"},
		{name: "valid", path: "/?min_price=12.5", status: http.StatusOK, body: "12.50"},
		{name: "blank", path: "/?min_price=%20", status: http.StatusOK, body: "nil"},
		{name: "negative", path: "/?min_price=-1", status: http.StatusBadRequest, body: "invalid min_price"},
		{name: "invalid", path: "/?min_price=cheap", status: http.StatusBadRequest, body: "invalid min_price"},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			w := httptest.NewRecorder()
			router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, tt.path, nil))
			if w.Code != tt.status {
				t.Fatalf("status = %d, want %d; body = %s", w.Code, tt.status, w.Body.String())
			}
			if !strings.Contains(w.Body.String(), tt.body) {
				t.Fatalf("body = %s, want to contain %q", w.Body.String(), tt.body)
			}
		})
	}
}

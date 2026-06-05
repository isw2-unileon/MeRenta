package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestResolveAllowedOrigin(t *testing.T) {
	t.Parallel()

	if got := resolveAllowedOrigin("", "https://app.example.com"); got != "" {
		t.Fatalf("empty origin = %q", got)
	}
	if got := resolveAllowedOrigin("https://app.example.com", "https://admin.example.com, https://app.example.com"); got != "https://app.example.com" {
		t.Fatalf("allowed origin = %q", got)
	}
	if got := resolveAllowedOrigin("https://evil.example.com", "https://app.example.com"); got != "" {
		t.Fatalf("disallowed origin = %q", got)
	}
}

func TestCORSHeadersAndPreflight(t *testing.T) {
	t.Parallel()

	router := gin.New()
	router.Use(CORS("https://app.example.com"))
	router.GET("/", func(c *gin.Context) { c.Status(http.StatusNoContent) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Origin", "https://app.example.com")
	router.ServeHTTP(w, req)

	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "https://app.example.com" {
		t.Fatalf("allow origin = %q", got)
	}
	if got := w.Header().Get("Access-Control-Allow-Credentials"); got != "true" {
		t.Fatalf("allow credentials = %q", got)
	}

	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodOptions, "/", nil)
	req.Header.Set("Origin", "https://app.example.com")
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNoContent {
		t.Fatalf("preflight status = %d", w.Code)
	}
}

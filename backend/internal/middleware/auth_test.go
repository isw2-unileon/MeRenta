package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/isw2-unileon/MeRenta/backend/internal/sqlcdb"
	"github.com/isw2-unileon/MeRenta/backend/pkg/jwt"
	"github.com/isw2-unileon/MeRenta/backend/pkg/response"
)

func TestJWTAuthAcceptsCookieBearerAndQueryTokens(t *testing.T) {
	t.Parallel()

	manager := jwt.NewManager("test-secret-with-at-least-32-bytes", "merenta", "web", time.Hour, time.Second)
	customerID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	token, err := manager.Generate(customerID, "admin@example.com", string(sqlcdb.UserRoleAdmin))
	if err != nil {
		t.Fatalf("Generate returned error: %v", err)
	}

	tests := []struct {
		name      string
		configure func(*http.Request)
		target    string
	}{
		{name: "cookie", target: "/", configure: func(req *http.Request) { req.AddCookie(&http.Cookie{Name: authCookieName, Value: token}) }},
		{name: "bearer", target: "/", configure: func(req *http.Request) { req.Header.Set("Authorization", "Bearer "+token) }},
		{name: "access token query", target: "/?access_token=" + token, configure: func(*http.Request) {}},
		{name: "legacy token query", target: "/?token=" + token, configure: func(*http.Request) {}},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, tt.target, nil)
			tt.configure(req)
			router := gin.New()
			router.Use(JWTAuth(manager))
			router.GET("/", func(c *gin.Context) {
				if got, _ := c.Get("customer_id"); got != customerID {
					t.Fatalf("customer_id = %v", got)
				}
				c.Status(http.StatusNoContent)
			})

			router.ServeHTTP(w, req)

			if w.Code != http.StatusNoContent {
				t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
			}
		})
	}
}

func TestJWTAuthRejectsMissingInvalidAndUnknownRoleTokens(t *testing.T) {
	t.Parallel()

	manager := jwt.NewManager("test-secret-with-at-least-32-bytes", "merenta", "web", time.Hour, time.Second)
	unknownRoleToken, err := manager.Generate(uuid.New(), "x@example.com", "owner")
	if err != nil {
		t.Fatalf("Generate returned error: %v", err)
	}

	tests := []struct {
		name   string
		header string
		status int
	}{
		{name: "missing", status: http.StatusUnauthorized},
		{name: "invalid", header: "Bearer invalid", status: http.StatusUnauthorized},
		{name: "unknown role", header: "Bearer " + unknownRoleToken, status: http.StatusForbidden},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			if tt.header != "" {
				req.Header.Set("Authorization", tt.header)
			}
			router := gin.New()
			router.Use(JWTAuth(manager))
			router.GET("/", func(c *gin.Context) { c.Status(http.StatusNoContent) })

			router.ServeHTTP(w, req)

			if w.Code != tt.status {
				t.Fatalf("status = %d, want %d", w.Code, tt.status)
			}
			var body response.Response
			if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
				t.Fatalf("decode body: %v", err)
			}
			if body.Success {
				t.Fatalf("expected error body, got %+v", body)
			}
		})
	}
}

func TestRequireRole(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		role   any
		status int
	}{
		{name: "allowed", role: sqlcdb.UserRoleAdmin, status: http.StatusNoContent},
		{name: "wrong role", role: sqlcdb.UserRoleUser, status: http.StatusForbidden},
		{name: "wrong type", role: "admin", status: http.StatusForbidden},
		{name: "missing", role: nil, status: http.StatusForbidden},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			w := httptest.NewRecorder()
			router := gin.New()
			router.Use(func(c *gin.Context) {
				if tt.role != nil {
					c.Set("role", tt.role)
				}
				c.Next()
			})
			router.Use(RequireRole(sqlcdb.UserRoleAdmin))
			router.GET("/", func(c *gin.Context) { c.Status(http.StatusNoContent) })

			router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/", nil))

			if w.Code != tt.status {
				t.Fatalf("status = %d, want %d", w.Code, tt.status)
			}
		})
	}
}

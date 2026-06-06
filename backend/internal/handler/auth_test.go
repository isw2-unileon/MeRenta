package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/isw2-unileon/MeRenta/backend/internal/service"
)

func TestSetAndClearAuthCookie(t *testing.T) {
	for _, tt := range []struct {
		name       string
		mode       string
		wantSame   http.SameSite
		wantSecure bool
	}{
		{name: "debug uses lax non secure cookie", mode: gin.DebugMode, wantSame: http.SameSiteLaxMode},
		{name: "release uses none secure cookie", mode: gin.ReleaseMode, wantSame: http.SameSiteNoneMode, wantSecure: true},
	} {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			c, w := testGinContextWithMode(tt.mode)
			setAuthCookie(c, "token")

			cookies := w.Result().Cookies()
			if len(cookies) != 1 {
				t.Fatalf("cookies = %d, want 1", len(cookies))
			}
			cookie := cookies[0]
			if cookie.Name != authCookieName || cookie.Value != "token" {
				t.Fatalf("cookie = %+v", cookie)
			}
			if cookie.HttpOnly != true || cookie.Secure != tt.wantSecure || cookie.SameSite != tt.wantSame {
				t.Fatalf("cookie flags = %+v", cookie)
			}
		})
	}

	c, w := testGinContextWithMode(gin.DebugMode)
	clearAuthCookie(c)
	cookie := w.Result().Cookies()[0]
	if cookie.Value != "" || cookie.MaxAge != -1 {
		t.Fatalf("clear cookie = %+v", cookie)
	}
}

func TestWriteAuthBlockedOrError(t *testing.T) {
	until := time.Date(2026, 7, 1, 0, 0, 0, 0, time.UTC)
	tests := []struct {
		name     string
		err      error
		status   int
		contains string
	}{
		{name: "invalid credentials", err: service.ErrInvalidCredentials, status: http.StatusUnauthorized, contains: "invalid credentials"},
		{name: "banned", err: service.ErrAccountBanned, status: http.StatusForbidden, contains: "account_banned"},
		{name: "suspended", err: &service.ErrAccountSuspended{Until: &until}, status: http.StatusForbidden, contains: "account_suspended"},
		{name: "not active", err: service.ErrAccountNotActive, status: http.StatusForbidden, contains: "account is not active"},
		{name: "unknown", err: errors.New("boom"), status: http.StatusInternalServerError, contains: "internal server error"},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			c, w := testGinContextWithMode(gin.DebugMode)
			writeAuthBlockedOrError(c, tt.err)

			if w.Code != tt.status {
				t.Fatalf("status = %d, want %d; body = %s", w.Code, tt.status, w.Body.String())
			}
			if body := w.Body.String(); !strings.Contains(body, tt.contains) {
				t.Fatalf("body = %s, want to contain %q", body, tt.contains)
			}
		})
	}
}

func TestBlockedPayloadShape(t *testing.T) {
	t.Parallel()

	until := "2026-07-01T00:00:00Z"
	payload := blockedPayload("account_suspended", until)
	bytes, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}
	body := string(bytes)
	for _, want := range []string{`"success":false`, `"error":"account_suspended"`, `"suspended_until":"2026-07-01T00:00:00Z"`} {
		if !strings.Contains(body, want) {
			t.Fatalf("payload = %s, want %s", body, want)
		}
	}
}

func testGinContextWithMode(mode string) (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(mode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/", nil)
	return c, w
}

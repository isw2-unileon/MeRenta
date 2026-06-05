//go:build integration

package integration

import (
	"net/http"
	"testing"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
)

func TestAuthFlowRegisterLoginSessionAndLogout(t *testing.T) {
	app := setupTestApp(t)

	auth, registerCookie := registerViaHTTP(t, app, "auth")
	if auth.Token == "" {
		t.Fatal("expected register token")
	}

	var passwordHash string
	var status string
	if err := app.pool.QueryRow(app.ctx, "SELECT password_hash, account_status FROM customer WHERE email = $1", auth.Customer.Email).Scan(&passwordHash, &status); err != nil {
		t.Fatalf("query registered customer: %v", err)
	}
	if passwordHash == "password123" || passwordHash == "" {
		t.Fatalf("password was not hashed: %q", passwordHash)
	}
	if status != "active" {
		t.Fatalf("account_status = %q", status)
	}

	loginCookie := loginViaHTTP(t, app, auth.Customer.Email)
	if loginCookie.HttpOnly != true || loginCookie.Value == "" {
		t.Fatalf("login cookie = %+v", loginCookie)
	}

	w, res := doJSON(t, app, http.MethodGet, "/api/me", loginCookie, nil)
	requireStatus(t, w, http.StatusOK)
	me := decodeData[model.CustomerResponse](t, res)
	if me.Email != auth.Customer.Email || me.CustomerID != auth.Customer.CustomerID {
		t.Fatalf("/me = %+v want email=%s id=%s", me, auth.Customer.Email, auth.Customer.CustomerID)
	}

	w, _ = doJSON(t, app, http.MethodPost, "/api/auth/logout", registerCookie, nil)
	requireStatus(t, w, http.StatusOK)
	cleared := findCookie(t, w, "access_token")
	if cleared.Value != "" || cleared.MaxAge != -1 {
		t.Fatalf("logout cookie = %+v", cleared)
	}

	w, _ = doJSON(t, app, http.MethodGet, "/api/me", cleared, nil)
	requireStatus(t, w, http.StatusUnauthorized)
}

func TestAuthFlowDuplicateEmailKeepsSingleCustomer(t *testing.T) {
	app := setupTestApp(t)

	auth, _ := registerViaHTTP(t, app, "duplicate")
	w, res := doJSON(t, app, http.MethodPost, "/api/auth/register", nil, map[string]any{
		"first_name": "Integration",
		"last_name":  "Duplicate",
		"email":      auth.Customer.Email,
		"password":   "password123",
	})
	requireStatus(t, w, http.StatusConflict)
	if res.Error == "" {
		t.Fatalf("expected error envelope, got %+v", res)
	}

	var count int
	if err := app.pool.QueryRow(app.ctx, "SELECT count(*) FROM customer WHERE email = $1", auth.Customer.Email).Scan(&count); err != nil {
		t.Fatalf("count duplicate email: %v", err)
	}
	if count != 1 {
		t.Fatalf("customer count = %d want 1", count)
	}
}

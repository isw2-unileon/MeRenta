//go:build integration

package integration

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
	"github.com/isw2-unileon/MeRenta/backend/internal/service"
	"github.com/isw2-unileon/MeRenta/backend/internal/sqlcdb"
)

func TestSecurityProtectedAndAdminRoutes(t *testing.T) {
	app := setupTestApp(t)

	user, userCookie := registerViaHTTP(t, app, "security-user")
	admin, adminCookie := registerViaHTTP(t, app, "security-admin")
	promoteAdmin(t, app, admin.Customer.CustomerID)
	adminCookie = loginViaHTTP(t, app, admin.Customer.Email)

	w, _ := doJSON(t, app, http.MethodGet, "/api/me", nil, nil)
	requireStatus(t, w, http.StatusUnauthorized)

	req := httptest.NewRequest(http.MethodGet, "/api/me", nil)
	req.Header.Set("Authorization", "Bearer invalid-token")
	w = httptest.NewRecorder()
	app.router.ServeHTTP(w, req)
	requireStatus(t, w, http.StatusUnauthorized)

	w, _ = doJSON(t, app, http.MethodGet, "/api/admin/users", userCookie, nil)
	requireStatus(t, w, http.StatusForbidden)

	w, res := doJSON(t, app, http.MethodGet, "/api/admin/users", adminCookie, nil)
	requireStatus(t, w, http.StatusOK)
	if !res.Success {
		t.Fatalf("admin users response = %+v user=%s", res, user.Customer.Email)
	}
}

func TestAdminFlowUserStatusConfigAndAudit(t *testing.T) {
	app := setupTestApp(t)

	admin, adminCookie := registerViaHTTP(t, app, "admin")
	target, _ := registerViaHTTP(t, app, "target")
	promoteAdmin(t, app, admin.Customer.CustomerID)
	adminCookie = loginViaHTTP(t, app, admin.Customer.Email)

	until := time.Date(2026, 12, 31, 0, 0, 0, 0, time.UTC).Format(time.RFC3339)
	w, _ := doJSON(t, app, http.MethodPatch, "/api/admin/users/"+target.Customer.CustomerID+"/status", adminCookie, map[string]any{
		"status":          string(sqlcdb.AccountStatusSuspended),
		"suspended_until": until,
	})
	requireStatus(t, w, http.StatusOK)

	var status string
	if err := app.pool.QueryRow(app.ctx, "SELECT account_status FROM customer WHERE customer_id = $1", target.Customer.CustomerID).Scan(&status); err != nil {
		t.Fatalf("query target status: %v", err)
	}
	if status != string(sqlcdb.AccountStatusSuspended) {
		t.Fatalf("status = %q", status)
	}

	w, _ = doJSON(t, app, http.MethodPatch, "/api/admin/config", adminCookie, map[string]any{
		"allow_new_registrations": false,
	})
	requireStatus(t, w, http.StatusOK)

	w, res := doJSON(t, app, http.MethodGet, "/api/admin/config", adminCookie, nil)
	requireStatus(t, w, http.StatusOK)
	if !res.Success {
		t.Fatalf("config response = %+v", res)
	}

	w, res = doJSON(t, app, http.MethodGet, "/api/admin/stats", adminCookie, nil)
	requireStatus(t, w, http.StatusOK)
	if !res.Success {
		t.Fatalf("stats response = %+v", res)
	}

	w, res = doJSON(t, app, http.MethodPost, "/api/auth/register", nil, map[string]any{
		"first_name": "Closed",
		"last_name":  "Signup",
		"email":      uniqueEmail(t, "closed"),
		"password":   "password123",
	})
	requireStatus(t, w, http.StatusForbidden)
	if res.Error != service.ErrRegistrationDisabled.Error() {
		t.Fatalf("registration error = %+v", res)
	}

	w, res = doJSON(t, app, http.MethodGet, "/api/admin/audit?action=user_status_changed", adminCookie, nil)
	requireStatus(t, w, http.StatusOK)
	if !res.Success {
		t.Fatalf("audit response = %+v", res)
	}

	var auditCount int
	if err := app.pool.QueryRow(app.ctx, "SELECT count(*) FROM admin_audit_log WHERE entity_id = $1", target.Customer.CustomerID).Scan(&auditCount); err != nil {
		t.Fatalf("query audit log: %v", err)
	}
	if auditCount == 0 {
		t.Fatal("expected audit log for user status change")
	}
}

func TestAdminFlowVerificationDecision(t *testing.T) {
	app := setupTestApp(t)

	admin, adminCookie := registerViaHTTP(t, app, "verify-admin")
	target, targetCookie := registerViaHTTP(t, app, "verify-target")
	promoteAdmin(t, app, admin.Customer.CustomerID)
	adminCookie = loginViaHTTP(t, app, admin.Customer.Email)

	w, _ := doJSON(t, app, http.MethodPost, "/api/me/verification-request", targetCookie, nil)
	requireStatus(t, w, http.StatusOK)

	w, res := doJSON(t, app, http.MethodGet, "/api/admin/verification?status=pending", adminCookie, nil)
	requireStatus(t, w, http.StatusOK)
	if !res.Success {
		t.Fatalf("verification list response = %+v", res)
	}

	w, _ = doJSON(t, app, http.MethodPatch, "/api/admin/verification/"+target.Customer.CustomerID, adminCookie, map[string]any{
		"status": string(sqlcdb.VerificationStatusVerified),
	})
	requireStatus(t, w, http.StatusOK)

	var status string
	if err := app.pool.QueryRow(app.ctx, "SELECT verification_status FROM customer WHERE customer_id = $1", target.Customer.CustomerID).Scan(&status); err != nil {
		t.Fatalf("query verification status: %v", err)
	}
	if status != string(sqlcdb.VerificationStatusVerified) {
		t.Fatalf("verification status = %q", status)
	}
}

func TestAdminFlowProductsBookingsPaymentsAndIncidents(t *testing.T) {
	app := setupTestApp(t)

	admin, adminCookie := registerViaHTTP(t, app, "ops-admin")
	_, ownerCookie := registerViaHTTP(t, app, "ops-owner")
	_, renterCookie := registerViaHTTP(t, app, "ops-renter")
	promoteAdmin(t, app, admin.Customer.CustomerID)
	adminCookie = loginViaHTTP(t, app, admin.Customer.Email)

	address := createAddress(t, app, ownerCookie)
	item := createItem(t, app, ownerCookie, address.AddressID)
	deletable := createItem(t, app, ownerCookie, address.AddressID)
	booking := createBooking(t, app, renterCookie, item.ItemID, "2026-09-01", "2026-09-03", "pi_admin_ops")

	w, res := doJSON(t, app, http.MethodGet, "/api/admin/items?q=Patinete", adminCookie, nil)
	requireStatus(t, w, http.StatusOK)
	products := decodeData[model.SearchItemsResponse](t, res)
	if !searchContains(products.Items, item.ItemID) {
		t.Fatalf("admin products = %+v want %s", products, item.ItemID)
	}

	w, _ = doJSON(t, app, http.MethodDelete, "/api/admin/items/"+deletable.ItemID, adminCookie, nil)
	requireStatus(t, w, http.StatusOK)

	w, _ = doJSON(t, app, http.MethodGet, "/api/items/"+deletable.ItemID, renterCookie, nil)
	requireStatus(t, w, http.StatusNotFound)

	w, res = doJSON(t, app, http.MethodGet, "/api/admin/bookings?status=pending", adminCookie, nil)
	requireStatus(t, w, http.StatusOK)
	bookings := decodeData[model.BookingListResponse](t, res)
	if !bookingListContains(bookings.Items, booking.BookingID) {
		t.Fatalf("admin bookings = %+v want %s", bookings, booking.BookingID)
	}

	w, res = doJSON(t, app, http.MethodGet, "/api/admin/payments", adminCookie, nil)
	requireStatus(t, w, http.StatusOK)
	payments := decodeData[model.BookingListResponse](t, res)
	if !bookingListContains(payments.Items, booking.BookingID) {
		t.Fatalf("admin payments = %+v want %s", payments, booking.BookingID)
	}

	w, res = doJSON(t, app, http.MethodPatch, "/api/admin/bookings/"+booking.BookingID+"/status", adminCookie, map[string]any{
		"status": string(sqlcdb.BookingStatusAccepted),
	})
	requireStatus(t, w, http.StatusOK)
	updatedBooking := decodeData[model.BookingResponse](t, res)
	if updatedBooking.BookingStatus != string(sqlcdb.BookingStatusAccepted) {
		t.Fatalf("admin updated booking = %+v", updatedBooking)
	}

	w, res = doJSON(t, app, http.MethodPost, "/api/incidents", renterCookie, map[string]any{
		"booking_id":  booking.BookingID,
		"type":        "damage",
		"description": "Incidencia administrativa con coste revisable",
		"cost":        40,
	})
	requireStatus(t, w, http.StatusCreated)
	incident := decodeData[model.IncidentResponse](t, res)

	w, res = doJSON(t, app, http.MethodGet, "/api/incidents/mine", renterCookie, nil)
	requireStatus(t, w, http.StatusOK)
	mine := decodeData[model.IncidentListResponse](t, res)
	if !incidentListContains(mine.Items, incident.IncidentID) {
		t.Fatalf("mine incidents = %+v want %s", mine, incident.IncidentID)
	}

	w, res = doJSON(t, app, http.MethodGet, "/api/admin/incidents?status=open&type=damage", adminCookie, nil)
	requireStatus(t, w, http.StatusOK)
	incidents := decodeData[model.IncidentListResponse](t, res)
	if !incidentListContains(incidents.Items, incident.IncidentID) {
		t.Fatalf("admin incidents = %+v want %s", incidents, incident.IncidentID)
	}

	w, res = doJSON(t, app, http.MethodGet, "/api/admin/incidents/"+incident.IncidentID, adminCookie, nil)
	requireStatus(t, w, http.StatusOK)
	gotIncident := decodeData[model.IncidentResponse](t, res)
	if gotIncident.IncidentID != incident.IncidentID {
		t.Fatalf("admin incident = %+v", gotIncident)
	}

	w, res = doJSON(t, app, http.MethodPatch, "/api/admin/incidents/"+incident.IncidentID+"/status", adminCookie, map[string]any{
		"status": string(sqlcdb.IncidentStatusUnderReview),
	})
	requireStatus(t, w, http.StatusOK)
	statusChanged := decodeData[model.IncidentResponse](t, res)
	if statusChanged.Status != string(sqlcdb.IncidentStatusUnderReview) {
		t.Fatalf("status changed incident = %+v", statusChanged)
	}

	w, res = doJSON(t, app, http.MethodPatch, "/api/admin/incidents/"+incident.IncidentID+"/priority", adminCookie, map[string]any{
		"priority": "high",
	})
	requireStatus(t, w, http.StatusOK)
	priorityChanged := decodeData[model.IncidentResponse](t, res)
	if priorityChanged.Priority != "high" {
		t.Fatalf("priority changed incident = %+v", priorityChanged)
	}
}

func incidentListContains(items []model.IncidentResponse, incidentID string) bool {
	for _, item := range items {
		if item.IncidentID == incidentID {
			return true
		}
	}
	return false
}

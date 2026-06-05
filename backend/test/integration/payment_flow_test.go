//go:build integration

package integration

import (
	"net/http"
	"testing"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
)

func TestPaymentFlowCreatesIntentWithFakeStripe(t *testing.T) {
	app := setupTestApp(t)

	_, ownerCookie := registerViaHTTP(t, app, "payment-owner")
	_, renterCookie := registerViaHTTP(t, app, "payment-renter")
	address := createAddress(t, app, ownerCookie)
	item := createItem(t, app, ownerCookie, address.AddressID)

	w, res := doJSON(t, app, http.MethodPost, "/api/payment/intent", renterCookie, map[string]any{
		"item_id":       item.ItemID,
		"start_date":    "2026-09-01",
		"end_date":      "2026-09-03",
		"price_per_day": 18.5,
	})
	requireStatus(t, w, http.StatusOK)
	intent := decodeData[model.CreatePaymentIntentResponse](t, res)
	if intent.ClientSecret != "pi_secret_integration" || intent.PaymentIntentID != "pi_integration" {
		t.Fatalf("intent = %+v", intent)
	}
}

func TestPaymentFlowRejectsInvalidPayloadBeforeStripe(t *testing.T) {
	app := setupTestApp(t)

	_, cookie := registerViaHTTP(t, app, "payment-invalid")
	w, res := doJSON(t, app, http.MethodPost, "/api/payment/intent", cookie, map[string]any{
		"item_id":       "not-a-uuid",
		"start_date":    "2026-09-01",
		"end_date":      "2026-09-03",
		"price_per_day": 18.5,
	})
	requireStatus(t, w, http.StatusBadRequest)
	if res.Error == "" {
		t.Fatalf("expected error response, got %+v", res)
	}
}

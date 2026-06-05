//go:build integration

package integration

import (
	"net/http"
	"testing"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
	"github.com/isw2-unileon/MeRenta/backend/internal/sqlcdb"
)

func TestChatFlowStartSendListAndMarkRead(t *testing.T) {
	app := setupTestApp(t)

	_, ownerCookie := registerViaHTTP(t, app, "chat-owner")
	renter, renterCookie := registerViaHTTP(t, app, "chat-renter")
	address := createAddress(t, app, ownerCookie)
	item := createItem(t, app, ownerCookie, address.AddressID)

	w, res := doJSON(t, app, http.MethodPost, "/api/conversations", renterCookie, map[string]any{"item_id": item.ItemID})
	requireStatus(t, w, http.StatusCreated)
	conversation := decodeData[model.ConversationResponse](t, res)

	messageBody := "Hola, me interesa el patinete."
	w, res = doJSON(t, app, http.MethodPost, "/api/conversations/"+conversation.ConversationID+"/messages", renterCookie, map[string]any{"body": messageBody})
	requireStatus(t, w, http.StatusCreated)
	message := decodeData[model.MessageResponse](t, res)
	if message.Body != messageBody || !message.IsMine {
		t.Fatalf("message = %+v", message)
	}

	var storedBody string
	if err := app.pool.QueryRow(app.ctx, "SELECT body FROM message WHERE message_id = $1", message.MessageID).Scan(&storedBody); err != nil {
		t.Fatalf("query message body: %v", err)
	}
	if storedBody == messageBody {
		t.Fatal("message body was stored in plaintext")
	}

	w, res = doJSON(t, app, http.MethodGet, "/api/conversations/"+conversation.ConversationID+"/messages", renterCookie, nil)
	requireStatus(t, w, http.StatusOK)
	messages := decodeData[model.MessagesResponse](t, res)
	if messages.Total != 1 || messages.Items[0].Body != messageBody {
		t.Fatalf("messages = %+v", messages)
	}

	w, _ = doJSON(t, app, http.MethodPost, "/api/conversations/"+conversation.ConversationID+"/read", renterCookie, nil)
	requireStatus(t, w, http.StatusOK)
	if message.SenderID != renter.Customer.CustomerID {
		t.Fatalf("sender = %s want %s", message.SenderID, renter.Customer.CustomerID)
	}
}

func TestReviewAndIncidentFlow(t *testing.T) {
	app := setupTestApp(t)

	owner, ownerCookie := registerViaHTTP(t, app, "review-owner")
	renter, renterCookie := registerViaHTTP(t, app, "review-renter")
	address := createAddress(t, app, ownerCookie)
	item := createItem(t, app, ownerCookie, address.AddressID)

	w, _ := doJSON(t, app, http.MethodPost, "/api/reviews", renterCookie, map[string]any{
		"reviewed_id": decodeData[model.CustomerResponse](t, mustMe(t, app, renterCookie)).CustomerID,
		"rating":      5,
		"comment":     "No puedo valorarme",
	})
	requireStatus(t, w, http.StatusBadRequest)

	w, _ = doJSON(t, app, http.MethodPost, "/api/reviews", renterCookie, map[string]any{
		"reviewed_id": owner.Customer.CustomerID,
		"rating":      5,
		"comment":     "Todo perfecto",
	})
	requireStatus(t, w, http.StatusCreated)

	w, res := doJSON(t, app, http.MethodGet, "/api/reviews/summary/"+owner.Customer.CustomerID, renterCookie, nil)
	requireStatus(t, w, http.StatusOK)
	summary := decodeData[model.ReviewSummaryResponse](t, res)
	if summary.Total < 1 || summary.AverageRating < 5 {
		t.Fatalf("summary = %+v", summary)
	}

	w, _ = doJSON(t, app, http.MethodPost, "/api/items/"+item.ItemID+"/reports", renterCookie, map[string]any{
		"type":        "damage",
		"description": "Producto danado",
	})
	requireStatus(t, w, http.StatusCreated)

	var incidentType string
	if err := app.pool.QueryRow(app.ctx, "SELECT incident_type FROM incident WHERE item_id = $1", item.ItemID).Scan(&incidentType); err != nil {
		t.Fatalf("query incident: %v", err)
	}
	if incidentType != string(sqlcdb.IncidentTypeDamage) {
		t.Fatalf("incident type = %q", incidentType)
	}

	booking := createBooking(t, app, renterCookie, item.ItemID, "2026-01-20", "2026-01-22", "pi_incident")
	w, _ = doJSON(t, app, http.MethodPatch, "/api/bookings/"+booking.BookingID+"/accept", ownerCookie, nil)
	requireStatus(t, w, http.StatusOK)

	w, _ = doJSON(t, app, http.MethodPost, "/api/incidents", renterCookie, map[string]any{
		"booking_id":  booking.BookingID,
		"type":        "damage",
		"description": "El patinete presenta danos visibles al devolverlo",
		"cost":        25,
	})
	requireStatus(t, w, http.StatusCreated)

	w, _ = doJSON(t, app, http.MethodPost, "/api/customers/"+owner.Customer.CustomerID+"/reports", renterCookie, map[string]any{
		"type":        "other",
		"description": "Comunicacion inapropiada durante la operacion",
	})
	requireStatus(t, w, http.StatusCreated)

	var reporterCount int
	if err := app.pool.QueryRow(app.ctx, "SELECT count(*) FROM incident WHERE reporter_id = $1", renter.Customer.CustomerID).Scan(&reporterCount); err != nil {
		t.Fatalf("query reporter incidents: %v", err)
	}
	if reporterCount < 3 {
		t.Fatalf("reporter incident count = %d want at least 3", reporterCount)
	}
}

func mustMe(t *testing.T, app *testApp, cookie *http.Cookie) apiResponse {
	t.Helper()

	w, res := doJSON(t, app, http.MethodGet, "/api/me", cookie, nil)
	requireStatus(t, w, http.StatusOK)
	return res
}

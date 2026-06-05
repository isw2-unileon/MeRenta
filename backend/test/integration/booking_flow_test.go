//go:build integration

package integration

import (
	"net/http"
	"testing"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
	"github.com/isw2-unileon/MeRenta/backend/internal/sqlcdb"
)

func TestBookingFlowStateMachineAndUnavailableDates(t *testing.T) {
	app := setupTestApp(t)

	_, ownerCookie := registerViaHTTP(t, app, "booking-owner")
	_, renterCookie := registerViaHTTP(t, app, "booking-renter")
	_, thirdCookie := registerViaHTTP(t, app, "booking-third")
	address := createAddress(t, app, ownerCookie)
	item := createItem(t, app, ownerCookie, address.AddressID)

	w, res := doJSON(t, app, http.MethodPost, "/api/bookings", renterCookie, map[string]any{
		"item_id":           item.ItemID,
		"start_date":        "2026-07-10",
		"end_date":          "2026-07-12",
		"estimated_total":   37,
		"notes":             "Entrega por la manana",
		"payment_intent_id": "pi_booking_flow",
	})
	requireStatus(t, w, http.StatusCreated)
	booking := decodeData[model.BookingResponse](t, res)
	if booking.BookingStatus != string(sqlcdb.BookingStatusPending) {
		t.Fatalf("booking = %+v", booking)
	}

	w, res = doJSON(t, app, http.MethodGet, "/api/bookings/mine", renterCookie, nil)
	requireStatus(t, w, http.StatusOK)
	mine := decodeData[model.BookingListResponse](t, res)
	if !bookingListContains(mine.Items, booking.BookingID) {
		t.Fatalf("mine bookings = %+v want %s", mine, booking.BookingID)
	}

	w, res = doJSON(t, app, http.MethodGet, "/api/bookings/as-owner", ownerCookie, nil)
	requireStatus(t, w, http.StatusOK)
	asOwner := decodeData[model.BookingListResponse](t, res)
	if !bookingListContains(asOwner.Items, booking.BookingID) {
		t.Fatalf("owner bookings = %+v want %s", asOwner, booking.BookingID)
	}

	w, _ = doJSON(t, app, http.MethodPatch, "/api/bookings/"+booking.BookingID+"/accept", thirdCookie, nil)
	requireStatus(t, w, http.StatusForbidden)
	requireBookingStatus(t, app, booking.BookingID, string(sqlcdb.BookingStatusPending))

	w, _ = doJSON(t, app, http.MethodPatch, "/api/bookings/"+booking.BookingID+"/complete", renterCookie, nil)
	requireStatus(t, w, http.StatusConflict)
	requireBookingStatus(t, app, booking.BookingID, string(sqlcdb.BookingStatusPending))

	w, res = doJSON(t, app, http.MethodGet, "/api/items/"+item.ItemID+"/unavailable-dates", renterCookie, nil)
	requireStatus(t, w, http.StatusOK)
	ranges := decodeData[[]model.DateRangeResponse](t, res)
	if len(ranges) == 0 || ranges[0].StartDate != "2026-07-10" || ranges[0].EndDate != "2026-07-12" {
		t.Fatalf("unavailable ranges = %+v", ranges)
	}

	w, res = doJSON(t, app, http.MethodPatch, "/api/bookings/"+booking.BookingID+"/accept", ownerCookie, nil)
	requireStatus(t, w, http.StatusOK)
	accepted := decodeData[model.BookingResponse](t, res)
	if accepted.BookingStatus != string(sqlcdb.BookingStatusAccepted) {
		t.Fatalf("accepted = %+v", accepted)
	}
	requireBookingStatus(t, app, booking.BookingID, string(sqlcdb.BookingStatusAccepted))
}

func TestBookingFlowRejectAndCancelTransitions(t *testing.T) {
	app := setupTestApp(t)

	_, ownerCookie := registerViaHTTP(t, app, "owner")
	_, renterCookie := registerViaHTTP(t, app, "renter")
	address := createAddress(t, app, ownerCookie)
	item := createItem(t, app, ownerCookie, address.AddressID)

	rejected := createBooking(t, app, renterCookie, item.ItemID, "2026-08-01", "2026-08-03", "pi_reject")
	w, res := doJSON(t, app, http.MethodPatch, "/api/bookings/"+rejected.BookingID+"/reject", ownerCookie, nil)
	requireStatus(t, w, http.StatusOK)
	rejectedRes := decodeData[model.BookingResponse](t, res)
	if rejectedRes.BookingStatus != string(sqlcdb.BookingStatusRejected) {
		t.Fatalf("rejected = %+v", rejectedRes)
	}

	cancelled := createBooking(t, app, renterCookie, item.ItemID, "2026-08-10", "2026-08-12", "pi_cancel")
	w, res = doJSON(t, app, http.MethodPatch, "/api/bookings/"+cancelled.BookingID+"/cancel", renterCookie, nil)
	requireStatus(t, w, http.StatusOK)
	cancelledRes := decodeData[model.BookingResponse](t, res)
	if cancelledRes.BookingStatus != string(sqlcdb.BookingStatusCancelled) {
		t.Fatalf("cancelled = %+v", cancelledRes)
	}
}

func TestBookingFlowCompleteAcceptedPastBooking(t *testing.T) {
	app := setupTestApp(t)

	_, ownerCookie := registerViaHTTP(t, app, "complete-owner")
	_, renterCookie := registerViaHTTP(t, app, "complete-renter")
	address := createAddress(t, app, ownerCookie)
	item := createItem(t, app, ownerCookie, address.AddressID)

	booking := createBooking(t, app, renterCookie, item.ItemID, "2026-01-10", "2026-01-12", "pi_complete")
	w, _ := doJSON(t, app, http.MethodPatch, "/api/bookings/"+booking.BookingID+"/accept", ownerCookie, nil)
	requireStatus(t, w, http.StatusOK)

	w, res := doJSON(t, app, http.MethodPatch, "/api/bookings/"+booking.BookingID+"/complete", renterCookie, nil)
	requireStatus(t, w, http.StatusOK)
	completed := decodeData[model.BookingResponse](t, res)
	if completed.BookingStatus != string(sqlcdb.BookingStatusCompleted) {
		t.Fatalf("completed = %+v", completed)
	}
	requireBookingStatus(t, app, booking.BookingID, string(sqlcdb.BookingStatusCompleted))
}

func createBooking(t *testing.T, app *testApp, cookie *http.Cookie, itemID, start, end, paymentIntentID string) model.BookingResponse {
	t.Helper()

	w, res := doJSON(t, app, http.MethodPost, "/api/bookings", cookie, map[string]any{
		"item_id":           itemID,
		"start_date":        start,
		"end_date":          end,
		"estimated_total":   37,
		"payment_intent_id": paymentIntentID,
	})
	requireStatus(t, w, http.StatusCreated)
	return decodeData[model.BookingResponse](t, res)
}

func requireBookingStatus(t *testing.T, app *testApp, bookingID, want string) {
	t.Helper()

	var got string
	if err := app.pool.QueryRow(app.ctx, "SELECT booking_status FROM booking WHERE booking_id = $1", bookingID).Scan(&got); err != nil {
		t.Fatalf("query booking status: %v", err)
	}
	if got != want {
		t.Fatalf("booking status = %q want %q", got, want)
	}
}

func bookingListContains(items []model.BookingDetailResponse, bookingID string) bool {
	for _, item := range items {
		if item.BookingID == bookingID {
			return true
		}
	}
	return false
}

//go:build integration

package integration

import (
	"net/http"
	"testing"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
)

func TestAddressFlowUpdateDeleteAndOwnershipThroughRouter(t *testing.T) {
	app := setupTestApp(t)

	_, ownerCookie := registerViaHTTP(t, app, "address-owner")
	_, otherCookie := registerViaHTTP(t, app, "address-other")
	address := createAddress(t, app, ownerCookie)

	w, res := doJSON(t, app, http.MethodPatch, "/api/addresses/"+address.AddressID, ownerCookie, map[string]any{
		"street":      "Avenida Ordonez",
		"number":      "22",
		"floor":       "4B",
		"city":        "Leon",
		"province":    "Leon",
		"postal_code": "24002",
		"country":     "Spain",
	})
	requireStatus(t, w, http.StatusOK)
	updated := decodeData[model.AddressResponse](t, res)
	if updated.AddressID != address.AddressID || updated.Street != "Avenida Ordonez" || updated.Floor != "4B" {
		t.Fatalf("updated address = %+v", updated)
	}

	w, res = doJSON(t, app, http.MethodGet, "/api/addresses", ownerCookie, nil)
	requireStatus(t, w, http.StatusOK)
	addresses := decodeData[[]model.AddressResponse](t, res)
	if !addressListContains(addresses, address.AddressID, "Avenida Ordonez") {
		t.Fatalf("addresses after update = %+v", addresses)
	}

	w, _ = doJSON(t, app, http.MethodPatch, "/api/addresses/"+address.AddressID, otherCookie, map[string]any{
		"street":      "Calle Intrusa",
		"number":      "1",
		"city":        "Leon",
		"province":    "Leon",
		"postal_code": "24003",
	})
	requireStatus(t, w, http.StatusForbidden)

	w, _ = doJSON(t, app, http.MethodDelete, "/api/addresses/"+address.AddressID, otherCookie, nil)
	requireStatus(t, w, http.StatusForbidden)

	w, _ = doJSON(t, app, http.MethodDelete, "/api/addresses/"+address.AddressID, ownerCookie, nil)
	requireStatus(t, w, http.StatusOK)

	w, res = doJSON(t, app, http.MethodGet, "/api/addresses", ownerCookie, nil)
	requireStatus(t, w, http.StatusOK)
	addresses = decodeData[[]model.AddressResponse](t, res)
	if addressListContains(addresses, address.AddressID, "") {
		t.Fatalf("deleted address still listed = %+v", addresses)
	}
}

func addressListContains(addresses []model.AddressResponse, addressID, street string) bool {
	for _, address := range addresses {
		if address.AddressID == addressID && (street == "" || address.Street == street) {
			return true
		}
	}
	return false
}

//go:build integration

package integration

import (
	"net/http"
	"testing"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
)

func TestCatalogAddressProfileAndFavoritesFlow(t *testing.T) {
	app := setupTestApp(t)

	owner, ownerCookie := registerViaHTTP(t, app, "catalog-owner")
	_, renterCookie := registerViaHTTP(t, app, "catalog-renter")
	address := createAddress(t, app, ownerCookie)
	item := createItem(t, app, ownerCookie, address.AddressID)

	w, res := doJSON(t, app, http.MethodGet, "/api/addresses", ownerCookie, nil)
	requireStatus(t, w, http.StatusOK)
	addresses := decodeData[[]model.AddressResponse](t, res)
	if len(addresses) != 1 || addresses[0].AddressID != address.AddressID {
		t.Fatalf("addresses = %+v", addresses)
	}

	w, res = doJSON(t, app, http.MethodGet, "/api/customers/"+owner.Customer.CustomerID+"/profile", renterCookie, nil)
	requireStatus(t, w, http.StatusOK)
	profile := decodeData[model.CustomerResponse](t, res)
	if profile.CustomerID != owner.Customer.CustomerID {
		t.Fatalf("profile = %+v", profile)
	}

	w, res = doJSON(t, app, http.MethodGet, "/api/customers/"+owner.Customer.CustomerID+"/items", renterCookie, nil)
	requireStatus(t, w, http.StatusOK)
	ownerItems := decodeData[model.SearchItemsResponse](t, res)
	if !searchContains(ownerItems.Items, item.ItemID) {
		t.Fatalf("owner items = %+v want item %s", ownerItems, item.ItemID)
	}

	w, res = doJSON(t, app, http.MethodGet, "/api/items/mine", ownerCookie, nil)
	requireStatus(t, w, http.StatusOK)
	mine := decodeData[model.SearchItemsResponse](t, res)
	if !searchContains(mine.Items, item.ItemID) {
		t.Fatalf("mine items = %+v want item %s", mine, item.ItemID)
	}

	w, res = doJSON(t, app, http.MethodGet, "/api/items/"+item.ItemID, renterCookie, nil)
	requireStatus(t, w, http.StatusOK)
	gotItem := decodeData[model.ItemResponse](t, res)
	if gotItem.ItemID != item.ItemID || gotItem.UsageRules != usageRules {
		t.Fatalf("item = %+v", gotItem)
	}

	w, _ = doJSON(t, app, http.MethodPost, "/api/favorites/"+item.ItemID, ownerCookie, nil)
	requireStatus(t, w, http.StatusForbidden)

	w, res = doJSON(t, app, http.MethodGet, "/api/favorites/"+item.ItemID+"/check", renterCookie, nil)
	requireStatus(t, w, http.StatusOK)
	check := decodeData[model.FavoriteCheckResponse](t, res)
	if check.IsFavorite {
		t.Fatalf("favorite check before add = %+v", check)
	}

	w, _ = doJSON(t, app, http.MethodPost, "/api/favorites/"+item.ItemID, renterCookie, nil)
	requireStatus(t, w, http.StatusNoContent)

	w, res = doJSON(t, app, http.MethodGet, "/api/favorites", renterCookie, nil)
	requireStatus(t, w, http.StatusOK)
	favorites := decodeData[model.FavoritesResponse](t, res)
	if favorites.Total != 1 || len(favorites.Items) != 1 || favorites.Items[0].ItemID != item.ItemID {
		t.Fatalf("favorites = %+v", favorites)
	}

	w, res = doJSON(t, app, http.MethodGet, "/api/favorites/"+item.ItemID+"/check", renterCookie, nil)
	requireStatus(t, w, http.StatusOK)
	check = decodeData[model.FavoriteCheckResponse](t, res)
	if !check.IsFavorite {
		t.Fatalf("favorite check after add = %+v", check)
	}

	w, _ = doJSON(t, app, http.MethodDelete, "/api/favorites/"+item.ItemID, renterCookie, nil)
	requireStatus(t, w, http.StatusNoContent)

	w, res = doJSON(t, app, http.MethodGet, "/api/favorites/"+item.ItemID+"/check", renterCookie, nil)
	requireStatus(t, w, http.StatusOK)
	check = decodeData[model.FavoriteCheckResponse](t, res)
	if check.IsFavorite {
		t.Fatalf("favorite check after remove = %+v", check)
	}
}

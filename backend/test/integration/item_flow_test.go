//go:build integration

package integration

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"testing"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
)

func TestItemFlowCreateSearchUpdateForbiddenAndImages(t *testing.T) {
	app := setupTestApp(t)

	owner, ownerCookie := registerViaHTTP(t, app, "owner")
	_, otherCookie := registerViaHTTP(t, app, "other")
	address := createAddress(t, app, ownerCookie)
	item := createItem(t, app, ownerCookie, address.AddressID)

	if item.OwnerID != owner.Customer.CustomerID || item.UsageRules != usageRules {
		t.Fatalf("created item = %+v owner=%s", item, owner.Customer.CustomerID)
	}

	var dbOwnerID string
	var dbUsageRules string
	if err := app.pool.QueryRow(app.ctx, "SELECT owner_id::text, usage_rules FROM item WHERE item_id = $1", item.ItemID).Scan(&dbOwnerID, &dbUsageRules); err != nil {
		t.Fatalf("query item: %v", err)
	}
	if dbOwnerID != owner.Customer.CustomerID || dbUsageRules != usageRules {
		t.Fatalf("db owner=%s rules=%q", dbOwnerID, dbUsageRules)
	}

	w, res := doJSON(t, app, http.MethodGet, "/api/items?q=Patinete&city=Leon&page=1&limit=10", ownerCookie, nil)
	requireStatus(t, w, http.StatusOK)
	search := decodeData[model.SearchItemsResponse](t, res)
	if search.Total < 1 || !searchContains(search, item.ItemID) {
		t.Fatalf("search = %+v", search)
	}

	w, _ = doJSON(t, app, http.MethodPatch, "/api/items/"+item.ItemID, otherCookie, map[string]any{
		"address_id":    address.AddressID,
		"category":      "vehicles",
		"title":         "Intento ajeno",
		"description":   "No debe persistir",
		"usage_rules":   "No autorizado",
		"condition":     "good",
		"price_per_day": 20,
		"min_days":      1,
		"is_available":  true,
		"item_status":   "available",
	})
	requireStatus(t, w, http.StatusForbidden)

	var title string
	if err := app.pool.QueryRow(app.ctx, "SELECT title FROM item WHERE item_id = $1", item.ItemID).Scan(&title); err != nil {
		t.Fatalf("query item title: %v", err)
	}
	if title != item.Title {
		t.Fatalf("title changed after forbidden update: %q", title)
	}

	w, res = uploadImage(t, app, ownerCookie, item.ItemID)
	requireStatus(t, w, http.StatusCreated)
	images := decodeData[[]model.ItemImageResponse](t, res)
	if len(images) != 1 || images[0].ItemID != item.ItemID {
		t.Fatalf("images = %+v", images)
	}

	var imageCount int
	if err := app.pool.QueryRow(app.ctx, "SELECT count(*) FROM item_image WHERE item_id = $1", item.ItemID).Scan(&imageCount); err != nil {
		t.Fatalf("count item images: %v", err)
	}
	if imageCount != 1 {
		t.Fatalf("image count = %d want 1", imageCount)
	}

	w, _ = doJSON(t, app, http.MethodDelete, "/api/items/"+item.ItemID+"/images/"+images[0].ImageID, ownerCookie, nil)
	requireStatus(t, w, http.StatusOK)
}

func uploadImage(t *testing.T, app *testApp, cookie *http.Cookie, itemID string) (*httptest.ResponseRecorder, apiResponse) {
	t.Helper()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	header := make(textproto.MIMEHeader)
	header.Set("Content-Disposition", `form-data; name="images"; filename="patinete.jpg"`)
	header.Set("Content-Type", "image/jpeg")
	part, err := writer.CreatePart(header)
	if err != nil {
		t.Fatalf("create multipart image: %v", err)
	}
	if _, err := part.Write([]byte("fake-jpeg-bytes")); err != nil {
		t.Fatalf("write multipart image: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/items/"+itemID+"/images", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	if cookie != nil {
		req.AddCookie(cookie)
	}

	w := httptest.NewRecorder()
	app.router.ServeHTTP(w, req)
	var res apiResponse
	if w.Body.Len() > 0 {
		if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
			t.Fatalf("decode upload response: %v body=%s", err, w.Body.String())
		}
	}
	return w, res
}

func searchContains(res model.SearchItemsResponse, itemID string) bool {
	for _, item := range res.Items {
		if item.ItemID == itemID {
			return true
		}
	}
	return false
}

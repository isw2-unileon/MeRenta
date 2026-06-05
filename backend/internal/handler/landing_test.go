package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
	"github.com/isw2-unileon/MeRenta/backend/internal/service"
	"github.com/isw2-unileon/MeRenta/backend/internal/sqlcdb"
)

// landingQuerierFake satisfies the (unexported) service landingQuerier interface
// via structural typing, letting us drive the real LandingService end to end.
type landingQuerierFake struct {
	available    int64
	customers    int64
	reviewStats  sqlcdb.PlatformReviewStatsRow
	categoryRows []sqlcdb.CountItemCardsByCategoryRow
	itemRows     []sqlcdb.SearchItemCardsRow
	err          error
}

func (f *landingQuerierFake) CountAvailableItems(context.Context) (int64, error) {
	return f.available, f.err
}

func (f *landingQuerierFake) CountCustomers(context.Context) (int64, error) {
	return f.customers, f.err
}

func (f *landingQuerierFake) GetPlatformReviewStats(context.Context) (sqlcdb.PlatformReviewStatsRow, error) {
	return f.reviewStats, f.err
}

func (f *landingQuerierFake) SearchItemCards(
	context.Context,
	sqlcdb.SearchItemCardsParams,
) ([]sqlcdb.SearchItemCardsRow, error) {
	return f.itemRows, f.err
}

func (f *landingQuerierFake) CountItemCardsByCategory(
	context.Context,
	sqlcdb.CountItemCardsByCategoryParams,
) ([]sqlcdb.CountItemCardsByCategoryRow, error) {
	return f.categoryRows, f.err
}

func newLandingTestRouter(fake *landingQuerierFake) *gin.Engine {
	gin.SetMode(gin.TestMode)
	h := NewLandingHandler(service.NewLandingService(fake))
	r := gin.New()
	r.GET("/api/landing", h.Get)
	return r
}

func TestLandingHandlerReturnsPublicPayload(t *testing.T) {
	t.Parallel()

	var price pgtype.Numeric
	if err := price.Scan("12"); err != nil {
		t.Fatalf("building price: %v", err)
	}

	fake := &landingQuerierFake{
		available:   42,
		customers:   17,
		reviewStats: sqlcdb.PlatformReviewStatsRow{AverageRating: 4.5, TotalReviews: 8},
		categoryRows: []sqlcdb.CountItemCardsByCategoryRow{
			{Category: sqlcdb.CategoryEnumTools, TotalCount: 3},
			{Category: sqlcdb.CategoryEnumSports, TotalCount: 9},
		},
		itemRows: []sqlcdb.SearchItemCardsRow{{
			ItemID:      uuid.MustParse("33333333-3333-3333-3333-333333333333"),
			OwnerID:     uuid.MustParse("22222222-2222-2222-2222-222222222222"),
			AddressID:   uuid.MustParse("44444444-4444-4444-4444-444444444444"),
			Category:    sqlcdb.CategoryEnumSports,
			Title:       "Bicicleta",
			ItemStatus:  sqlcdb.ItemStatusAvailable,
			PricePerDay: price,
			IsAvailable: true,
			City:        "Leon",
			TotalCount:  1,
		}},
	}

	w := httptest.NewRecorder()
	newLandingTestRouter(fake).ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/landing", nil))

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}

	var body struct {
		Success bool                  `json:"success"`
		Data    model.LandingResponse `json:"data"`
		Error   string                `json:"error"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("decoding response: %v", err)
	}

	if !body.Success {
		t.Fatalf("expected success envelope, got %+v", body)
	}
	if body.Data.Stats.AvailableProducts != 42 || body.Data.Stats.Users != 17 {
		t.Fatalf("unexpected stats: %+v", body.Data.Stats)
	}
	if body.Data.Stats.AverageRating != 4.5 || body.Data.Stats.TotalReviews != 8 {
		t.Fatalf("unexpected review stats: %+v", body.Data.Stats)
	}
	// Categories must be sorted by count, descending.
	if len(body.Data.Categories) != 2 || body.Data.Categories[0].Category != "sports" {
		t.Fatalf("unexpected categories: %+v", body.Data.Categories)
	}
	if len(body.Data.Featured) != 1 || body.Data.Featured[0].Title != "Bicicleta" {
		t.Fatalf("unexpected featured: %+v", body.Data.Featured)
	}
}

func TestLandingHandlerReturns500OnError(t *testing.T) {
	t.Parallel()

	fake := &landingQuerierFake{err: errors.New("db down")}

	w := httptest.NewRecorder()
	newLandingTestRouter(fake).ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/landing", nil))

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	if !containsBody(w, "internal server error") {
		t.Fatalf("unexpected body: %s", w.Body.String())
	}
}

package service

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"

	"github.com/isw2-unileon/MeRenta/backend/internal/sqlcdb"
)

type landingQuerierStub struct {
	availableItems int64
	customers      int64
	reviewStats    sqlcdb.PlatformReviewStatsRow
	categoryRows   []sqlcdb.CountItemCardsByCategoryRow
	itemRows       []sqlcdb.SearchItemCardsRow
	searchArg      sqlcdb.SearchItemCardsParams
	err            error
}

func (s *landingQuerierStub) CountAvailableItems(context.Context) (int64, error) {
	return s.availableItems, s.err
}

func (s *landingQuerierStub) CountCustomers(context.Context) (int64, error) {
	return s.customers, s.err
}

func (s *landingQuerierStub) GetPlatformReviewStats(context.Context) (sqlcdb.PlatformReviewStatsRow, error) {
	return s.reviewStats, s.err
}

func (s *landingQuerierStub) SearchItemCards(
	_ context.Context,
	arg sqlcdb.SearchItemCardsParams,
) ([]sqlcdb.SearchItemCardsRow, error) {
	s.searchArg = arg
	return s.itemRows, s.err
}

func (s *landingQuerierStub) CountItemCardsByCategory(
	context.Context,
	sqlcdb.CountItemCardsByCategoryParams,
) ([]sqlcdb.CountItemCardsByCategoryRow, error) {
	return s.categoryRows, s.err
}

func TestLandingServiceAggregatesPublicData(t *testing.T) {
	t.Parallel()

	price, _ := float64ToNumeric(12)
	stub := &landingQuerierStub{
		availableItems: 42,
		customers:      17,
		reviewStats:    sqlcdb.PlatformReviewStatsRow{AverageRating: 4.5, TotalReviews: 8},
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

	res, err := NewLandingService(stub).GetLanding(context.Background())
	if err != nil {
		t.Fatalf("GetLanding returned error: %v", err)
	}

	if res.Stats.AvailableProducts != 42 || res.Stats.Users != 17 {
		t.Fatalf("unexpected stats: %+v", res.Stats)
	}
	if res.Stats.AverageRating != 4.5 || res.Stats.TotalReviews != 8 {
		t.Fatalf("unexpected review stats: %+v", res.Stats)
	}

	// Categories must come back sorted by count, descending.
	if len(res.Categories) != 2 || res.Categories[0].Category != "sports" || res.Categories[0].Count != 9 {
		t.Fatalf("unexpected categories: %+v", res.Categories)
	}

	if len(res.Featured) != 1 || res.Featured[0].Title != "Bicicleta" || res.Featured[0].PricePerDay != 12 {
		t.Fatalf("unexpected featured items: %+v", res.Featured)
	}

	// Featured listings must only include available items, newest first.
	if !stub.searchArg.RequireAvailable || stub.searchArg.Sort != "recent" || stub.searchArg.Limit != landingFeaturedLimit {
		t.Fatalf("unexpected search params: %+v", stub.searchArg)
	}
}

func TestLandingServicePropagatesErrors(t *testing.T) {
	t.Parallel()

	stub := &landingQuerierStub{err: errors.New("db down")}
	if _, err := NewLandingService(stub).GetLanding(context.Background()); err == nil {
		t.Fatal("expected error to propagate")
	}
}

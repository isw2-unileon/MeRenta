// Package service contains business logic for the API.
package service

import (
	"context"
	"sort"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
	"github.com/isw2-unileon/MeRenta/backend/internal/sqlcdb"
)

// landingFeaturedLimit caps how many listings are showcased in the landing hero.
const landingFeaturedLimit = 6

// landingQuerier is the minimal DB interface needed by LandingService.
// Keeping it small lets tests swap in a fake without the full sqlcdb.Querier.
type landingQuerier interface {
	CountAvailableItems(ctx context.Context) (int64, error)
	CountCustomers(ctx context.Context) (int64, error)
	GetPlatformReviewStats(ctx context.Context) (sqlcdb.PlatformReviewStatsRow, error)
	SearchItemCards(ctx context.Context, arg sqlcdb.SearchItemCardsParams) ([]sqlcdb.SearchItemCardsRow, error)
	CountItemCardsByCategory(ctx context.Context, arg sqlcdb.CountItemCardsByCategoryParams) ([]sqlcdb.CountItemCardsByCategoryRow, error)
}

// LandingService aggregates public marketplace data for the landing page.
type LandingService struct {
	q landingQuerier
}

// NewLandingService creates a LandingService with its dependencies.
func NewLandingService(q landingQuerier) *LandingService {
	return &LandingService{q: q}
}

// GetLanding returns marketplace stats, top categories and a few featured listings.
func (s *LandingService) GetLanding(ctx context.Context) (*model.LandingResponse, error) {
	availableProducts, err := s.q.CountAvailableItems(ctx)
	if err != nil {
		return nil, err
	}

	users, err := s.q.CountCustomers(ctx)
	if err != nil {
		return nil, err
	}

	reviewStats, err := s.q.GetPlatformReviewStats(ctx)
	if err != nil {
		return nil, err
	}

	categories, err := s.landingCategories(ctx)
	if err != nil {
		return nil, err
	}

	featured, err := s.featuredItems(ctx)
	if err != nil {
		return nil, err
	}

	return &model.LandingResponse{
		Stats: model.LandingStats{
			AvailableProducts: availableProducts,
			Users:             users,
			AverageRating:     reviewStats.AverageRating,
			TotalReviews:      reviewStats.TotalReviews,
		},
		Categories: categories,
		Featured:   featured,
	}, nil
}

// landingCategories returns the available categories, most populated first.
func (s *LandingService) landingCategories(ctx context.Context) ([]model.LandingCategory, error) {
	rows, err := s.q.CountItemCardsByCategory(ctx, sqlcdb.CountItemCardsByCategoryParams{RequireAvailable: true})
	if err != nil {
		return nil, err
	}

	categories := make([]model.LandingCategory, 0, len(rows))
	for _, row := range rows {
		categories = append(categories, model.LandingCategory{
			Category: string(row.Category),
			Count:    row.TotalCount,
		})
	}

	sort.SliceStable(categories, func(i, j int) bool {
		return categories[i].Count > categories[j].Count
	})

	return categories, nil
}

// featuredItems returns the most recently published available listings.
func (s *LandingService) featuredItems(ctx context.Context) ([]model.SearchItemResponse, error) {
	rows, err := s.q.SearchItemCards(ctx, sqlcdb.SearchItemCardsParams{
		RequireAvailable: true,
		Sort:             "recent",
		Limit:            landingFeaturedLimit,
		Offset:           0,
	})
	if err != nil {
		return nil, err
	}

	items, _, err := searchItemCardRowsToResponses(rows)
	if err != nil {
		return nil, err
	}

	return items, nil
}

// Package service contains business logic for the API.
package service

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
	"github.com/isw2-unileon/MeRenta/backend/internal/sqlcdb"
)

// favoriteQuerier is the minimal DB interface needed by FavoriteService.
type favoriteQuerier interface {
	AddFavorite(ctx context.Context, arg sqlcdb.AddFavoriteParams) error
	RemoveFavorite(ctx context.Context, arg sqlcdb.RemoveFavoriteParams) error
	IsFavorite(ctx context.Context, arg sqlcdb.IsFavoriteParams) (bool, error)
	ListFavoriteItems(ctx context.Context, customerID uuid.UUID) ([]sqlcdb.FavoriteItemRow, error)
	ExistsItemByID(ctx context.Context, itemID uuid.UUID) (bool, error)
}

// FavoriteService handles the favorites use cases.
type FavoriteService struct {
	q favoriteQuerier
}

// NewFavoriteService creates a FavoriteService with its dependencies.
func NewFavoriteService(q favoriteQuerier) *FavoriteService {
	return &FavoriteService{q: q}
}

// AddFavorite saves an item to the customer's favorites.
// Returns ErrItemNotFound when the item does not exist.
func (s *FavoriteService) AddFavorite(ctx context.Context, customerID, itemID uuid.UUID) error {
	exists, err := s.q.ExistsItemByID(ctx, itemID)
	if err != nil {
		return err
	}
	if !exists {
		return ErrItemNotFound
	}
	return s.q.AddFavorite(ctx, sqlcdb.AddFavoriteParams{
		CustomerID: customerID,
		ItemID:     itemID,
	})
}

// RemoveFavorite deletes an item from the customer's favorites (no-op if absent).
func (s *FavoriteService) RemoveFavorite(ctx context.Context, customerID, itemID uuid.UUID) error {
	return s.q.RemoveFavorite(ctx, sqlcdb.RemoveFavoriteParams{
		CustomerID: customerID,
		ItemID:     itemID,
	})
}

// IsFavorite reports whether a customer has saved a given item.
func (s *FavoriteService) IsFavorite(ctx context.Context, customerID, itemID uuid.UUID) (bool, error) {
	return s.q.IsFavorite(ctx, sqlcdb.IsFavoriteParams{
		CustomerID: customerID,
		ItemID:     itemID,
	})
}

// ListFavorites returns all items saved by a customer, newest first.
func (s *FavoriteService) ListFavorites(ctx context.Context, customerID uuid.UUID) (*model.FavoritesResponse, error) {
	rows, err := s.q.ListFavoriteItems(ctx, customerID)
	if err != nil {
		return nil, err
	}

	items := make([]model.FavoriteItemResponse, 0, len(rows))
	for _, row := range rows {
		item, err := toFavoriteItemResponse(row)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	return &model.FavoritesResponse{Items: items, Total: len(items)}, nil
}

// toFavoriteItemResponse maps a FavoriteItemRow to the API response model.
func toFavoriteItemResponse(row sqlcdb.FavoriteItemRow) (model.FavoriteItemResponse, error) {
	price, err := numericToFloat64(row.PricePerDay)
	if err != nil {
		return model.FavoriteItemResponse{}, fmt.Errorf("converting price_per_day: %w", err)
	}
	return model.FavoriteItemResponse{
		ItemID:          row.ItemID.String(),
		Category:        string(row.Category),
		Title:           row.Title,
		ItemStatus:      string(row.ItemStatus),
		PricePerDay:     price,
		IsAvailable:     row.IsAvailable,
		City:            row.City,
		PrimaryImageURL: row.PrimaryImageURL,
		SavedAt:         row.SavedAt.Time,
	}, nil
}

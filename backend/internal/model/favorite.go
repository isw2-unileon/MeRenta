// Package model contains request and response DTOs.
package model

import "time"

// FavoriteItemResponse is a compact item card returned in the favorites list.
type FavoriteItemResponse struct {
	ItemID          string    `json:"item_id"`
	Category        string    `json:"category"`
	Title           string    `json:"title"`
	ItemStatus      string    `json:"item_status"`
	PricePerDay     float64   `json:"price_per_day"`
	IsAvailable     bool      `json:"is_available"`
	City            string    `json:"city"`
	PrimaryImageURL string    `json:"primary_image_url,omitempty"`
	SavedAt         time.Time `json:"saved_at"`
}

// FavoritesResponse wraps the list of favorited items.
type FavoritesResponse struct {
	Items []FavoriteItemResponse `json:"items"`
	Total int                   `json:"total"`
}

// FavoriteCheckResponse reports whether an item is saved by the current customer.
type FavoriteCheckResponse struct {
	IsFavorite bool `json:"is_favorite"`
}

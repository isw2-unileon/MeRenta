// Package model contains request and response DTOs.
package model

import "time"

// CreateItemRequest defines the payload for creating a new item listing.
type CreateItemRequest struct {
	AddressID   string   `json:"address_id"    binding:"required,uuid"`
	Category    string   `json:"category"      binding:"required"`
	Title       string   `json:"title"         binding:"required,min=1,max=200"`
	Description string   `json:"description"   binding:"omitempty,max=2000"`
	Brand       string   `json:"brand"         binding:"omitempty,max=100"`
	Model       string   `json:"model"         binding:"omitempty,max=100"`
	PricePerDay float64  `json:"price_per_day" binding:"required,gt=0"`
	Deposit     *float64 `json:"deposit"       binding:"omitempty,gte=0"`
}

// ItemResponse is the API representation of an item listing.
type ItemResponse struct {
	ItemID      string    `json:"item_id"`
	OwnerID     string    `json:"owner_id"`
	AddressID   string    `json:"address_id"`
	Category    string    `json:"category"`
	Title       string    `json:"title"`
	Description string    `json:"description,omitempty"`
	Brand       string    `json:"brand,omitempty"`
	Model       string    `json:"model,omitempty"`
	ItemStatus  string    `json:"item_status"`
	PricePerDay float64   `json:"price_per_day"`
	Deposit     *float64  `json:"deposit,omitempty"`
	IsAvailable bool      `json:"is_available"`
	PublishedAt time.Time `json:"published_at"`
}

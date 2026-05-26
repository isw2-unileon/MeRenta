// Package model contains request and response DTOs.
package model

import "time"

// CreateItemRequest defines the payload for creating a new item listing.
type CreateItemRequest struct {
	AddressID   string   `json:"address_id"    binding:"required,uuid"`
	Category    string   `json:"category"      binding:"required"`
	Title       string   `json:"title"         binding:"required,min=1,max=200"`
	Description string   `json:"description"   binding:"omitempty,max=2000"`
	UsageRules  string   `json:"usage_rules"   binding:"omitempty,max=2000"`
	Condition   string   `json:"condition"     binding:"required"`
	PricePerDay float64  `json:"price_per_day" binding:"required,gt=0"`
	Deposit     *float64 `json:"deposit"       binding:"omitempty,gte=0"`
	MinDays     int      `json:"min_days"      binding:"omitempty,gte=1"`
	MaxDays     *int     `json:"max_days"      binding:"omitempty,gte=1"`
}

// ItemResponse is the API representation of an item listing.
type ItemResponse struct {
	ItemID      string    `json:"item_id"`
	OwnerID     string    `json:"owner_id"`
	AddressID   string    `json:"address_id"`
	Category    string    `json:"category"`
	Title       string    `json:"title"`
	Description string    `json:"description,omitempty"`
	UsageRules  string    `json:"usage_rules,omitempty"`
	Condition   string    `json:"condition"`
	ItemStatus  string    `json:"item_status"`
	PricePerDay float64   `json:"price_per_day"`
	Deposit     *float64  `json:"deposit,omitempty"`
	MinDays     int32     `json:"min_days"`
	MaxDays     *int32    `json:"max_days,omitempty"`
	IsAvailable bool      `json:"is_available"`
	PublishedAt time.Time `json:"published_at"`
}

// SearchItemResponse is the compact item shape used by the search results UI.
type SearchItemResponse struct {
	ItemID          string    `json:"item_id"`
	OwnerID         string    `json:"owner_id"`
	AddressID       string    `json:"address_id"`
	Category        string    `json:"category"`
	Title           string    `json:"title"`
	ItemStatus      string    `json:"item_status"`
	PricePerDay     float64   `json:"price_per_day"`
	IsAvailable     bool      `json:"is_available"`
	PublishedAt     time.Time `json:"published_at"`
	City            string    `json:"city"`
	PrimaryImageURL string    `json:"primary_image_url,omitempty"`
}

// SearchItemsResponse wraps paginated search results.
type SearchItemsResponse struct {
	Items           []SearchItemResponse `json:"items"`
	Total           int64                `json:"total"`
	Page            int                  `json:"page"`
	Limit           int                  `json:"limit"`
	CategoryCounts  map[string]int64     `json:"category_counts"`
	CityCounts      map[string]int64     `json:"city_counts"`
	ConditionCounts map[string]int64     `json:"condition_counts"`
}

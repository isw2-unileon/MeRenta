// Package model contains request and response DTOs.
package model

// LandingStats holds the marketplace-wide metrics shown on the public landing page.
type LandingStats struct {
	AvailableProducts int64   `json:"available_products"`
	Users             int64   `json:"users"`
	AverageRating     float64 `json:"average_rating"`
	TotalReviews      int64   `json:"total_reviews"`
}

// LandingCategory is a category with its available-item count for the landing page.
type LandingCategory struct {
	Category string `json:"category"`
	Count    int64  `json:"count"`
}

// LandingResponse is the public payload powering the marketing landing page.
type LandingResponse struct {
	Stats      LandingStats         `json:"stats"`
	Categories []LandingCategory    `json:"categories"`
	Featured   []SearchItemResponse `json:"featured"`
}

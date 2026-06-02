package model

import "time"

// CreateReviewRequest defines the payload for creating a review for another user.
type CreateReviewRequest struct {
	ReviewedID string `json:"reviewed_id" binding:"required,uuid"`
	Rating     int32  `json:"rating"      binding:"required,min=1,max=5"`
	Comment    string `json:"comment"     binding:"omitempty,max=1000"`
}

// ReviewSummaryResponse aggregates ratings received by a customer.
type ReviewSummaryResponse struct {
	AverageRating float64          `json:"average_rating"`
	Total         int64            `json:"total"`
	Distribution  map[string]int64 `json:"distribution"`
}

// ReceivedReviewResponse is a public review received by a customer.
type ReceivedReviewResponse struct {
	ReviewID          string    `json:"review_id"`
	ReviewerID        string    `json:"reviewer_id"`
	ReviewerFirstName string    `json:"reviewer_first_name"`
	ReviewerLastName  string    `json:"reviewer_last_name"`
	ReviewerAvatarURL string    `json:"reviewer_avatar_url,omitempty"`
	Rating            int32     `json:"rating"`
	Comment           string    `json:"comment"`
	ReviewedAt        time.Time `json:"reviewed_at"`
}

// ReceivedReviewsResponse wraps reviews received by a customer.
type ReceivedReviewsResponse struct {
	Items   []ReceivedReviewResponse `json:"items"`
	Total   int64                    `json:"total"`
	Page    int                      `json:"page"`
	Limit   int                      `json:"limit"`
	Summary ReviewSummaryResponse    `json:"summary"`
}

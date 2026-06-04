// Package model defines request and response types for the booking layer.
package model

// CreateBookingRequest is the body sent by the frontend after a successful Stripe payment.
// The payment_intent_id ties the booking to the charge so refunds can be issued automatically.
type CreateBookingRequest struct {
	ItemID          string   `json:"item_id"           binding:"required,uuid"`
	StartDate       string   `json:"start_date"        binding:"required"`
	EndDate         string   `json:"end_date"          binding:"required"`
	EstimatedTotal  *float64 `json:"estimated_total"`
	Notes           string   `json:"notes"`
	PaymentIntentID string   `json:"payment_intent_id" binding:"required"`
}

// BookingResponse is returned for create / status-update operations.
type BookingResponse struct {
	BookingID       string   `json:"booking_id"`
	ItemID          string   `json:"item_id"`
	RenterID        string   `json:"renter_id"`
	StartDate       string   `json:"start_date"`
	EndDate         string   `json:"end_date"`
	RequestedAt     string   `json:"requested_at"`
	BookingStatus   string   `json:"booking_status"`
	EstimatedTotal  *float64 `json:"estimated_total"`
	Notes           string   `json:"notes"`
	PaymentIntentID string   `json:"payment_intent_id"`
	ExpiresAt       string   `json:"expires_at"`
}

// BookingDetailResponse is returned for list / detail queries with joined data.
type BookingDetailResponse struct {
	BookingID                string   `json:"booking_id"`
	ItemID                   string   `json:"item_id"`
	ItemTitle                string   `json:"item_title"`
	ItemImageURL             string   `json:"item_image_url"`
	RenterID                 string   `json:"renter_id"`
	RenterFirstName          string   `json:"renter_first_name"`
	RenterLastName           string   `json:"renter_last_name"`
	RenterVerificationStatus string   `json:"renter_verification_status"`
	OwnerID                  string   `json:"owner_id"`
	StartDate                string   `json:"start_date"`
	EndDate                  string   `json:"end_date"`
	RequestedAt              string   `json:"requested_at"`
	BookingStatus            string   `json:"booking_status"`
	EstimatedTotal           *float64 `json:"estimated_total"`
	Notes                    string   `json:"notes"`
	PaymentIntentID          string   `json:"payment_intent_id"`
	ExpiresAt                string   `json:"expires_at"`
}

// BookingListResponse wraps a paginated list of booking detail rows.
type BookingListResponse struct {
	Items []BookingDetailResponse `json:"items"`
	Total int64                   `json:"total"`
}

// DateRangeResponse is a blocked date interval returned by the unavailable-dates endpoint.
type DateRangeResponse struct {
	StartDate string `json:"start_date"`
	EndDate   string `json:"end_date"`
}

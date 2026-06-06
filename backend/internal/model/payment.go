// Package model defines request and response types for the payment layer.
package model

// CreatePaymentIntentRequest is the body sent by the frontend
// to initialize a Stripe PaymentIntent for a rental.
type CreatePaymentIntentRequest struct {
	ItemID      string  `json:"item_id"      binding:"required,uuid"`
	StartDate   string  `json:"start_date"   binding:"required"`
	EndDate     string  `json:"end_date"     binding:"required"`
	PricePerDay float64 `json:"price_per_day" binding:"required,gt=0"`
	// Category determines the per-day insurance premium. Optional: an empty or
	// unknown category falls back to the default rate.
	Category string `json:"category" binding:"omitempty"`
}

// CreatePaymentIntentResponse carries the client secret back to the browser
// together with the authoritative total the server computed.
type CreatePaymentIntentResponse struct {
	ClientSecret    string  `json:"client_secret"`
	PaymentIntentID string  `json:"payment_intent_id"`
	AmountEUR       float64 `json:"amount_eur"`
}

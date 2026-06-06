// Package service contains business logic for the application.
package service

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/stripe/stripe-go/v82"
	"github.com/stripe/stripe-go/v82/paymentintent"
	"github.com/stripe/stripe-go/v82/refund"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
)

const (
	// serviceFeeEUR is the fixed platform fee added to every rental.
	serviceFeeEUR = 5.0
	// defaultInsuranceDailyRateEUR is the per-day insurance cost for unknown
	// or unspecified categories.
	defaultInsuranceDailyRateEUR = 2.3
)

// insuranceDailyRatesByCategory holds the mock per-day insurance premium (EUR)
// for each product category. Higher-value or higher-risk categories cost more.
// These are computed on the fly — there is no insurance table in the database.
var insuranceDailyRatesByCategory = map[string]float64{
	"vehicles":    4.5,
	"electronics": 3.5,
	"photography": 3.5,
	"music":       3.0,
	"sports":      2.5,
	"camping":     2.5,
	"tools":       2.0,
	"gardening":   2.0,
	"leisure":     1.8,
	"home":        1.8,
	"clothing":    1.2,
	"other":       2.3,
}

// insuranceDailyRate returns the per-day insurance premium for a category,
// falling back to the default rate for empty or unknown categories.
func insuranceDailyRate(category string) float64 {
	if rate, ok := insuranceDailyRatesByCategory[category]; ok {
		return rate
	}
	return defaultInsuranceDailyRateEUR
}

// PaymentService handles Stripe PaymentIntent creation.
type PaymentService struct{}

// NewPaymentService wires up a PaymentService and configures the Stripe SDK
// with the provided secret key.
func NewPaymentService(stripeSecretKey string) *PaymentService {
	stripe.Key = stripeSecretKey
	return &PaymentService{}
}

// CreatePaymentIntent computes the authoritative rental total and creates a
// Stripe PaymentIntent. The returned client secret lets the browser confirm
// the charge without the secret key leaving the server.
func (s *PaymentService) CreatePaymentIntent(
	_ context.Context,
	req model.CreatePaymentIntentRequest,
) (model.CreatePaymentIntentResponse, error) {
	days, err := rentalDays(req.StartDate, req.EndDate)
	if err != nil {
		return model.CreatePaymentIntentResponse{}, fmt.Errorf("invalid dates: %w", err)
	}
	if days < 1 {
		return model.CreatePaymentIntentResponse{}, fmt.Errorf("end_date must be after start_date")
	}

	subtotal := req.PricePerDay * float64(days)
	insurance := math.Round(insuranceDailyRate(req.Category)*float64(days)*100) / 100
	total := subtotal + serviceFeeEUR + insurance

	// Stripe amounts are in the smallest currency unit (cents for EUR).
	amountCents := int64(math.Round(total * 100))

	params := &stripe.PaymentIntentParams{
		Amount:   stripe.Int64(amountCents),
		Currency: stripe.String(string(stripe.CurrencyEUR)),
		Metadata: map[string]string{
			"item_id":    req.ItemID,
			"start_date": req.StartDate,
			"end_date":   req.EndDate,
		},
	}

	pi, err := paymentintent.New(params)
	if err != nil {
		return model.CreatePaymentIntentResponse{}, fmt.Errorf("stripe create intent: %w", err)
	}

	return model.CreatePaymentIntentResponse{
		ClientSecret:    pi.ClientSecret,
		PaymentIntentID: pi.ID,
		AmountEUR:       total,
	}, nil
}

// RefundPayment issues a full Stripe refund for the given PaymentIntent.
// If the intent has no completed charge it is a no-op.
func (s *PaymentService) RefundPayment(_ context.Context, paymentIntentID string) error {
	if paymentIntentID == "" {
		return nil
	}
	_, err := refund.New(&stripe.RefundParams{
		PaymentIntent: stripe.String(paymentIntentID),
	})
	if err != nil {
		return fmt.Errorf("stripe refund: %w", err)
	}
	return nil
}

// rentalDays returns the number of calendar days in a rental period.
func rentalDays(startDate, endDate string) (int, error) {
	const layout = "2006-01-02"
	const hoursPerDay = 24

	start, err := time.Parse(layout, startDate)
	if err != nil {
		return 0, fmt.Errorf("invalid start_date %q: %w", startDate, err)
	}
	end, err := time.Parse(layout, endDate)
	if err != nil {
		return 0, fmt.Errorf("invalid end_date %q: %w", endDate, err)
	}

	return int(end.Sub(start).Hours() / hoursPerDay), nil
}

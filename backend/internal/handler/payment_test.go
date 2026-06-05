package handler

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
)

type paymentServiceStub struct {
	err error
	req model.CreatePaymentIntentRequest
}

func (s *paymentServiceStub) CreatePaymentIntent(_ context.Context, req model.CreatePaymentIntentRequest) (model.CreatePaymentIntentResponse, error) {
	s.req = req
	if s.err != nil {
		return model.CreatePaymentIntentResponse{}, s.err
	}
	return model.CreatePaymentIntentResponse{ClientSecret: "secret", PaymentIntentID: "pi_123", AmountEUR: 18.4}, nil
}

func TestPaymentHandlerCreateIntent(t *testing.T) {
	t.Parallel()

	stub := &paymentServiceStub{}
	router := gin.New()
	router.POST("/payment/intent", NewPaymentHandler(stub).CreateIntent)

	w := httptest.NewRecorder()
	body := `{"item_id":"11111111-1111-1111-1111-111111111111","start_date":"2026-06-01","end_date":"2026-06-03","price_per_day":8}`
	router.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/payment/intent", strings.NewReader(body)))

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d body=%s", w.Code, w.Body.String())
	}
	if stub.req.ItemID != "11111111-1111-1111-1111-111111111111" || !containsBody(w, `"payment_intent_id":"pi_123"`) {
		t.Fatalf("unexpected req=%+v body=%s", stub.req, w.Body.String())
	}
}

func TestPaymentHandlerCreateIntentErrors(t *testing.T) {
	t.Parallel()

	router := gin.New()
	router.POST("/payment/intent", NewPaymentHandler(&paymentServiceStub{err: errors.New("invalid dates")}).CreateIntent)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/payment/intent", strings.NewReader(`{}`)))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("bind status = %d", w.Code)
	}

	w = httptest.NewRecorder()
	body := `{"item_id":"11111111-1111-1111-1111-111111111111","start_date":"2026-06-01","end_date":"2026-06-03","price_per_day":8}`
	router.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/payment/intent", strings.NewReader(body)))
	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("service status = %d", w.Code)
	}
}

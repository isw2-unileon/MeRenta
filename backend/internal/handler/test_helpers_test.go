package handler

import (
	"net/http/httptest"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func setCustomer(customerID uuid.UUID) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set("customer_id", customerID)
		c.Next()
	}
}

func containsBody(w *httptest.ResponseRecorder, value string) bool {
	return strings.Contains(w.Body.String(), value)
}

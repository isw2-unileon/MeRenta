// Package handler provides HTTP handlers for the API.
package handler

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/isw2-unileon/MeRenta/backend/pkg/response"
)

type paginatedResponder func(page int, limit int) (any, error)

// parseUUIDParam extracts the ":id" route parameter and parses it as a UUID.
// On success it returns the UUID and true.
// On failure it writes a 400 response and returns false, so the caller can
// return immediately without writing a second response.
func parseUUIDParam(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.Error(c, http.StatusBadRequest, "invalid id")
		return uuid.UUID{}, false
	}

	return id, true
}

// parseUUIDString parses a UUID from a request payload field.
// On failure it writes a 400 response and returns false.
func parseUUIDString(c *gin.Context, value string) (uuid.UUID, bool) {
	id, err := uuid.Parse(value)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "invalid id")
		return uuid.UUID{}, false
	}

	return id, true
}

// getCustomerID extracts the authenticated customer's UUID from the Gin context.
// On failure it writes a 401 response and returns false.
func getCustomerID(c *gin.Context) (uuid.UUID, bool) {
	raw, ok := c.Get("customer_id")
	if !ok {
		response.Error(c, http.StatusUnauthorized, "missing auth context")
		return uuid.UUID{}, false
	}
	id, ok := raw.(uuid.UUID)
	if !ok {
		response.Error(c, http.StatusUnauthorized, "invalid auth context")
		return uuid.UUID{}, false
	}
	return id, true
}

func respondWithPaginated(
	c *gin.Context,
	defaultLimit int,
	maxLimit int,
	logMessage string,
	logKey string,
	logValue any,
	fetch paginatedResponder,
) {
	page := parsePositiveInt(c.DefaultQuery("page", "1"), 1, 500)
	limit := parsePositiveInt(c.DefaultQuery("limit", ""), defaultLimit, maxLimit)

	res, err := fetch(page, limit)
	if err != nil {
		slog.Error(logMessage, logKey, logValue, "error", err)
		response.Error(c, http.StatusInternalServerError, "internal server error")
		return
	}

	response.OK(c, http.StatusOK, res)
}

// Package handler provides HTTP handlers for the API.
package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/isw2-unileon/MeRenta/backend/pkg/response"
)

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

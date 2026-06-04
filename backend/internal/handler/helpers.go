// Package handler provides HTTP handlers for the API.
package handler

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/isw2-unileon/MeRenta/backend/pkg/response"
)

type paginatedResponder func(page int, limit int) (any, error)

// respondByID parses the ":id" route param, runs fetch, and writes the result as
// 200 — mapping a notFound match to 404 and any other error to 500.
func respondByID(c *gin.Context, notFound error, fetch func(uuid.UUID) (any, error)) {
	id, ok := parseUUIDParam(c)
	if !ok {
		return
	}

	res, err := fetch(id)
	switch {
	case err == nil:
		response.OK(c, http.StatusOK, res)
	case errors.Is(err, notFound):
		response.Error(c, http.StatusNotFound, err.Error())
	default:
		response.Error(c, http.StatusInternalServerError, "internal server error")
	}
}

// parseUUIDParam extracts the ":id" route parameter and parses it as a UUID.
// On success, it returns the UUID and true.
// On failure, it writes a 400 response and returns false, so the caller can
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
// On failure, it writes a 400 response and returns false.
func parseUUIDString(c *gin.Context, value string) (uuid.UUID, bool) {
	id, err := uuid.Parse(value)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "invalid id")
		return uuid.UUID{}, false
	}

	return id, true
}

// getCustomerID extracts the authenticated customer's UUID from the Gin context.
// On failure, it writes a 401 response and returns false.
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

// bindAndCreate handles the common POST handler pattern: authenticate → bind JSON →
// call a service method that takes (ctx, actorID, req) → respond 201.
func bindAndCreate[Req any, Res any](
	c *gin.Context,
	svcFn func(context.Context, uuid.UUID, Req) (Res, error),
	errStatusFn func(error) int,
) {
	customerID, ok := getCustomerID(c)
	if !ok {
		return
	}
	var req Req
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, formatBindError(err))
		return
	}
	res, err := svcFn(c.Request.Context(), customerID, req)
	if err != nil {
		response.Error(c, errStatusFn(err), err.Error())
		return
	}
	response.OK(c, http.StatusCreated, res)
}

// bindAndCreateForTarget handles POST handlers that need both an actor ID and a
// target resource UUID: authenticate → parse :id → bind JSON → call service → 201.
func bindAndCreateForTarget[Req any, Res any](
	c *gin.Context,
	svcFn func(context.Context, uuid.UUID, uuid.UUID, Req) (Res, error),
	errStatusFn func(error) int,
) {
	actorID, ok := getCustomerID(c)
	if !ok {
		return
	}
	targetID, ok := parseUUIDParam(c)
	if !ok {
		return
	}
	var req Req
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, formatBindError(err))
		return
	}
	res, err := svcFn(c.Request.Context(), actorID, targetID, req)
	if err != nil {
		response.Error(c, errStatusFn(err), err.Error())
		return
	}
	response.OK(c, http.StatusCreated, res)
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

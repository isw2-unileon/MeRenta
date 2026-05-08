// Package handler provides HTTP handlers for the API.
package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/isw2-unileon/MeRenta/backend/internal/model"
	"github.com/isw2-unileon/MeRenta/backend/internal/service"
	"github.com/isw2-unileon/MeRenta/backend/pkg/response"
)

// AuthHandler wires authentication endpoints to the auth service.
type AuthHandler struct {
	svc *service.AuthService
}

const (
	authCookieName   = "access_token"
	authCookiePath   = "/"
	authCookieMaxAge = 60 * 60 * 24
)

// NewAuthHandler builds a new AuthHandler.
func NewAuthHandler(svc *service.AuthService) *AuthHandler {
	return &AuthHandler{svc: svc}
}

// Register handles user registration requests.
func (h *AuthHandler) Register(c *gin.Context) {
	var req model.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, formatBindError(err))
		return
	}

	res, err := h.svc.Register(c.Request.Context(), req)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrEmailExists):
			response.Error(c, http.StatusConflict, err.Error())
		default:
			response.Error(c, http.StatusInternalServerError, "internal server error")
		}
		return
	}
	setAuthCookie(c, res.Token)
	response.OK(c, http.StatusCreated, res)
}

// Login handles user login requests.
func (h *AuthHandler) Login(c *gin.Context) {
	var req model.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, formatBindError(err))
		return
	}

	res, err := h.svc.Login(c.Request.Context(), req)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidCredentials):
			response.Error(c, http.StatusUnauthorized, err.Error())
		case errors.Is(err, service.ErrAccountNotActive):
			response.Error(c, http.StatusForbidden, err.Error())
		default:
			response.Error(c, http.StatusInternalServerError, "internal server error")
		}
		return
	}
	setAuthCookie(c, res.Token)
	response.OK(c, http.StatusOK, res)
}

// Session returns the current authenticated customer.
func (h *AuthHandler) Session(c *gin.Context) {
	respondWithCurrentCustomer(c, h.svc)
}

// Me returns the authenticated customer's public profile.
func (h *AuthHandler) Me(c *gin.Context) {
	respondWithCurrentCustomer(c, h.svc)
}

func respondWithCurrentCustomer(c *gin.Context, svc *service.AuthService) {
	customerID, ok := c.Get("customer_id")
	if !ok {
		response.Error(c, http.StatusUnauthorized, "missing auth context")
		return
	}
	id, ok := customerID.(uuid.UUID)
	if !ok {
		response.Error(c, http.StatusUnauthorized, "invalid auth context")
		return
	}
	res, err := svc.GetCustomerByID(c.Request.Context(), id)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "internal server error")
		return
	}
	response.OK(c, http.StatusOK, res)
}

func formatBindError(err error) string {
	if gin.Mode() == gin.ReleaseMode {
		return "invalid request body"
	}
	return err.Error()
}

func setAuthCookie(c *gin.Context, token string) {
	c.SetSameSite(http.SameSiteLaxMode)
	secure := gin.Mode() == gin.ReleaseMode
	c.SetCookie(authCookieName, token, authCookieMaxAge, authCookiePath, "", secure, true)
}

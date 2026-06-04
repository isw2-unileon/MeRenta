// Package handler provides HTTP handlers for the API.
package handler

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"

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
		writeAuthBlockedOrError(c, err)
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

// ProfileByID handles GET /api/customers/:id/profile and returns the public
// profile of any customer. Sensitive fields (email, phone, stripe ID) are
// omitted from the response.
//
// Response 200: model.CustomerProfileResponse
// Response 400: invalid UUID in path
// Response 404: customer not found
func (h *AuthHandler) ProfileByID(c *gin.Context) {
	id, ok := parseUUIDParam(c)
	if !ok {
		return
	}

	res, err := h.svc.GetPublicProfile(c.Request.Context(), id)
	switch {
	case err == nil:
		response.OK(c, http.StatusOK, res)
	case errors.Is(err, service.ErrCustomerNotFound):
		response.Error(c, http.StatusNotFound, err.Error())
	default:
		response.Error(c, http.StatusInternalServerError, "internal server error")
	}
}

// UpdateMe updates editable fields on the authenticated customer's profile.
func (h *AuthHandler) UpdateMe(c *gin.Context) {
	customerID, ok := getCustomerID(c)
	if !ok {
		return
	}

	var req model.UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, formatBindError(err))
		return
	}

	res, err := h.svc.UpdateProfile(c.Request.Context(), customerID, req)
	switch {
	case err == nil:
		response.OK(c, http.StatusOK, res)
	case errors.Is(err, service.ErrCustomerNotFound):
		response.Error(c, http.StatusNotFound, err.Error())
	default:
		response.Error(c, http.StatusInternalServerError, "internal server error")
	}
}

// UpdateEmail updates the authenticated customer's email after confirmation.
func (h *AuthHandler) UpdateEmail(c *gin.Context) {
	customerID, ok := getCustomerID(c)
	if !ok {
		return
	}

	var req model.UpdateEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, formatBindError(err))
		return
	}

	res, err := h.svc.UpdateEmail(c.Request.Context(), customerID, req)
	switch {
	case err == nil:
		response.OK(c, http.StatusOK, res)
	case errors.Is(err, service.ErrEmailMismatch):
		response.Error(c, http.StatusBadRequest, err.Error())
	case errors.Is(err, service.ErrEmailExists):
		response.Error(c, http.StatusConflict, err.Error())
	case errors.Is(err, service.ErrCustomerNotFound):
		response.Error(c, http.StatusNotFound, err.Error())
	default:
		response.Error(c, http.StatusInternalServerError, formatBindError(err))
	}
}

// UpdatePassword updates the authenticated customer's password.
func (h *AuthHandler) UpdatePassword(c *gin.Context) {
	customerID, ok := getCustomerID(c)
	if !ok {
		return
	}

	var req model.UpdatePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, formatBindError(err))
		return
	}

	err := h.svc.UpdatePassword(c.Request.Context(), customerID, req)
	switch {
	case err == nil:
		response.OK(c, http.StatusOK, gin.H{"message": "password updated successfully"})
	case errors.Is(err, service.ErrPasswordMismatch):
		response.Error(c, http.StatusBadRequest, err.Error())
	case errors.Is(err, service.ErrInvalidCredentials):
		response.Error(c, http.StatusUnauthorized, "current password is incorrect")
	case errors.Is(err, service.ErrCustomerNotFound):
		response.Error(c, http.StatusNotFound, err.Error())
	default:
		response.Error(c, http.StatusInternalServerError, "internal server error")
	}
}

// UploadAvatar uploads and stores the authenticated customer's avatar image.
func (h *AuthHandler) UploadAvatar(c *gin.Context) {
	customerID, ok := getCustomerID(c)
	if !ok {
		return
	}

	if err := c.Request.ParseMultipartForm(maxUploadBytes); err != nil {
		response.Error(c, http.StatusBadRequest, "cannot parse multipart form")
		return
	}

	file, err := c.FormFile("avatar")
	if err != nil {
		response.Error(c, http.StatusBadRequest, "avatar image is required")
		return
	}

	if file.Size > maxImageBytes {
		response.Error(c, http.StatusBadRequest, "avatar image must be at most 5 MB")
		return
	}

	contentType := strings.TrimSpace(strings.SplitN(file.Header.Get("Content-Type"), ";", 2)[0])
	if !allowedMIMETypes[contentType] {
		response.Error(c, http.StatusBadRequest, "only JPEG, PNG and WebP images are accepted")
		return
	}

	res, err := h.svc.UploadAvatar(c.Request.Context(), customerID, file)
	switch {
	case err == nil:
		response.OK(c, http.StatusOK, res)
	case errors.Is(err, service.ErrCustomerNotFound):
		response.Error(c, http.StatusNotFound, err.Error())
	default:
		response.Error(c, http.StatusInternalServerError, "internal server error")
	}
}

// RequestVerification queues the authenticated customer for profile verification.
func (h *AuthHandler) RequestVerification(c *gin.Context) {
	customerID, ok := getCustomerID(c)
	if !ok {
		return
	}

	status, err := h.svc.RequestVerification(c.Request.Context(), customerID)
	switch {
	case err == nil:
		response.OK(c, http.StatusOK, gin.H{"verification_status": status})
	case errors.Is(err, service.ErrAccountNotActive):
		response.Error(c, http.StatusForbidden, err.Error())
	case errors.Is(err, service.ErrCustomerNotFound):
		response.Error(c, http.StatusNotFound, err.Error())
	default:
		slog.Error("verification request failed", "customer_id", customerID, "error", err)
		response.Error(c, http.StatusInternalServerError, "internal server error")
	}
}

// DeleteMe removes the authenticated customer account and clears the session.
func (h *AuthHandler) DeleteMe(c *gin.Context) {
	customerID, ok := getCustomerID(c)
	if !ok {
		return
	}

	err := h.svc.DeleteAccount(c.Request.Context(), customerID)
	switch {
	case err == nil:
		clearAuthCookie(c)
		response.OK(c, http.StatusOK, gin.H{"message": "account deleted successfully"})
	case errors.Is(err, service.ErrCustomerNotFound):
		response.Error(c, http.StatusNotFound, err.Error())
	default:
		response.Error(c, http.StatusInternalServerError, "internal server error")
	}
}

// Logout clears the authentication cookie.
func (h *AuthHandler) Logout(c *gin.Context) {
	clearAuthCookie(c)
	response.OK(c, http.StatusOK, gin.H{
		"message": "logged out successfully",
	})
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
	switch res.AccountStatus {
	case "banned":
		c.AbortWithStatusJSON(http.StatusForbidden, blockedPayload("account_banned", nil))
	case "suspended":
		c.AbortWithStatusJSON(http.StatusForbidden, blockedPayload("account_suspended", res.SuspendedUntil))
	default:
		response.OK(c, http.StatusOK, res)
	}
}

// writeAuthBlockedOrError maps login service errors to the appropriate HTTP response.
func writeAuthBlockedOrError(c *gin.Context, err error) {
	var suspErr *service.ErrAccountSuspended
	switch {
	case errors.Is(err, service.ErrInvalidCredentials):
		response.Error(c, http.StatusUnauthorized, err.Error())
	case errors.Is(err, service.ErrAccountBanned):
		c.AbortWithStatusJSON(http.StatusForbidden, blockedPayload("account_banned", nil))
	case errors.As(err, &suspErr):
		c.AbortWithStatusJSON(http.StatusForbidden, blockedPayload("account_suspended", suspErr.Until))
	case errors.Is(err, service.ErrAccountNotActive):
		response.Error(c, http.StatusForbidden, err.Error())
	default:
		response.Error(c, http.StatusInternalServerError, "internal server error")
	}
}

// blockedPayload builds a consistent 403 body for banned/suspended accounts.
func blockedPayload(errCode string, suspendedUntil interface{}) gin.H {
	return gin.H{
		"success": false,
		"error":   errCode,
		"data":    gin.H{"suspended_until": suspendedUntil},
	}
}

func formatBindError(err error) string {
	if gin.Mode() == gin.ReleaseMode {
		return "invalid request body"
	}
	return err.Error()
}

func setAuthCookie(c *gin.Context, token string) {
	secure := gin.Mode() == gin.ReleaseMode
	if secure {
		c.SetSameSite(http.SameSiteNoneMode)
	} else {
		c.SetSameSite(http.SameSiteLaxMode)
	}
	c.SetCookie(authCookieName, token, authCookieMaxAge, authCookiePath, "", secure, true)
}

func clearAuthCookie(c *gin.Context) {
	secure := gin.Mode() == gin.ReleaseMode
	if secure {
		c.SetSameSite(http.SameSiteNoneMode)
	} else {
		c.SetSameSite(http.SameSiteLaxMode)
	}
	c.SetCookie(authCookieName, "", -1, authCookiePath, "", secure, true)
}

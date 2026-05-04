package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/isw2-unileon/MeRenta/backend/internal/config"
	"github.com/isw2-unileon/MeRenta/backend/internal/models"
	"github.com/isw2-unileon/MeRenta/backend/internal/user"
	"github.com/jackc/pgx/v5/pgxpool"
)

// AuthHandler handles authentication-related requests.
type AuthHandler struct {
	userService *user.Service
	jwtSecret   []byte
}

// NewAuthHandler creates a new auth handler.
func NewAuthHandler(db *pgxpool.Pool) *AuthHandler {
	repo := user.NewRepository(db)
	service := user.NewService(repo)
	cfg := config.Load()
	return &AuthHandler{
		userService: service,
		jwtSecret:   cfg.JWTSecret,
	}
}

// Register handles customer registration.
// POST /api/auth/register
func (h *AuthHandler) Register(c *gin.Context) {
	var req models.RegisterRequest

	// Bind and validate the request
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request payload",
			"details": err.Error(),
		})
		return
	}

	// Register the customer
	resp, err := h.userService.Register(c.Request.Context(), &req)
	if err != nil {
		// Determine if this is a validation error or a server error
		statusCode := http.StatusInternalServerError
		errorMsg := err.Error()

		if errorMsg == "user with this email already exists" {
			statusCode = http.StatusConflict
		} else if errorMsg == "all fields are required" ||
			errorMsg == "password must be at least 8 characters long" ||
			errorMsg == "passwords do not match" {
			statusCode = http.StatusBadRequest
		}

		c.JSON(statusCode, gin.H{
			"error": errorMsg,
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "User registered successfully",
		"user":    resp,
	})
}

// Login handles customer login.
// POST /api/auth/login
func (h *AuthHandler) Login(c *gin.Context) {
	var req models.LoginRequest

	// Bind and validate the request
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Invalid request payload",
			"details": err.Error(),
		})
		return
	}

	// Authenticate the customer
	customer, err := h.userService.LoginCustomer(c.Request.Context(), req.Email, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": err.Error(),
		})
		return
	}

	// Generate JWT tokens
	accessToken, err := h.generateToken(customer.CustomerID, 24*time.Hour)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to generate access token",
		})
		return
	}

	refreshToken, err := h.generateToken(customer.CustomerID, 7*24*time.Hour)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to generate refresh token",
		})
		return
	}

	// Convert customer to public customer
	customerPublic := models.CustomerPublic{
		CustomerID:       customer.CustomerID,
		FirstName:        customer.FirstName,
		LastName:         customer.LastName,
		Email:            customer.Email,
		Phone:            customer.Phone,
		AvatarURL:        customer.AvatarURL,
		RegistrationDate: customer.RegistrationDate,
		AccountStatus:    customer.AccountStatus,
		UserRole:         customer.UserRole,
	}

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"access_token":  accessToken,
			"refresh_token": refreshToken,
			"customer":      customerPublic,
		},
	})
}

// generateToken generates a JWT token with the given customer ID and expiration.
func (h *AuthHandler) generateToken(customerID string, expiration time.Duration) (string, error) {
	claims := jwt.MapClaims{
		"sub": customerID,
		"exp": time.Now().Add(expiration).Unix(),
		"iat": time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(h.jwtSecret)
}

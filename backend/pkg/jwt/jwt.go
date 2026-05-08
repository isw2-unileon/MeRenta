// Package jwt provides JWT token generation and verification helpers.
package jwt

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// Claims represents the JWT payload for authenticated customers.
type Claims struct {
	CustomerID uuid.UUID `json:"customer_id"`
	Email      string    `json:"email"`
	Role       string    `json:"role"`
	jwt.RegisteredClaims
}

// Manager issues and verifies JWT tokens.
type Manager struct {
	secret   []byte
	issuer   string
	audience string
	duration time.Duration
	leeway   time.Duration
}

// NewManager builds a Manager with the secret and token duration.
func NewManager(secret, issuer, audience string, duration, leeway time.Duration) *Manager {
	return &Manager{
		secret:   []byte(secret),
		issuer:   issuer,
		audience: audience,
		duration: duration,
		leeway:   leeway,
	}
}

// Generate issues a signed JWT token for the given subject data.
func (m *Manager) Generate(customerID uuid.UUID, email, role string) (string, error) {
	now := time.Now()
	claims := Claims{
		CustomerID: customerID,
		Email:      email,
		Role:       role,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    m.issuer,
			Audience:  jwt.ClaimStrings{m.audience},
			ExpiresAt: jwt.NewNumericDate(now.Add(m.duration)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(m.secret)
}

// Verify parses and validates a JWT token string.
func (m *Manager) Verify(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(
		tokenStr,
		&Claims{},
		func(t *jwt.Token) (interface{}, error) {
			return m.secret, nil
		},
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithIssuer(m.issuer),
		jwt.WithAudience(m.audience),
		jwt.WithLeeway(m.leeway),
	)
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}

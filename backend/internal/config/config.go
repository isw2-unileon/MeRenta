// Package config loads application configuration from environment variables.
package config

import (
	"encoding/base64"
	"log"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

// Config holds application settings loaded from the environment.
type Config struct {
	Port            string
	GinMode         string
	DatabaseURL     string
	JWTSecret       []byte
	JWTIssuer       string
	JWTAudience     string
	JWTExpiresIn    time.Duration
	JWTLeeway       time.Duration
	StripeSecretKey string
	CORSAllowOrigin string
}

// Load reads configuration from environment variables and applies defaults.
func Load() *Config {
	_ = godotenv.Load()

	jwtSecret := strings.TrimSpace(getEnv("JWT_SECRET", ""))
	if jwtSecret == "" {
		log.Fatal("JWT_SECRET is not defined in .env")
	}
	jwtSecretBytes, err := base64.StdEncoding.DecodeString(jwtSecret)
	if err != nil {
		log.Fatal("JWT_SECRET must be a valid base64 string")
	}
	if len(jwtSecretBytes) < 32 {
		log.Fatal("JWT_SECRET must decode to at least 32 bytes")
	}

	jwtIssuer := strings.TrimSpace(getEnv("JWT_ISSUER", ""))
	if jwtIssuer == "" {
		log.Fatal("JWT_ISSUER is not defined in .env")
	}

	jwtAudience := strings.TrimSpace(getEnv("JWT_AUDIENCE", ""))
	if jwtAudience == "" {
		log.Fatal("JWT_AUDIENCE is not defined in .env")
	}

	jwtExpiresInStr := strings.TrimSpace(getEnv("JWT_EXPIRES_IN", ""))
	if jwtExpiresInStr == "" {
		log.Fatal("JWT_EXPIRES_IN is not defined in .env")
	}
	jwtExpiresIn, err := time.ParseDuration(jwtExpiresInStr)
	if err != nil || jwtExpiresIn <= 0 {
		log.Fatal("JWT_EXPIRES_IN must be a valid duration like 24h or 15m")
	}

	jwtLeewayStr := strings.TrimSpace(getEnv("JWT_LEEWAY", "2m"))
	jwtLeeway, err := time.ParseDuration(jwtLeewayStr)
	if err != nil || jwtLeeway < 0 {
		log.Fatal("JWT_LEEWAY must be a valid non-negative duration like 2m")
	}

	stripeSecret := strings.TrimSpace(getEnv("STRIPE_SECRET_KEY", ""))
	if stripeSecret == "" {
		log.Fatal("STRIPE_SECRET_KEY is not defined in .env")
	}

	databaseURL := getEnv("DATABASE_URL", "")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL is not defined in .env")
	}

	ginMode := getEnv("GIN_MODE", "debug")
	corsAllowOrigin := getEnv("CORS_ALLOW_ORIGIN", "*")
	if isProductionMode(ginMode) && strings.TrimSpace(corsAllowOrigin) == "*" {
		log.Fatal("CORS_ALLOW_ORIGIN must be an explicit allowlist in production")
	}

	return &Config{
		Port:            getEnv("PORT", "8080"),
		GinMode:         ginMode,
		DatabaseURL:     databaseURL,
		JWTSecret:       jwtSecretBytes,
		JWTIssuer:       jwtIssuer,
		JWTAudience:     jwtAudience,
		JWTExpiresIn:    jwtExpiresIn,
		JWTLeeway:       jwtLeeway,
		StripeSecretKey: stripeSecret,
		CORSAllowOrigin: corsAllowOrigin,
	}
}

// getEnv returns the environment value or a fallback.
func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func isProductionMode(mode string) bool {
	switch strings.ToLower(strings.TrimSpace(mode)) {
	case "production", "prod", "release":
		return true
	default:
		return false
	}
}

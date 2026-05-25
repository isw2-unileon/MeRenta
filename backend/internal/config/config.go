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
	Port                   string
	GinMode                string
	DatabaseURL            string
	JWTSecret              []byte
	JWTIssuer              string
	JWTAudience            string
	JWTExpiresIn           time.Duration
	JWTLeeway              time.Duration
	StripeSecretKey        string
	CORSAllowOrigin        string
	SupabaseURL            string
	SupabaseServiceRoleKey string
}

// Load reads configuration from environment variables and applies defaults.
func Load() *Config {
	_ = godotenv.Load()

	jwtSecretBytes := mustDecodeJWTSecret()
	jwtIssuer := mustGetEnv("JWT_ISSUER")
	jwtAudience := mustGetEnv("JWT_AUDIENCE")
	jwtExpiresIn := mustParsePositiveDuration("JWT_EXPIRES_IN", mustGetEnv("JWT_EXPIRES_IN"))
	jwtLeeway := mustParseNonNegativeDuration("JWT_LEEWAY", getEnv("JWT_LEEWAY", "2m"))

	stripeSecret := mustGetEnv("STRIPE_SECRET_KEY")
	databaseURL := mustGetEnv("DATABASE_URL")

	ginMode := getEnv("GIN_MODE", "debug")
	corsAllowOrigin := getEnv("CORS_ALLOW_ORIGIN", "*")
	ensureCORSAllowOrigin(ginMode, corsAllowOrigin)

	supabaseURL := mustGetEnv("SUPABASE_URL")
	supabaseServiceRoleKey := mustGetEnv("SUPABASE_SERVICE_ROLE_KEY")

	return &Config{
		Port:                   getEnv("PORT", "8080"),
		GinMode:                ginMode,
		DatabaseURL:            databaseURL,
		JWTSecret:              jwtSecretBytes,
		JWTIssuer:              jwtIssuer,
		JWTAudience:            jwtAudience,
		JWTExpiresIn:           jwtExpiresIn,
		JWTLeeway:              jwtLeeway,
		StripeSecretKey:        stripeSecret,
		CORSAllowOrigin:        corsAllowOrigin,
		SupabaseURL:            supabaseURL,
		SupabaseServiceRoleKey: supabaseServiceRoleKey,
	}
}

func mustGetEnv(key string) string {
	value := strings.TrimSpace(getEnv(key, ""))
	if value == "" {
		log.Fatalf("%s is not defined in .env", key)
	}
	return value
}

func mustDecodeJWTSecret() []byte {
	jwtSecret := mustGetEnv("JWT_SECRET")
	jwtSecretBytes, err := base64.StdEncoding.DecodeString(jwtSecret)
	if err != nil {
		log.Fatal("JWT_SECRET must be a valid base64 string")
	}
	if len(jwtSecretBytes) < 32 {
		log.Fatal("JWT_SECRET must decode to at least 32 bytes")
	}
	return jwtSecretBytes
}

func mustParsePositiveDuration(key, value string) time.Duration {
	parsed, err := time.ParseDuration(strings.TrimSpace(value))
	if err != nil || parsed <= 0 {
		log.Fatalf("%s must be a valid duration like 24h or 15m", key)
	}
	return parsed
}

func mustParseNonNegativeDuration(key, value string) time.Duration {
	parsed, err := time.ParseDuration(strings.TrimSpace(value))
	if err != nil || parsed < 0 {
		log.Fatalf("%s must be a valid non-negative duration like 2m", key)
	}
	return parsed
}

func ensureCORSAllowOrigin(mode, corsAllowOrigin string) {
	if isProductionMode(mode) && strings.TrimSpace(corsAllowOrigin) == "*" {
		log.Fatal("CORS_ALLOW_ORIGIN must be an explicit allowlist in production")
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

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
	MessageEncryptionKey   []byte
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
	messageEncryptionKey := getMessageEncryptionKey(jwtSecretBytes)

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
		MessageEncryptionKey:   messageEncryptionKey,
	}
}

// getMessageEncryptionKey returns the configured 32-byte message encryption
// key, decoding it from base64. When unset it derives the key from the first
// 32 bytes of the provided fallback (the JWT secret).
func getMessageEncryptionKey(fallback []byte) []byte {
	raw := strings.TrimSpace(getEnv("MESSAGE_ENCRYPTION_KEY", ""))
	if raw == "" {
		return fallback[:32]
	}

	key, err := base64.StdEncoding.DecodeString(raw)
	if err != nil {
		log.Fatal("MESSAGE_ENCRYPTION_KEY must be a valid base64 string")
	}
	if len(key) != 32 {
		log.Fatal("MESSAGE_ENCRYPTION_KEY must decode to exactly 32 bytes")
	}

	return key
}

// mustGetEnv returns the trimmed value of the environment variable, or exits
// the process when it is missing or empty.
func mustGetEnv(key string) string {
	value := strings.TrimSpace(getEnv(key, ""))
	if value == "" {
		log.Fatalf("%s is not defined in .env", key)
	}
	return value
}

// mustDecodeJWTSecret decodes the base64 JWT_SECRET and ensures it is at least
// 32 bytes long, exiting the process if either check fails.
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

// mustParsePositiveDuration parses value as a strictly positive duration,
// exiting the process if it is invalid or non-positive.
func mustParsePositiveDuration(key, value string) time.Duration {
	parsed, err := time.ParseDuration(strings.TrimSpace(value))
	if err != nil || parsed <= 0 {
		log.Fatalf("%s must be a valid duration like 24h or 15m", key)
	}
	return parsed
}

// mustParseNonNegativeDuration parses value as a non-negative duration,
// exiting the process if it is invalid or negative.
func mustParseNonNegativeDuration(key, value string) time.Duration {
	parsed, err := time.ParseDuration(strings.TrimSpace(value))
	if err != nil || parsed < 0 {
		log.Fatalf("%s must be a valid non-negative duration like 2m", key)
	}
	return parsed
}

// ensureCORSAllowOrigin guards against a wildcard CORS origin in production,
// exiting the process when one is configured.
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

// isProductionMode reports whether the given Gin mode represents a production
// deployment.
func isProductionMode(mode string) bool {
	switch strings.ToLower(strings.TrimSpace(mode)) {
	case "production", "prod", "release":
		return true
	default:
		return false
	}
}

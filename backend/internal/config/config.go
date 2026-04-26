package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

// Config holds the application configuration loaded from environment variables.
type Config struct {
	Port            string
	GinMode         string
	DatabaseURL     string
	JWTSecret       []byte
	StripeSecretKey string
	CORSAllowOrigin string
}

// Load reads configuration from environment variables with sensible defaults.
func Load() *Config {
	_ = godotenv.Load()

	jwtSecret := getEnv("JWT_SECRET", "")
	if jwtSecret == "" {
		log.Fatal("JWT_SECRET no está definido en .env")
	}

	databaseURL := getEnv("DATABASE_URL", "")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL no está definido en .env")
	}

	return &Config{
		Port:            getEnv("PORT", "8080"),
		GinMode:         getEnv("GIN_MODE", "debug"),
		DatabaseURL:     databaseURL,
		JWTSecret:       []byte(jwtSecret),
		StripeSecretKey: getEnv("STRIPE_SECRET_KEY", ""),
		CORSAllowOrigin: getEnv("CORS_ALLOW_ORIGIN", "*"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

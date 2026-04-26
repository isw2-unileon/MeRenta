// Package config handles application configuration from environment variables.
package config

import (
	"os"

	"github.com/joho/godotenv"
)

// Config holds the application configuration loaded from environment variables.
type Config struct {
	Port            string
	GinMode         string
	DatabaseURL     string
	CORSAllowOrigin string
}

// Load reads configuration from environment variables with sensible defaults.
func Load() *Config {
	// Intenta cargar desde varias ubicaciones
	_ = godotenv.Load()
	_ = godotenv.Load(".env")

	return &Config{
		Port:            getEnv("PORT", "8080"),
		GinMode:         getEnv("GIN_MODE", "debug"),
		DatabaseURL:     getEnv("DATABASE_URL", ""),
		CORSAllowOrigin: getEnv("CORS_ALLOW_ORIGIN", "*"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

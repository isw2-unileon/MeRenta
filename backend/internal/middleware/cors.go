// Package middleware defines HTTP middleware for the API.
package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
)

// CORS adds basic CORS headers and handles preflight requests.
func CORS(allowOrigin string) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		allowedOrigin := resolveAllowedOrigin(origin, allowOrigin)
		if allowedOrigin != "" {
			c.Writer.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
			c.Writer.Header().Set("Vary", "Origin")
		}
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}

func resolveAllowedOrigin(origin, allowOrigin string) string {
	if allowOrigin == "" {
		allowOrigin = "*"
	}
	if allowOrigin == "*" {
		return "*"
	}
	if origin == "" {
		return ""
	}
	for _, allowed := range strings.Split(allowOrigin, ",") {
		if strings.TrimSpace(allowed) == origin {
			return origin
		}
	}
	return ""
}

// Package middleware defines HTTP middleware for the API.
package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/isw2-unileon/MeRenta/backend/internal/sqlcdb"
	"github.com/isw2-unileon/MeRenta/backend/pkg/jwt"
	"github.com/isw2-unileon/MeRenta/backend/pkg/response"
)

// JWTAuth validates bearer tokens and injects auth claims into the context.
func JWTAuth(jwtMgr *jwt.Manager) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" || !strings.HasPrefix(header, "Bearer ") {
			response.Error(c, http.StatusUnauthorized, "missing or invalid authorization header")
			return
		}
		tokenStr := strings.TrimPrefix(header, "Bearer ")
		claims, err := jwtMgr.Verify(tokenStr)
		if err != nil {
			response.Error(c, http.StatusUnauthorized, "invalid token")
			return
		}
		role, ok := normalizeRole(claims.Role)
		if !ok {
			response.Error(c, http.StatusForbidden, "forbidden")
			return
		}
		c.Set("customer_id", claims.CustomerID)
		c.Set("email", claims.Email)
		c.Set("role", role)
		c.Next()
	}
}

// RequireRole restricts access to requests with the allowed roles.
func RequireRole(roles ...sqlcdb.UserRole) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, ok := c.Get("role")
		if !ok {
			response.Error(c, http.StatusForbidden, "forbidden")
			return
		}
		userRole, ok := role.(sqlcdb.UserRole)
		if !ok {
			response.Error(c, http.StatusForbidden, "forbidden")
			return
		}
		for _, r := range roles {
			if userRole == r {
				c.Next()
				return
			}
		}
		response.Error(c, http.StatusForbidden, "forbidden")
	}
}

func normalizeRole(role string) (sqlcdb.UserRole, bool) {
	switch sqlcdb.UserRole(role) {
	case sqlcdb.UserRoleUser, sqlcdb.UserRoleAdmin:
		return sqlcdb.UserRole(role), true
	default:
		return "", false
	}
}

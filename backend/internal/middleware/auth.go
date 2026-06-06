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

const authCookieName = "access_token"

// JWTAuth validates bearer tokens or auth cookies and injects auth claims into the context.
func JWTAuth(jwtMgr *jwt.Manager) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenStr := authTokenFromRequest(c)
		if tokenStr == "" {
			response.Error(c, http.StatusUnauthorized, "missing or invalid authorization header")
			c.Abort()
			return
		}
		claims, err := jwtMgr.Verify(tokenStr)
		if err != nil {
			response.Error(c, http.StatusUnauthorized, "invalid token")
			c.Abort()
			return
		}
		role, ok := normalizeRole(claims.Role)
		if !ok {
			response.Error(c, http.StatusForbidden, "forbidden")
			c.Abort()
			return
		}
		c.Set("customer_id", claims.CustomerID)
		c.Set("email", claims.Email)
		c.Set("role", role)
		c.Next()
	}
}

// authTokenFromRequest extracts the JWT from the request, checking the auth
// cookie first, then the Authorization bearer header, and finally the
// "access_token"/"token" query parameters (used by the WebSocket handshake).
func authTokenFromRequest(c *gin.Context) string {
	if tokenStr, err := c.Cookie(authCookieName); err == nil && tokenStr != "" {
		return tokenStr
	}

	header := c.GetHeader("Authorization")
	if strings.HasPrefix(header, "Bearer ") {
		return strings.TrimPrefix(header, "Bearer ")
	}

	if tokenStr := strings.TrimSpace(c.Query("access_token")); tokenStr != "" {
		return tokenStr
	}

	return strings.TrimSpace(c.Query("token"))
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

// normalizeRole validates the claim role string and converts it to a known
// sqlcdb.UserRole, reporting false for any unrecognized value.
func normalizeRole(role string) (sqlcdb.UserRole, bool) {
	switch sqlcdb.UserRole(role) {
	case sqlcdb.UserRoleUser, sqlcdb.UserRoleAdmin:
		return sqlcdb.UserRole(role), true
	default:
		return "", false
	}
}

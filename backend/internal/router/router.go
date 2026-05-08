// Package router wires API routes and middleware.
package router

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/isw2-unileon/MeRenta/backend/internal/handler"
	"github.com/isw2-unileon/MeRenta/backend/internal/middleware"
	"github.com/isw2-unileon/MeRenta/backend/internal/sqlcdb"
	"github.com/isw2-unileon/MeRenta/backend/pkg/jwt"
)

// Setup builds the Gin engine with public and protected routes.
func Setup(
	authH *handler.AuthHandler,
	jwtMgr *jwt.Manager,
	corsAllowOrigin string,
	readiness func(context.Context) error,
) *gin.Engine {
	r := gin.Default()
	r.Use(middleware.CORS(corsAllowOrigin))

	// core
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
	r.GET("/ready", func(c *gin.Context) {
		if readiness != nil {
			if err := readiness(c.Request.Context()); err != nil {
				c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unready"})
				return
			}
		}
		c.JSON(http.StatusOK, gin.H{"status": "ready"})
	})

	api := r.Group("/api")

	// public
	auth := api.Group("/auth")
	auth.POST("/register", authH.Register)
	auth.POST("/login", authH.Login)

	// protected
	protected := api.Group("/")
	protected.Use(middleware.JWTAuth(jwtMgr))

	// auto log in with cookie
	protected.GET("/session", authH.Session)

	// authenticated user profile
	protected.GET("/me", authH.Me)

	// admin
	admin := api.Group("/admin")
	admin.Use(middleware.JWTAuth(jwtMgr), middleware.RequireRole(sqlcdb.UserRoleAdmin))

	return r
}

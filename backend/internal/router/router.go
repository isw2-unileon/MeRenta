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
	itemH *handler.ItemHandler,
	itemImgH *handler.ItemImageHandler,
	addrH *handler.AddressHandler,
	favH *handler.FavoriteHandler,
	chatH *handler.ChatHandler,
	reviewH *handler.ReviewHandler,
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
	auth.POST("/logout", authH.Logout)

	// protected
	protected := api.Group("/")
	protected.Use(middleware.JWTAuth(jwtMgr))

	// auto log in with cookie
	protected.GET("/session", authH.Session)

	// authenticated user profile
	protected.GET("/me", authH.Me)
	protected.PATCH("/me", authH.UpdateMe)
	protected.PATCH("/me/email", authH.UpdateEmail)
	protected.PATCH("/me/password", authH.UpdatePassword)
	protected.POST("/me/avatar", authH.UploadAvatar)

	// addresses
	addresses := protected.Group("/addresses")
	addresses.GET("", addrH.List)
	addresses.POST("", addrH.Create)

	// customers (public profiles only — sensitive data excluded)
	customers := protected.Group("/customers")
	customers.GET("/:id/profile", authH.ProfileByID)

	// items
	items := protected.Group("/items")
	items.GET("", itemH.List)
	items.POST("", itemH.Create)
	items.GET("/mine", itemH.ListMine)
	items.GET("/:id", itemH.Get)
	items.GET("/:id/images", itemImgH.ListImages)
	items.POST("/:id/images", itemImgH.AddImages)
	items.GET("/:id/images/:imageId/content", itemImgH.ProxyImage)

	// favorites
	favs := protected.Group("/favorites")
	favs.GET("", favH.List)
	favs.POST("/:id", favH.Add)
	favs.DELETE("/:id", favH.Remove)
	favs.GET("/:id/check", favH.Check)

	// reviews
	reviews := protected.Group("/reviews")
	reviews.GET("/received", reviewH.ListReceived)

	// conversations
	conversations := protected.Group("/conversations")
	conversations.GET("", chatH.ListConversations)
	conversations.POST("", chatH.StartConversation)
	conversations.GET("/:id/messages", chatH.ListMessages)
	conversations.POST("/:id/messages", chatH.SendMessage)
	conversations.GET("/:id/ws", chatH.WebSocket)

	// admin
	admin := api.Group("/admin")
	admin.Use(middleware.JWTAuth(jwtMgr), middleware.RequireRole(sqlcdb.UserRoleAdmin))

	return r
}

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
	paymentH *handler.PaymentHandler,
	bookingH *handler.BookingHandler,
	incidentH *handler.IncidentHandler,
	adminH *handler.AdminHandler,
	jwtMgr *jwt.Manager,
	corsAllowOrigin string,
	readiness func(context.Context) error,
) *gin.Engine {
	r := gin.Default()
	r.Use(middleware.CORS(corsAllowOrigin))

	addCoreRoutes(r, readiness)

	api := r.Group("/api")
	registerPublicRoutes(api, authH)
	api.GET("/conversations/:id/ws", chatH.WebSocket)

	protected := api.Group("/")
	protected.Use(middleware.JWTAuth(jwtMgr))
	registerProtectedRoutes(protected, authH, itemH, itemImgH, addrH, favH, chatH, reviewH, paymentH, bookingH, incidentH)

	registerAdminRoutes(api, adminH, incidentH, jwtMgr)

	return r
}

func addCoreRoutes(r *gin.Engine, readiness func(context.Context) error) {
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
}

func registerPublicRoutes(api *gin.RouterGroup, authH *handler.AuthHandler) {
	auth := api.Group("/auth")
	auth.POST("/register", authH.Register)
	auth.POST("/login", authH.Login)
	auth.POST("/logout", authH.Logout)
}

// centralizes protected API wiring for readability.
func registerProtectedRoutes(
	protected *gin.RouterGroup,
	authH *handler.AuthHandler,
	itemH *handler.ItemHandler,
	itemImgH *handler.ItemImageHandler,
	addrH *handler.AddressHandler,
	favH *handler.FavoriteHandler,
	chatH *handler.ChatHandler,
	reviewH *handler.ReviewHandler,
	paymentH *handler.PaymentHandler,
	bookingH *handler.BookingHandler,
	incidentH *handler.IncidentHandler,
) {
	protected.GET("/session", authH.Session)
	protected.GET("/me", authH.Me)
	protected.POST("/me/verification-request", authH.RequestVerification)

	addresses := protected.Group("/addresses")
	addresses.GET("", addrH.List)
	addresses.POST("", addrH.Create)

	customers := protected.Group("/customers")
	customers.GET("/:id/profile", authH.ProfileByID)
	customers.GET("/:id/items", itemH.ListByOwner)
	customers.POST("/:id/reports", incidentH.CreateUserReport)

	items := protected.Group("/items")
	items.GET("", itemH.List)
	items.POST("", itemH.Create)
	items.GET("/mine", itemH.ListMine)
	items.GET("/:id", itemH.Get)
	items.PATCH("/:id", itemH.Update)
	items.DELETE("/:id", itemH.Delete)
	items.GET("/:id/images", itemImgH.ListImages)
	items.POST("/:id/images", itemImgH.AddImages)
	items.DELETE("/:id/images/:imageId", itemImgH.DeleteImage)
	items.GET("/:id/images/:imageId/content", itemImgH.ProxyImage)
	items.GET("/:id/unavailable-dates", bookingH.UnavailableDates)

	favs := protected.Group("/favorites")
	favs.GET("", favH.List)
	favs.POST("/:id", favH.Add)
	favs.DELETE("/:id", favH.Remove)
	favs.GET("/:id/check", favH.Check)

	registerConversationRoutes(protected, chatH)

	reviews := protected.Group("/reviews")
	reviews.POST("", reviewH.Create)
	reviews.GET("/received", reviewH.ListReceived)
	reviews.GET("/received/:id", reviewH.ListReceivedByCustomer)
	reviews.GET("/summary/:id", reviewH.SummaryByCustomer)

	protected.POST("/items/:id/reports", incidentH.CreateProductReport)

	payment := protected.Group("/payment")
	payment.POST("/intent", paymentH.CreateIntent)

	registerBookingRoutes(protected, bookingH)

	incidents := protected.Group("/incidents")
	incidents.POST("", incidentH.Create)
	incidents.GET("/mine", incidentH.ListMine)
}

func registerConversationRoutes(protected *gin.RouterGroup, chatH *handler.ChatHandler) {
	conversations := protected.Group("/conversations")
	conversations.GET("", chatH.ListConversations)
	conversations.POST("", chatH.StartConversation)
	conversations.DELETE("/:id", chatH.DeleteConversation)
	conversations.POST("/:id/read", chatH.MarkMessagesRead)
	conversations.GET("/:id/messages", chatH.ListMessages)
	conversations.POST("/:id/messages", chatH.SendMessage)
}

func registerBookingRoutes(protected *gin.RouterGroup, bookingH *handler.BookingHandler) {
	bookings := protected.Group("/bookings")
	bookings.POST("", bookingH.Create)
	bookings.GET("/mine", bookingH.ListMine)
	bookings.GET("/as-owner", bookingH.ListAsOwner)
	bookings.PATCH("/:id/accept", bookingH.Accept)
	bookings.PATCH("/:id/reject", bookingH.Reject)
	bookings.PATCH("/:id/cancel", bookingH.Cancel)
	bookings.PATCH("/:id/complete", bookingH.Complete)
}

func registerAdminRoutes(api *gin.RouterGroup, adminH *handler.AdminHandler, incidentH *handler.IncidentHandler, jwtMgr *jwt.Manager) {
	admin := api.Group("/admin")
	admin.Use(middleware.JWTAuth(jwtMgr), middleware.RequireRole(sqlcdb.UserRoleAdmin))

	users := admin.Group("/users")
	users.GET("", adminH.ListUsers)
	users.PATCH("/:id/status", adminH.UpdateUserStatus)

	verification := admin.Group("/verification")
	verification.GET("", adminH.ListVerification)
	verification.PATCH("/:id", adminH.UpdateVerification)

	items := admin.Group("/items")
	items.GET("", adminH.ListProducts)
	items.DELETE("/:id", adminH.DeleteProduct)

	bookings := admin.Group("/bookings")
	bookings.GET("", adminH.ListBookings)
	bookings.PATCH("/:id/status", adminH.AdminUpdateBookingStatus)

	admin.GET("/payments", adminH.ListPayments)
	admin.GET("/stats", adminH.GetStats)
	admin.GET("/audit", adminH.ListAuditLog)
	admin.GET("/config", adminH.GetPlatformConfig)
	admin.PATCH("/config", adminH.UpdatePlatformConfig)

	incidents := admin.Group("/incidents")
	incidents.GET("", incidentH.AdminList)
	incidents.GET("/:id", incidentH.AdminGet)
	incidents.PATCH("/:id/status", incidentH.AdminUpdateStatus)
	incidents.PATCH("/:id/priority", incidentH.AdminUpdatePriority)
}

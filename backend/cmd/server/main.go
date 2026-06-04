// Package main provides the backend server entrypoint.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/isw2-unileon/MeRenta/backend/internal/config"
	"github.com/isw2-unileon/MeRenta/backend/internal/database"
	"github.com/isw2-unileon/MeRenta/backend/internal/handler"
	"github.com/isw2-unileon/MeRenta/backend/internal/router"
	"github.com/isw2-unileon/MeRenta/backend/internal/service"
	"github.com/isw2-unileon/MeRenta/backend/internal/sqlcdb"
	"github.com/isw2-unileon/MeRenta/backend/pkg/jwt"
	"github.com/isw2-unileon/MeRenta/backend/pkg/storage"
)

// main loads configuration, wires dependencies, and starts the HTTP server.
func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	cfg := config.Load()
	gin.SetMode(normalizeGinMode(cfg.GinMode))

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("error connecting to database", "error", err)
		return
	}
	defer pool.Close()

	q := sqlcdb.New(pool)

	jwtMgr := jwt.NewManager(
		string(cfg.JWTSecret),
		cfg.JWTIssuer,
		cfg.JWTAudience,
		cfg.JWTExpiresIn,
		cfg.JWTLeeway,
	)

	storageCli := storage.NewSupabaseClient(cfg.SupabaseURL, cfg.SupabaseServiceRoleKey)

	authSvc := service.NewAuthService(q, jwtMgr, storageCli, "avatar")
	authH := handler.NewAuthHandler(authSvc)

	itemSvc := service.NewItemService(q)
	itemH := handler.NewItemHandler(itemSvc)

	itemImgSvc := service.NewItemImageService(q, storageCli, "item")
	itemImgH := handler.NewItemImageHandler(itemImgSvc)

	addrSvc := service.NewAddressService(q)
	addrH := handler.NewAddressHandler(addrSvc)

	favSvc := service.NewFavoriteService(q)
	favH := handler.NewFavoriteHandler(favSvc)

	chatSvc, err := service.NewChatService(q, cfg.MessageEncryptionKey)
	if err != nil {
		slog.Error("error creating chat service", "error", err)
		return
	}
	chatHub := handler.NewChatHub()
	chatH := handler.NewChatHandler(chatSvc, chatHub, jwtMgr)

	reviewSvc := service.NewReviewService(q)
	reviewH := handler.NewReviewHandler(reviewSvc)

	paymentSvc, bookingSvc, paymentH, bookingH := wirePaymentAndBooking(q, cfg.StripeSecretKey)
	go startAutoExpireJob(ctx, bookingSvc)
	adminH, incidentH := wireAdminHandlers(q, paymentSvc)

	r := router.Setup(authH, itemH, itemImgH, addrH, favH, chatH, reviewH, paymentH, bookingH, incidentH, adminH, jwtMgr, cfg.CORSAllowOrigin, pool.Ping)
	portNum, err := strconv.Atoi(cfg.Port)
	if err != nil || portNum < 1 || portNum > 65535 {
		slog.Error("invalid port", "port", cfg.Port)
		return
	}

	srv := &http.Server{
		Addr:              fmt.Sprintf(":%d", portNum),
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	serverErr := make(chan error, 1)
	go func() {
		serverErr <- srv.ListenAndServe()
	}()

	slog.Info("server running", "port", portNum)

	select {
	case <-ctx.Done():
		slog.Info("shutdown signal received")
	case err := <-serverErr:
		if !errors.Is(err, http.ErrServerClosed) {
			slog.Error("server stopped", "error", err)
			return
		}
	}

	gracefulShutdown(srv)
}

// wireAdminHandlers constructs the admin and incident handlers.
// refunder is passed so that admin-triggered cancellations issue Stripe refunds.
func wireAdminHandlers(q *sqlcdb.Queries, refunder service.PaymentRefunder) (*handler.AdminHandler, *handler.IncidentHandler) {
	return handler.NewAdminHandler(service.NewAdminService(q, refunder)),
		handler.NewIncidentHandler(service.NewIncidentService(q))
}

// wirePaymentAndBooking constructs the payment and booking handlers.
// It also returns the PaymentService so it can be wired into the admin handler.
func wirePaymentAndBooking(
	q *sqlcdb.Queries,
	stripeKey string,
) (*service.PaymentService, *service.BookingService, *handler.PaymentHandler, *handler.BookingHandler) {
	paymentSvc := service.NewPaymentService(stripeKey)
	bookingSvc := service.NewBookingService(q, paymentSvc)
	return paymentSvc, bookingSvc, handler.NewPaymentHandler(paymentSvc), handler.NewBookingHandler(bookingSvc)
}

// startAutoExpireJob runs in a goroutine. On startup it reconciles item
// availability for all existing bookings. Every hour it auto-cancels pending
// bookings whose 5-day window has elapsed and resynchronises availability.
func startAutoExpireJob(ctx context.Context, svc *service.BookingService) {
	if err := svc.SyncAllAvailabilities(ctx); err != nil {
		slog.Error("startup availability sync failed", "error", err)
	}
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := svc.ExpireOldBookings(ctx); err != nil {
				slog.Error("auto-expire bookings failed", "error", err)
			}
			if err := svc.AutoCompleteExpiredBookings(ctx); err != nil {
				slog.Error("auto-complete bookings failed", "error", err)
			}
			if err := svc.SyncAllAvailabilities(ctx); err != nil {
				slog.Error("availability sync failed", "error", err)
			}
		}
	}
}

// gracefulShutdown attempts a clean server shutdown within a 10-second timeout.
func gracefulShutdown(srv *http.Server) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("graceful shutdown failed", "error", err)
	}
}

func normalizeGinMode(mode string) string {
	switch strings.ToLower(strings.TrimSpace(mode)) {
	case "", gin.DebugMode:
		return gin.DebugMode
	case "production", "prod", gin.ReleaseMode:
		return gin.ReleaseMode
	default:
		return gin.DebugMode
	}
}

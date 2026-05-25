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
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/isw2-unileon/MeRenta/backend/internal/config"
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

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("error connecting to database", "error", err)
		return
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		slog.Error("database ping failed", "error", err)
		return
	}

	q := sqlcdb.New(pool)

	jwtMgr := jwt.NewManager(
		string(cfg.JWTSecret),
		cfg.JWTIssuer,
		cfg.JWTAudience,
		cfg.JWTExpiresIn,
		cfg.JWTLeeway,
	)

	authSvc := service.NewAuthService(q, jwtMgr)
	authH := handler.NewAuthHandler(authSvc)

	itemSvc := service.NewItemService(q)
	itemH := handler.NewItemHandler(itemSvc)

	storageCli := storage.NewSupabaseClient(cfg.SupabaseURL, cfg.SupabaseServiceRoleKey)
	itemImgSvc := service.NewItemImageService(q, storageCli, "item")
	itemImgH := handler.NewItemImageHandler(itemImgSvc)

	addrSvc := service.NewAddressService(q)
	addrH := handler.NewAddressHandler(addrSvc)

	favSvc := service.NewFavoriteService(q)
	favH := handler.NewFavoriteHandler(favSvc)

	r := router.Setup(authH, itemH, itemImgH, addrH, favH, jwtMgr, cfg.CORSAllowOrigin, pool.Ping)
	portNum, err := strconv.Atoi(cfg.Port)
	if err != nil || portNum < 1 || portNum > 65535 {
		slog.Error("invalid port", "port", cfg.Port)
		return
	}

	srv := &http.Server{
		Addr:              fmt.Sprintf(":%d", portNum),
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
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

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
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

package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/leonardolermen/tracer/collector/internal/config"
	"github.com/leonardolermen/tracer/collector/internal/handler"
	"github.com/leonardolermen/tracer/collector/internal/keystore"
	"github.com/leonardolermen/tracer/collector/internal/publisher"
	"github.com/leonardolermen/tracer/collector/internal/queue"
	"github.com/leonardolermen/tracer/collector/internal/ratelimit"
)

func main() {
	cfg := config.Load()

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: cfg.LogLevel,
	}))
	slog.SetDefault(logger)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	q := queue.New(cfg.QueueSize)

	pub, err := publisher.New(ctx, cfg.RedisURL, q)
	if err != nil {
		slog.Error("failed to connect to redis", "error", err)
		os.Exit(1)
	}
	go pub.Run(ctx)

	var keys *keystore.Store
	if cfg.DatabaseURL != "" {
		keys, err = keystore.New(ctx, cfg.DatabaseURL, time.Duration(cfg.KeyRefreshSeconds)*time.Second)
		if err != nil {
			slog.Error("failed to init api-key store", "error", err)
			os.Exit(1)
		}
		go keys.Run(ctx)
		slog.Info("api-key auth enabled", "refresh_seconds", cfg.KeyRefreshSeconds, "rate_limit_per_min", cfg.RateLimitPerMin)
	} else {
		slog.Warn("DATABASE_URL not set — collector running WITHOUT api-key auth (dev mode)")
	}

	limiter := ratelimit.New(cfg.RateLimitPerMin)

	srv := handler.NewServer(cfg, q, keys, limiter)
	go srv.ListenHTTP()
	go srv.ListenUDP()

	slog.Info("collector started", "http_port", cfg.Port, "udp_port", cfg.UDPPort)

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("shutting down...")
	cancel()
	srv.Shutdown()
	slog.Info("collector stopped")
}

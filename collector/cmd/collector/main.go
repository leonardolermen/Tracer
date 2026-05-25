package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
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

	srv := handler.NewServer(cfg, q)
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

package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/leonardolermen/tracer/processor/internal/config"
	"github.com/leonardolermen/tracer/processor/internal/correlator"
	"github.com/leonardolermen/tracer/processor/internal/storage"
	"github.com/leonardolermen/tracer/processor/internal/subscriber"
)

func main() {
	cfg := config.Load()

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: cfg.LogLevel,
	}))
	slog.SetDefault(logger)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	store, err := storage.New(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer store.Close()

	corr := correlator.New()
	go corr.RunCleanup()

	sub, err := subscriber.New(ctx, cfg.RedisURL, corr)
	if err != nil {
		slog.Error("failed to connect to redis", "error", err)
		os.Exit(1)
	}
	go sub.Run(ctx)

	go func() {
		for spans := range corr.Out() {
			if err := store.SaveSpans(ctx, spans); err != nil {
				slog.Error("failed to save spans", "error", err, "count", len(spans))
			} else {
				slog.Info("trace persisted", "spans", len(spans), "trace_id", spans[0].TraceID)
			}
		}
	}()

	slog.Info("processor started")

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("processor stopped")
}

package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/traceflow/sidecar/internal/config"
	"github.com/traceflow/sidecar/internal/proxy"
	"github.com/traceflow/sidecar/internal/tracer"
)

func main() {
	// ── Config ────────────────────────────────────────────────────────────────
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "traceflow-sidecar: %v\n\n", err)
		fmt.Fprintf(os.Stderr, "Required env vars:\n")
		fmt.Fprintf(os.Stderr, "  TF_TARGET       Upstream URL  (e.g. http://my-service:8080)\n")
		fmt.Fprintf(os.Stderr, "  TF_SERVICE_NAME Service name  (e.g. core-service)\n\n")
		fmt.Fprintf(os.Stderr, "Optional env vars:\n")
		fmt.Fprintf(os.Stderr, "  TF_WORKSPACE_ID      TraceFlow workspace ID   (default: ws_dev)\n")
		fmt.Fprintf(os.Stderr, "  TF_COLLECTOR_URL     Collector URL            (default: http://localhost:4317)\n")
		fmt.Fprintf(os.Stderr, "  TF_PORT              Listen port              (default: 8080)\n")
		fmt.Fprintf(os.Stderr, "  TF_MAX_BODY_BYTES    Max body capture size    (default: 2048)\n")
		fmt.Fprintf(os.Stderr, "  TF_REDACT_FIELDS     Extra fields to redact   (comma-separated)\n")
		fmt.Fprintf(os.Stderr, "  TF_DISABLE_BODY_CAPTURE  Set to 'true' to skip body capture\n")
		fmt.Fprintf(os.Stderr, "  TF_LOG_LEVEL         DEBUG|INFO|WARN|ERROR    (default: INFO)\n")
		os.Exit(1)
	}

	// ── Logger ────────────────────────────────────────────────────────────────
	level := slog.LevelInfo
	switch cfg.LogLevel {
	case "DEBUG":
		level = slog.LevelDebug
	case "WARN":
		level = slog.LevelWarn
	case "ERROR":
		level = slog.LevelError
	}
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level})))

	// ── Tracer ────────────────────────────────────────────────────────────────
	t := tracer.New(cfg)

	// ── Proxy handler ─────────────────────────────────────────────────────────
	handler, err := proxy.Handler(cfg, t)
	if err != nil {
		slog.Error("failed to create proxy handler", "err", err)
		os.Exit(1)
	}

	// ── Health endpoint ───────────────────────────────────────────────────────
	mux := http.NewServeMux()
	mux.Handle("/__traceflow/health", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"ok","service":"%s","target":"%s"}`, cfg.ServiceName, cfg.TargetURL)
	}))
	mux.Handle("/", handler)

	// ── Server ────────────────────────────────────────────────────────────────
	addr := fmt.Sprintf(":%d", cfg.Port)
	srv := &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
	}

	slog.Info("traceflow-sidecar started",
		"listening", addr,
		"target", cfg.TargetURL,
		"service", cfg.ServiceName,
		"workspace", cfg.WorkspaceID,
		"collector", cfg.CollectorURL,
	)

	// ── Graceful shutdown ─────────────────────────────────────────────────────
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "err", err)
			os.Exit(1)
		}
	}()

	<-quit
	slog.Info("shutting down…")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
	slog.Info("bye")
}

package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"time"

	"github.com/leonardolermen/tracer/collector/internal/config"
	"github.com/leonardolermen/tracer/collector/internal/keystore"
	"github.com/leonardolermen/tracer/collector/internal/metrics"
	"github.com/leonardolermen/tracer/collector/internal/queue"
	"github.com/leonardolermen/tracer/collector/internal/ratelimit"
	"github.com/leonardolermen/tracer/collector/internal/validator"
)

type ctxKey string

const workspaceCtxKey ctxKey = "workspace_id"

type Server struct {
	cfg     *config.Config
	queue   *queue.Queue
	keys    *keystore.Store
	limiter *ratelimit.Limiter
	http    *http.Server
	udpConn *net.UDPConn
}

func NewServer(cfg *config.Config, q *queue.Queue, keys *keystore.Store, limiter *ratelimit.Limiter) *Server {
	s := &Server{cfg: cfg, queue: q, keys: keys, limiter: limiter}

	mux := http.NewServeMux()
	mux.HandleFunc("POST /spans", s.withAuth(s.handleSpan))
	mux.HandleFunc("POST /ingest", s.withAuth(s.handleIngest))
	mux.HandleFunc("POST /v1/traces", s.withAuth(s.handleOTLPTraces))
	mux.HandleFunc("POST /v1/logs", s.withAuth(s.handleOTLPLogs))
	mux.HandleFunc("GET /health", s.handleHealth)
	mux.HandleFunc("GET /metrics", metrics.Handler)

	s.http = &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.Port),
		Handler:      mux,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 5 * time.Second,
	}

	return s
}

func (s *Server) ListenHTTP() {
	slog.Info("http listener ready", "addr", s.http.Addr)
	if err := s.http.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		slog.Error("http server error", "error", err)
	}
}

func (s *Server) ListenUDP() {
	addr, err := net.ResolveUDPAddr("udp", fmt.Sprintf(":%s", s.cfg.UDPPort))
	if err != nil {
		slog.Error("failed to resolve udp addr", "error", err)
		return
	}

	conn, err := net.ListenUDP("udp", addr)
	if err != nil {
		slog.Error("failed to listen udp", "error", err)
		return
	}
	s.udpConn = conn

	slog.Info("udp listener ready", "addr", addr)

	buf := make([]byte, 65535)
	for {
		n, remote, err := conn.ReadFromUDP(buf)
		if err != nil {
			slog.Debug("udp read error", "error", err)
			return
		}
		go s.processRawSpan(buf[:n], remote.String())
	}
}

func (s *Server) handleSpan(w http.ResponseWriter, r *http.Request) {
	var span validator.SpanEvent
	if err := json.NewDecoder(r.Body).Decode(&span); err != nil {
		writeError(w, http.StatusBadRequest, "validation_error", "invalid JSON: "+err.Error())
		return
	}

	// The authenticated api-key is the source of truth for the workspace; ignore
	// any workspace_id provided in the body.
	if wsID, ok := workspaceFromContext(r.Context()); ok {
		span.WorkspaceID = wsID
	}

	if err := validator.Validate(&span); err != nil {
		writeError(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	if !s.queue.Push(&span) {
		metrics.SpansDropped.Add(1)
		writeError(w, http.StatusTooManyRequests, "rate_limited", "collector queue full, try again later")
		return
	}
	metrics.SpansReceived.Add(1)

	// Extract embedded logs and route them
	for _, el := range span.Logs {
		logEvt := &validator.LogEvent{
			ID:          span.ID + "_" + el.Timestamp,
			TraceID:     span.TraceID,
			ServiceName: span.ServiceName,
			Level:       el.Level,
			Message:     el.Message,
			Attributes:  el.Attributes,
			WorkspaceID: span.WorkspaceID,
		}
		parsedTime, err := time.Parse(time.RFC3339Nano, el.Timestamp)
		if err != nil {
			parsedTime = time.Now()
		}
		logEvt.Timestamp = parsedTime
		if s.queue.PushLog(logEvt) {
			metrics.LogsReceived.Add(1)
		} else {
			metrics.LogsDropped.Add(1)
		}
	}

	slog.Debug("span accepted", "span_id", span.ID, "trace_id", span.TraceID, "service", span.ServiceName)
	w.WriteHeader(http.StatusAccepted)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"ok"}`))
}

// withAuth validates the x-api-key header against the keystore, enforces the
// per-workspace rate limit, and injects the resolved workspace_id into the
// request context. When no keystore is configured (no DATABASE_URL), auth is
// disabled and requests pass through unchanged (dev mode).
func (s *Server) withAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if s.keys == nil {
			next(w, r)
			return
		}

		apiKey := r.Header.Get("x-api-key")
		if apiKey == "" {
			metrics.AuthRejected.Add(1)
			writeError(w, http.StatusUnauthorized, "unauthorized", "missing x-api-key header")
			return
		}

		workspaceID, ok := s.keys.WorkspaceID(apiKey)
		if !ok {
			metrics.AuthRejected.Add(1)
			writeError(w, http.StatusUnauthorized, "unauthorized", "invalid api key")
			return
		}

		if s.limiter != nil && !s.limiter.Allow(workspaceID) {
			metrics.RateLimited.Add(1)
			writeError(w, http.StatusTooManyRequests, "rate_limited", "rate limit exceeded")
			return
		}

		ctx := context.WithValue(r.Context(), workspaceCtxKey, workspaceID)
		next(w, r.WithContext(ctx))
	}
}

// workspaceFromContext returns the authenticated workspace_id, if present.
func workspaceFromContext(ctx context.Context) (string, bool) {
	ws, ok := ctx.Value(workspaceCtxKey).(string)
	return ws, ok && ws != ""
}

func (s *Server) processRawSpan(data []byte, remote string) {
	var span validator.SpanEvent
	if err := json.Unmarshal(data, &span); err != nil {
		slog.Warn("udp: invalid JSON", "remote", remote, "error", err)
		return
	}

	// UDP has no headers, so the api-key travels in the payload's api_key field.
	if s.keys != nil {
		workspaceID, ok := s.keys.WorkspaceID(span.APIKey)
		if !ok {
			slog.Warn("udp: invalid or missing api_key, dropping span", "remote", remote)
			return
		}
		if s.limiter != nil && !s.limiter.Allow(workspaceID) {
			slog.Warn("udp: rate limited, dropping span", "workspace_id", workspaceID)
			return
		}
		span.WorkspaceID = workspaceID
	}
	span.APIKey = "" // never persist the api-key downstream

	if err := validator.Validate(&span); err != nil {
		slog.Warn("udp: invalid span", "remote", remote, "error", err)
		return
	}

	if !s.queue.Push(&span) {
		metrics.SpansDropped.Add(1)
		slog.Warn("udp: queue full, dropping span", "span_id", span.ID)
		return
	}
	metrics.SpansReceived.Add(1)

	// Extract embedded logs and route them
	for _, el := range span.Logs {
		logEvt := &validator.LogEvent{
			ID:          span.ID + "_" + el.Timestamp,
			TraceID:     span.TraceID,
			ServiceName: span.ServiceName,
			Level:       el.Level,
			Message:     el.Message,
			Attributes:  el.Attributes,
			WorkspaceID: span.WorkspaceID,
		}
		parsedTime, err := time.Parse(time.RFC3339Nano, el.Timestamp)
		if err != nil {
			parsedTime = time.Now()
		}
		logEvt.Timestamp = parsedTime
		if s.queue.PushLog(logEvt) {
			metrics.LogsReceived.Add(1)
		} else {
			metrics.LogsDropped.Add(1)
		}
	}

	slog.Debug("udp span accepted", "span_id", span.ID, "trace_id", span.TraceID)
}

func (s *Server) Shutdown() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	s.http.Shutdown(ctx)
	if s.udpConn != nil {
		s.udpConn.Close()
	}
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	slog.Error("API Error", "status", status, "code", code, "message", message)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{
		"error":   code,
		"message": message,
	})
}

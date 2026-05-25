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
	"github.com/leonardolermen/tracer/collector/internal/queue"
	"github.com/leonardolermen/tracer/collector/internal/validator"
)

type Server struct {
	cfg    *config.Config
	queue  *queue.Queue
	http   *http.Server
	udpConn *net.UDPConn
}

func NewServer(cfg *config.Config, q *queue.Queue) *Server {
	s := &Server{cfg: cfg, queue: q}

	mux := http.NewServeMux()
	mux.HandleFunc("POST /spans", s.handleSpan)
	mux.HandleFunc("GET /health", s.handleHealth)

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

	if err := validator.Validate(&span); err != nil {
		writeError(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	if !s.queue.Push(&span) {
		writeError(w, http.StatusTooManyRequests, "rate_limited", "collector queue full, try again later")
		return
	}

	slog.Debug("span accepted", "span_id", span.ID, "trace_id", span.TraceID, "service", span.ServiceName)
	w.WriteHeader(http.StatusAccepted)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"ok"}`))
}

func (s *Server) processRawSpan(data []byte, remote string) {
	var span validator.SpanEvent
	if err := json.Unmarshal(data, &span); err != nil {
		slog.Warn("udp: invalid JSON", "remote", remote, "error", err)
		return
	}

	if err := validator.Validate(&span); err != nil {
		slog.Warn("udp: invalid span", "remote", remote, "error", err)
		return
	}

	if !s.queue.Push(&span) {
		slog.Warn("udp: queue full, dropping span", "span_id", span.ID)
		return
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
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{
		"error":   code,
		"message": message,
	})
}

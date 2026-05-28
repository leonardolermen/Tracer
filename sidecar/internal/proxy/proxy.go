// Package proxy implements the reverse proxy handler.
// It captures request and response bodies without blocking the main path.
package proxy

import (
	"bytes"
	"io"
	"log/slog"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"

	"github.com/traceflow/sidecar/internal/config"
	"github.com/traceflow/sidecar/internal/tracer"
)

const (
	traceIDHeader  = "X-Traceflow-Trace-Id"
	parentIDHeader = "X-Traceflow-Span-Id"
)

// responseRecorder wraps http.ResponseWriter to capture status and body.
type responseRecorder struct {
	http.ResponseWriter
	statusCode int
	body       bytes.Buffer
}

func (r *responseRecorder) WriteHeader(code int) {
	r.statusCode = code
	r.ResponseWriter.WriteHeader(code)
}

func (r *responseRecorder) Write(b []byte) (int, error) {
	r.body.Write(b) // capture (best effort, no error check)
	return r.ResponseWriter.Write(b)
}

// Handler returns an http.Handler that proxies to targetURL and traces every request.
func Handler(cfg *config.Config, t *tracer.Tracer) (http.Handler, error) {
	target, err := url.Parse(cfg.TargetURL)
	if err != nil {
		return nil, err
	}

	proxy := httputil.NewSingleHostReverseProxy(target)

	// Silence the default error log — we handle logging ourselves
	proxy.ErrorLog = nil
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		slog.Error("proxy: upstream error", "err", err, "path", r.URL.Path)
		http.Error(w, "upstream error", http.StatusBadGateway)
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		startedAt := time.Now()

		// ── Propagate / generate trace ID ─────────────────────────────────────
		traceID := r.Header.Get(traceIDHeader)
		if traceID == "" {
			traceID = "tr_" + tracer.NewID()
		}
		parentID := r.Header.Get(parentIDHeader)

		// Inject trace ID into forwarded request so downstream services can propagate
		r.Header.Set(traceIDHeader, traceID)
		// Expose on response so the caller can chain further calls
		w.Header().Set(traceIDHeader, traceID)

		// ── Capture request body ───────────────────────────────────────────────
		var reqBody []byte
		if !cfg.DisableBodyCapture && r.Body != nil && r.Body != http.NoBody {
			limited := io.LimitReader(r.Body, cfg.MaxBodyBytes+1)
			reqBody, _ = io.ReadAll(limited)
			r.Body = io.NopCloser(bytes.NewReader(reqBody)) // restore for proxy
			r.ContentLength = int64(len(reqBody))
		}

		// Fix the Host header so the upstream sees the right host
		r.Header.Del("X-Forwarded-Host")
		r.Host = target.Host

		// ── Record the response ────────────────────────────────────────────────
		rec := &responseRecorder{ResponseWriter: w, statusCode: http.StatusOK}
		proxy.ServeHTTP(rec, r)

		endedAt := time.Now()

		// ── Capture response body (limited) ───────────────────────────────────
		var resBody []byte
		if !cfg.DisableBodyCapture {
			resBytes := rec.body.Bytes()
			if int64(len(resBytes)) > cfg.MaxBodyBytes {
				resBody = resBytes[:cfg.MaxBodyBytes]
			} else {
				resBody = resBytes
			}
		}

		// ── Ship span ─────────────────────────────────────────────────────────
		path := r.URL.Path
		rawURL := r.URL.RequestURI()
		if rawURL == "" {
			rawURL = path
		}

		t.CaptureSpan(
			traceID, parentID,
			r.Method, path, rawURL,
			reqBody, r.Header,
			rec.statusCode,
			resBody,
			startedAt, endedAt,
		)

		slog.Debug("proxy: request handled",
			"method", r.Method,
			"path", path,
			"status", rec.statusCode,
			"duration_ms", endedAt.Sub(startedAt).Milliseconds(),
			"trace_id", traceID,
		)
	}), nil
}

// StripPort removes the port from a host string.
func StripPort(host string) string {
	if idx := strings.LastIndex(host, ":"); idx != -1 {
		return host[:idx]
	}
	return host
}

// Package tracer builds and ships span events to the TraceFlow collector.
// It runs fire-and-forget: errors are logged but never returned to the caller.
package tracer

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/traceflow/sidecar/internal/config"
)

// ── ID generation ──────────────────────────────────────────────────────────────

func NewID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// ── Sensitive field redaction ──────────────────────────────────────────────────

var builtinSensitive = []string{
	"password", "senha", "token", "secret", "apikey", "api_key",
	"authorization", "cvv", "card_number", "cardnumber", "ssn",
	"cpf", "pin", "refreshtoken", "refresh_token", "accesstoken",
	"access_token", "confirmpassword", "confirm_password", "private_key",
}

func buildRedactPattern(extra []string) *regexp.Regexp {
	fields := append(builtinSensitive, extra...)
	escaped := make([]string, len(fields))
	for i, f := range fields {
		escaped[i] = regexp.QuoteMeta(f)
	}
	// Matches: "fieldName": "value" or "fieldName": 123456
	pattern := fmt.Sprintf(
		`(?i)("(?:%s)"\s*:\s*)("(?:[^"\\]|\\.)*"|\d+(?:\.\d+)?)`,
		strings.Join(escaped, "|"),
	)
	return regexp.MustCompile(pattern)
}

func redact(body []byte, pattern *regexp.Regexp) string {
	if pattern == nil || len(body) == 0 {
		return string(body)
	}
	return pattern.ReplaceAllString(string(body), `${1}"[REDACTED]"`)
}

// ── Span event structures ──────────────────────────────────────────────────────

type spanLog struct {
	Level      string            `json:"level"`
	Message    string            `json:"message"`
	Attributes map[string]string `json:"attributes,omitempty"`
	Timestamp  string            `json:"timestamp"`
}

type spanEvent struct {
	ID            string            `json:"id"`
	TraceID       string            `json:"trace_id"`
	ParentID      string            `json:"parent_id,omitempty"`
	ServiceName   string            `json:"service_name"`
	OperationName string            `json:"operation_name"`
	Kind          string            `json:"kind"`
	StartedAt     string            `json:"started_at"`
	EndedAt       string            `json:"ended_at"`
	DurationMs    int64             `json:"duration_ms"`
	Status        string            `json:"status"`
	Tags          map[string]string `json:"tags"`
	Logs          []spanLog         `json:"logs,omitempty"`
	WorkspaceID   string            `json:"workspace_id"`
}

// ── Tracer ─────────────────────────────────────────────────────────────────────

type Tracer struct {
	cfg           *config.Config
	redactPattern *regexp.Regexp
	client        *http.Client
}

func New(cfg *config.Config) *Tracer {
	return &Tracer{
		cfg:           cfg,
		redactPattern: buildRedactPattern(cfg.ExtraRedactFields),
		client: &http.Client{
			Timeout: 3 * time.Second,
		},
	}
}

// CaptureSpan builds a span from a completed request/response and ships it.
func (t *Tracer) CaptureSpan(
	traceID, parentID string,
	method, path, rawURL string,
	reqBody []byte,
	reqHeaders http.Header,
	statusCode int,
	resBody []byte,
	startedAt time.Time,
	endedAt time.Time,
) {
	durationMs := endedAt.Sub(startedAt).Milliseconds()

	status := "ok"
	if statusCode >= 500 {
		status = "error"
	}

	// ── Sanitize bodies ────────────────────────────────────────────────────────
	reqBodyStr := t.prepareBody(reqBody, reqHeaders.Get("Content-Type"))
	resBodyStr := t.prepareBody(resBody, "application/json") // assume JSON for response

	// ── Tags ──────────────────────────────────────────────────────────────────
	tags := map[string]string{
		"http.method":      method,
		"http.url":         rawURL,
		"http.path":        path,
		"http.status_code": fmt.Sprintf("%d", statusCode),
		"sidecar":          "true",
	}

	// ── Logs (request + response) ─────────────────────────────────────────────
	logs := []spanLog{}

	reqAttrs := map[string]string{
		"method":       method,
		"url":          rawURL,
		"content-type": reqHeaders.Get("Content-Type"),
		"user-agent":   reqHeaders.Get("User-Agent"),
	}
	if reqBodyStr != "" {
		reqAttrs["http.body"] = reqBodyStr
	}
	logs = append(logs, spanLog{
		Level:      "INFO",
		Message:    "http.request",
		Attributes: reqAttrs,
		Timestamp:  startedAt.UTC().Format(time.RFC3339Nano),
	})

	resLevel := "INFO"
	if statusCode >= 500 {
		resLevel = "ERROR"
	} else if statusCode >= 400 {
		resLevel = "WARN"
	}
	resAttrs := map[string]string{
		"status_code": fmt.Sprintf("%d", statusCode),
	}
	if resBodyStr != "" {
		resAttrs["http.body"] = resBodyStr
	}
	logs = append(logs, spanLog{
		Level:      resLevel,
		Message:    "http.response",
		Attributes: resAttrs,
		Timestamp:  endedAt.UTC().Format(time.RFC3339Nano),
	})

	// ── Assemble event ────────────────────────────────────────────────────────
	event := spanEvent{
		ID:            "sp_" + NewID(),
		TraceID:       traceID,
		ParentID:      parentID,
		ServiceName:   t.cfg.ServiceName,
		OperationName: fmt.Sprintf("%s %s", method, path),
		Kind:          "server",
		StartedAt:     startedAt.UTC().Format(time.RFC3339Nano),
		EndedAt:       endedAt.UTC().Format(time.RFC3339Nano),
		DurationMs:    durationMs,
		Status:        status,
		Tags:          tags,
		Logs:          logs,
		WorkspaceID:   t.cfg.WorkspaceID,
	}

	// ── Ship async ────────────────────────────────────────────────────────────
	go t.ship(event)
}

func (t *Tracer) ship(event spanEvent) {
	body, err := json.Marshal(event)
	if err != nil {
		slog.Error("tracer: failed to marshal span", "err", err)
		return
	}

	url := strings.TrimRight(t.cfg.CollectorURL, "/") + "/v1/spans"
	resp, err := t.client.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		slog.Debug("tracer: failed to send span (collector unavailable)", "err", err)
		return
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body)

	slog.Debug("tracer: span sent", "status", resp.StatusCode, "trace_id", event.TraceID)
}

// prepareBody reads up to MaxBodyBytes, redacts sensitive fields, and returns a string.
// Returns empty string for binary or empty bodies.
func (t *Tracer) prepareBody(body []byte, contentType string) string {
	if t.cfg.DisableBodyCapture || len(body) == 0 {
		return ""
	}

	// Skip binary content types
	ct := strings.ToLower(contentType)
	if strings.Contains(ct, "multipart") ||
		strings.Contains(ct, "octet-stream") ||
		strings.Contains(ct, "image/") ||
		strings.Contains(ct, "video/") ||
		strings.Contains(ct, "audio/") {
		return "[binary body skipped]"
	}

	// Truncate
	if int64(len(body)) > t.cfg.MaxBodyBytes {
		body = append(body[:t.cfg.MaxBodyBytes], []byte("…[truncated]")...)
	}

	return redact(body, t.redactPattern)
}

package handler

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/leonardolermen/tracer/collector/internal/metrics"
	"github.com/leonardolermen/tracer/collector/internal/validator"
)

type IngestPayload struct {
	Source     string                 `json:"source"`
	Event      string                 `json:"event"`
	DurationMs *int64                 `json:"duration_ms,omitempty"`
	Status     string                 `json:"status,omitempty"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
}

func generateID(n int) string {
	b := make([]byte, n)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func (s *Server) handleIngest(w http.ResponseWriter, r *http.Request) {
	var payload IngestPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "validation_error", "invalid JSON: "+err.Error())
		return
	}

	wsID, ok := workspaceFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusInternalServerError, "internal_error", "missing workspace context")
		return
	}

	if payload.Source == "" {
		payload.Source = "unknown_source"
	}
	if payload.Event == "" {
		payload.Event = "event"
	}

	status := payload.Status
	if status == "" {
		status = "ok"
	} else if status != "ok" && status != "error" && status != "timeout" && status != "in_progress" {
		status = "ok"
	}

	tags := make(map[string]string)
	for k, v := range payload.Metadata {
		tags[k] = fmt.Sprintf("%v", v)
	}

	now := time.Now().UTC()

	span := validator.SpanEvent{
		ID:            generateID(8),
		TraceID:       generateID(16),
		ServiceName:   payload.Source,
		OperationName: payload.Event,
		Kind:          "internal",
		StartedAt:     now,
		DurationMs:    payload.DurationMs,
		Status:        status,
		Tags:          tags,
		WorkspaceID:   wsID,
	}
	
	if payload.DurationMs != nil {
		endedAt := now.Add(time.Duration(*payload.DurationMs) * time.Millisecond)
		span.EndedAt = &endedAt
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

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(map[string]string{
		"status":   "accepted",
		"trace_id": span.TraceID,
		"span_id":  span.ID,
	})
}

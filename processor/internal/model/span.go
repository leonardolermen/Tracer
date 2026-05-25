package model

import "time"

type SpanEvent struct {
	ID            string            `json:"id"`
	TraceID       string            `json:"trace_id"`
	ParentID      string            `json:"parent_id,omitempty"`
	ServiceName   string            `json:"service_name"`
	OperationName string            `json:"operation_name"`
	Kind          string            `json:"kind"`
	StartedAt     time.Time         `json:"started_at"`
	EndedAt       *time.Time        `json:"ended_at,omitempty"`
	DurationMs    *int64            `json:"duration_ms,omitempty"`
	Status        string            `json:"status"`
	Error         *SpanError        `json:"error,omitempty"`
	Tags          map[string]string `json:"tags,omitempty"`
	WorkspaceID   string            `json:"workspace_id"`
}

type SpanError struct {
	Type    string `json:"type"`
	Message string `json:"message"`
	Code    string `json:"code,omitempty"`
}

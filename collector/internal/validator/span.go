package validator

import (
	"fmt"
	"time"
)

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
	Logs          []EmbeddedLog     `json:"logs,omitempty"`
	WorkspaceID   string            `json:"workspace_id"`
}

type SpanError struct {
	Type    string `json:"type"`
	Message string `json:"message"`
	Code    string `json:"code,omitempty"`
}

var validKinds = map[string]bool{
	"server":   true,
	"client":   true,
	"producer": true,
	"consumer": true,
	"internal": true,
}

var validStatuses = map[string]bool{
	"ok":          true,
	"error":       true,
	"timeout":     true,
	"in_progress": true,
}

func Validate(s *SpanEvent) error {
	if s.ID == "" {
		return fmt.Errorf("id is required")
	}
	if s.TraceID == "" {
		return fmt.Errorf("trace_id is required")
	}
	if s.ServiceName == "" {
		return fmt.Errorf("service_name is required")
	}
	if s.OperationName == "" {
		return fmt.Errorf("operation_name is required")
	}
	if !validKinds[s.Kind] {
		return fmt.Errorf("kind must be one of: server, client, producer, consumer, internal")
	}
	if s.StartedAt.IsZero() {
		return fmt.Errorf("started_at is required")
	}
	if !validStatuses[s.Status] {
		return fmt.Errorf("status must be one of: ok, error, timeout, in_progress")
	}
	if s.WorkspaceID == "" {
		return fmt.Errorf("workspace_id is required")
	}
	return nil
}

type LogEvent struct {
	ID          string            `json:"id"`
	TraceID     string            `json:"trace_id"`
	ServiceName string            `json:"service_name"`
	Level       string            `json:"level"`
	Message     string            `json:"message"`
	Attributes  map[string]string `json:"attributes,omitempty"`
	Timestamp   time.Time         `json:"timestamp"`
	WorkspaceID string            `json:"workspace_id"`
}

var validLogLevels = map[string]bool{
	"DEBUG": true,
	"INFO":  true,
	"WARN":  true,
	"ERROR": true,
}

func ValidateLog(l *LogEvent) error {
	if l.TraceID == "" {
		return fmt.Errorf("trace_id is required")
	}
	if l.ServiceName == "" {
		return fmt.Errorf("service_name is required")
	}
	if !validLogLevels[l.Level] {
		return fmt.Errorf("level must be one of: DEBUG, INFO, WARN, ERROR")
	}
	if l.Message == "" {
		return fmt.Errorf("message is required")
	}
	if l.WorkspaceID == "" {
		return fmt.Errorf("workspace_id is required")
	}
	return nil
}

type EmbeddedLog struct {
	Level      string            `json:"level"`
	Message    string            `json:"message"`
	Attributes map[string]string `json:"attributes,omitempty"`
	Timestamp  string            `json:"timestamp"`
}

package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/leonardolermen/tracer/collector/internal/validator"
	collogspb "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	logspb "go.opentelemetry.io/proto/otlp/logs/v1"
	resourcepb "go.opentelemetry.io/proto/otlp/resource/v1"
	"google.golang.org/protobuf/proto"
)

// ─── OTLP JSON structures for logs (minimal subset) ───────────────────────

type otlpLogsRequest struct {
	ResourceLogs []otlpResourceLog `json:"resourceLogs"`
}

type otlpResourceLog struct {
	Resource   otlpResource  `json:"resource"`
	ScopeLogs  []otlpScopeLog `json:"scopeLogs"`
}

type otlpScopeLog struct {
	LogRecords []otlpLogRecord `json:"logRecords"`
}

type otlpLogRecord struct {
	TimeUnixNano string          `json:"timeUnixNano"`
	SeverityText string          `json:"severityText"`
	Body         otlpAnyVal     `json:"body"`
	Attributes   []otlpAttribute `json:"attributes"`
	TraceID      string          `json:"traceId"`
	SpanID       string          `json:"spanId"`
}

// ─── OTLP severity level → TraceFlow level ───────────────────────────────
func otlpSeverityToLevel(severityText string) string {
	switch strings.ToUpper(severityText) {
	case "DEBUG":
		return "DEBUG"
	case "INFO":
		return "INFO"
	case "WARN", "WARNING":
		return "WARN"
	case "ERROR", "FATAL":
		return "ERROR"
	default:
		return "INFO"
	}
}

// ─── Handler ──────────────────────────────────────────────────────────────

func (s *Server) handleOTLPLogs(w http.ResponseWriter, r *http.Request) {
	// When api-key auth is on, the authenticated workspace is the source of truth.
	// In dev mode it can come from header, query param, or the JSON body itself.
	workspaceID, _ := workspaceFromContext(r.Context())
	if workspaceID == "" {
		workspaceID = r.Header.Get("X-Workspace-Id")
	}
	if workspaceID == "" {
		workspaceID = r.URL.Query().Get("workspace_id")
	}

	data, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to read body")
		return
	}
	if len(data) == 0 {
		writeError(w, http.StatusBadRequest, "validation_error", "empty payload")
		return
	}

	ct := r.Header.Get("Content-Type")
	var logs []*validator.LogEvent
	var dropped int

	// Detect format: TraceFlow native JSON has a top-level "trace_id" field,
	// OTLP JSON has "resourceLogs", OTLP protobuf is binary.
	if isTraceFlowNativeLog(data) {
		log, parseErr := parseNativeLog(data)
		if parseErr != nil {
			writeError(w, http.StatusBadRequest, "validation_error", parseErr.Error())
			return
		}
		// workspace from body wins if header not set
		if workspaceID == "" {
			workspaceID = log.WorkspaceID
		} else {
			log.WorkspaceID = workspaceID
		}
		if workspaceID == "" {
			writeError(w, http.StatusBadRequest, "validation_error", "workspace_id required")
			return
		}
		logs = []*validator.LogEvent{log}
	} else {
		if workspaceID == "" {
			writeError(w, http.StatusBadRequest, "validation_error", "X-Workspace-Id header required for OTLP logs")
			return
		}
		logs, dropped, err = parseOTLPLogsPayload(data, ct, workspaceID)
		if err != nil {
			writeError(w, http.StatusBadRequest, "validation_error", err.Error())
			return
		}
	}

	accepted := 0
	for _, log := range logs {
		if !s.queue.PushLog(log) {
			slog.Warn("logs: queue full, dropping log", "log_id", log.ID)
			dropped++
			continue
		}
		slog.Debug("log accepted", "log_id", log.ID, "trace_id", log.TraceID, "service", log.ServiceName)
		accepted++
	}

	if dropped > 0 {
		slog.Warn("logs: some dropped", "accepted", accepted, "dropped", dropped)
	}

	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"accepted":%d,"dropped":%d}`, accepted, dropped)
}

// ─── TraceFlow native log format (sent by Java SDK) ───────────────────────

type nativeLogPayload struct {
	ID          string            `json:"id"`
	TraceID     string            `json:"trace_id"`
	ServiceName string            `json:"service_name"`
	Level       string            `json:"level"`
	Message     string            `json:"message"`
	Attributes  map[string]string `json:"attributes"`
	Timestamp   string            `json:"timestamp"`
	WorkspaceID string            `json:"workspace_id"`
}

func isTraceFlowNativeLog(data []byte) bool {
	// Quick check: native log JSON contains "trace_id" but NOT "resourceLogs"
	s := string(data)
	return strings.Contains(s, `"trace_id"`) && !strings.Contains(s, `"resourceLogs"`)
}

func parseNativeLog(data []byte) (*validator.LogEvent, error) {
	var p nativeLogPayload
	if err := json.Unmarshal(data, &p); err != nil {
		return nil, fmt.Errorf("invalid native log JSON: %w", err)
	}

	ts := time.Now()
	if p.Timestamp != "" {
		if parsed, err := time.Parse(time.RFC3339Nano, p.Timestamp); err == nil {
			ts = parsed
		}
	}

	id := p.ID
	if id == "" {
		id = fmt.Sprintf("%s_%d", p.TraceID, ts.UnixNano())
	}

	return &validator.LogEvent{
		ID:          id,
		TraceID:     p.TraceID,
		ServiceName: p.ServiceName,
		Level:       p.Level,
		Message:     p.Message,
		Attributes:  p.Attributes,
		Timestamp:   ts,
		WorkspaceID: p.WorkspaceID,
	}, nil
}

// ─── Parse OTLP logs payload (JSON or protobuf) ───────────────────────────

func parseOTLPLogsPayload(data []byte, contentType, workspaceID string) ([]*validator.LogEvent, int, error) {
	if strings.Contains(strings.ToLower(contentType), "json") || (len(data) > 0 && data[0] == '{') {
		return parseOTLPLogsJSON(data, workspaceID)
	}
	return parseOTLPLogsProtobuf(data, workspaceID)
}

func parseOTLPLogsJSON(data []byte, workspaceID string) ([]*validator.LogEvent, int, error) {
	var req otlpLogsRequest
	if err := json.Unmarshal(data, &req); err != nil {
		return nil, 0, fmt.Errorf("invalid OTLP JSON: %w", err)
	}

	logs := make([]*validator.LogEvent, 0)
	dropped := 0

	for _, rl := range req.ResourceLogs {
		serviceName := attrString(rl.Resource.Attributes, "service.name")
		if serviceName == "" {
			serviceName = "unknown"
		}

		for _, sl := range rl.ScopeLogs {
			for _, lr := range sl.LogRecords {
				log, err := convertOTLPLogRecord(lr, serviceName, workspaceID)
				if err != nil {
					slog.Warn("otlp: failed to convert JSON log", "error", err)
					dropped++
					continue
				}
				logs = append(logs, log)
			}
		}
	}

	return logs, dropped, nil
}

func parseOTLPLogsProtobuf(data []byte, workspaceID string) ([]*validator.LogEvent, int, error) {
	var req collogspb.ExportLogsServiceRequest
	if err := proto.Unmarshal(data, &req); err != nil {
		return nil, 0, fmt.Errorf("invalid OTLP protobuf: %w", err)
	}

	logs := make([]*validator.LogEvent, 0)
	dropped := 0

	for _, rl := range req.ResourceLogs {
		serviceName := attrFromProtoLogs(rl.Resource, "service.name")
		if serviceName == "" {
			serviceName = "unknown"
		}

		for _, sl := range rl.ScopeLogs {
			for _, lr := range sl.LogRecords {
				log, err := convertProtoLogRecord(lr, serviceName, workspaceID)
				if err != nil {
					slog.Warn("otlp: failed to convert proto log", "error", err)
					dropped++
					continue
				}
				logs = append(logs, log)
			}
		}
	}

	return logs, dropped, nil
}

// ─── Convert OTLP log record to TraceFlow log event ───────────────────────

func convertOTLPLogRecord(lr otlpLogRecord, serviceName, workspaceID string) (*validator.LogEvent, error) {
	timestamp, err := parseUnixNano(lr.TimeUnixNano)
	if err != nil {
		timestamp = time.Now()
	}

	level := otlpSeverityToLevel(lr.SeverityText)
	message := lr.Body.StringValue
	if message == "" && lr.Body.IntValue != "" {
		message = lr.Body.IntValue
	}

	attrs := make(map[string]string)
	for _, a := range lr.Attributes {
		val := a.Value.StringValue
		if val == "" && a.Value.IntValue != "" {
			val = a.Value.IntValue
		}
		attrs[a.Key] = val
	}

	return &validator.LogEvent{
		TraceID:     lr.TraceID,
		ServiceName: serviceName,
		Level:       level,
		Message:     message,
		Attributes:  attrs,
		Timestamp:   timestamp,
		WorkspaceID: workspaceID,
	}, nil
}

func convertProtoLogRecord(lr *logspb.LogRecord, serviceName, workspaceID string) (*validator.LogEvent, error) {
	if lr == nil {
		return nil, fmt.Errorf("log record is nil")
	}

	timestamp := time.Unix(0, int64(lr.GetTimeUnixNano()))
	if timestamp.IsZero() {
		timestamp = time.Now()
	}

	level := otlpSeverityToLevel(lr.GetSeverityText())
	message := anyValueToStringLogs(lr.GetBody())
	if message == "" {
		message = "<empty>"
	}

	attrs := make(map[string]string)
	for _, attr := range lr.Attributes {
		if attr == nil {
			continue
		}
		val := anyValueToStringLogs(attr.Value)
		if val != "" {
			attrs[attr.Key] = val
		}
	}

	return &validator.LogEvent{
		TraceID:     fmt.Sprintf("%032x", lr.GetTraceId()),
		ServiceName: serviceName,
		Level:       level,
		Message:     message,
		Attributes:  attrs,
		Timestamp:   timestamp,
		WorkspaceID: workspaceID,
	}, nil
}

func attrFromProtoLogs(res *resourcepb.Resource, key string) string {
	if res == nil {
		return ""
	}
	for _, kv := range res.Attributes {
		if kv != nil && kv.Key == key {
			return anyValueToStringLogs(kv.Value)
		}
	}
	return ""
}

func anyValueToStringLogs(v *commonpb.AnyValue) string {
	if v == nil {
		return ""
	}
	switch val := v.Value.(type) {
	case *commonpb.AnyValue_StringValue:
		return val.StringValue
	case *commonpb.AnyValue_IntValue:
		return strconv.FormatInt(val.IntValue, 10)
	case *commonpb.AnyValue_DoubleValue:
		return strconv.FormatFloat(val.DoubleValue, 'f', -1, 64)
	case *commonpb.AnyValue_BoolValue:
		return strconv.FormatBool(val.BoolValue)
	case *commonpb.AnyValue_ArrayValue:
		parts := make([]string, 0, len(val.ArrayValue.Values))
		for _, v := range val.ArrayValue.Values {
			parts = append(parts, anyValueToStringLogs(v))
		}
		return strings.Join(parts, ",")
	default:
		return ""
	}
}

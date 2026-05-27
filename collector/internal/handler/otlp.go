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
	coltracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	tracepb "go.opentelemetry.io/proto/otlp/trace/v1"
	resourcepb "go.opentelemetry.io/proto/otlp/resource/v1"
	"google.golang.org/protobuf/proto"
)

// ─── OTLP JSON structures (minimal subset we need) ───────────────────────────

type otlpTracesRequest struct {
	ResourceSpans []otlpResourceSpan `json:"resourceSpans"`
}

type otlpResourceSpan struct {
	Resource   otlpResource    `json:"resource"`
	ScopeSpans []otlpScopeSpan `json:"scopeSpans"`
}

type otlpResource struct {
	Attributes []otlpAttribute `json:"attributes"`
}

type otlpScopeSpan struct {
	Spans []otlpSpan `json:"spans"`
}

type otlpSpan struct {
	TraceID           string          `json:"traceId"`
	SpanID            string          `json:"spanId"`
	ParentSpanID      string          `json:"parentSpanId"`
	Name              string          `json:"name"`
	Kind              int             `json:"kind"`
	StartTimeUnixNano string          `json:"startTimeUnixNano"`
	EndTimeUnixNano   string          `json:"endTimeUnixNano"`
	Attributes        []otlpAttribute `json:"attributes"`
	Status            otlpStatus      `json:"status"`
}

type otlpAttribute struct {
	Key   string     `json:"key"`
	Value otlpAnyVal `json:"value"`
}

type otlpAnyVal struct {
	StringValue string `json:"stringValue,omitempty"`
	IntValue    string `json:"intValue,omitempty"`
	BoolValue   bool   `json:"boolValue,omitempty"`
}

type otlpStatus struct {
	Code    int    `json:"code"`
	Message string `json:"message,omitempty"`
}

// ─── OTLP span kind → TraceFlow kind ─────────────────────────────────────────
// https://opentelemetry.io/docs/specs/otel/trace/api/#spankind
// 0=UNSPECIFIED, 1=INTERNAL, 2=SERVER, 3=CLIENT, 4=PRODUCER, 5=CONSUMER
var otlpKindMap = map[int]string{
	0: "internal",
	1: "internal",
	2: "server",
	3: "client",
	4: "producer",
	5: "consumer",
}

// ─── OTLP status code → TraceFlow status ─────────────────────────────────────
// 0=UNSET, 1=OK, 2=ERROR
func otlpStatusToTraceFlow(code int) string {
	switch code {
	case 2:
		return "error"
	default:
		return "ok"
	}
}

// ─── Handler ──────────────────────────────────────────────────────────────────

func (s *Server) handleOTLPTraces(w http.ResponseWriter, r *http.Request) {
	workspaceID := r.Header.Get("X-Workspace-Id")
	if workspaceID == "" {
		workspaceID = r.URL.Query().Get("workspace_id")
	}
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "X-Workspace-Id header or workspace_id query param is required")
		return
	}

	data, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", "failed to read body")
		return
	}
	if len(data) == 0 {
		writeError(w, http.StatusBadRequest, "validation_error", "empty OTLP payload")
		return
	}

	ct := r.Header.Get("Content-Type")
	spans, dropped, err := parseOTLPPayload(data, ct, workspaceID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	accepted := 0
	for _, span := range spans {
		if !s.queue.Push(span) {
			slog.Warn("otlp: queue full, dropping span", "span_id", span.ID)
			dropped++
			continue
		}
		slog.Debug("otlp span accepted", "span_id", span.ID, "trace_id", span.TraceID, "service", span.ServiceName)
		accepted++
	}

	if dropped > 0 {
		slog.Warn("otlp: some spans dropped", "accepted", accepted, "dropped", dropped)
	}

	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"accepted":%d,"dropped":%d}`, accepted, dropped)
}

// ─── Conversion ───────────────────────────────────────────────────────────────

func convertOTLPSpan(os otlpSpan, serviceName, workspaceID string) (*validator.SpanEvent, error) {
	startedAt, err := parseUnixNano(os.StartTimeUnixNano)
	if err != nil {
		return nil, fmt.Errorf("invalid startTimeUnixNano: %w", err)
	}

	endedAt, err := parseUnixNano(os.EndTimeUnixNano)
	if err != nil {
		return nil, fmt.Errorf("invalid endTimeUnixNano: %w", err)
	}

	durationMs := endedAt.Sub(startedAt).Milliseconds()

	kind := otlpKindMap[os.Kind]
	status := otlpStatusToTraceFlow(os.Status.Code)

	tags := make(map[string]string)
	for _, a := range os.Attributes {
		val := a.Value.StringValue
		if val == "" && a.Value.IntValue != "" {
			val = a.Value.IntValue
		}
		if val == "" && a.Value.BoolValue {
			val = "true"
		}
		tags[a.Key] = val
	}

	span := &validator.SpanEvent{
		ID:            os.SpanID,
		TraceID:       os.TraceID,
		ServiceName:   serviceName,
		OperationName: os.Name,
		Kind:          kind,
		StartedAt:     startedAt,
		EndedAt:       &endedAt,
		DurationMs:    &durationMs,
		Status:        status,
		Tags:          tags,
		WorkspaceID:   workspaceID,
	}

	if os.ParentSpanID != "" {
		span.ParentID = os.ParentSpanID
	}

	if status == "error" && os.Status.Message != "" {
		span.Error = &validator.SpanError{
			Type:    "OTelError",
			Message: os.Status.Message,
		}
	}

	return span, nil
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func parseUnixNano(s string) (time.Time, error) {
	if s == "" || s == "0" {
		return time.Time{}, fmt.Errorf("empty or zero timestamp")
	}
	var ns int64
	if _, err := fmt.Sscanf(s, "%d", &ns); err != nil {
		return time.Time{}, err
	}
	return time.Unix(0, ns), nil
}

func attrString(attrs []otlpAttribute, key string) string {
	for _, a := range attrs {
		if a.Key == key {
			return a.Value.StringValue
		}
	}
	return ""
}

func parseOTLPPayload(data []byte, contentType, workspaceID string) ([]*validator.SpanEvent, int, error) {
	if strings.Contains(strings.ToLower(contentType), "json") || (len(data) > 0 && data[0] == '{') {
		return parseOTLPJSON(data, workspaceID)
	}
	return parseOTLPProtobuf(data, workspaceID)
}

func parseOTLPJSON(data []byte, workspaceID string) ([]*validator.SpanEvent, int, error) {
	var req otlpTracesRequest
	if err := json.Unmarshal(data, &req); err != nil {
		return nil, 0, fmt.Errorf("invalid OTLP JSON: %w", err)
	}

	spans := make([]*validator.SpanEvent, 0)
	dropped := 0

	for _, rs := range req.ResourceSpans {
		serviceName := attrString(rs.Resource.Attributes, "service.name")
		if serviceName == "" {
			serviceName = "unknown"
		}

		for _, ss := range rs.ScopeSpans {
			for _, os := range ss.Spans {
				span, err := convertOTLPSpan(os, serviceName, workspaceID)
				if err != nil {
					slog.Warn("otlp: failed to convert JSON span", "error", err)
					dropped++
					continue
				}
				spans = append(spans, span)
			}
		}
	}

	return spans, dropped, nil
}

func parseOTLPProtobuf(data []byte, workspaceID string) ([]*validator.SpanEvent, int, error) {
	var req coltracepb.ExportTraceServiceRequest
	if err := proto.Unmarshal(data, &req); err != nil {
		return nil, 0, fmt.Errorf("invalid OTLP protobuf: %w", err)
	}

	spans := make([]*validator.SpanEvent, 0)
	dropped := 0

	for _, rs := range req.ResourceSpans {
		serviceName := attrFromProto(rs.Resource, "service.name")
		if serviceName == "" {
			serviceName = "unknown"
		}

		for _, ss := range rs.ScopeSpans {
			for _, ps := range ss.Spans {
				span, err := convertProtoSpan(ps, serviceName, workspaceID)
				if err != nil {
					slog.Warn("otlp: failed to convert proto span", "error", err)
					dropped++
					continue
				}
				spans = append(spans, span)
			}
		}
	}

	return spans, dropped, nil
}

func convertProtoSpan(os *tracepb.Span, serviceName, workspaceID string) (*validator.SpanEvent, error) {
	if os == nil {
		return nil, fmt.Errorf("span is nil")
	}

	startedAt := time.Unix(0, int64(os.GetStartTimeUnixNano()))
	endedAt := time.Unix(0, int64(os.GetEndTimeUnixNano()))
	if startedAt.IsZero() || endedAt.IsZero() {
		return nil, fmt.Errorf("invalid timestamps")
	}
	if endedAt.Before(startedAt) {
		return nil, fmt.Errorf("end before start")
	}

	durationMs := endedAt.Sub(startedAt).Milliseconds()
	kind := otlpKindMap[int(os.GetKind())]
	status := otlpStatusToTraceFlow(int(os.GetStatus().GetCode()))

	tags := make(map[string]string)
	for _, attr := range os.Attributes {
		if attr == nil {
			continue
		}
		val := anyValueToString(attr.Value)
		if val != "" {
			tags[attr.Key] = val
		}
	}

	span := &validator.SpanEvent{
		ID:            fmt.Sprintf("%016x", os.GetSpanId()),
		TraceID:       fmt.Sprintf("%032x", os.GetTraceId()),
		ServiceName:   serviceName,
		OperationName: os.GetName(),
		Kind:          kind,
		StartedAt:     startedAt,
		Status:        status,
		Tags:          tags,
		WorkspaceID:   workspaceID,
	}

	if !endedAt.IsZero() {
		span.EndedAt = &endedAt
		duration := durationMs
		span.DurationMs = &duration
	}

	if parent := os.GetParentSpanId(); len(parent) > 0 {
		span.ParentID = fmt.Sprintf("%016x", parent)
	}

	if status == "error" && os.GetStatus() != nil && os.GetStatus().GetMessage() != "" {
		span.Error = &validator.SpanError{
			Type:    "OTelError",
			Message: os.GetStatus().GetMessage(),
		}
	}

	return span, nil
}

func attrFromProto(res *resourcepb.Resource, key string) string {
	if res == nil {
		return ""
	}

	for _, kv := range res.Attributes {
		if kv != nil && kv.Key == key {
			return anyValueToString(kv.Value)
		}
	}
	return ""
}

func anyValueToString(v *commonpb.AnyValue) string {
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
			parts = append(parts, anyValueToString(v))
		}
		return strings.Join(parts, ",")
	default:
		return ""
	}
}

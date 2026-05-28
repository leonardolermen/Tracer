package middleware

import (
	"bytes"
	"io"
	"net/http"
	"regexp"
	"time"

	"github.com/traceflow/sdk-go/tracer"
)

var sensitiveRegex = regexp.MustCompile(`(?i)"(password|token|cvv)"\s*:\s*(?:"[^"]*"|[^,}]+)`)

func redactAndTruncate(body []byte) string {
	if len(body) == 0 {
		return ""
	}
	
	// Truncate to 2KB
	if len(body) > 2048 {
		body = body[:2048]
	}
	
	// Redact
	redacted := sensitiveRegex.ReplaceAll(body, []byte(`"$1":"[REDACTED]"`))
	
	return string(redacted)
}

type responseWriter struct {
	http.ResponseWriter
	status int
	body   *bytes.Buffer
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

func (rw *responseWriter) Write(b []byte) (int, error) {
	if rw.body.Len() < 2048 {
		toWrite := 2048 - rw.body.Len()
		if len(b) < toWrite {
			toWrite = len(b)
		}
		rw.body.Write(b[:toWrite])
	}
	return rw.ResponseWriter.Write(b)
}

func Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		span := &tracer.SpanEvent{
			TraceID:   tracer.GenerateID(16),
			SpanID:    tracer.GenerateID(8),
			Name:      r.Method + " " + r.URL.Path,
			Timestamp: time.Now(),
			Tags: map[string]interface{}{
				"http.method": r.Method,
				"http.url":    r.URL.String(),
			},
			Logs: []tracer.LogEntry{},
		}

		var reqBody []byte
		if r.Body != nil {
			reqBody, _ = io.ReadAll(io.LimitReader(r.Body, 2048))
			r.Body = struct {
				io.Reader
				io.Closer
			}{
				Reader: io.MultiReader(bytes.NewReader(reqBody), r.Body),
				Closer: r.Body,
			}
		}

		span.Logs = append(span.Logs, tracer.LogEntry{
			Timestamp: time.Now(),
			Event:     "http.request",
			Message:   redactAndTruncate(reqBody),
		})

		rw := &responseWriter{
			ResponseWriter: w,
			status:         http.StatusOK,
			body:           &bytes.Buffer{},
		}

		next.ServeHTTP(rw, r)

		span.Logs = append(span.Logs, tracer.LogEntry{
			Timestamp: time.Now(),
			Event:     "http.response",
			Message:   redactAndTruncate(rw.body.Bytes()),
		})

		span.Tags["http.status_code"] = rw.status

		tracer.SendSpan(span)
	})
}

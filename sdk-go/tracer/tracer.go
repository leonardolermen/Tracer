package tracer

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"os"
	"time"
)

type SpanEvent struct {
	TraceID   string                 `json:"trace_id"`
	SpanID    string                 `json:"span_id"`
	Name      string                 `json:"name"`
	Timestamp time.Time              `json:"timestamp"`
	Logs      []LogEntry             `json:"logs"`
	Tags      map[string]interface{} `json:"tags"`
}

type LogEntry struct {
	Timestamp time.Time `json:"timestamp"`
	Event     string    `json:"event"`
	Message   string    `json:"message"`
}

var collectorURL = os.Getenv("TF_COLLECTOR_URL")
var httpClient = &http.Client{Timeout: 5 * time.Second}

func SendSpan(span *SpanEvent) {
	if collectorURL == "" {
		return
	}
	
	go func(s SpanEvent) {
		payload, err := json.Marshal(s)
		if err != nil {
			return
		}
		
		req, err := http.NewRequest("POST", collectorURL, bytes.NewBuffer(payload))
		if err != nil {
			return
		}
		req.Header.Set("Content-Type", "application/json")
		
		resp, err := httpClient.Do(req)
		if err == nil {
			resp.Body.Close()
		}
	}(*span)
}

func GenerateID(bytesLen int) string {
	b := make([]byte, bytesLen)
	_, err := rand.Read(b)
	if err != nil {
		return "fallback-id"
	}
	return hex.EncodeToString(b)
}

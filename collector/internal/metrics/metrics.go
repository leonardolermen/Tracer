// Package metrics exposes lightweight, dependency-free Prometheus counters for
// the collector's ingestion path. Counters are process-global and safe for
// concurrent use. The Handler renders them in the Prometheus text exposition
// format so the collector can be scraped without pulling in a client library.
package metrics

import (
	"fmt"
	"net/http"
	"sync/atomic"
)

var (
	// SpansReceived counts spans successfully enqueued for publishing.
	SpansReceived atomic.Int64
	// SpansDropped counts spans dropped because the in-memory queue was full.
	SpansDropped atomic.Int64
	// LogsReceived counts business logs successfully enqueued.
	LogsReceived atomic.Int64
	// LogsDropped counts business logs dropped because the queue was full.
	LogsDropped atomic.Int64
	// AuthRejected counts requests rejected for a missing/invalid api-key.
	AuthRejected atomic.Int64
	// RateLimited counts requests rejected by the per-workspace rate limiter.
	RateLimited atomic.Int64
)

type counter struct {
	name string
	help string
	val  *atomic.Int64
}

func all() []counter {
	return []counter{
		{"traceflow_collector_spans_received_total", "Spans successfully enqueued for publishing.", &SpansReceived},
		{"traceflow_collector_spans_dropped_total", "Spans dropped because the in-memory queue was full.", &SpansDropped},
		{"traceflow_collector_logs_received_total", "Business logs successfully enqueued.", &LogsReceived},
		{"traceflow_collector_logs_dropped_total", "Business logs dropped because the in-memory queue was full.", &LogsDropped},
		{"traceflow_collector_auth_rejected_total", "Requests rejected due to a missing or invalid api-key.", &AuthRejected},
		{"traceflow_collector_rate_limited_total", "Requests rejected by the per-workspace rate limiter.", &RateLimited},
	}
}

// Handler renders all counters in the Prometheus text exposition format.
func Handler(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	for _, c := range all() {
		fmt.Fprintf(w, "# HELP %s %s\n", c.name, c.help)
		fmt.Fprintf(w, "# TYPE %s counter\n", c.name)
		fmt.Fprintf(w, "%s %d\n", c.name, c.val.Load())
	}
}

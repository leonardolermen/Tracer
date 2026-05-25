package correlator

import (
	"log/slog"
	"sync"
	"time"

	"github.com/leonardolermen/tracer/processor/internal/model"
)

const (
	traceTimeout  = 30 * time.Second
	cleanupTicker = 10 * time.Second
)

type traceBuffer struct {
	spans     []*model.SpanEvent
	lastSeen  time.Time
}

type Correlator struct {
	mu      sync.Mutex
	buffers map[string]*traceBuffer
	out     chan []*model.SpanEvent
}

func New() *Correlator {
	return &Correlator{
		buffers: make(map[string]*traceBuffer),
		out:     make(chan []*model.SpanEvent, 1000),
	}
}

func (c *Correlator) Add(span *model.SpanEvent) {
	c.mu.Lock()
	defer c.mu.Unlock()

	buf, ok := c.buffers[span.TraceID]
	if !ok {
		buf = &traceBuffer{}
		c.buffers[span.TraceID] = buf
	}

	buf.spans = append(buf.spans, span)
	buf.lastSeen = time.Now()

	if c.isComplete(buf) {
		slog.Debug("trace complete", "trace_id", span.TraceID, "spans", len(buf.spans))
		c.flush(span.TraceID, buf)
	}
}

func (c *Correlator) Out() <-chan []*model.SpanEvent {
	return c.out
}

func (c *Correlator) RunCleanup() {
	ticker := time.NewTicker(cleanupTicker)
	defer ticker.Stop()

	for range ticker.C {
		c.evictStale()
	}
}

func (c *Correlator) isComplete(buf *traceBuffer) bool {
	parentIDs := make(map[string]bool)
	for _, s := range buf.spans {
		parentIDs[s.ID] = true
	}

	hasRoot := false
	for _, s := range buf.spans {
		if s.ParentID == "" {
			hasRoot = true
		}
		if s.Status == "in_progress" {
			return false
		}
	}

	if !hasRoot {
		return false
	}

	for _, s := range buf.spans {
		if s.ParentID != "" && !parentIDs[s.ParentID] {
			return false
		}
	}

	return true
}

func (c *Correlator) flush(traceID string, buf *traceBuffer) {
	spans := make([]*model.SpanEvent, len(buf.spans))
	copy(spans, buf.spans)
	delete(c.buffers, traceID)

	select {
	case c.out <- spans:
	default:
		slog.Warn("correlator output channel full, dropping trace", "trace_id", traceID)
	}
}

func (c *Correlator) evictStale() {
	c.mu.Lock()
	defer c.mu.Unlock()

	now := time.Now()
	for traceID, buf := range c.buffers {
		if now.Sub(buf.lastSeen) > traceTimeout {
			slog.Debug("evicting stale trace", "trace_id", traceID, "spans", len(buf.spans))
			c.flush(traceID, buf)
		}
	}
}

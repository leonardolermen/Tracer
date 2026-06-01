// Package ratelimit provides a simple in-memory token-bucket limiter keyed by
// an arbitrary string (e.g. workspace_id). It is safe for concurrent use.
package ratelimit

import (
	"sync"
	"time"
)

type bucket struct {
	tokens     float64
	lastRefill time.Time
}

// Limiter enforces an approximate "events per minute" budget per key using a
// token bucket. The burst capacity equals the per-minute budget.
type Limiter struct {
	mu      sync.Mutex
	buckets map[string]*bucket
	rate    float64 // tokens added per second
	burst   float64 // maximum tokens
}

// New creates a Limiter allowing up to perMinute events per minute per key.
func New(perMinute int) *Limiter {
	return &Limiter{
		buckets: make(map[string]*bucket),
		rate:    float64(perMinute) / 60.0,
		burst:   float64(perMinute),
	}
}

// Allow reports whether an event for the given key may proceed, consuming one
// token if so.
func (l *Limiter) Allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	b, ok := l.buckets[key]
	if !ok {
		b = &bucket{tokens: l.burst, lastRefill: now}
		l.buckets[key] = b
	}

	elapsed := now.Sub(b.lastRefill).Seconds()
	b.tokens = min(l.burst, b.tokens+elapsed*l.rate)
	b.lastRefill = now

	if b.tokens >= 1 {
		b.tokens--
		return true
	}
	return false
}

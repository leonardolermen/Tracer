package queue

import "github.com/leonardolermen/tracer/collector/internal/validator"

type Queue struct {
	ch chan *validator.SpanEvent
}

func New(size int) *Queue {
	return &Queue{ch: make(chan *validator.SpanEvent, size)}
}

func (q *Queue) Push(span *validator.SpanEvent) bool {
	select {
	case q.ch <- span:
		return true
	default:
		return false
	}
}

func (q *Queue) Chan() <-chan *validator.SpanEvent {
	return q.ch
}

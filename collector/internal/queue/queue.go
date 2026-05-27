package queue

import "github.com/leonardolermen/tracer/collector/internal/validator"

type Queue struct {
	spanCh chan *validator.SpanEvent
	logCh  chan *validator.LogEvent
}

func New(size int) *Queue {
	return &Queue{
		spanCh: make(chan *validator.SpanEvent, size),
		logCh:  make(chan *validator.LogEvent, size),
	}
}

func (q *Queue) Push(span *validator.SpanEvent) bool {
	select {
	case q.spanCh <- span:
		return true
	default:
		return false
	}
}

func (q *Queue) PushLog(log *validator.LogEvent) bool {
	select {
	case q.logCh <- log:
		return true
	default:
		return false
	}
}

func (q *Queue) SpanChan() <-chan *validator.SpanEvent {
	return q.spanCh
}

func (q *Queue) LogChan() <-chan *validator.LogEvent {
	return q.logCh
}

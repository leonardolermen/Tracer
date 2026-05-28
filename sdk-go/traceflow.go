package traceflow

import (
	"net/http"
	"github.com/traceflow/sdk-go/middleware"
)

// Middleware wraps net/http handlers to generate TraceFlow spans
func Middleware(next http.Handler) http.Handler {
	return middleware.Middleware(next)
}

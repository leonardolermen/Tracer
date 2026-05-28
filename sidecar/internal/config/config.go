package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

type Config struct {
	// Target upstream service URL (required)
	TargetURL string

	// Name of the service being proxied (required)
	ServiceName string

	// TraceFlow workspace ID
	WorkspaceID string

	// TraceFlow collector HTTP URL
	CollectorURL string

	// Port this sidecar listens on
	Port int

	// Max body size to capture in bytes (default 2048)
	MaxBodyBytes int64

	// Comma-separated extra sensitive field names to redact
	ExtraRedactFields []string

	// Disable body capture entirely
	DisableBodyCapture bool

	// Log level (DEBUG, INFO, WARN, ERROR)
	LogLevel string
}

func Load() (*Config, error) {
	target := os.Getenv("TF_TARGET")
	if target == "" {
		return nil, fmt.Errorf("TF_TARGET is required — set it to the upstream service URL (e.g. http://my-service:8080)")
	}

	serviceName := os.Getenv("TF_SERVICE_NAME")
	if serviceName == "" {
		return nil, fmt.Errorf("TF_SERVICE_NAME is required — set it to the name of the service being proxied")
	}

	port := 8080
	if p := os.Getenv("TF_PORT"); p != "" {
		n, err := strconv.Atoi(p)
		if err != nil {
			return nil, fmt.Errorf("TF_PORT must be a number, got %q", p)
		}
		port = n
	}

	maxBody := int64(2048)
	if m := os.Getenv("TF_MAX_BODY_BYTES"); m != "" {
		n, err := strconv.ParseInt(m, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("TF_MAX_BODY_BYTES must be a number, got %q", m)
		}
		maxBody = n
	}

	var extraFields []string
	if ef := os.Getenv("TF_REDACT_FIELDS"); ef != "" {
		for _, f := range strings.Split(ef, ",") {
			f = strings.TrimSpace(strings.ToLower(f))
			if f != "" {
				extraFields = append(extraFields, f)
			}
		}
	}

	return &Config{
		TargetURL:          target,
		ServiceName:        serviceName,
		WorkspaceID:        envOr("TF_WORKSPACE_ID", "ws_dev"),
		CollectorURL:       envOr("TF_COLLECTOR_URL", "http://localhost:4317"),
		Port:               port,
		MaxBodyBytes:       maxBody,
		ExtraRedactFields:  extraFields,
		DisableBodyCapture: os.Getenv("TF_DISABLE_BODY_CAPTURE") == "true",
		LogLevel:           envOr("TF_LOG_LEVEL", "INFO"),
	}, nil
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

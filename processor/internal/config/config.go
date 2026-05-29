package config

import (
	"log/slog"
	"os"
)

type Config struct {
	DatabaseURL string
	RedisURL    string
	LogLevel    slog.Level
}

func Load() *Config {
	return &Config{
		DatabaseURL: getEnv("DATABASE_URL", "postgres://traceflow:traceflow@localhost:5433/traceflow"),
		RedisURL:    getEnv("REDIS_URL", "redis://localhost:6379"),
		LogLevel:    parseLogLevel(getEnv("LOG_LEVEL", "info")),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func parseLogLevel(level string) slog.Level {
	switch level {
	case "debug":
		return slog.LevelDebug
	case "warn":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

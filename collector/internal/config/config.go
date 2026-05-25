package config

import (
	"log/slog"
	"os"
	"strconv"
)

type Config struct {
	Port      string
	UDPPort   string
	RedisURL  string
	LogLevel  slog.Level
	QueueSize int
}

func Load() *Config {
	return &Config{
		Port:      getEnv("PORT", "4317"),
		UDPPort:   getEnv("UDP_PORT", "4318"),
		RedisURL:  getEnv("REDIS_URL", "redis://localhost:6379"),
		LogLevel:  parseLogLevel(getEnv("LOG_LEVEL", "info")),
		QueueSize: getEnvInt("QUEUE_SIZE", 10000),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
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

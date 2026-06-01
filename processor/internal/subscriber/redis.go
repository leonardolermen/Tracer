package subscriber

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"os"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/leonardolermen/tracer/processor/internal/correlator"
	"github.com/leonardolermen/tracer/processor/internal/model"
)

const (
	redisSpanStream = "spans"
	redisLogStream  = "logs"
	consumerGroup   = "processors"
	readBatchSize   = 100
	readBlock       = 5 * time.Second
)

type Subscriber struct {
	client     *redis.Client
	correlator *correlator.Correlator
	storage    Storage
	consumer   string
}

type Storage interface {
	PersistLog(ctx context.Context, log *model.LogEvent) error
}

func New(ctx context.Context, redisURL string, c *correlator.Correlator, storage Storage) (*Subscriber, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, err
	}

	client := redis.NewClient(opts)
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, err
	}

	// Create the consumer group on each stream (idempotent). "0" makes the group
	// consume any backlog already present in the stream, not just new messages.
	for _, stream := range []string{redisSpanStream, redisLogStream} {
		if err := client.XGroupCreateMkStream(ctx, stream, consumerGroup, "0").Err(); err != nil &&
			!strings.Contains(err.Error(), "BUSYGROUP") {
			return nil, err
		}
	}

	consumer := os.Getenv("HOSTNAME")
	if consumer == "" {
		consumer = "processor"
	}

	return &Subscriber{client: client, correlator: c, storage: storage, consumer: consumer}, nil
}

func (s *Subscriber) Run(ctx context.Context) {
	slog.Info("consuming redis streams",
		"streams", []string{redisSpanStream, redisLogStream},
		"group", consumerGroup, "consumer", s.consumer)

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		res, err := s.client.XReadGroup(ctx, &redis.XReadGroupArgs{
			Group:    consumerGroup,
			Consumer: s.consumer,
			Streams:  []string{redisSpanStream, redisLogStream, ">", ">"},
			Count:    readBatchSize,
			Block:    readBlock,
		}).Result()
		if err != nil {
			if errors.Is(err, redis.Nil) || ctx.Err() != nil {
				continue
			}
			slog.Error("xreadgroup error", "error", err)
			time.Sleep(time.Second)
			continue
		}

		for _, stream := range res {
			for _, msg := range stream.Messages {
				s.handleMessage(ctx, stream.Stream, msg)
			}
		}
	}
}

func (s *Subscriber) handleMessage(ctx context.Context, stream string, msg redis.XMessage) {
	data, _ := msg.Values["data"].(string)

	switch stream {
	case redisSpanStream:
		var span model.SpanEvent
		if err := json.Unmarshal([]byte(data), &span); err != nil {
			slog.Warn("failed to unmarshal span from redis", "error", err)
		} else {
			s.correlator.Add(&span)
		}
		// Ack: the span is now buffered in the correlator for persistence.
		s.ack(ctx, redisSpanStream, msg.ID)

	case redisLogStream:
		var log model.LogEvent
		if err := json.Unmarshal([]byte(data), &log); err != nil {
			slog.Warn("failed to unmarshal log from redis", "error", err)
			s.ack(ctx, redisLogStream, msg.ID) // poison message, drop it
			return
		}
		if err := s.storage.PersistLog(ctx, &log); err != nil {
			// Do NOT ack: leave it pending so it can be retried/claimed later.
			slog.Error("failed to persist log", "error", err)
			return
		}
		s.ack(ctx, redisLogStream, msg.ID)
	}
}

func (s *Subscriber) ack(ctx context.Context, stream, id string) {
	if err := s.client.XAck(ctx, stream, consumerGroup, id).Err(); err != nil {
		slog.Warn("failed to ack message", "stream", stream, "id", id, "error", err)
	}
}

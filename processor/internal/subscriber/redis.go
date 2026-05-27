package subscriber

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/redis/go-redis/v9"
	"github.com/leonardolermen/tracer/processor/internal/correlator"
	"github.com/leonardolermen/tracer/processor/internal/model"
)

const (
	redisSpanChannel = "spans"
	redisLogChannel  = "logs"
)

type Subscriber struct {
	client     *redis.Client
	correlator *correlator.Correlator
	storage    Storage
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

	return &Subscriber{client: client, correlator: c, storage: storage}, nil
}

func (s *Subscriber) Run(ctx context.Context) {
	pubsub := s.client.Subscribe(ctx, redisSpanChannel, redisLogChannel)
	defer pubsub.Close()

	slog.Info("subscribed to redis channels", "channels", []string{redisSpanChannel, redisLogChannel})

	ch := pubsub.Channel()
	for {
		select {
		case <-ctx.Done():
			return
		case msg, ok := <-ch:
			if !ok {
				return
			}
			switch msg.Channel {
			case redisSpanChannel:
				var span model.SpanEvent
				if err := json.Unmarshal([]byte(msg.Payload), &span); err != nil {
					slog.Warn("failed to unmarshal span from redis", "error", err)
					continue
				}
				s.correlator.Add(&span)
			case redisLogChannel:
				var log model.LogEvent
				if err := json.Unmarshal([]byte(msg.Payload), &log); err != nil {
					slog.Warn("failed to unmarshal log from redis", "error", err)
					continue
				}
				if err := s.storage.PersistLog(ctx, &log); err != nil {
					slog.Error("failed to persist log", "error", err)
				}
			}
		}
	}
}

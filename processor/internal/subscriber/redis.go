package subscriber

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/redis/go-redis/v9"
	"github.com/leonardolermen/tracer/processor/internal/correlator"
	"github.com/leonardolermen/tracer/processor/internal/model"
)

const redisChannel = "spans"

type Subscriber struct {
	client     *redis.Client
	correlator *correlator.Correlator
}

func New(ctx context.Context, redisURL string, c *correlator.Correlator) (*Subscriber, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, err
	}

	client := redis.NewClient(opts)
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, err
	}

	return &Subscriber{client: client, correlator: c}, nil
}

func (s *Subscriber) Run(ctx context.Context) {
	pubsub := s.client.Subscribe(ctx, redisChannel)
	defer pubsub.Close()

	slog.Info("subscribed to redis channel", "channel", redisChannel)

	ch := pubsub.Channel()
	for {
		select {
		case <-ctx.Done():
			return
		case msg, ok := <-ch:
			if !ok {
				return
			}
			var span model.SpanEvent
			if err := json.Unmarshal([]byte(msg.Payload), &span); err != nil {
				slog.Warn("failed to unmarshal span from redis", "error", err)
				continue
			}
			s.correlator.Add(&span)
		}
	}
}

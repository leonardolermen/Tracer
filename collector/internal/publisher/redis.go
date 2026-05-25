package publisher

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/redis/go-redis/v9"
	"github.com/leonardolermen/tracer/collector/internal/queue"
)

const redisChannel = "spans"

type Publisher struct {
	client *redis.Client
	queue  *queue.Queue
}

func New(ctx context.Context, redisURL string, q *queue.Queue) (*Publisher, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, err
	}

	client := redis.NewClient(opts)
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, err
	}

	return &Publisher{client: client, queue: q}, nil
}

func (p *Publisher) Run(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			p.client.Close()
			return
		case span := <-p.queue.Chan():
			payload, err := json.Marshal(span)
			if err != nil {
				slog.Error("failed to marshal span", "error", err)
				continue
			}
			if err := p.client.Publish(ctx, redisChannel, payload).Err(); err != nil {
				slog.Error("failed to publish span to redis", "error", err)
			}
		}
	}
}

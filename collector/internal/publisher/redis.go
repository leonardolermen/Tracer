package publisher

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/redis/go-redis/v9"
	"github.com/leonardolermen/tracer/collector/internal/queue"
)

const (
	redisSpanStream = "spans"
	redisLogStream  = "logs"
	// streamMaxLen caps each stream length (approximate) to bound Redis memory
	// while still providing durable, replayable delivery to the processor.
	streamMaxLen = 1_000_000
)

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
		case span := <-p.queue.SpanChan():
			payload, err := json.Marshal(span)
			if err != nil {
				slog.Error("failed to marshal span", "error", err)
				continue
			}
			if err := p.client.XAdd(ctx, &redis.XAddArgs{
				Stream: redisSpanStream,
				MaxLen: streamMaxLen,
				Approx: true,
				Values: map[string]interface{}{"data": payload},
			}).Err(); err != nil {
				slog.Error("failed to xadd span to redis", "error", err)
			}
		case log := <-p.queue.LogChan():
			payload, err := json.Marshal(log)
			if err != nil {
				slog.Error("failed to marshal log", "error", err)
				continue
			}
			if err := p.client.XAdd(ctx, &redis.XAddArgs{
				Stream: redisLogStream,
				MaxLen: streamMaxLen,
				Approx: true,
				Values: map[string]interface{}{"data": payload},
			}).Err(); err != nil {
				slog.Error("failed to xadd log to redis", "error", err)
			}
		}
	}
}

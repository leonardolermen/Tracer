package storage

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/leonardolermen/tracer/processor/internal/model"
)

type Store struct {
	pool *pgxpool.Pool
}

func New(ctx context.Context, databaseURL string) (*Store, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, err
	}

	if err := pool.Ping(ctx); err != nil {
		return nil, err
	}

	return &Store{pool: pool}, nil
}

func (s *Store) Close() {
	s.pool.Close()
}

func (s *Store) SaveSpans(ctx context.Context, spans []*model.SpanEvent) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for _, span := range spans {
		tags, err := json.Marshal(span.Tags)
		if err != nil {
			slog.Warn("failed to marshal tags", "span_id", span.ID, "error", err)
			tags = []byte("{}")
		}

		var errorType, errorMsg *string
		if span.Error != nil {
			errorType = &span.Error.Type
			errorMsg = &span.Error.Message
		}

		_, err = tx.Exec(ctx, `
			INSERT INTO spans (
				id, trace_id, parent_id, service_name, operation,
				kind, started_at, ended_at, duration_ms,
				status, error_type, error_msg, tags, workspace_id
			) VALUES (
				$1, $2, $3, $4, $5,
				$6, $7, $8, $9,
				$10, $11, $12, $13, $14
			) ON CONFLICT (id, started_at) DO NOTHING`,
			span.ID, span.TraceID, nullString(span.ParentID), span.ServiceName, span.OperationName,
			span.Kind, span.StartedAt, span.EndedAt, span.DurationMs,
			span.Status, errorType, errorMsg, tags, span.WorkspaceID,
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func nullString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

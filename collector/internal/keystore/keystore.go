// Package keystore maintains an in-memory cache of valid ingestion api-keys
// loaded from the workspaces table, mapping each api-key to its workspace_id.
//
// The collector stays effectively stateless from a request-handling standpoint
// (no per-request DB hit): keys are loaded at startup and refreshed periodically.
package keystore

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct {
	pool         *pgxpool.Pool
	refreshEvery time.Duration

	mu   sync.RWMutex
	keys map[string]string // api_key -> workspace_id
}

// New connects to the database, performs an initial load of the api-keys and
// returns a ready-to-use Store. Call Run to keep the cache fresh.
func New(ctx context.Context, databaseURL string, refreshEvery time.Duration) (*Store, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, err
	}

	s := &Store{
		pool:         pool,
		refreshEvery: refreshEvery,
		keys:         make(map[string]string),
	}

	if err := s.refresh(ctx); err != nil {
		pool.Close()
		return nil, err
	}

	return s, nil
}

func (s *Store) refresh(ctx context.Context) error {
	rows, err := s.pool.Query(ctx, `SELECT api_key, id FROM workspaces`)
	if err != nil {
		return err
	}
	defer rows.Close()

	keys := make(map[string]string)
	for rows.Next() {
		var apiKey, workspaceID string
		if err := rows.Scan(&apiKey, &workspaceID); err != nil {
			return err
		}
		keys[apiKey] = workspaceID
	}
	if err := rows.Err(); err != nil {
		return err
	}

	s.mu.Lock()
	s.keys = keys
	s.mu.Unlock()

	slog.Info("api-key cache refreshed", "count", len(keys))
	return nil
}

// WorkspaceID returns the workspace_id bound to the given api-key and whether
// the key is valid.
func (s *Store) WorkspaceID(apiKey string) (string, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	workspaceID, ok := s.keys[apiKey]
	return workspaceID, ok
}

// Run periodically refreshes the cache until ctx is cancelled.
func (s *Store) Run(ctx context.Context) {
	ticker := time.NewTicker(s.refreshEvery)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			s.pool.Close()
			return
		case <-ticker.C:
			if err := s.refresh(ctx); err != nil {
				slog.Error("failed to refresh api-key cache", "error", err)
			}
		}
	}
}

// Package keystore maintains an in-memory cache of valid ingestion api-keys
// loaded from the workspaces table, mapping each api-key to its workspace_id.
//
// The collector stays effectively stateless from a request-handling standpoint
// (no per-request DB hit): keys are loaded at startup and refreshed periodically.
package keystore

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"log/slog"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct {
	pool         *pgxpool.Pool
	refreshEvery time.Duration

	mu         sync.RWMutex
	legacyKeys map[string]string // api_key -> workspace_id
	hashedKeys map[string]string // sha256(api_key) -> workspace_id
	
	usedKeys chan string // channel for key_hashes to update last_used_at
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
		legacyKeys:   make(map[string]string),
		hashedKeys:   make(map[string]string),
		usedKeys:     make(chan string, 10000),
	}

	if err := s.refresh(ctx); err != nil {
		pool.Close()
		return nil, err
	}

	return s, nil
}

func (s *Store) refresh(ctx context.Context) error {
	// 1. Load legacy keys
	rows, err := s.pool.Query(ctx, `SELECT api_key, id FROM workspaces`)
	if err != nil {
		return err
	}
	defer rows.Close()

	legacy := make(map[string]string)
	for rows.Next() {
		var apiKey, workspaceID string
		if err := rows.Scan(&apiKey, &workspaceID); err != nil {
			return err
		}
		legacy[apiKey] = workspaceID
	}
	if err := rows.Err(); err != nil {
		return err
	}

	// 2. Load hashed keys
	rows2, err := s.pool.Query(ctx, `SELECT key_hash, workspace_id FROM api_keys WHERE revoked_at IS NULL`)
	if err != nil {
		return err
	}
	defer rows2.Close()

	hashed := make(map[string]string)
	for rows2.Next() {
		var keyHash, workspaceID string
		if err := rows2.Scan(&keyHash, &workspaceID); err != nil {
			return err
		}
		hashed[keyHash] = workspaceID
	}
	if err := rows2.Err(); err != nil {
		return err
	}

	s.mu.Lock()
	s.legacyKeys = legacy
	s.hashedKeys = hashed
	s.mu.Unlock()

	slog.Info("api-key cache refreshed", "legacy", len(legacy), "hashed", len(hashed))
	return nil
}

// WorkspaceID returns the workspace_id bound to the given api-key and whether
// the key is valid.
func (s *Store) WorkspaceID(apiKey string) (string, bool) {
	s.mu.RLock()
	workspaceID, ok := s.legacyKeys[apiKey]
	if ok {
		s.mu.RUnlock()
		return workspaceID, true
	}

	hashBytes := sha256.Sum256([]byte(apiKey))
	hashStr := hex.EncodeToString(hashBytes[:])
	workspaceID, ok = s.hashedKeys[hashStr]
	s.mu.RUnlock()

	if ok {
		select {
		case s.usedKeys <- hashStr:
		default:
		}
	}

	return workspaceID, ok
}

// Run periodically refreshes the cache until ctx is cancelled.
func (s *Store) Run(ctx context.Context) {
	ticker := time.NewTicker(s.refreshEvery)
	defer ticker.Stop()

	go s.flushUsedKeys(ctx)

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

func (s *Store) flushUsedKeys(ctx context.Context) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	used := make(map[string]bool)

	for {
		select {
		case <-ctx.Done():
			return
		case hash := <-s.usedKeys:
			used[hash] = true
		case <-ticker.C:
			if len(used) > 0 {
				hashes := make([]string, 0, len(used))
				for h := range used {
					hashes = append(hashes, h)
				}
				used = make(map[string]bool)

				// Background update
				go func(hashesToUpdate []string) {
					updateCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
					defer cancel()
					_, err := s.pool.Exec(updateCtx, `UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = ANY($1)`, hashesToUpdate)
					if err != nil {
						slog.Warn("failed to update last_used_at for api_keys", "error", err)
					}
				}(hashes)
			}
		}
	}
}

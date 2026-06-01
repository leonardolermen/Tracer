CREATE TABLE IF NOT EXISTS api_keys (
  id           TEXT PRIMARY KEY DEFAULT 'key_' || gen_random_uuid()::text,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  key_hash     TEXT NOT NULL UNIQUE,       -- SHA-256 hash da chave para lookup rápido
  key_prefix   TEXT NOT NULL,              -- primeiros 12 chars para display: "tf_live_ab12"
  last_used_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at   TIMESTAMPTZ                 -- NULL = ativa
);

CREATE INDEX IF NOT EXISTS idx_api_keys_ws ON api_keys (workspace_id, created_at DESC);

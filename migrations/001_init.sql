CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS workspaces (
  id          TEXT PRIMARY KEY DEFAULT 'ws_' || gen_random_uuid()::text,
  name        TEXT NOT NULL,
  api_key     TEXT NOT NULL UNIQUE DEFAULT 'tf_live_' || gen_random_uuid()::text,
  plan        TEXT NOT NULL DEFAULT 'free',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY DEFAULT 'usr_' || gen_random_uuid()::text,
  workspace_id   TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spans (
  id           TEXT NOT NULL,
  trace_id     TEXT NOT NULL,
  parent_id    TEXT,
  service_name TEXT NOT NULL,
  operation    TEXT NOT NULL,
  kind         TEXT NOT NULL,
  started_at   TIMESTAMPTZ NOT NULL,
  ended_at     TIMESTAMPTZ,
  duration_ms  INTEGER,
  status       TEXT NOT NULL DEFAULT 'in_progress',
  error_type   TEXT,
  error_msg    TEXT,
  tags         JSONB NOT NULL DEFAULT '{}',
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  PRIMARY KEY (id, started_at)
);

SELECT create_hypertable('spans', 'started_at', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_spans_trace_id     ON spans (trace_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_spans_workspace    ON spans (workspace_id, service_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_spans_status       ON spans (workspace_id, status, started_at DESC);

CREATE TABLE IF NOT EXISTS alerts (
  id           TEXT PRIMARY KEY DEFAULT 'alert_' || gen_random_uuid()::text,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  condition    JSONB NOT NULL,
  channels     JSONB NOT NULL DEFAULT '[]',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO workspaces (id, name, api_key, plan)
VALUES ('ws_dev', 'Dev Workspace', 'tf_live_devkey', 'free')
ON CONFLICT DO NOTHING;

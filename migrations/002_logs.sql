CREATE TABLE IF NOT EXISTS logs (
  id           TEXT NOT NULL DEFAULT 'log_' || gen_random_uuid()::text,
  trace_id     TEXT NOT NULL,
  service_name TEXT NOT NULL,
  level        TEXT NOT NULL CHECK (level IN ('DEBUG', 'INFO', 'WARN', 'ERROR')),
  message      TEXT NOT NULL,
  attributes   JSONB NOT NULL DEFAULT '{}',
  timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  PRIMARY KEY (id, timestamp)
);

SELECT create_hypertable('logs', 'timestamp', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_logs_trace_id      ON logs (trace_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_workspace     ON logs (workspace_id, service_name, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_level         ON logs (workspace_id, level, timestamp DESC);

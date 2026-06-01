-- Adiciona coluna fired_count e enabled à tabela alerts
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS last_fired_at TIMESTAMPTZ;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS fired_count INTEGER NOT NULL DEFAULT 0;

-- Histórico de disparos
CREATE TABLE IF NOT EXISTS alert_firings (
  id           TEXT PRIMARY KEY DEFAULT 'firing_' || gen_random_uuid()::text,
  alert_id     TEXT NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  fired_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  condition    JSONB NOT NULL,
  channels_ok  JSONB NOT NULL DEFAULT '[]',
  channels_err JSONB NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_firings_alert ON alert_firings (alert_id, fired_at DESC);
CREATE INDEX IF NOT EXISTS idx_firings_ws    ON alert_firings (workspace_id, fired_at DESC);

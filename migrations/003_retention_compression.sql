-- Retention & compression policies for the spans/logs hypertables.
--
-- Compression keeps recent data uncompressed for fast writes/queries and
-- compresses older chunks to save space. Retention drops chunks past a maximum
-- age. Timescale policies are global per hypertable; per-plan retention
-- (free 7d vs paid 90d) is enforced at the application layer on top of this
-- generous global ceiling so paid data is never dropped prematurely.

-- ── spans ────────────────────────────────────────────────────────────────────
ALTER TABLE spans SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'workspace_id',
  timescaledb.compress_orderby   = 'started_at DESC'
);

SELECT add_compression_policy('spans', INTERVAL '7 days', if_not_exists => TRUE);
SELECT add_retention_policy('spans', INTERVAL '90 days', if_not_exists => TRUE);

-- ── logs ─────────────────────────────────────────────────────────────────────
ALTER TABLE logs SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'workspace_id',
  timescaledb.compress_orderby   = 'timestamp DESC'
);

SELECT add_compression_policy('logs', INTERVAL '7 days', if_not_exists => TRUE);
SELECT add_retention_policy('logs', INTERVAL '90 days', if_not_exists => TRUE);

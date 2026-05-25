import { pool } from './pool'

export async function listServices(workspaceId: string) {
  const { rows } = await pool.query(
    `SELECT
      service_name AS name,
      MAX(started_at) AS last_seen_at,
      COUNT(CASE WHEN started_at >= NOW() - INTERVAL '24 hours' THEN 1 END) AS trace_count_24h,
      ROUND(
        COUNT(CASE WHEN started_at >= NOW() - INTERVAL '24 hours' AND status = 'error' THEN 1 END)::numeric /
        NULLIF(COUNT(CASE WHEN started_at >= NOW() - INTERVAL '24 hours' THEN 1 END), 0), 4
      ) AS error_rate_24h,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_duration_ms
    FROM spans
    WHERE workspace_id = $1 AND parent_id IS NULL
    GROUP BY service_name
    ORDER BY last_seen_at DESC`,
    [workspaceId]
  )
  return rows
}

export async function getServiceStats(
  workspaceId: string,
  serviceName: string,
  from: string,
  to: string,
  interval: string
) {
  const intervalMap: Record<string, string> = {
    '1m': '1 minute', '5m': '5 minutes', '1h': '1 hour', '1d': '1 day',
  }
  const pgInterval = intervalMap[interval] ?? '5 minutes'

  const { rows } = await pool.query(
    `SELECT
      time_bucket($1::interval, started_at) AS timestamp,
      COUNT(*) AS request_count,
      COUNT(CASE WHEN status = 'error' THEN 1 END) AS error_count,
      ROUND(
        COUNT(CASE WHEN status = 'error' THEN 1 END)::numeric / NULLIF(COUNT(*), 0), 4
      ) AS error_rate,
      PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration_ms) AS p50_ms,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_ms,
      PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) AS p99_ms
    FROM spans
    WHERE workspace_id = $2
      AND service_name = $3
      AND parent_id IS NULL
      AND started_at BETWEEN $4 AND $5
    GROUP BY timestamp
    ORDER BY timestamp ASC`,
    [pgInterval, workspaceId, serviceName, from, to]
  )
  return rows
}

import { Router } from 'express'
import { pool } from '../db/pool'
import { requireAuth } from '../middleware/auth'

const router = Router()
router.use(requireAuth)

router.get('/', async (req, res) => {
  const { from, to } = req.query
  const workspaceId = req.auth.workspaceId

  let timeFilter = "started_at >= NOW() - INTERVAL '1 hour'"
  const params: any[] = [workspaceId]

  if (from && to) {
    timeFilter = "started_at >= $2 AND started_at <= $3"
    params.push(new Date(String(from)), new Date(String(to)))
  } else if (from) {
    timeFilter = "started_at >= $2"
    params.push(new Date(String(from)))
  }

  const query = `
    WITH edges AS (
      SELECT 
        child.service_name as target,
        parent.service_name as source,
        child.duration_ms,
        child.status
      FROM spans child
      JOIN spans parent ON child.parent_id = parent.id AND child.workspace_id = parent.workspace_id
      WHERE child.workspace_id = $1 AND child.${timeFilter} AND parent.${timeFilter}
        AND child.service_name != parent.service_name
    )
    SELECT 
      source,
      target,
      COUNT(*) as request_count,
      COUNT(*) FILTER (WHERE status = 'error') as error_count,
      percentile_cont(0.95) within group (order by duration_ms) as p95_latency
    FROM edges
    GROUP BY source, target
  `

  try {
    const { rows } = await pool.query(query, params)
    
    const nodesQuery = `
      SELECT service_name, COUNT(*) as span_count
      FROM spans
      WHERE workspace_id = $1 AND ${timeFilter}
      GROUP BY service_name
    `
    const { rows: nodesRows } = await pool.query(nodesQuery, params)

    res.json({
      nodes: nodesRows.map(r => ({
        id: r.service_name,
        spanCount: Number(r.span_count)
      })),
      edges: rows.map(r => ({
        source: r.source,
        target: r.target,
        requestCount: Number(r.request_count),
        errorRate: Number(r.request_count) > 0 ? (Number(r.error_count) / Number(r.request_count)) * 100 : 0,
        p95Latency: r.p95_latency
      }))
    })
  } catch (err) {
    console.error('[topology] Error querying topology:', err)
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch topology data' })
  }
})

export default router

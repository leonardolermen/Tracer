import { pool } from './pool'

export interface TraceFilters {
  service?: string
  status?: string
  from?: string
  to?: string
  min_duration_ms?: number
  limit?: number
  cursor?: string
  workspaceId: string
}

export async function listTraces(filters: TraceFilters) {
  const {
    service, status, from, to,
    min_duration_ms, limit = 50, cursor, workspaceId,
  } = filters

  const conditions: string[] = ['workspace_id = $1']
  const params: unknown[] = [workspaceId]
  let i = 2

  if (service) { conditions.push(`service_name = $${i++}`); params.push(service) }
  if (status) { conditions.push(`status = $${i++}`); params.push(status) }
  if (from) { conditions.push(`started_at >= $${i++}`); params.push(from) }
  if (to) { conditions.push(`started_at <= $${i++}`); params.push(to) }
  if (min_duration_ms) { conditions.push(`duration_ms >= $${i++}`); params.push(min_duration_ms) }
  if (cursor) { conditions.push(`started_at < $${i++}`); params.push(cursor) }

  const where = conditions.join(' AND ')
  const safeLimit = Math.min(limit, 200)

  const { rows } = await pool.query(
    `SELECT
      trace_id AS id,
      MIN(started_at) AS started_at,
      MAX(ended_at) AS ended_at,
      SUM(duration_ms) AS duration_ms,
      MAX(CASE WHEN status = 'error' THEN 'error'
               WHEN status = 'timeout' THEN 'timeout'
               ELSE status END) AS status,
      MIN(CASE WHEN parent_id IS NULL THEN service_name END) AS root_service,
      MIN(CASE WHEN parent_id IS NULL THEN operation END) AS root_operation,
      COUNT(*) AS span_count,
      COUNT(CASE WHEN status = 'error' THEN 1 END) AS error_count,
      ARRAY_AGG(DISTINCT service_name) AS services
    FROM spans
    WHERE ${where}
    GROUP BY trace_id
    ORDER BY started_at DESC
    LIMIT $${i}`,
    [...params, safeLimit + 1]
  )

  const hasMore = rows.length > safeLimit
  const traces = hasMore ? rows.slice(0, safeLimit) : rows
  const nextCursor = hasMore ? traces[traces.length - 1].started_at : null

  return { traces, nextCursor }
}

export async function getTrace(traceId: string, workspaceId: string) {
  const { rows: spans } = await pool.query(
    `SELECT id, trace_id, parent_id, service_name, operation AS operation_name,
            kind, started_at, ended_at, duration_ms, status,
            error_type, error_msg, tags
     FROM spans
     WHERE trace_id = $1 AND workspace_id = $2
     ORDER BY started_at ASC`,
    [traceId, workspaceId]
  )

  if (spans.length === 0) return null

  const spanMap = new Map(spans.map((s: any) => [s.id, s]))
  const children: Record<string, string[]> = {}
  for (const s of spans) {
    if (s.parent_id) {
      children[s.parent_id] = children[s.parent_id] ?? []
      children[s.parent_id].push(s.id)
    }
  }

  const formattedSpans = spans.map((s: any) => ({
    id: s.id,
    parent_span_id: s.parent_id ?? null,
    service_name: s.service_name,
    operation_name: s.operation_name,
    kind: s.kind,
    started_at: s.started_at,
    ended_at: s.ended_at,
    duration_ms: s.duration_ms,
    status: s.status,
    error: s.error_type ? { type: s.error_type, message: s.error_msg } : null,
    tags: s.tags ?? {},
    logs: [],
    children: children[s.id] ?? [],
  }))

  const root = spans.find((s: any) => !s.parent_id)
  const nodes = formattedSpans.map((s: any) => ({
    id: s.id, service: s.service_name, operation: s.operation_name,
    status: s.status, duration_ms: s.duration_ms,
  }))
  const edges: { from: string; to: string; label: string }[] = []
  for (const s of spans) {
    if (s.parent_id) {
      edges.push({ from: s.parent_id, to: s.id, label: s.kind })
    }
  }

  return {
    id: traceId,
    started_at: root?.started_at,
    ended_at: spans.reduce((max: any, s: any) => s.ended_at > max ? s.ended_at : max, spans[0].ended_at),
    duration_ms: root?.duration_ms,
    status: root?.status,
    root_service: root?.service_name,
    root_operation: root?.operation_name,
    span_count: spans.length,
    error_count: spans.filter((s: any) => s.status === 'error').length,
    spans: formattedSpans,
    dag: { nodes, edges },
  }
}

export async function getTraceTimeline(traceId: string, workspaceId: string) {
  const { rows } = await pool.query(
    `SELECT id AS span_id, service_name, operation AS operation_name,
            started_at, duration_ms, status, parent_id
     FROM spans
     WHERE trace_id = $1 AND workspace_id = $2
     ORDER BY started_at ASC`,
    [traceId, workspaceId]
  )

  if (rows.length === 0) return null

  const traceStart = rows[0].started_at.getTime()
  const totalDuration = rows.reduce((max: number, s: any) =>
    Math.max(max, (s.started_at.getTime() - traceStart) + (s.duration_ms ?? 0)), 0)

  const depthMap: Record<string, number> = {}
  const parentDepth: Record<string, number> = {}
  for (const s of rows) {
    depthMap[s.span_id] = s.parent_id ? (parentDepth[s.parent_id] ?? 0) + 1 : 0
    parentDepth[s.span_id] = depthMap[s.span_id]
  }

  return {
    trace_id: traceId,
    total_duration_ms: totalDuration,
    timeline: rows.map((s: any) => ({
      span_id: s.span_id,
      service_name: s.service_name,
      operation_name: s.operation_name,
      offset_ms: s.started_at.getTime() - traceStart,
      duration_ms: s.duration_ms,
      status: s.status,
      depth: depthMap[s.span_id] ?? 0,
    })),
  }
}

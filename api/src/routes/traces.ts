import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { listTraces, getTrace, getTraceTimeline } from '../db/traces'

const router = Router()
router.use(requireAuth)

router.get('/', async (req, res) => {
  const { service, status, from, to, min_duration_ms, limit, cursor } = req.query

  const { traces, nextCursor } = await listTraces({
    workspaceId: req.auth.workspaceId,
    service: service as string,
    status: status as string,
    from: from as string,
    to: to as string,
    min_duration_ms: min_duration_ms ? Number(min_duration_ms) : undefined,
    limit: limit ? Number(limit) : 50,
    cursor: cursor as string,
  })

  res.json({ traces, total: traces.length, next_cursor: nextCursor })
})

router.get('/:traceId', async (req, res) => {
  const trace = await getTrace(req.params.traceId, req.auth.workspaceId)
  if (!trace) {
    res.status(404).json({ error: 'not_found', message: `Trace '${req.params.traceId}' not found` })
    return
  }
  res.json(trace)
})

router.get('/:traceId/timeline', async (req, res) => {
  const timeline = await getTraceTimeline(req.params.traceId, req.auth.workspaceId)
  if (!timeline) {
    res.status(404).json({ error: 'not_found', message: `Trace '${req.params.traceId}' not found` })
    return
  }
  res.json(timeline)
})

export default router

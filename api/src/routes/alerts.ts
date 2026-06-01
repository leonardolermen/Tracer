import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { pool } from '../db/pool'

const router = Router()
router.use(requireAuth)

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, condition, channels, enabled, last_fired_at, fired_count, created_at FROM alerts WHERE workspace_id = $1 ORDER BY created_at DESC',
    [req.auth.workspaceId]
  )
  res.json({ alerts: rows })
})

router.post('/', async (req, res) => {
  const { name, condition, channels, enabled = true } = req.body

  if (!name || !condition || !channels) {
    res.status(400).json({ error: 'validation_error', message: 'name, condition and channels are required' })
    return
  }

  const { rows } = await pool.query(
    `INSERT INTO alerts (workspace_id, name, condition, channels, enabled, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     RETURNING id, created_at`,
    [req.auth.workspaceId, name, JSON.stringify(condition), JSON.stringify(channels), enabled]
  )

  res.status(201).json({ id: rows[0].id, created_at: rows[0].created_at })
})

router.patch('/:alertId', async (req, res) => {
  const { name, condition, channels, enabled } = req.body

  const updates: string[] = []
  const values: any[] = []
  let paramCount = 1

  if (name !== undefined) {
    updates.push(`name = $${paramCount++}`)
    values.push(name)
  }
  if (condition !== undefined) {
    updates.push(`condition = $${paramCount++}`)
    values.push(JSON.stringify(condition))
  }
  if (channels !== undefined) {
    updates.push(`channels = $${paramCount++}`)
    values.push(JSON.stringify(channels))
  }
  if (enabled !== undefined) {
    updates.push(`enabled = $${paramCount++}`)
    values.push(enabled)
  }

  if (updates.length === 0) {
    res.status(400).json({ error: 'validation_error', message: 'no fields to update' })
    return
  }

  values.push(req.params.alertId, req.auth.workspaceId)
  
  const { rowCount } = await pool.query(
    `UPDATE alerts SET ${updates.join(', ')} WHERE id = $${paramCount++} AND workspace_id = $${paramCount++}`,
    values
  )

  if (!rowCount) {
    res.status(404).json({ error: 'not_found', message: `Alert '${req.params.alertId}' not found` })
    return
  }

  res.status(200).json({ success: true })
})

router.delete('/:alertId', async (req, res) => {
  const { rowCount } = await pool.query(
    'DELETE FROM alerts WHERE id = $1 AND workspace_id = $2',
    [req.params.alertId, req.auth.workspaceId]
  )

  if (!rowCount) {
    res.status(404).json({ error: 'not_found', message: `Alert '${req.params.alertId}' not found` })
    return
  }

  res.status(204).send()
})

router.get('/:alertId/firings', async (req, res) => {
  const { limit = 20, offset = 0 } = req.query
  const { rows } = await pool.query(
    'SELECT id, fired_at, condition, channels_ok, channels_err FROM alert_firings WHERE alert_id = $1 AND workspace_id = $2 ORDER BY fired_at DESC LIMIT $3 OFFSET $4',
    [req.params.alertId, req.auth.workspaceId, limit, offset]
  )
  res.json({ firings: rows })
})

export default router

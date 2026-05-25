import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { pool } from '../db/pool'

const router = Router()
router.use(requireAuth)

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM alerts WHERE workspace_id = $1 ORDER BY created_at DESC',
    [req.auth.workspaceId]
  )
  res.json({ alerts: rows })
})

router.post('/', async (req, res) => {
  const { name, condition, channels } = req.body

  if (!name || !condition || !channels) {
    res.status(400).json({ error: 'validation_error', message: 'name, condition and channels are required' })
    return
  }

  const { rows } = await pool.query(
    `INSERT INTO alerts (workspace_id, name, condition, channels, created_at)
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING id, created_at`,
    [req.auth.workspaceId, name, JSON.stringify(condition), JSON.stringify(channels)]
  )

  res.status(201).json({ id: rows[0].id, created_at: rows[0].created_at })
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

export default router

import { Router } from 'express'
import crypto from 'crypto'
import { requireAuth } from '../middleware/auth'
import { pool } from '../db/pool'

const router = Router()
router.use(requireAuth)

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, key_prefix, last_used_at, created_at, revoked_at FROM api_keys WHERE workspace_id = $1 ORDER BY created_at DESC',
    [req.auth.workspaceId]
  )
  res.json({ keys: rows })
})

router.post('/', async (req, res) => {
  const { name } = req.body

  if (!name) {
    res.status(400).json({ error: 'validation_error', message: 'name is required' })
    return
  }

  const keySecret = crypto.randomBytes(32).toString('hex')
  const apiKey = `tf_live_${keySecret}`
  const keyPrefix = apiKey.substring(0, 16)
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex')

  const { rows } = await pool.query(
    `INSERT INTO api_keys (workspace_id, name, key_hash, key_prefix, created_at)
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING id, name, key_prefix, created_at`,
    [req.auth.workspaceId, name, keyHash, keyPrefix]
  )

  res.status(201).json({ ...rows[0], api_key: apiKey })
})

router.delete('/:keyId', async (req, res) => {
  const { rowCount } = await pool.query(
    'UPDATE api_keys SET revoked_at = NOW() WHERE id = $1 AND workspace_id = $2 AND revoked_at IS NULL',
    [req.params.keyId, req.auth.workspaceId]
  )

  if (!rowCount) {
    res.status(404).json({ error: 'not_found', message: `Active API Key '${req.params.keyId}' not found` })
    return
  }

  res.status(204).send()
})

export default router

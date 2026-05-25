import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { pool } from '../db/pool'
import { config } from '../config'

const router = Router()

router.post('/login', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    res.status(400).json({ error: 'validation_error', message: 'email and password are required' })
    return
  }

  const { rows } = await pool.query(
    'SELECT id, email, password_hash, workspace_id FROM users WHERE email = $1',
    [email]
  )

  const user = rows[0]
  if (!user) {
    res.status(401).json({ error: 'unauthorized', message: 'Invalid credentials' })
    return
  }

  const { rows: ws } = await pool.query(
    'SELECT id, name, api_key FROM workspaces WHERE id = $1',
    [user.workspace_id]
  )
  const workspace = ws[0]

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const token = jwt.sign(
    { sub: user.id, workspaceId: user.workspace_id, email: user.email },
    config.jwtSecret,
    { expiresIn: '24h' }
  )

  res.json({ token, expires_at: expiresAt.toISOString(), workspace })
})

export default router

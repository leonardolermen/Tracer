import { Router } from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { pool } from '../db/pool'
import { config } from '../config'
import { requireAuth } from '../middleware/auth'

const router = Router()

router.post('/register', async (req, res) => {
  const { email, password, workspaceName } = req.body

  if (!email || !password || !workspaceName) {
    res.status(400).json({ error: 'validation_error', message: 'email, password and workspaceName are required' })
    return
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    
    // Check if email already exists
    const { rows: existingUser } = await client.query('SELECT id FROM users WHERE email = $1', [email])
    if (existingUser.length > 0) {
      await client.query('ROLLBACK')
      res.status(409).json({ error: 'conflict', message: 'Email already exists' })
      return
    }

    // Create workspace
    const { rows: wsRows } = await client.query(
      'INSERT INTO workspaces (name) VALUES ($1) RETURNING id, name, api_key, plan, created_at',
      [workspaceName]
    )
    const workspace = wsRows[0]

    // Create user
    const passwordHash = await bcrypt.hash(password, 10)
    const { rows: userRows } = await client.query(
      'INSERT INTO users (workspace_id, email, password_hash) VALUES ($1, $2, $3) RETURNING id, email, workspace_id',
      [workspace.id, email, passwordHash]
    )
    const user = userRows[0]

    await client.query('COMMIT')

    // Generate token
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const token = jwt.sign(
      { sub: user.id, workspaceId: user.workspace_id, email: user.email },
      config.jwtSecret,
      { expiresIn: '24h' }
    )

    res.json({ token, expires_at: expiresAt.toISOString(), workspace })
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
})

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

  const isValid = await bcrypt.compare(password, user.password_hash)
  if (!isValid) {
    res.status(401).json({ error: 'unauthorized', message: 'Invalid credentials' })
    return
  }

  const { rows: ws } = await pool.query(
    'SELECT id, name, api_key, plan, created_at FROM workspaces WHERE id = $1',
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

// Returns full workspace info for the authenticated user
router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, api_key, plan, created_at FROM workspaces WHERE id = $1',
    [req.auth.workspaceId]
  )
  if (!rows[0]) {
    res.status(404).json({ error: 'not_found', message: 'Workspace not found' })
    return
  }
  res.json({ workspace: rows[0], email: req.auth.email })
})

export default router

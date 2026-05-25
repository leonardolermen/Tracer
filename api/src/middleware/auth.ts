import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config'

export interface AuthPayload {
  sub: string
  workspaceId: string
  email: string
}

declare global {
  namespace Express {
    interface Request {
      auth: AuthPayload
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'unauthorized', message: 'Missing or invalid Authorization header' })
    return
  }

  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, config.jwtSecret) as AuthPayload
    req.auth = payload
    next()
  } catch {
    res.status(401).json({ error: 'unauthorized', message: 'Token expired or invalid' })
  }
}

import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage, Server } from 'http'
import jwt from 'jsonwebtoken'
import Redis from 'ioredis'
import { config } from '../config'
import { AuthPayload } from '../middleware/auth'

interface AuthedSocket extends WebSocket {
  auth?: AuthPayload
  subscriptions: Set<string>
  serviceSubscriptions: Set<string>
}

export function setupWebSocket(httpServer: Server) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' })
  const redis = new Redis(config.redisUrl)

  redis.subscribe('spans', (err) => {
    if (err) console.error('[ws] redis subscribe error', err)
  })

  redis.on('message', (_channel: string, payload: string) => {
    let span: any
    try { span = JSON.parse(payload) } catch { return }

    wss.clients.forEach((client) => {
      const socket = client as AuthedSocket
      if (socket.readyState !== WebSocket.OPEN || !socket.auth) return

      if (socket.subscriptions.has(span.trace_id)) {
        socket.send(JSON.stringify({ type: 'span.received', trace_id: span.trace_id, span }))
      }

      if (socket.serviceSubscriptions.has(span.service_name)) {
        socket.send(JSON.stringify({ type: 'span.received', trace_id: span.trace_id, span }))
      }
    })
  })

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    const socket = ws as AuthedSocket
    socket.subscriptions = new Set()
    socket.serviceSubscriptions = new Set()

    socket.on('message', (raw) => {
      let msg: any
      try { msg = JSON.parse(raw.toString()) } catch { return }

      if (msg.type === 'auth') {
        try {
          socket.auth = jwt.verify(msg.token, config.jwtSecret) as AuthPayload
          socket.send(JSON.stringify({ type: 'auth.ok' }))
        } catch {
          socket.send(JSON.stringify({ type: 'auth.error', message: 'Invalid token' }))
          socket.close()
        }
        return
      }

      if (!socket.auth) {
        socket.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }))
        return
      }

      if (msg.type === 'subscribe' && msg.trace_id) {
        socket.subscriptions.add(msg.trace_id)
        return
      }

      if (msg.type === 'subscribe_service' && msg.service) {
        socket.serviceSubscriptions.add(msg.service)
        return
      }
    })
  })

  return wss
}

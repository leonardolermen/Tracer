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
  // Dedicated connection used exclusively for the blocking XREAD loop.
  const redis = new Redis(config.redisUrl)

  function broadcast(span: any) {
    wss.clients.forEach((client) => {
      const socket = client as AuthedSocket
      if (socket.readyState !== WebSocket.OPEN || !socket.auth) return

      if (socket.subscriptions.has(span.trace_id) || socket.serviceSubscriptions.has(span.service_name)) {
        socket.send(JSON.stringify({ type: 'span.received', trace_id: span.trace_id, span }))
      }
    })
  }

  // Tail the 'spans' Redis Stream from now ($) and fan out to subscribed clients.
  void (async function tailSpans() {
    let lastId = '$'
    while (true) {
      try {
        const res = await (redis as any).xread('BLOCK', 0, 'COUNT', 100, 'STREAMS', 'spans', lastId)
        if (!res) continue
        for (const [, entries] of res as [string, [string, string[]][]][]) {
          for (const [id, fields] of entries) {
            lastId = id
            const dataIdx = fields.indexOf('data')
            if (dataIdx === -1 || dataIdx + 1 >= fields.length) continue
            let span: any
            try { span = JSON.parse(fields[dataIdx + 1]) } catch { continue }
            broadcast(span)
          }
        }
      } catch (err) {
        console.error('[ws] xread error', err)
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }
  })()

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

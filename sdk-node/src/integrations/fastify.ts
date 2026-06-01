import { Tracer } from '../tracer'
import { extractContext } from '../propagation'
import { generateTraceId } from '../id'

const SENSITIVE_KEYS = new Set(['password', 'senha', 'token', 'secret', 'authorization', 'cvv', 'card_number', 'cpf', 'ssn'])

function sanitize(obj: unknown, maxDepth = 3): Record<string, string> {
  if (!obj || typeof obj !== 'object' || maxDepth === 0) return {}
  const result: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      result[k] = '[REDACTED]'
    } else if (v !== null && typeof v === 'object') {
      const nested = sanitize(v, maxDepth - 1)
      for (const [nk, nv] of Object.entries(nested)) {
        result[`${k}.${nk}`] = nv
      }
    } else {
      result[k] = String(v ?? '')
    }
  }
  return result
}

export function fastifyTraceFlow(fastify: any, opts: { tracer: Tracer }, done: () => void) {
  const { tracer } = opts
  if (!tracer) {
    done()
    return
  }

  fastify.addHook('onRequest', (request: any, reply: any, next: () => void) => {
    const incoming = extractContext(request.headers as Record<string, string>)
    const traceId = incoming?.traceId ?? generateTraceId()
    const parentId = incoming?.spanId

    const operationName = `${request.method} ${request.routeOptions?.url ?? request.url}`

    const span = (tracer as any).startSpan(operationName, {
      kind: 'server',
      traceId,
      parentId,
      tags: {
        'http.method': request.method,
        'http.url': request.url,
      },
    })

    reply.header('x-traceflow-trace-id', span.traceId)
    request.span = span

    next()
  })

  fastify.addHook('preHandler', (request: any, reply: any, next: () => void) => {
    const span = request.span
    if (!span) {
      next()
      return
    }

    const reqAttrs: Record<string, unknown> = {
      method: request.method,
      url: request.url,
      'user-agent': request.headers['user-agent'] ?? '',
      'content-type': request.headers['content-type'] ?? '',
    }

    if (request.body && typeof request.body === 'object') {
      const sanitized = sanitize(request.body)
      for (const [k, v] of Object.entries(sanitized)) {
        reqAttrs[`body.${k}`] = v
      }
    }
    if (request.params && Object.keys(request.params).length > 0) {
      for (const [k, v] of Object.entries(request.params as Record<string, unknown>)) {
        reqAttrs[`param.${k}`] = String(v)
      }
    }
    span.log('http.request', reqAttrs, 'INFO')
    next()
  })

  fastify.addHook('onSend', (request: any, reply: any, payload: any, next: () => void) => {
    const span = request.span
    if (!span) {
      next()
      return
    }

    const status = reply.statusCode
    span.setTag('http.status_code', String(status))

    const resAttrs: Record<string, unknown> = { status_code: String(status) }

    try {
      if (payload && typeof payload === 'string' && reply.getHeader('content-type')?.includes('application/json')) {
        const body = JSON.parse(payload)
        const sanitized = sanitize(body)
        for (const [k, v] of Object.entries(sanitized)) {
          resAttrs[`body.${k}`] = v
        }
      }
    } catch (e) {
      // Ignore parsing errors for response body
    }

    if (status >= 500) {
      span.setError({ type: 'HttpError', message: `HTTP ${status}` })
      span.log('http.response', resAttrs, 'ERROR')
    } else if (status >= 400) {
      span.log('http.response', resAttrs, 'WARN')
    } else {
      span.log('http.response', resAttrs, 'INFO')
    }

    next()
  })

  fastify.addHook('onResponse', (request: any, reply: any, next: () => void) => {
    const span = request.span
    if (span) {
      span.end(reply.statusCode >= 500 ? 'error' : 'ok')
    }
    next()
  })

  done()
}

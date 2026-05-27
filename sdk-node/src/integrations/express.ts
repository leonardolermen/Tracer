import { Request, Response, NextFunction } from 'express'
import { Tracer } from '../tracer'
import { extractContext, injectHeaders } from '../propagation'
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

export function traceflowMiddleware(tracer: Tracer) {
  return function (req: Request, res: Response, next: NextFunction) {
    const incoming = extractContext(req.headers as Record<string, string>)

    const traceId = incoming?.traceId ?? generateTraceId()
    const parentId = incoming?.spanId

    const operationName = `${req.method} ${req.route?.path ?? req.path}`

    const span = (tracer as any).startSpan(operationName, {
      kind: 'server',
      traceId,
      parentId,
      tags: {
        'http.method': req.method,
        'http.url': req.originalUrl,
        'http.path': req.path,
      },
    })

    res.setHeader('x-traceflow-trace-id', span.traceId)
    ;(req as any).span = span

    // Log incoming request with sanitized body
    const reqAttrs: Record<string, unknown> = {
      method: req.method,
      url: req.originalUrl,
      'user-agent': req.headers['user-agent'] ?? '',
      'content-type': req.headers['content-type'] ?? '',
    }
    if (req.body && typeof req.body === 'object') {
      const sanitized = sanitize(req.body)
      for (const [k, v] of Object.entries(sanitized)) {
        reqAttrs[`body.${k}`] = v
      }
    }
    if (req.params && Object.keys(req.params).length > 0) {
      for (const [k, v] of Object.entries(req.params)) {
        reqAttrs[`param.${k}`] = v
      }
    }
    span.log('http.request', reqAttrs, 'INFO')

    // Intercept res.json to capture response body
    const originalJson = res.json.bind(res)
    res.json = function (body: unknown) {
      const status = res.statusCode
      span.setTag('http.status_code', String(status))

      const resAttrs: Record<string, unknown> = { status_code: String(status) }
      if (body && typeof body === 'object') {
        const sanitized = sanitize(body)
        for (const [k, v] of Object.entries(sanitized)) {
          resAttrs[`body.${k}`] = v
        }
      }

      if (status >= 500) {
        span.setError({ type: 'HttpError', message: `HTTP ${status}` })
        span.log('http.response', resAttrs, 'ERROR')
      } else if (status >= 400) {
        span.log('http.response', resAttrs, 'WARN')
      } else {
        span.log('http.response', resAttrs, 'INFO')
      }

      span.end(status >= 500 ? 'error' : 'ok')
      return originalJson(body)
    }

    res.on('finish', () => {
      if ((span as any)['_status'] === 'in_progress') {
        span.setTag('http.status_code', String(res.statusCode))
        span.end(res.statusCode >= 500 ? 'error' : 'ok')
      }
    })

    next()
  }
}

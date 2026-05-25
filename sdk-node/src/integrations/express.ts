import { Request, Response, NextFunction } from 'express'
import { Tracer } from '../tracer'
import { extractContext, injectHeaders } from '../propagation'
import { generateTraceId } from '../id'

export function traceflowMiddleware(tracer: Tracer) {
  return function (req: Request, res: Response, next: NextFunction) {
    const incoming = extractContext(req.headers as Record<string, string>)

    const traceId = incoming?.traceId ?? generateTraceId()
    const parentId = incoming?.spanId

    const operationName = `http.server ${req.method} ${req.route?.path ?? req.path}`

    const span = (tracer as any).startSpan(operationName, {
      kind: 'server',
      parentId,
      tags: {
        'http.method': req.method,
        'http.url': req.originalUrl,
      },
    })

    ;(span as any)['_traceId'] = traceId
    ;(req as any).span = span

    const originalJson = res.json.bind(res)
    res.json = function (body: unknown) {
      span.setTag('http.status_code', String(res.statusCode))
      if (res.statusCode >= 500) {
        span.setError({ type: 'HttpError', message: `HTTP ${res.statusCode}` })
      }
      span.end(res.statusCode >= 500 ? 'error' : 'ok')
      return originalJson(body)
    }

    res.on('finish', () => {
      if (span['_status'] === 'in_progress') {
        span.setTag('http.status_code', String(res.statusCode))
        span.end(res.statusCode >= 500 ? 'error' : 'ok')
      }
    })

    next()
  }
}

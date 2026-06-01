import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Observable } from 'rxjs'
import { tap, catchError } from 'rxjs/operators'
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

@Injectable()
export class TraceFlowInterceptor implements NestInterceptor {
  constructor(private tracer: Tracer) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp()
    const request = ctx.getRequest()
    const response = ctx.getResponse()

    if (!request || !response || typeof ctx.getRequest !== 'function') {
      return next.handle() // Not an HTTP context
    }

    const incoming = extractContext(request.headers as Record<string, string>)
    const traceId = incoming?.traceId ?? generateTraceId()
    const parentId = incoming?.spanId

    const operationName = `${request.method} ${request.route?.path ?? request.path}`

    const span = (this.tracer as any).startSpan(operationName, {
      kind: 'server',
      traceId,
      parentId,
      tags: {
        'http.method': request.method,
        'http.url': request.originalUrl ?? request.url,
      },
    })

    if (response.setHeader) {
      response.setHeader('x-traceflow-trace-id', span.traceId)
    } else if (response.header) {
      response.header('x-traceflow-trace-id', span.traceId)
    }

    const reqAttrs: Record<string, unknown> = {
      method: request.method,
      url: request.originalUrl ?? request.url,
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

    return next.handle().pipe(
      tap((data) => {
        const status = response.statusCode ?? 200
        span.setTag('http.status_code', String(status))

        const resAttrs: Record<string, unknown> = { status_code: String(status) }
        if (data && typeof data === 'object') {
          const sanitized = sanitize(data)
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
      }),
      catchError((err) => {
        const status = err.status || err.statusCode || 500
        span.setTag('http.status_code', String(status))
        span.setError(err instanceof Error ? err : { type: 'Error', message: String(err) })
        span.log('http.response', { status_code: String(status), error: String(err) }, 'ERROR')
        span.end('error')
        throw err
      })
    )
  }
}

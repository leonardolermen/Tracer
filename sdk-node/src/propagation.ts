export interface TraceContext {
  traceId: string
  spanId: string
}

export function injectHeaders(ctx: TraceContext, headers: Record<string, string>): void {
  headers['traceparent'] = `00-${ctx.traceId.replace('trace_', '').padStart(32, '0')}-${ctx.spanId.replace('span_', '').padStart(16, '0')}-01`
  headers['x-traceflow-trace-id'] = ctx.traceId
  headers['x-traceflow-span-id'] = ctx.spanId
}

export function extractContext(headers: Record<string, string | string[] | undefined>): TraceContext | null {
  const xTraceId = header(headers, 'x-traceflow-trace-id')
  const xSpanId = header(headers, 'x-traceflow-span-id')
  if (xTraceId && xSpanId) {
    return { traceId: xTraceId, spanId: xSpanId }
  }

  const traceparent = header(headers, 'traceparent')
  if (traceparent) {
    const parts = traceparent.split('-')
    if (parts.length === 4) {
      return {
        traceId: 'trace_' + parts[1].replace(/^0+/, ''),
        spanId: 'span_' + parts[2].replace(/^0+/, ''),
      }
    }
  }

  return null
}

function header(headers: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const val = headers[key] ?? headers[key.toLowerCase()]
  return Array.isArray(val) ? val[0] : val
}

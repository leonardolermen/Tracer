import { Tracer } from '../tracer'
import { injectHeaders } from '../propagation'

export function patchFetch(tracer: Tracer): void {
  const originalFetch = globalThis.fetch

  globalThis.fetch = async function (
    input: string | URL | Request,
    init?: RequestInit
  ): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url
    const method = init?.method ?? 'GET'
    const operationName = `http.client ${method} ${new URL(url, 'http://localhost').pathname}`

    const span = tracer.startSpan(operationName, { kind: 'client' })

    const headers: Record<string, string> = {}
    injectHeaders({ traceId: span.traceId, spanId: span.id }, headers)

    const mergedInit: RequestInit = {
      ...init,
      headers: { ...(init?.headers as Record<string, string> ?? {}), ...headers },
    }

    try {
      const res = await originalFetch(input, mergedInit)
      span.setTag('http.status_code', String(res.status))
      span.end(res.status >= 500 ? 'error' : 'ok')
      return res
    } catch (err) {
      span.setError(err instanceof Error ? err : new Error(String(err)))
      span.end()
      throw err
    }
  }
}

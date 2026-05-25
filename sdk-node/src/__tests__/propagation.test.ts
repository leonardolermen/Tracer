import { injectHeaders, extractContext } from '../propagation'

describe('propagation', () => {
  describe('injectHeaders', () => {
    it('injects x-traceflow headers', () => {
      const headers: Record<string, string> = {}
      injectHeaders({ traceId: 'trace_abc123', spanId: 'span_def456' }, headers)

      expect(headers['x-traceflow-trace-id']).toBe('trace_abc123')
      expect(headers['x-traceflow-span-id']).toBe('span_def456')
    })

    it('injects W3C traceparent header', () => {
      const headers: Record<string, string> = {}
      injectHeaders({ traceId: 'trace_abc123', spanId: 'span_def456' }, headers)

      expect(headers['traceparent']).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/)
    })
  })

  describe('extractContext', () => {
    it('extracts from x-traceflow headers (priority)', () => {
      const ctx = extractContext({
        'x-traceflow-trace-id': 'trace_abc123',
        'x-traceflow-span-id': 'span_def456',
      })

      expect(ctx).not.toBeNull()
      expect(ctx!.traceId).toBe('trace_abc123')
      expect(ctx!.spanId).toBe('span_def456')
    })

    it('extracts from W3C traceparent as fallback', () => {
      const ctx = extractContext({
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      })

      expect(ctx).not.toBeNull()
      expect(ctx!.traceId).toMatch(/^trace_/)
      expect(ctx!.spanId).toMatch(/^span_/)
    })

    it('returns null when no trace headers present', () => {
      expect(extractContext({ 'content-type': 'application/json' })).toBeNull()
    })

    it('returns null for empty headers', () => {
      expect(extractContext({})).toBeNull()
    })

    it('round-trips inject → extract', () => {
      const original = { traceId: 'trace_aabbccdd1122', spanId: 'span_11223344' }
      const headers: Record<string, string> = {}
      injectHeaders(original, headers)

      const extracted = extractContext(headers)
      expect(extracted!.traceId).toBe(original.traceId)
      expect(extracted!.spanId).toBe(original.spanId)
    })
  })
})

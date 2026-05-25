import { Span } from '../span'

function makeSpan(overrides: Partial<ConstructorParameters<typeof Span>[0]> = {}) {
  return new Span({
    traceId: 'trace_test001',
    serviceName: 'test-service',
    operationName: 'test.op',
    kind: 'internal',
    workspaceId: 'ws_test',
    ...overrides,
  })
}

describe('Span', () => {
  it('initialises with in_progress status', () => {
    const span = makeSpan()
    expect(span.toEvent().status).toBe('in_progress')
  })

  it('ends with ok when no status provided', () => {
    const span = makeSpan()
    span.end()
    expect(span.toEvent().status).toBe('ok')
  })

  it('ends with provided status', () => {
    const span = makeSpan()
    span.end('error')
    expect(span.toEvent().status).toBe('error')
  })

  it('sets error and changes status to error', () => {
    const span = makeSpan()
    span.setError(new Error('something broke'))
    span.end()

    const event = span.toEvent()
    expect(event.status).toBe('error')
    expect(event.error?.type).toBe('Error')
    expect(event.error?.message).toBe('something broke')
  })

  it('setError accepts SpanError object', () => {
    const span = makeSpan()
    span.setError({ type: 'TimeoutError', message: 'timed out', code: 'ETIMEDOUT' })
    span.end()

    const event = span.toEvent()
    expect(event.error?.code).toBe('ETIMEDOUT')
  })

  it('setTimeout sets status to timeout', () => {
    const span = makeSpan()
    span.setTimeout()
    span.end()
    expect(span.toEvent().status).toBe('timeout')
  })

  it('sets tags', () => {
    const span = makeSpan()
    span.setTag('http.method', 'POST').setTag('http.status_code', '200')
    span.end()

    expect(span.toEvent().tags['http.method']).toBe('POST')
    expect(span.toEvent().tags['http.status_code']).toBe('200')
  })

  it('calculates duration_ms after end', () => {
    const span = makeSpan()
    span.end()

    expect(span.toEvent().duration_ms).toBeGreaterThanOrEqual(0)
  })

  it('sets ended_at after end', () => {
    const span = makeSpan()
    span.end()

    expect(span.toEvent().ended_at).toBeDefined()
  })

  it('calls onEnd callback when ended', () => {
    const onEnd = jest.fn()
    const span = makeSpan({ onEnd })
    span.end()

    expect(onEnd).toHaveBeenCalledTimes(1)
    expect(onEnd).toHaveBeenCalledWith(span)
  })

  it('propagates parentId in event', () => {
    const span = makeSpan({ parentId: 'span_parent01' })
    expect(span.toEvent().parent_id).toBe('span_parent01')
  })

  it('has unique ids', () => {
    const ids = new Set(Array.from({ length: 500 }, () => makeSpan().id))
    expect(ids.size).toBe(500)
  })
})

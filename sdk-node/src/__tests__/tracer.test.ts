import { Tracer } from '../tracer'
import { Span } from '../span'

const mockSend = jest.fn().mockResolvedValue(undefined)

jest.mock('../transport/http', () => ({
  HttpTransport: jest.fn().mockImplementation(() => ({ send: mockSend })),
}))

jest.mock('../transport/udp', () => ({
  UdpTransport: jest.fn().mockImplementation(() => ({ send: mockSend })),
}))

function makeTracer(overrides = {}) {
  return new Tracer({
    serviceName: 'test-svc',
    workspaceId: 'ws_test',
    collectorUrl: 'http://localhost:4317',
    ...overrides,
  })
}

describe('Tracer', () => {
  beforeEach(() => mockSend.mockClear())

  it('startSpan returns a Span instance', () => {
    const tracer = makeTracer()
    const span = tracer.startSpan('my.op')
    expect(span).toBeInstanceOf(Span)
  })

  it('sends span to transport when ended', async () => {
    const tracer = makeTracer()
    const span = tracer.startSpan('my.op')
    span.end()

    await new Promise(r => setTimeout(r, 10))
    expect(mockSend).toHaveBeenCalledTimes(1)
    expect(mockSend.mock.calls[0][0].operation_name).toBe('my.op')
  })

  it('does not send when disabled', async () => {
    const tracer = makeTracer({ disabled: true })
    const span = tracer.startSpan('my.op')
    span.end()

    await new Promise(r => setTimeout(r, 10))
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('startChildSpan shares traceId with parent', () => {
    const tracer = makeTracer()
    const parent = tracer.startSpan('parent.op')
    const child = tracer.startChildSpan(parent, 'child.op')

    expect(child.traceId).toBe(parent.traceId)
    expect(child.parentId).toBe(parent.id)
  })

  it('trace() resolves and marks span ok', async () => {
    const tracer = makeTracer()
    const result = await tracer.trace('traced.op', async (span) => {
      expect(span).toBeInstanceOf(Span)
      return 42
    })

    expect(result).toBe(42)
    await new Promise(r => setTimeout(r, 10))
    expect(mockSend.mock.calls[0][0].status).toBe('ok')
  })

  it('trace() marks span error on exception', async () => {
    const tracer = makeTracer()

    await expect(
      tracer.trace('failing.op', async () => { throw new Error('boom') })
    ).rejects.toThrow('boom')

    await new Promise(r => setTimeout(r, 10))
    expect(mockSend.mock.calls[0][0].status).toBe('error')
    expect(mockSend.mock.calls[0][0].error.message).toBe('boom')
  })

  it('sends span with correct service and workspace', async () => {
    const tracer = makeTracer()
    tracer.startSpan('op').end()

    await new Promise(r => setTimeout(r, 10))
    const event = mockSend.mock.calls[0][0]
    expect(event.service_name).toBe('test-svc')
    expect(event.workspace_id).toBe('ws_test')
  })

  it('omits workspace_id when only an apiKey is configured', async () => {
    const tracer = new Tracer({
      serviceName: 'test-svc',
      apiKey: 'tf_live_abc',
      collectorUrl: 'http://localhost:4317',
    })
    tracer.startSpan('op').end()

    await new Promise(r => setTimeout(r, 10))
    const event = mockSend.mock.calls[0][0]
    expect(event.workspace_id).toBeUndefined()
  })
})

import { TraceFlowConfig, SpanOptions, SpanKind } from './types'
import { Span } from './span'
import { generateTraceId } from './id'
import { HttpTransport } from './transport/http'
import { UdpTransport } from './transport/udp'

type AnyTransport = { send(span: ReturnType<Span['toEvent']>): void | Promise<void> }

export class Tracer {
  private readonly config: Required<Pick<TraceFlowConfig, 'serviceName' | 'transport' | 'disabled'>> & {
    workspaceId?: string
    apiKey?: string
  }
  private readonly transport: AnyTransport

  constructor(config: TraceFlowConfig) {
    const apiKey = config.apiKey
      ?? (typeof process !== 'undefined' ? process.env.TRACEFLOW_API_KEY : undefined)

    // The collector derives the workspace from the api-key. workspaceId is only
    // a fallback for dev mode (collector running without api-key auth).
    const workspaceId = config.workspaceId
      ?? (typeof process !== 'undefined' ? process.env.TRACEFLOW_WORKSPACE_ID : undefined)
      ?? (apiKey ? undefined : 'ws_dev')

    const collectorUrl = config.collectorUrl
      ?? (typeof process !== 'undefined' ? process.env.TRACEFLOW_COLLECTOR_URL : undefined)
      ?? 'http://localhost:4317'

    const collectorHost = config.collectorHost
      ?? (typeof process !== 'undefined' ? process.env.TRACEFLOW_COLLECTOR_HOST : undefined)
      ?? 'localhost'

    if (!apiKey && typeof console !== 'undefined') {
      console.warn('[traceflow] no apiKey configured — set TRACEFLOW_API_KEY or pass apiKey. Falling back to dev mode.')
    }

    this.config = {
      serviceName: config.serviceName,
      workspaceId,
      apiKey,
      transport: config.transport ?? 'http',
      disabled: config.disabled ?? false,
    }

    if (config.transport === 'udp') {
      this.transport = new UdpTransport(
        collectorHost,
        config.collectorUdpPort ?? 4318,
        apiKey
      )
    } else {
      this.transport = new HttpTransport(collectorUrl, apiKey)
    }
  }


  startSpan(operationName: string, options: SpanOptions = {}): Span {
    const traceId = (options as any).traceId ?? generateTraceId()
    return new Span({
      traceId,
      parentId: options.parentId,
      serviceName: this.config.serviceName,
      operationName,
      kind: options.kind ?? 'internal',
      workspaceId: this.config.workspaceId,
      tags: options.tags,
      onEnd: (span) => this.flush(span),
    })
  }

  startChildSpan(parent: Span, operationName: string, options: SpanOptions = {}): Span {
    return new Span({
      traceId: parent.traceId,
      parentId: parent.id,
      serviceName: this.config.serviceName,
      operationName,
      kind: options.kind ?? 'internal',
      workspaceId: this.config.workspaceId,
      tags: options.tags,
      onEnd: (span) => this.flush(span),
    })
  }

  async trace<T>(
    operationName: string,
    fn: (span: Span) => Promise<T>,
    options: SpanOptions = {}
  ): Promise<T> {
    const span = this.startSpan(operationName, options)
    try {
      const result = await fn(span)
      span.end('ok')
      return result
    } catch (err) {
      span.setError(err instanceof Error ? err : new Error(String(err)))
      span.end()
      throw err
    }
  }

  private async flush(span: Span): Promise<void> {
    if (this.config.disabled) return
    try {
      await this.transport.send(span.toEvent())
    } catch (err) {
      console.error('[traceflow] failed to send span', err)
    }
  }

}

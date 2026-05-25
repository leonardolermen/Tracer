import { TraceFlowConfig, SpanOptions, SpanKind } from './types'
import { Span } from './span'
import { generateTraceId } from './id'
import { HttpTransport } from './transport/http'
import { UdpTransport } from './transport/udp'

type AnyTransport = { send(span: ReturnType<Span['toEvent']>): void | Promise<void> }

export class Tracer {
  private readonly config: Required<Pick<TraceFlowConfig, 'serviceName' | 'workspaceId' | 'transport' | 'disabled'>>
  private readonly transport: AnyTransport

  constructor(config: TraceFlowConfig) {
    this.config = {
      serviceName: config.serviceName,
      workspaceId: config.workspaceId,
      transport: config.transport ?? 'http',
      disabled: config.disabled ?? false,
    }

    if (config.transport === 'udp') {
      this.transport = new UdpTransport(
        config.collectorHost ?? 'localhost',
        config.collectorUdpPort ?? 4318
      )
    } else {
      this.transport = new HttpTransport(
        config.collectorUrl ?? 'http://localhost:4317'
      )
    }
  }

  startSpan(operationName: string, options: SpanOptions = {}): Span {
    return new Span({
      traceId: options.parentId ? this.extractTraceId(options.parentId) : generateTraceId(),
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

  private extractTraceId(parentId: string): string {
    return generateTraceId()
  }
}

import { SpanEvent, SpanError, SpanKind, SpanStatus, SpanLog } from './types'
import { generateSpanId } from './id'

export class Span {
  readonly id: string
  readonly traceId: string
  readonly parentId?: string
  readonly serviceName: string
  readonly operationName: string
  readonly kind: SpanKind
  readonly workspaceId?: string
  readonly startedAt: Date

  private endedAt?: Date
  private _status: SpanStatus = 'in_progress'
  private _error?: SpanError
  private _tags: Record<string, string> = {}

  private _onEnd?: (span: Span) => void

  private _logs: SpanLog[] = []

  constructor(opts: {
    traceId: string
    parentId?: string
    serviceName: string
    operationName: string
    kind: SpanKind
    workspaceId?: string
    tags?: Record<string, string>
    onEnd?: (span: Span) => void
  }) {
    this.id = generateSpanId()
    this.traceId = opts.traceId
    this.parentId = opts.parentId
    this.serviceName = opts.serviceName
    this.operationName = opts.operationName
    this.kind = opts.kind
    this.workspaceId = opts.workspaceId
    this._tags = opts.tags ?? {}
    this._onEnd = opts.onEnd
    this.startedAt = new Date()
  }

  setTag(key: string, value: string): this {
    this._tags[key] = value
    return this
  }

  setError(err: Error | SpanError): this {
    this._status = 'error'
    if (err instanceof Error) {
      this._error = { type: err.name, message: err.message }
    } else {
      this._error = err
    }
    return this
  }

  setTimeout(): this {
    this._status = 'timeout'
    return this
  }

  log(message: string, attributes?: Record<string, unknown>, level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' = 'INFO'): this {
    const flat: Record<string, string> = {}
    if (attributes) {
      for (const [k, v] of Object.entries(attributes)) {
        if (v === null || v === undefined) continue
        flat[k] = typeof v === 'object' ? JSON.stringify(v) : String(v)
      }
    }
    this._logs.push({ level, message, attributes: flat, timestamp: new Date().toISOString() })
    return this
  }

  end(status?: SpanStatus): void {
    this.endedAt = new Date()
    if (status) this._status = status
    else if (this._status === 'in_progress') this._status = 'ok'
    this._onEnd?.(this)
  }

  toEvent(): SpanEvent {
    const durationMs = this.endedAt
      ? this.endedAt.getTime() - this.startedAt.getTime()
      : undefined

    return {
      id: this.id,
      trace_id: this.traceId,
      parent_id: this.parentId,
      service_name: this.serviceName,
      operation_name: this.operationName,
      kind: this.kind,
      started_at: this.startedAt.toISOString(),
      ended_at: this.endedAt?.toISOString(),
      duration_ms: durationMs,
      status: this._status,
      error: this._error,
      tags: this._tags,
      logs: this._logs,
      ...(this.workspaceId ? { workspace_id: this.workspaceId } : {}),
    }
  }
}

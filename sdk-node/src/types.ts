export type SpanKind = 'server' | 'client' | 'producer' | 'consumer' | 'internal'
export type SpanStatus = 'ok' | 'error' | 'timeout' | 'in_progress'
export type Transport = 'http' | 'udp'

export interface SpanError {
  type: string
  message: string
  code?: string
}

export interface SpanEvent {
  id: string
  trace_id: string
  parent_id?: string
  service_name: string
  operation_name: string
  kind: SpanKind
  started_at: string
  ended_at?: string
  duration_ms?: number
  status: SpanStatus
  error?: SpanError
  tags: Record<string, string>
  workspace_id: string
}

export interface TraceFlowConfig {
  serviceName: string
  workspaceId: string
  collectorUrl?: string
  collectorHost?: string
  collectorUdpPort?: number
  transport?: Transport
  disabled?: boolean
}

export interface SpanOptions {
  kind?: SpanKind
  tags?: Record<string, string>
  parentId?: string
}

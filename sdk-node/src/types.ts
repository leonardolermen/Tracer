export type SpanKind = 'server' | 'client' | 'producer' | 'consumer' | 'internal'
export type SpanStatus = 'ok' | 'error' | 'timeout' | 'in_progress'
export type Transport = 'http' | 'udp'

export interface SpanError {
  type: string
  message: string
  code?: string
}

export interface SpanLog {
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
  message: string
  attributes?: Record<string, string>
  timestamp: string // ISO
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
  logs?: SpanLog[]
  workspace_id?: string
  api_key?: string
}

export interface TraceFlowConfig {
  serviceName: string
  /** Your workspace api-key (tf_live_...). The collector derives the workspace from it. */
  apiKey?: string
  /** Optional. Only used in dev mode when no api-key is configured. */
  workspaceId?: string
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

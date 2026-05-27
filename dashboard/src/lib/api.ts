const BASE = '/api/v1'

let _token: string | null = localStorage.getItem('tf_token')

export function setToken(t: string) {
  _token = t
  localStorage.setItem('tf_token', t)
}

export function clearToken() {
  _token = null
  localStorage.removeItem('tf_token')
}

export function getToken() {
  return _token
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...((_token) ? { Authorization: `Bearer ${_token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message ?? `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  login: (email: string, password: string) =>
    req<{ token: string; workspace: { id: string; name: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  traces: (params: Record<string, string | number | undefined> = {}) => {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) qs.set(k, String(v))
    }
    return req<{ traces: Trace[]; total: number; next_cursor: string | null }>(
      `/traces?${qs}`
    )
  },

  trace: (id: string) => req<TraceDetail>(`/traces/${id}`),
  timeline: (id: string) => req<Timeline>(`/traces/${id}/timeline`),
  traceLogs: (id: string) => req<{ logs: TraceLog[] }>(`/traces/${id}/logs`),
  services: () => req<{ services: Service[] }>('/services'),
  serviceStats: (name: string, params: Record<string, string>) => {
    const qs = new URLSearchParams(params)
    return req<ServiceStats>(`/services/${encodeURIComponent(name)}/stats?${qs}`)
  },
}

export interface Trace {
  id: string
  started_at: string
  ended_at: string
  duration_ms: number
  status: 'ok' | 'error' | 'timeout' | 'in_progress'
  root_service: string
  root_operation: string
  span_count: number
  error_count: number
  services: string[]
}

export interface Span {
  id: string
  parent_span_id: string | null
  service_name: string
  operation_name: string
  kind: string
  started_at: string
  ended_at: string
  duration_ms: number
  status: string
  error: { type: string; message: string } | null
  tags: Record<string, string>
  logs: { level: string; message: string; logged_at?: string; fields?: Record<string, string> }[]
  children: string[]
}

export interface TraceDetail extends Trace {
  spans: Span[]
  dag: { nodes: DagNode[]; edges: DagEdge[] }
}

export interface DagNode {
  id: string
  service: string
  operation: string
  status: string
  duration_ms: number
}

export interface DagEdge {
  from: string
  to: string
  label: string
}

export interface TimelineSpan {
  span_id: string
  service_name: string
  operation_name: string
  offset_ms: number
  duration_ms: number
  status: string
  depth: number
}

export interface Timeline {
  trace_id: string
  total_duration_ms: number
  timeline: TimelineSpan[]
}

export interface TraceLog {
  id: string
  service_name: string
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
  message: string
  attributes: Record<string, string>
  timestamp: string
}

export interface Service {
  name: string
  last_seen_at: string
  trace_count_24h: number
  error_rate_24h: number
  p95_duration_ms: number
}

export interface ServiceStats {
  service_name: string
  from: string
  to: string
  interval: string
  series: {
    timestamp: string
    request_count: number
    error_count: number
    error_rate: number
    p50_ms: number
    p95_ms: number
    p99_ms: number
  }[]
}

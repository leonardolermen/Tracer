import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, FileText, Activity, ChevronDown, ChevronRight, Search, Globe } from 'lucide-react'
import { api } from '../lib/api'
import type { TraceDetail, TimelineSpan, TraceLog } from '../lib/api'
import { StatusBadge } from '../components/StatusBadge'
import { formatDuration, serviceColor } from '../lib/utils'

type Tab = 'timeline' | 'logs'

const LOG_LEVEL_COLORS: Record<string, string> = {
  ERROR: 'var(--error)',
  WARN:  'var(--warning)',
  INFO:  'var(--accent-primary)',
  DEBUG: 'var(--text-muted)',
}

function tryPrettyJson(raw: string): { pretty: string; isJson: boolean } {
  try {
    return { pretty: JSON.stringify(JSON.parse(raw), null, 2), isJson: true }
  } catch {
    return { pretty: raw, isJson: false }
  }
}

function RequestBodyCard({ logs }: { logs: TraceLog[] }) {
  const [bodyExpanded, setBodyExpanded] = useState(true)
  const [resExpanded, setResExpanded]   = useState(true)

  // Sort logs by timestamp to find the chronologically first http.request
  const sorted = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  // Earliest http.request (entry point of the whole trace)
  const reqLog = sorted.find(l => l.message === 'http.request')
  // Latest http.response that matches the same service as the root request
  const rootSvc = reqLog?.service_name
  const resLog  = rootSvc
    ? [...sorted].reverse().find(l => l.message === 'http.response' && l.service_name === rootSvc)
    : undefined

  if (!reqLog) return null
  const rootService = reqLog.service_name

  const method  = reqLog.attributes?.['http.method'] ?? ''
  const url     = reqLog.attributes?.['http.url'] ?? ''
  const ct      = reqLog.attributes?.['http.content_type'] ?? ''
  const rawBody = reqLog.attributes?.['http.body'] ?? ''
  const { pretty: prettyBody } = tryPrettyJson(rawBody)

  const status    = resLog?.attributes?.['http.status']
  const rawResBody = resLog?.attributes?.['http.body'] ?? ''
  const { pretty: prettyRes } = tryPrettyJson(rawResBody)

  const statusNum = Number(status)
  const statusColor = statusNum >= 500 ? 'var(--error)' : statusNum >= 400 ? 'var(--warning)' : 'var(--success)'

  const methodColor: Record<string, string> = {
    GET: '#61afef', POST: '#a9dc76', PUT: '#ffd866',
    PATCH: '#e5c07b', DELETE: '#ff6188', OPTIONS: '#c678dd',
  }

  return (
    <div className="glass-card" style={{ marginBottom: '1.5rem', overflow: 'hidden' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
        <Globe style={{ width: 16, height: 16, color: 'var(--accent-primary)', flexShrink: 0 }} />
        {/* Method badge */}
        <span style={{
          fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em',
          color: methodColor[method] ?? 'var(--text-secondary)',
          background: `${methodColor[method] ?? '#888'}18`,
          border: `1px solid ${methodColor[method] ?? '#888'}40`,
          padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap',
        }}>{method}</span>
        {/* URL */}
        <span className="font-mono" style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>{url}</span>
        {/* Service */}
        <span style={{
          fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-secondary)',
          background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 4,
          marginLeft: 'auto', whiteSpace: 'nowrap',
        }}>{rootService}</span>
        {ct && (
          <span className="font-mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{ct}</span>
        )}
        {status && (
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: statusColor, background: `${statusColor}18`, border: `1px solid ${statusColor}40`, padding: '2px 8px', borderRadius: 4 }}>
            {status}
          </span>
        )}
      </div>

      {/* Request body */}
      {rawBody && (
        <div>
          <button
            onClick={() => setBodyExpanded(e => !e)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '10px 20px', background: 'transparent', border: 'none',
              borderBottom: bodyExpanded ? '1px solid var(--border-subtle)' : 'none',
              cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.75rem',
              fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
              fontFamily: 'inherit',
            }}
          >
            {bodyExpanded
              ? <ChevronDown style={{ width: 13, height: 13 }} />
              : <ChevronRight style={{ width: 13, height: 13 }} />}
            Request Body
          </button>
          {bodyExpanded && (
            <pre style={{
              margin: 0, padding: '14px 20px',
              fontFamily: 'monospace', fontSize: '0.78rem', lineHeight: 1.7,
              color: 'var(--text-primary)', background: 'rgba(0,0,0,0.25)',
              overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              borderBottom: resLog ? '1px solid var(--border-subtle)' : 'none',
            }}>{prettyBody}</pre>
          )}
        </div>
      )}

      {/* Response body */}
      {resLog && rawResBody && (
        <div>
          <button
            onClick={() => setResExpanded(e => !e)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '10px 20px', background: 'transparent', border: 'none',
              borderBottom: resExpanded ? '1px solid var(--border-subtle)' : 'none',
              cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.75rem',
              fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
              fontFamily: 'inherit',
            }}
          >
            {resExpanded
              ? <ChevronDown style={{ width: 13, height: 13 }} />
              : <ChevronRight style={{ width: 13, height: 13 }} />}
            Response Body
          </button>
          {resExpanded && (
            <pre style={{
              margin: 0, padding: '14px 20px',
              fontFamily: 'monospace', fontSize: '0.78rem', lineHeight: 1.7,
              color: 'var(--text-primary)', background: 'rgba(0,0,0,0.25)',
              overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>{prettyRes}</pre>
          )}
        </div>
      )}
    </div>
  )
}

function LogEntry({ log, idx }: { log: TraceLog; idx: number }) {
  const isHttpEntry = log.message === 'http.request' || log.message === 'http.response'
  const [expanded, setExpanded] = useState(isHttpEntry) // auto-expand HTTP bodies
  const hasAttrs = log.attributes && Object.keys(log.attributes).length > 0
  const color = LOG_LEVEL_COLORS[log.level?.toUpperCase()] ?? 'var(--text-muted)'
  const time = new Date(log.timestamp).toLocaleTimeString('pt-BR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 })

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column',
        borderLeft: `3px solid ${color}`,
        background: idx % 2 === 0 ? 'rgba(0,0,0,0.15)' : 'transparent',
        borderRadius: '0 6px 6px 0',
        overflow: 'hidden',
        transition: 'background 0.15s',
      }}
    >
      <div
        className="flex items-center gap-3"
        style={{ padding: '10px 14px', cursor: hasAttrs ? 'pointer' : 'default' }}
        onClick={() => hasAttrs && setExpanded(e => !e)}
      >
        <span style={{
          fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em',
          color, background: `${color}18`, border: `1px solid ${color}30`,
          padding: '2px 7px', borderRadius: 4, whiteSpace: 'nowrap', textTransform: 'uppercase',
          minWidth: '46px', textAlign: 'center',
        }}>
          {log.level}
        </span>

        <span className="font-mono text-muted" style={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
          {time}
        </span>

        <span style={{
          fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-secondary)',
          background: 'rgba(255,255,255,0.06)', padding: '2px 8px',
          borderRadius: 4, whiteSpace: 'nowrap',
        }}>
          {log.service_name}
        </span>

        <span className="text-sm text-primary" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {log.message}
        </span>

        {hasAttrs && (
          <span style={{ color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }}>
            {expanded
              ? <ChevronDown style={{ width: 14, height: 14 }} />
              : <ChevronRight style={{ width: 14, height: 14 }} />
            }
          </span>
        )}
      </div>

      {expanded && hasAttrs && (
        <div style={{ padding: '0 14px 12px 14px' }}>
          <div style={{
            background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 6, padding: '12px 14px', fontFamily: 'monospace',
            fontSize: '0.78rem', lineHeight: 1.7,
          }}>
            {Object.entries(log.attributes!).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--accent-primary)', minWidth: '160px', flexShrink: 0 }}>{k}</span>
                <span style={{ color: 'var(--text-secondary)' }}>=</span>
                <span style={{
                  color: v === '[REDACTED]' || v === '***REDACTED***' ? 'var(--text-muted)' : 'var(--text-primary)',
                  fontStyle: v === '[REDACTED]' || v === '***REDACTED***' ? 'italic' : 'normal',
                  wordBreak: 'break-all',
                }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function TraceDetailPage() {
  const { traceId } = useParams<{ traceId: string }>()
  const [trace, setTrace]       = useState<TraceDetail | null>(null)
  const [timeline, setTimeline] = useState<TimelineSpan[]>([])
  const [totalMs, setTotalMs]   = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [logs, setLogs]         = useState<TraceLog[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [tab, setTab]           = useState<Tab>('timeline')
  const [logSearch, setLogSearch]           = useState('')
  const [logLevelFilter, setLogLevelFilter] = useState<string>('')

  useEffect(() => {
    if (!traceId) return
    setLoading(true)
    Promise.all([api.trace(traceId), api.timeline(traceId), api.traceLogs(traceId)])
      .then(([t, tl, lg]) => {
        setTrace(t)
        setTimeline(tl.timeline)
        setTotalMs(tl.total_duration_ms)
        setLogs(lg.logs || [])
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [traceId])

  const services    = [...new Set(timeline.map(s => s.service_name))]
  const selectedSpan = trace?.spans.find(s => s.id === selected)

  const filteredLogs = logs.filter(l => {
    const matchLevel  = logLevelFilter ? l.level?.toUpperCase() === logLevelFilter : true
    const matchSearch = logSearch
      ? l.message?.toLowerCase().includes(logSearch.toLowerCase()) ||
        l.service_name?.toLowerCase().includes(logSearch.toLowerCase()) ||
        Object.values(l.attributes ?? {}).some(v => v.toLowerCase().includes(logSearch.toLowerCase()))
      : true
    return matchLevel && matchSearch
  })

  const logCountByLevel = logs.reduce((acc, l) => {
    const lvl = l.level?.toUpperCase() ?? 'INFO'
    acc[lvl] = (acc[lvl] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  if (loading) return <div className="flex-1 flex items-center justify-center text-muted">Loading trace…</div>
  if (error)   return <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--error)' }}>{error}</div>
  if (!trace)  return null

  return (
    <div className="flex-1 overflow-auto p-6 animate-fade-in">
      <div className="max-w-6xl flex-col gap-4">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link to="/traces" style={{ color: 'var(--text-secondary)', transition: 'color 0.2s', padding: '8px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }}>
            <ArrowLeft style={{ width: '16px', height: '16px' }} />
          </Link>
          <h1 className="text-lg font-semibold text-primary font-mono" style={{ letterSpacing: '0.02em', background: 'rgba(255,255,255,0.05)', padding: '4px 12px', borderRadius: 'var(--radius-md)' }}>
            {trace.id}
          </h1>
          <StatusBadge status={trace.status} />
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Total Duration', value: formatDuration(trace.duration_ms) },
            { label: 'Total Spans',    value: trace.span_count },
            { label: 'Errors',         value: trace.error_count, error: trace.error_count > 0 },
            { label: 'Log Events',     value: logs.length },
          ].map(({ label, value, error }) => (
            <div key={label} className="glass-card p-4">
              <div className="text-xs text-secondary mb-1" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
              <div className="text-2xl font-bold" style={{ color: error ? 'var(--error)' : 'var(--text-primary)' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* ── Request body card — shown only in Logs tab, inside the tab content */}

        {/* Tabs */}
        <div className="flex gap-1 mb-4" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 0 }}>
          {([
            { id: 'timeline', label: 'Timeline',                                         icon: <Activity  style={{ width: 14, height: 14 }} /> },
            { id: 'logs',     label: `Logs ${logs.length > 0 ? `(${logs.length})` : ''}`, icon: <FileText style={{ width: 14, height: 14 }} /> },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex items-center gap-2"
              style={{
                padding: '8px 16px', border: 'none', cursor: 'pointer',
                background: 'transparent', fontFamily: 'inherit', fontSize: '0.875rem',
                fontWeight: tab === t.id ? 600 : 400,
                color: tab === t.id ? 'var(--accent-primary)' : 'var(--text-muted)',
                borderBottom: tab === t.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
                marginBottom: '-1px', transition: 'all 0.2s',
              }}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* ===== TIMELINE TAB ===== */}
        {tab === 'timeline' && (
          <div className="glass-panel p-6 mb-4">

            {/* Request/Response summary at top of timeline */}
            {logs.length > 0 && <RequestBodyCard logs={logs} />}
            <div className="flex gap-4 flex-wrap mb-6" style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              {services.map((s, i) => (
                <div key={s} className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: serviceColor(i), boxShadow: `0 0 8px ${serviceColor(i)}88` }} />
                  {s}
                </div>
              ))}
            </div>

            <div className="flex-col gap-2">
              {timeline.map((span) => {
                const left  = totalMs > 0 ? (span.offset_ms / totalMs) * 100 : 0
                const width = totalMs > 0 ? Math.max((span.duration_ms / totalMs) * 100, 0.5) : 0.5
                const svcIdx    = services.indexOf(span.service_name)
                const isSelected = span.span_id === selected

                return (
                  <div
                    key={span.span_id}
                    className="flex items-center gap-3"
                    style={{
                      paddingLeft: `${span.depth * 20}px`,
                      padding: '6px 8px 6px 0',
                      cursor: 'pointer',
                      borderRadius: 'var(--radius-sm)',
                      background: isSelected ? 'rgba(255,255,255,0.05)' : 'transparent',
                      border: isSelected ? '1px solid var(--border-active)' : '1px solid transparent',
                      transition: 'all 0.2s'
                    }}
                    onClick={() => setSelected(isSelected ? null : span.span_id)}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                  >
                    <div className="text-xs font-medium text-secondary truncate" style={{ width: '12rem', paddingLeft: `${span.depth * 16 + 8}px` }}>
                      {span.operation_name.split(' ').slice(-1)[0]}
                    </div>
                    <div style={{ position: 'relative', height: '1.5rem', borderRadius: '0.25rem', flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{
                        position: 'absolute', height: '100%', borderRadius: '4px',
                        left: `${left}%`, width: `${width}%`,
                        background: serviceColor(svcIdx), opacity: 0.85,
                        boxShadow: `0 0 10px ${serviceColor(svcIdx)}40`,
                        transition: 'opacity 0.2s'
                      }} />
                    </div>
                    <div className="text-right text-xs font-mono text-muted" style={{ width: '5rem' }}>
                      {formatDuration(span.duration_ms)}
                    </div>
                    <StatusBadge status={span.status} />
                  </div>
                )
              })}
            </div>

            {/* Span detail */}
            {selectedSpan && (
              <div className="mt-6 p-5" style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div className="text-xs text-secondary uppercase mb-4" style={{ letterSpacing: '0.06em', fontWeight: 600 }}>
                  Span Detail — {selectedSpan.operation_name}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div><span className="text-xs text-secondary uppercase" style={{ letterSpacing: '0.05em' }}>ID</span><p className="font-mono text-xs text-primary mt-1">{selectedSpan.id}</p></div>
                  <div><span className="text-xs text-secondary uppercase" style={{ letterSpacing: '0.05em' }}>Service</span><p className="text-sm font-medium text-primary mt-1">{selectedSpan.service_name}</p></div>
                  <div><span className="text-xs text-secondary uppercase" style={{ letterSpacing: '0.05em' }}>Kind</span><p className="text-sm text-primary mt-1">{selectedSpan.kind}</p></div>
                  <div><span className="text-xs text-secondary uppercase" style={{ letterSpacing: '0.05em' }}>Duration</span><p className="font-mono text-sm text-primary mt-1">{formatDuration(selectedSpan.duration_ms)}</p></div>
                  <div><span className="text-xs text-secondary uppercase" style={{ letterSpacing: '0.05em' }}>Status</span><div className="mt-1"><StatusBadge status={selectedSpan.status} /></div></div>
                </div>

                {selectedSpan.error && (
                  <div className="p-4 mb-4" style={{ background: 'var(--error-bg)', border: '1px solid rgba(255, 97, 136, 0.3)', borderRadius: 'var(--radius-md)' }}>
                    <div className="text-xs font-bold uppercase" style={{ color: 'var(--error)', letterSpacing: '0.05em' }}>{selectedSpan.error.type}</div>
                    <div className="text-sm mt-1" style={{ color: 'rgba(255,97,136,0.9)' }}>{selectedSpan.error.message}</div>
                  </div>
                )}

                {Object.keys(selectedSpan.tags).length > 0 && (
                  <div>
                    <div className="text-xs text-secondary uppercase mb-3" style={{ letterSpacing: '0.05em' }}>Tags</div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(selectedSpan.tags).map(([k, v]) => (
                        <span key={k} className="text-xs font-mono" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                          <span style={{ color: 'var(--accent-primary)' }}>{k}</span>: {v}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== LOGS TAB ===== */}
        {tab === 'logs' && (
          <div className="glass-panel p-6 mb-4">

            {/* Request/Response summary at top of logs */}
            {logs.length > 0 && <RequestBodyCard logs={logs} />}
            {logs.length > 0 && (
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <span className="text-xs text-muted font-semibold uppercase" style={{ letterSpacing: '0.05em' }}>Filter:</span>
                {(['ERROR', 'WARN', 'INFO', 'DEBUG'] as const).map(lvl => {
                  const count = logCountByLevel[lvl] ?? 0
                  if (!count) return null
                  const color    = LOG_LEVEL_COLORS[lvl]
                  const isActive = logLevelFilter === lvl
                  return (
                    <button
                      key={lvl}
                      onClick={() => setLogLevelFilter(isActive ? '' : lvl)}
                      style={{
                        border: `1px solid ${isActive ? color : color + '40'}`,
                        background: isActive ? `${color}20` : 'transparent',
                        color: isActive ? color : 'var(--text-muted)',
                        padding: '3px 10px', borderRadius: 20,
                        fontFamily: 'inherit', fontSize: '0.7rem', fontWeight: 600,
                        cursor: 'pointer', letterSpacing: '0.05em', textTransform: 'uppercase',
                        transition: 'all 0.15s',
                      }}
                    >
                      {lvl} <span style={{ opacity: 0.7 }}>{count}</span>
                    </button>
                  )
                })}

                <div style={{ position: 'relative', marginLeft: 'auto' }}>
                  <Search style={{ position: 'absolute', left: 10, top: 8, width: 13, height: 13, color: 'var(--text-muted)' }} />
                  <input
                    value={logSearch}
                    onChange={e => setLogSearch(e.target.value)}
                    placeholder="Buscar em mensagens e atributos…"
                    className="glass-input"
                    style={{ paddingLeft: 30, fontSize: '0.8rem', width: '260px', height: '32px' }}
                  />
                </div>
              </div>
            )}

            {logs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                <FileText style={{ width: 32, height: 32, margin: '0 auto 12px', opacity: 0.3 }} />
                <div className="text-sm">Nenhum log encontrado para este trace.</div>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                <div className="text-sm">Nenhum log corresponde aos filtros.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {filteredLogs.map((log, idx) => (
                  <LogEntry key={log.id ?? idx} log={log} idx={idx} />
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

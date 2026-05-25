import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api } from '../lib/api'
import type { TraceDetail, TimelineSpan } from '../lib/api'
import { StatusBadge } from '../components/StatusBadge'
import { formatDuration, serviceColor } from '../lib/utils'

export function TraceDetailPage() {
  const { traceId } = useParams<{ traceId: string }>()
  const [trace, setTrace] = useState<TraceDetail | null>(null)
  const [timeline, setTimeline] = useState<TimelineSpan[]>([])
  const [totalMs, setTotalMs] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!traceId) return
    setLoading(true)
    Promise.all([api.trace(traceId), api.timeline(traceId)])
      .then(([t, tl]) => {
        setTrace(t)
        setTimeline(tl.timeline)
        setTotalMs(tl.total_duration_ms)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [traceId])

  const services = [...new Set(timeline.map(s => s.service_name))]
  const selectedSpan = trace?.spans.find(s => s.id === selected)

  if (loading) return <div className="flex-1 flex items-center justify-center text-muted">Loading trace details…</div>
  if (error) return <div className="flex-1 flex items-center justify-center text-error">{error}</div>
  if (!trace) return null

  return (
    <div className="flex-1 overflow-auto p-6 animate-fade-in">
      <div className="max-w-6xl flex-col gap-4">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/traces" style={{ color: 'var(--text-secondary)', transition: 'color 0.2s', padding: '8px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }}>
            <ArrowLeft style={{ width: '16px', height: '16px' }} />
          </Link>
          <h1 className="text-lg font-semibold text-primary font-mono" style={{ letterSpacing: '0.02em', background: 'rgba(255,255,255,0.05)', padding: '4px 12px', borderRadius: 'var(--radius-md)' }}>
            {trace.id}
          </h1>
          <StatusBadge status={trace.status} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Total Duration', value: formatDuration(trace.duration_ms) },
            { label: 'Total Spans', value: trace.span_count },
            { label: 'Errors', value: trace.error_count, error: trace.error_count > 0 },
            { label: 'Services Involved', value: trace.services?.length ?? 0 },
          ].map(({ label, value, error }) => (
            <div key={label} className="glass-card p-4">
              <div className="text-xs text-secondary mb-1" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
              <div className="text-2xl font-bold" style={{ color: error ? 'var(--error)' : 'var(--text-primary)' }}>{value}</div>
            </div>
          ))}
        </div>

        <div className="glass-panel p-6 mb-4">
          <h2 className="text-base font-bold text-primary mb-4">Execution Timeline</h2>
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
              const left = totalMs > 0 ? (span.offset_ms / totalMs) * 100 : 0
              const width = totalMs > 0 ? Math.max((span.duration_ms / totalMs) * 100, 0.5) : 0.5
              const svcIdx = services.indexOf(span.service_name)
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
                  <div className="w-48 text-xs font-medium text-secondary truncate" style={{ paddingLeft: `${span.depth * 16 + 8}px` }}>
                    {span.operation_name.split(' ').slice(-1)[0]}
                  </div>
                  <div className="flex-1 relative h-6 rounded" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div
                      style={{
                        position: 'absolute',
                        height: '100%',
                        borderRadius: '4px',
                        left: `${left}%`,
                        width: `${width}%`,
                        background: serviceColor(svcIdx),
                        opacity: 0.85,
                        boxShadow: `0 0 10px ${serviceColor(svcIdx)}40`,
                        transition: 'opacity 0.2s'
                      }}
                    />
                  </div>
                  <div className="w-20 text-right text-xs font-mono text-muted">
                    {formatDuration(span.duration_ms)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {selectedSpan && (
          <div className="glass-panel p-6 animate-fade-in" style={{ borderTop: '4px solid var(--accent-primary)' }}>
            <h2 className="text-base font-bold text-primary mb-4">Span Details: {selectedSpan.operation_name}</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div><span className="text-xs text-secondary uppercase" style={{ letterSpacing: '0.05em' }}>ID</span><p className="font-mono text-xs text-primary mt-1">{selectedSpan.id}</p></div>
              <div><span className="text-xs text-secondary uppercase" style={{ letterSpacing: '0.05em' }}>Service</span><p className="text-sm font-medium text-primary mt-1">{selectedSpan.service_name}</p></div>
              <div><span className="text-xs text-secondary uppercase" style={{ letterSpacing: '0.05em' }}>Kind</span><p className="text-sm text-primary mt-1">{selectedSpan.kind}</p></div>
              <div><span className="text-xs text-secondary uppercase" style={{ letterSpacing: '0.05em' }}>Duration</span><p className="font-mono text-sm text-primary mt-1">{formatDuration(selectedSpan.duration_ms)}</p></div>
              <div><span className="text-xs text-secondary uppercase" style={{ letterSpacing: '0.05em' }}>Status</span><div className="mt-1"><StatusBadge status={selectedSpan.status} /></div></div>
            </div>
            
            {selectedSpan.error && (
              <div className="p-4 mb-4" style={{ background: 'var(--error-bg)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)' }}>
                <div className="text-xs font-bold text-error uppercase" style={{ letterSpacing: '0.05em' }}>{selectedSpan.error.type}</div>
                <div className="text-sm text-primary mt-1" style={{ color: 'rgba(239, 68, 68, 0.9)' }}>{selectedSpan.error.message}</div>
              </div>
            )}
            
            {Object.keys(selectedSpan.tags).length > 0 && (
              <div>
                <div className="text-xs text-secondary uppercase mb-3" style={{ letterSpacing: '0.05em' }}>Metadata Tags</div>
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
    </div>
  )
}

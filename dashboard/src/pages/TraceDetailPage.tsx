import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react'
import { api, TraceDetail, TimelineSpan } from '../lib/api'
import { StatusBadge } from '../components/StatusBadge'
import { formatDuration, formatDate, serviceColor } from '../lib/utils'

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

  if (loading) return <div className="flex-1 flex items-center justify-center text-slate-500">Loading…</div>
  if (error) return <div className="flex-1 flex items-center justify-center text-red-400">{error}</div>
  if (!trace) return null

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Link to="/traces" className="text-slate-500 hover:text-slate-300 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-xl font-semibold text-white font-mono text-sm">{trace.id}</h1>
          <StatusBadge status={trace.status} />
        </div>

        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Duration', value: formatDuration(trace.duration_ms) },
            { label: 'Spans', value: trace.span_count },
            { label: 'Errors', value: trace.error_count },
            { label: 'Services', value: trace.services?.length ?? 0 },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-500 mb-1">{label}</div>
              <div className="text-xl font-semibold text-white">{value}</div>
            </div>
          ))}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h2 className="text-sm font-medium text-slate-300 mb-4">Timeline (Gantt)</h2>
          <div className="flex gap-3 flex-wrap mb-3">
            {services.map((s, i) => (
              <div key={s} className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="w-2 h-2 rounded-full" style={{ background: serviceColor(i) }} />
                {s}
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            {timeline.map((span) => {
              const left = totalMs > 0 ? (span.offset_ms / totalMs) * 100 : 0
              const width = totalMs > 0 ? Math.max((span.duration_ms / totalMs) * 100, 0.5) : 0.5
              const svcIdx = services.indexOf(span.service_name)

              return (
                <div
                  key={span.span_id}
                  className="flex items-center gap-2 cursor-pointer group"
                  style={{ paddingLeft: `${span.depth * 16}px` }}
                  onClick={() => setSelected(span.span_id === selected ? null : span.span_id)}
                >
                  <div className="w-40 shrink-0 text-xs text-slate-400 truncate group-hover:text-slate-200 transition-colors">
                    {span.operation_name.split(' ').slice(-1)[0]}
                  </div>
                  <div className="flex-1 relative h-5 bg-slate-800 rounded">
                    <div
                      className="absolute h-full rounded opacity-80"
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        background: serviceColor(svcIdx),
                      }}
                    />
                  </div>
                  <div className="w-16 text-right text-xs text-slate-500 font-mono shrink-0">
                    {formatDuration(span.duration_ms)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {selectedSpan && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <h2 className="text-sm font-medium text-slate-300">Span detail</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-slate-500">ID</span><p className="text-slate-200 font-mono text-xs mt-0.5">{selectedSpan.id}</p></div>
              <div><span className="text-slate-500">Service</span><p className="text-slate-200 mt-0.5">{selectedSpan.service_name}</p></div>
              <div><span className="text-slate-500">Operation</span><p className="text-slate-200 mt-0.5">{selectedSpan.operation_name}</p></div>
              <div><span className="text-slate-500">Kind</span><p className="text-slate-200 mt-0.5">{selectedSpan.kind}</p></div>
              <div><span className="text-slate-500">Duration</span><p className="text-slate-200 mt-0.5">{formatDuration(selectedSpan.duration_ms)}</p></div>
              <div><span className="text-slate-500">Status</span><div className="mt-0.5"><StatusBadge status={selectedSpan.status} /></div></div>
            </div>
            {selectedSpan.error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <div className="text-xs text-red-400 font-medium">{selectedSpan.error.type}</div>
                <div className="text-xs text-red-300 mt-0.5">{selectedSpan.error.message}</div>
              </div>
            )}
            {Object.keys(selectedSpan.tags).length > 0 && (
              <div>
                <div className="text-xs text-slate-500 mb-2">Tags</div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(selectedSpan.tags).map(([k, v]) => (
                    <span key={k} className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-slate-300 font-mono">
                      {k}: {v}
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

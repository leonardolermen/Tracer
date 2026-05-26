import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Filter, RefreshCw, Hash } from 'lucide-react'
import { api } from '../lib/api'
import type { Trace } from '../lib/api'
import { StatusBadge } from '../components/StatusBadge'
import { formatDuration, formatDate } from '../lib/utils'

export function TracesPage() {
  const [traces, setTraces] = useState<Trace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [traceIdSearch, setTraceIdSearch] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await api.traces({
        service: search || undefined,
        status: statusFilter || undefined,
        limit: 50,
      })
      setTraces(res.traces)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load traces')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [search, statusFilter])

  return (
    <div className="flex-1 overflow-auto p-6 animate-fade-in">
      <div className="max-w-6xl flex-col gap-4">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-xl font-bold text-primary" style={{ letterSpacing: '0.02em' }}>Traces</h1>
          <button 
            onClick={load} 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.75rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <RefreshCw style={{ width: '12px', height: '12px' }} />
            Refresh
          </button>
        </div>

        <div className="flex gap-3 mb-8" style={{ flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '280px', minWidth: '180px' }}>
            <Search style={{ position: 'absolute', left: '12px', top: '10px', width: '16px', height: '16px', color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter by service…"
              className="glass-input"
              style={{ paddingLeft: '36px' }}
            />
          </div>
          <div style={{ position: 'relative' }}>
            <Filter style={{ position: 'absolute', left: '12px', top: '10px', width: '16px', height: '16px', color: 'var(--text-muted)' }} />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="glass-input glass-select"
              style={{ paddingLeft: '36px', paddingRight: '36px', cursor: 'pointer', minWidth: '160px' }}
            >
              <option value="" style={{ background: 'var(--bg-dark)' }}>All statuses</option>
              <option value="ok" style={{ background: 'var(--bg-dark)' }}>ok</option>
              <option value="error" style={{ background: 'var(--bg-dark)' }}>error</option>
              <option value="timeout" style={{ background: 'var(--bg-dark)' }}>timeout</option>
              <option value="in_progress" style={{ background: 'var(--bg-dark)' }}>in_progress</option>
            </select>
          </div>
          <div style={{ position: 'relative', flex: 1, maxWidth: '280px', minWidth: '180px' }}>
            <Hash style={{ position: 'absolute', left: '12px', top: '10px', width: '16px', height: '16px', color: 'var(--text-muted)' }} />
            <input
              value={traceIdSearch}
              onChange={e => setTraceIdSearch(e.target.value)}
              placeholder="Jump to trace ID…"
              className="glass-input"
              style={{ paddingLeft: '36px', fontFamily: 'monospace', fontSize: '0.8rem' }}
              onKeyDown={e => {
                if (e.key === 'Enter' && traceIdSearch.trim()) {
                  window.location.href = `/traces/${traceIdSearch.trim()}`
                }
              }}
            />
          </div>
        </div>

        {error && (
          <div className="text-sm p-3 mb-4" style={{ background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)' }}>
            {error}
          </div>
        )}

        <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead style={{ background: 'rgba(0,0,0,0.2)' }}>
              <tr>
                <th className="text-left">Trace ID</th>
                <th className="text-left">Service</th>
                <th className="text-left">Operation</th>
                <th className="text-left">Status</th>
                <th className="text-right">Duration</th>
                <th className="text-right">Spans</th>
                <th className="text-right">Started</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="text-center text-muted py-3" style={{ padding: '32px 0' }}>Loading traces…</td>
                </tr>
              )}
              {!loading && traces.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-muted py-3" style={{ padding: '32px 0' }}>No traces found</td>
                </tr>
              )}
              {!loading && traces.map(t => (
                <tr key={t.id}>
                  <td className="font-mono text-xs">
                    <Link to={`/traces/${t.id}`} style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 500 }}>
                      {t.id.slice(0, 20)}…
                    </Link>
                  </td>
                  <td className="text-primary font-medium">{t.root_service}</td>
                  <td className="text-secondary" style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.root_operation}</td>
                  <td><StatusBadge status={t.status} /></td>
                  <td className="text-right font-mono text-primary">{formatDuration(t.duration_ms)}</td>
                  <td className="text-right text-secondary">
                    {t.span_count}
                    {t.error_count > 0 && <span style={{ color: 'var(--error)', marginLeft: '4px' }}>({t.error_count} err)</span>}
                  </td>
                  <td className="text-right text-muted text-xs">{formatDate(t.started_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

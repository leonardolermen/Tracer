import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Filter } from 'lucide-react'
import { api, Trace } from '../lib/api'
import { StatusBadge } from '../components/StatusBadge'
import { formatDuration, formatDate } from '../lib/utils'

export function TracesPage() {
  const [traces, setTraces] = useState<Trace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

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
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-white">Traces</h1>
          <button onClick={load} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
            Refresh
          </button>
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter by service…"
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 transition-colors appearance-none"
            >
              <option value="">All statuses</option>
              <option value="ok">ok</option>
              <option value="error">error</option>
              <option value="timeout">timeout</option>
              <option value="in_progress">in_progress</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg p-3">{error}</div>
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-500">
                <th className="text-left px-4 py-3 font-medium">Trace ID</th>
                <th className="text-left px-4 py-3 font-medium">Service</th>
                <th className="text-left px-4 py-3 font-medium">Operation</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Duration</th>
                <th className="text-right px-4 py-3 font-medium">Spans</th>
                <th className="text-right px-4 py-3 font-medium">Started</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">Loading…</td>
                </tr>
              )}
              {!loading && traces.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">No traces found</td>
                </tr>
              )}
              {!loading && traces.map(t => (
                <tr key={t.id} className="border-b border-slate-800/50 hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/traces/${t.id}`} className="text-indigo-400 hover:text-indigo-300 font-mono text-xs transition-colors">
                      {t.id.slice(0, 20)}…
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{t.root_service}</td>
                  <td className="px-4 py-3 text-slate-400 max-w-xs truncate">{t.root_operation}</td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3 text-right text-slate-300 font-mono">{formatDuration(t.duration_ms)}</td>
                  <td className="px-4 py-3 text-right text-slate-400">
                    {t.span_count}
                    {t.error_count > 0 && <span className="text-red-400 ml-1">({t.error_count} err)</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500 text-xs">{formatDate(t.started_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

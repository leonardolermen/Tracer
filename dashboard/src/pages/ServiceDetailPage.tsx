import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { api, ServiceStats } from '../lib/api'

export function ServiceDetailPage() {
  const { serviceName } = useParams<{ serviceName: string }>()
  const [stats, setStats] = useState<ServiceStats | null>(null)
  const [interval, setInterval] = useState('5m')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!serviceName) return
    setLoading(true)
    const to = new Date()
    const from = new Date(to.getTime() - 60 * 60 * 1000)
    api.serviceStats(serviceName, {
      from: from.toISOString(),
      to: to.toISOString(),
      interval,
    })
      .then(setStats)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [serviceName, interval])

  const chartData = stats?.series.map(s => ({
    t: new Date(s.timestamp).toLocaleTimeString(),
    requests: s.request_count,
    errors: s.error_count,
    p50: s.p50_ms,
    p95: s.p95_ms,
    p99: s.p99_ms,
  })) ?? []

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Link to="/services" className="text-slate-500 hover:text-slate-300 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-xl font-semibold text-white">{serviceName}</h1>
          <div className="ml-auto flex gap-1">
            {['1m', '5m', '1h', '1d'].map(i => (
              <button
                key={i}
                onClick={() => setInterval(i)}
                className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                  interval === i
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {i}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg p-3">{error}</div>
        )}

        {loading ? (
          <div className="text-slate-500 text-sm">Loading…</div>
        ) : (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h2 className="text-sm font-medium text-slate-300 mb-4">Requests & Errors</h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="t" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                  <Line type="monotone" dataKey="requests" stroke="#6366f1" strokeWidth={2} dot={false} name="requests" />
                  <Line type="monotone" dataKey="errors" stroke="#ef4444" strokeWidth={2} dot={false} name="errors" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h2 className="text-sm font-medium text-slate-300 mb-4">Latency (ms)</h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="t" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                  <Line type="monotone" dataKey="p50" stroke="#10b981" strokeWidth={2} dot={false} name="p50" />
                  <Line type="monotone" dataKey="p95" stroke="#f59e0b" strokeWidth={2} dot={false} name="p95" />
                  <Line type="monotone" dataKey="p99" stroke="#ef4444" strokeWidth={2} dot={false} name="p99" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

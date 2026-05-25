import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { api } from '../lib/api'
import type { ServiceStats } from '../lib/api'

export function ServiceDetailPage() {
  const { serviceName } = useParams<{ serviceName: string }>()
  const [stats, setStats] = useState<ServiceStats | null>(null)
  const [granularity, setGranularity] = useState('5m')
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
      interval: granularity,
    })
      .then(setStats)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [serviceName, granularity])

  const chartData = stats?.series.map(s => ({
    t: new Date(s.timestamp).toLocaleTimeString(),
    requests: s.request_count,
    errors: s.error_count,
    p50: s.p50_ms,
    p95: s.p95_ms,
    p99: s.p99_ms,
  })) ?? []

  return (
    <div className="flex-1 overflow-auto p-6 animate-fade-in">
      <div className="max-w-6xl flex-col gap-4">
        <div className="flex items-center gap-3 mb-8">
          <Link to="/services" style={{ color: 'var(--text-secondary)', transition: 'color 0.2s', padding: '8px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }}>
            <ArrowLeft style={{ width: '16px', height: '16px' }} />
          </Link>
          <h1 className="text-xl font-bold text-primary">{serviceName}</h1>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
            {['1m', '5m', '1h', '1d'].map(i => (
              <button
                key={i}
                onClick={() => setGranularity(i)}
                style={{
                  padding: '6px 16px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  transition: 'all 0.2s',
                  border: 'none',
                  cursor: 'pointer',
                  background: granularity === i ? 'var(--accent-primary)' : 'transparent',
                  color: granularity === i ? 'white' : 'var(--text-secondary)',
                  boxShadow: granularity === i ? '0 2px 8px rgba(99, 102, 241, 0.4)' : 'none'
                }}
              >
                {i}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="text-sm p-3 mb-4" style={{ background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-muted text-sm py-4">Loading metrics…</div>
        ) : (
          <div className="flex-col gap-6">
            <div className="glass-panel p-6">
              <h2 className="text-base font-bold text-primary mb-4">Traffic & Errors</h2>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="t" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} dy={10} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#1e2638', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#f8fafc' }}
                    itemStyle={{ fontSize: 12, fontWeight: 500 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8', paddingTop: '10px' }} iconType="circle" />
                  <Line type="monotone" dataKey="requests" stroke="#6366f1" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} name="Requests" />
                  <Line type="monotone" dataKey="errors" stroke="#ef4444" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} name="Errors" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="glass-panel p-6">
              <h2 className="text-base font-bold text-primary mb-4">Latency Distribution (ms)</h2>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="t" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} dy={10} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#1e2638', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#f8fafc' }}
                    itemStyle={{ fontSize: 12, fontWeight: 500 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8', paddingTop: '10px' }} iconType="circle" />
                  <Line type="monotone" dataKey="p50" stroke="#10b981" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} name="p50 Latency" />
                  <Line type="monotone" dataKey="p95" stroke="#f59e0b" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} name="p95 Latency" />
                  <Line type="monotone" dataKey="p99" stroke="#ef4444" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} name="p99 Latency" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

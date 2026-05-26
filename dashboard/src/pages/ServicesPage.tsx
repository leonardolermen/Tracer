import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, AlertTriangle, Clock } from 'lucide-react'
import { api } from '../lib/api'
import type { Service } from '../lib/api'
import { formatDate } from '../lib/utils'

export function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.services()
      .then(res => setServices(res.services))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex-1 overflow-auto p-6 animate-fade-in">
      <div className="max-w-6xl flex-col gap-4">
        <h1 className="text-xl font-bold text-primary mb-8" style={{ letterSpacing: '0.02em' }}>Services Dashboard</h1>

        {error && (
          <div className="text-sm p-3 mb-4" style={{ background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)' }}>
            {error}
          </div>
        )}

        {loading && <div className="text-muted text-sm py-4">Loading services…</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          {services.map(svc => (
            <Link
              key={svc.name}
              to={`/services/${encodeURIComponent(svc.name)}`}
              className="glass-card p-4 flex-col gap-4"
              style={{ padding: '1.25rem' }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-primary" style={{ letterSpacing: '0.02em' }}>{svc.name}</h2>
                <span
                  style={{
                    fontSize: '0.7rem',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    background: Number(svc.error_rate_24h) > 0.05 ? 'var(--error-bg)' : 'var(--success-bg)',
                    color: Number(svc.error_rate_24h) > 0.05 ? 'var(--error)' : 'var(--success)',
                    border: `1px solid ${Number(svc.error_rate_24h) > 0.05 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
                  }}
                >
                  {(Number(svc.error_rate_24h) * 100).toFixed(1)}% err
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
                <div className="flex-col gap-1.5" style={{ background: 'rgba(0,0,0,0.2)', padding: '12px 10px', borderRadius: '8px' }}>
                  <div className="flex items-center gap-1.5 text-muted font-semibold" style={{ textTransform: 'uppercase', fontSize: '0.65rem' }}>
                    <TrendingUp style={{ width: '12px', height: '12px' }} />
                    Requests
                  </div>
                  <div className="text-sm font-mono text-primary">{Number(svc.trace_count_24h).toLocaleString()}</div>
                </div>
                
                <div className="flex-col gap-1.5" style={{ background: 'rgba(0,0,0,0.2)', padding: '12px 10px', borderRadius: '8px' }}>
                  <div className="flex items-center gap-1.5 text-muted font-semibold" style={{ textTransform: 'uppercase', fontSize: '0.65rem' }}>
                    <Clock style={{ width: '12px', height: '12px' }} />
                    p95 Latency
                  </div>
                  <div className="text-sm font-mono text-primary">{Number(Number(svc.p95_duration_ms).toFixed(2))}ms</div>
                </div>

                <div className="flex-col gap-1.5" style={{ background: 'rgba(0,0,0,0.2)', padding: '12px 10px', borderRadius: '8px' }}>
                  <div className="flex items-center gap-1.5 text-muted font-semibold" style={{ textTransform: 'uppercase', fontSize: '0.65rem' }}>
                    <AlertTriangle style={{ width: '12px', height: '12px' }} />
                    Error Rate
                  </div>
                  <div className="text-sm font-mono" style={{ color: Number(svc.error_rate_24h) > 0 ? 'var(--error)' : 'var(--success)' }}>
                    {Number(svc.error_rate_24h) > 0 ? `${Number(svc.error_rate_24h).toFixed(3)}` : '0'}
                  </div>
                </div>
              </div>

              <div className="text-xs text-muted text-right">
                Last seen {formatDate(svc.last_seen_at)}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

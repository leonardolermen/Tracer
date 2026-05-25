import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, AlertTriangle, Clock } from 'lucide-react'
import { api, Service } from '../lib/api'
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
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <h1 className="text-xl font-semibold text-white">Services</h1>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg p-3">{error}</div>
        )}

        {loading && <div className="text-slate-500 text-sm">Loading…</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {services.map(svc => (
            <Link
              key={svc.name}
              to={`/services/${encodeURIComponent(svc.name)}`}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-indigo-500/50 transition-colors space-y-3"
            >
              <div className="flex items-start justify-between">
                <h2 className="text-sm font-medium text-white truncate">{svc.name}</h2>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full border ${
                    svc.error_rate_24h > 0.05
                      ? 'bg-red-500/20 text-red-300 border-red-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  {(svc.error_rate_24h * 100).toFixed(1)}% err
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="flex items-center gap-1 text-slate-400">
                  <TrendingUp className="w-3 h-3" />
                  <span>{svc.trace_count_24h.toLocaleString()} req/24h</span>
                </div>
                <div className="flex items-center gap-1 text-slate-400">
                  <Clock className="w-3 h-3" />
                  <span>p95: {svc.p95_duration_ms}ms</span>
                </div>
                <div className="flex items-center gap-1 text-slate-400">
                  <AlertTriangle className="w-3 h-3" />
                  <span>{svc.error_rate_24h > 0 ? `${svc.error_rate_24h.toFixed(3)}` : 'no errors'}</span>
                </div>
              </div>

              <div className="text-xs text-slate-600">
                Last seen {formatDate(svc.last_seen_at)}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

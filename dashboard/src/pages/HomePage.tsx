import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Server, AlertTriangle, Clock, Zap, ArrowRight } from 'lucide-react'
import { api } from '../lib/api'
import type { Service, Trace } from '../lib/api'
import { StatusBadge } from '../components/StatusBadge'
import { formatDuration, formatDate } from '../lib/utils'

function ServiceHealthCard({ svc }: { svc: Service }) {
  const errRate = Number(svc.error_rate_24h)
  const isUnhealthy = errRate > 0.05
  const isWarning = errRate > 0 && errRate <= 0.05

  const statusColor = isUnhealthy ? 'var(--error)' : isWarning ? 'var(--warning)' : 'var(--success)'
  const statusBg = isUnhealthy ? 'rgba(239,68,68,0.1)' : isWarning ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)'

  return (
    <Link
      to={`/services/${encodeURIComponent(svc.name)}`}
      className="glass-card p-4"
      style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: statusColor, boxShadow: `0 0 8px ${statusColor}` }} />
          <span className="text-sm font-bold text-primary">{svc.name}</span>
        </div>
        <ArrowRight style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
        <div style={{ background: 'rgba(0,0,0,0.25)', padding: '8px 10px', borderRadius: 6, minWidth: 0 }}>
          <div className="text-muted font-semibold" style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Requests</div>
          <div className="text-sm font-mono text-primary" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{Number(svc.trace_count_24h).toLocaleString()}</div>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.25)', padding: '8px 10px', borderRadius: 6, minWidth: 0 }}>
          <div className="text-muted font-semibold" style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>p95</div>
          <div className="text-sm font-mono text-primary" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{Number(Number(svc.p95_duration_ms).toFixed(2))}ms</div>
        </div>
        <div style={{ background: statusBg, padding: '8px 10px', borderRadius: 6, border: `1px solid ${statusColor}22` }}>
          <div className="font-semibold" style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: statusColor, marginBottom: 3 }}>Err%</div>
          <div className="text-sm font-mono" style={{ color: statusColor }}>
            {(errRate * 100).toFixed(1)}%
          </div>
        </div>
      </div>
    </Link>
  )
}

function StatCard({ icon, label, value, sub, color = 'var(--accent-primary)' }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color?: string
}) {
  return (
    <div className="glass-panel p-5" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-secondary font-semibold" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
        <div style={{ color, opacity: 0.8 }}>{icon}</div>
      </div>
      <div className="text-2xl font-bold text-primary">{value}</div>
      {sub && <div className="text-xs text-muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
    </div>
  )
}

export function HomePage() {
  const [services, setServices] = useState<Service[]>([])
  const [traces, setTraces] = useState<Trace[]>([])
  const [loading, setLoading] = useState(true)
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected')
  const [liveCount, setLiveCount] = useState(0)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    Promise.all([
      api.services(),
      api.traces({ limit: 10 }),
    ]).then(([svcRes, traceRes]) => {
      setServices(svcRes.services)
      setTraces(traceRes.traces)
    }).finally(() => setLoading(false))
  }, [])

  // WebSocket live connection
  useEffect(() => {
    const token = localStorage.getItem('tf_token')
    if (!token) return

    const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`
    let ws: WebSocket
    try {
      ws = new WebSocket(wsUrl)
      wsRef.current = ws
      setWsStatus('connecting')

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'auth', token }))
      }
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'auth.ok') {
            setWsStatus('connected')
          } else if (msg.type === 'span.received') {
            setLiveCount(c => c + 1)
          }
        } catch {}
      }
      ws.onclose = () => setWsStatus('disconnected')
      ws.onerror = () => setWsStatus('disconnected')
    } catch {}

    return () => {
      if (wsRef.current) {
        const socket = wsRef.current
        if (socket.readyState === WebSocket.CONNECTING) {
          socket.addEventListener('open', () => socket.close())
        } else {
          socket.close()
        }
      }
    }
  }, [])

  const totalRequests = services.reduce((sum, s) => sum + Number(s.trace_count_24h), 0)
  const unhealthy = services.filter(s => Number(s.error_rate_24h) > 0.05)
  const healthy = services.filter(s => Number(s.error_rate_24h) === 0)
  const avgP95 = services.length > 0
    ? Number((services.reduce((sum, s) => sum + Number(s.p95_duration_ms), 0) / services.length).toFixed(2))
    : 0

  return (
    <div className="flex-1 overflow-auto p-6 animate-fade-in">
      <div className="max-w-6xl" style={{ margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-primary" style={{ letterSpacing: '0.02em' }}>System Overview</h1>
            <p className="text-sm text-secondary" style={{ marginTop: 4 }}>Real-time health of your distributed services</p>
          </div>
          <div className="flex items-center gap-2" style={{
            padding: '6px 14px', borderRadius: 'var(--radius-md)',
            background: wsStatus === 'connected' ? 'rgba(16,185,129,0.1)' : wsStatus === 'connecting' ? 'rgba(245,158,11,0.1)' : 'rgba(100,116,139,0.1)',
            border: `1px solid ${wsStatus === 'connected' ? 'rgba(16,185,129,0.3)' : wsStatus === 'connecting' ? 'rgba(245,158,11,0.3)' : 'rgba(100,116,139,0.2)'}`,
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: wsStatus === 'connected' ? 'var(--success)' : wsStatus === 'connecting' ? 'var(--warning)' : 'var(--text-muted)',
              boxShadow: wsStatus === 'connected' ? '0 0 6px var(--success)' : 'none',
              animation: wsStatus === 'connecting' ? 'pulse 1.5s infinite' : 'none',
            }} />
            <span className="text-xs font-semibold" style={{
              color: wsStatus === 'connected' ? 'var(--success)' : wsStatus === 'connecting' ? 'var(--warning)' : 'var(--text-muted)'
            }}>
              {wsStatus === 'connected' ? `Live · ${liveCount} spans` : wsStatus === 'connecting' ? 'Connecting…' : 'Offline'}
            </span>
          </div>
        </div>

        {/* Global Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem' }}>
          <StatCard
            icon={<Server style={{ width: 18, height: 18 }} />}
            label="Services"
            value={services.length}
            sub={`${healthy.length} healthy, ${unhealthy.length} degraded`}
          />
          <StatCard
            icon={<Activity style={{ width: 18, height: 18 }} />}
            label="Requests / 24h"
            value={totalRequests.toLocaleString()}
            color="var(--accent-primary)"
          />
          <StatCard
            icon={<Clock style={{ width: 18, height: 18 }} />}
            label="Avg p95 Latency"
            value={`${avgP95}ms`}
            color="var(--warning)"
          />
          <StatCard
            icon={<AlertTriangle style={{ width: 18, height: 18 }} />}
            label="Degraded Services"
            value={unhealthy.length}
            sub={unhealthy.length > 0 ? unhealthy.map(s => s.name).join(', ') : 'All systems nominal'}
            color={unhealthy.length > 0 ? 'var(--error)' : 'var(--success)'}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
          {/* Service Health Grid */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-primary">Services Health</h2>
              <Link to="/services" className="text-xs font-semibold" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>
                View all →
              </Link>
            </div>
            {loading ? (
              <div className="text-muted text-sm">Loading…</div>
            ) : services.length === 0 ? (
              <div className="glass-card p-6 text-center text-muted text-sm">
                No services yet. Instrument your first service with the SDK.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {services.slice(0, 6).map(svc => (
                  <ServiceHealthCard key={svc.name} svc={svc} />
                ))}
              </div>
            )}
          </div>

          {/* Recent Traces */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-primary">Recent Traces</h2>
              <Link to="/traces" className="text-xs font-semibold" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>
                View all →
              </Link>
            </div>
            {loading ? (
              <div className="text-muted text-sm">Loading…</div>
            ) : (
              <div className="glass-card" style={{ overflow: 'hidden' }}>
                {traces.length === 0 ? (
                  <div className="p-6 text-center text-muted text-sm">No traces yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {traces.map((t, idx) => (
                      <Link
                        key={t.id}
                        to={`/traces/${t.id}`}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                          textDecoration: 'none',
                          borderBottom: idx < traces.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <StatusBadge status={t.status} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="text-sm font-medium text-primary" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {t.root_service} <span className="text-muted">·</span> {t.root_operation}
                          </div>
                          <div className="text-xs text-muted" style={{ marginTop: 2 }}>{formatDate(t.started_at)}</div>
                        </div>
                        <div className="text-xs font-mono text-secondary" style={{ minWidth: '60px', textAlign: 'right' }}>{formatDuration(t.duration_ms)}</div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="glass-panel p-5">
          <h2 className="text-sm font-bold text-secondary mb-4" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Quick Actions</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem' }}>
            {[
              { to: '/traces?status=error', icon: <AlertTriangle style={{ width: 18, height: 18 }} />, label: 'View Error Traces', color: 'var(--error)', bg: 'rgba(239,68,68,0.1)' },
              { to: '/services', icon: <Server style={{ width: 18, height: 18 }} />, label: 'Browse Services', color: 'var(--accent-primary)', bg: 'rgba(99,102,241,0.1)' },
              { to: '/alerts', icon: <Zap style={{ width: 18, height: 18 }} />, label: 'Manage Alerts', color: 'var(--warning)', bg: 'rgba(245,158,11,0.1)' },
            ].map(({ to, icon, label, color, bg }) => (
              <Link
                key={to}
                to={to}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                  background: bg, border: `1px solid ${color}22`, borderRadius: 'var(--radius-md)',
                  textDecoration: 'none', color, fontWeight: 600, fontSize: '0.875rem',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.15)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={e => { e.currentTarget.style.filter = ''; e.currentTarget.style.transform = '' }}
              >
                {icon}
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

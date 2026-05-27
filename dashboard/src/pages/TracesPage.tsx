import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Search, Filter, RefreshCw, Hash, ChevronDown, Calendar, Clock, X } from 'lucide-react'
import { api } from '../lib/api'
import type { Trace, Service } from '../lib/api'
import { StatusBadge } from '../components/StatusBadge'
import { formatDuration, formatDate } from '../lib/utils'

// ── Dropdown helper ────────────────────────────────────────────────────────────
function Dropdown({
  label, icon, value, onClear, children,
}: {
  label: string; icon: React.ReactNode; value: string; onClear?: () => void; children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const hasValue = !!value

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: hasValue ? 'rgba(249,115,22,0.12)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${hasValue ? 'rgba(249,115,22,0.4)' : 'var(--border-subtle)'}`,
          color: hasValue ? 'var(--accent-primary)' : 'var(--text-secondary)',
          padding: '8px 12px', borderRadius: 'var(--radius-sm)',
          fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 500,
          cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s',
        }}
      >
        {icon}
        <span>{value || label}</span>
        {hasValue && onClear ? (
          <span
            onClick={(e) => { e.stopPropagation(); onClear(); setOpen(false) }}
            style={{ marginLeft: 2, color: 'var(--accent-primary)', display: 'flex', cursor: 'pointer' }}
          >
            <X style={{ width: 12, height: 12 }} />
          </span>
        ) : (
          <ChevronDown style={{ width: 13, height: 13, opacity: 0.6, marginLeft: 2 }} />
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 100,
          background: 'rgba(20,20,20,0.98)', backdropFilter: 'blur(16px)',
          border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
          minWidth: '220px', padding: '6px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}>
          {children}
        </div>
      )}
    </div>
  )
}

function DropdownItem({ label, active, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '7px 12px', borderRadius: 'var(--radius-sm)',
        background: active ? 'rgba(249,115,22,0.15)' : 'transparent',
        color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
        border: 'none', fontFamily: 'inherit', fontSize: '0.82rem',
        cursor: 'pointer', transition: 'background 0.15s',
      }}
      onMouseEnter={e => { if (!active) (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
      onMouseLeave={e => { if (!active) (e.target as HTMLElement).style.background = 'transparent' }}
    >
      {label}
    </button>
  )
}

// ── Active filter pill ─────────────────────────────────────────────────────────
function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.35)',
      color: 'var(--accent-primary)', fontSize: '0.72rem', fontWeight: 600,
      padding: '3px 10px', borderRadius: 20,
    }}>
      {label}
      <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}>
        <X style={{ width: 11, height: 11 }} />
      </button>
    </span>
  )
}

// ── Date quick-picks ──────────────────────────────────────────────────────────
function toLocalDateString(d: Date) {
  return d.toISOString().split('T')[0]
}
const QUICK_DATES = [
  { label: 'Hoje',           from: () => toLocalDateString(new Date()), to: () => toLocalDateString(new Date()) },
  { label: 'Ontem',          from: () => toLocalDateString(new Date(Date.now() - 86400000)), to: () => toLocalDateString(new Date(Date.now() - 86400000)) },
  { label: 'Últimos 7 dias', from: () => toLocalDateString(new Date(Date.now() - 6 * 86400000)), to: () => toLocalDateString(new Date()) },
  { label: 'Últimos 30 dias',from: () => toLocalDateString(new Date(Date.now() - 29 * 86400000)), to: () => toLocalDateString(new Date()) },
]

function inputStyle(): React.CSSProperties {
  return {
    background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
    fontFamily: 'inherit', fontSize: '0.8rem', padding: '6px 10px',
    width: '100%', outline: 'none', colorScheme: 'dark',
  }
}

export function TracesPage() {
  const [traces, setTraces]       = useState<Trace[]>([])
  const [services, setServices]   = useState<Service[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  // Filter state
  const [search, setSearch]           = useState('')
  const [serviceFilter, setServiceFilter] = useState('')
  const [statusFilter, setStatusFilter]   = useState('')
  const [dateFrom, setDateFrom]           = useState('')
  const [dateTo, setDateTo]               = useState('')
  const [hourFrom, setHourFrom]           = useState('')
  const [hourTo, setHourTo]               = useState('')
  const [traceIdSearch, setTraceIdSearch] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      // Build from/to with hour precision
      const fromDT = dateFrom
        ? `${dateFrom}T${hourFrom || '00:00'}:00.000Z`
        : undefined
      const toDT = dateTo
        ? `${dateTo}T${hourTo || '23:59'}:59.999Z`
        : undefined

      const [res, svcRes] = await Promise.all([
        api.traces({
          service: serviceFilter || search || undefined,
          status:  statusFilter || undefined,
          from:    fromDT,
          to:      toDT,
          limit:   50,
        }),
        api.services(),
      ])
      setTraces(res.traces)
      setServices(svcRes.services)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load traces')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [search, serviceFilter, statusFilter, dateFrom, dateTo, hourFrom, hourTo])

  // Derived label helpers
  const dateLabel = dateFrom
    ? dateTo && dateTo !== dateFrom
      ? `${dateFrom} → ${dateTo}`
      : dateFrom
    : ''

  const hourLabel = hourFrom || hourTo
    ? `${hourFrom || '00:00'} – ${hourTo || '23:59'}`
    : ''

  const activeFilters: { label: string; clear: () => void }[] = [
    serviceFilter && { label: `Service: ${serviceFilter}`,            clear: () => setServiceFilter('') },
    statusFilter  && { label: `Status: ${statusFilter}`,             clear: () => setStatusFilter('') },
    dateLabel     && { label: `Data: ${dateLabel}`,                   clear: () => { setDateFrom(''); setDateTo('') } },
    hourLabel     && { label: `Hora: ${hourLabel}`,                   clear: () => { setHourFrom(''); setHourTo('') } },
  ].filter(Boolean) as { label: string; clear: () => void }[]

  return (
    <div className="flex-1 overflow-auto p-6 animate-fade-in">
      <div className="max-w-6xl flex-col gap-4">

        {/* ── Page header ── */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-xl font-bold text-primary" style={{ letterSpacing: '0.02em' }}>Traces</h1>
          <button
            onClick={load}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)', padding: '6px 12px',
              borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}
          >
            <RefreshCw style={{ width: 12, height: 12 }} />
            Refresh
          </button>
        </div>

        {/* ── Filter bar ── */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>

          {/* Free-text service search */}
          <div style={{ position: 'relative', flex: 1, maxWidth: 220, minWidth: 160 }}>
            <Search style={{ position: 'absolute', left: 12, top: 10, width: 15, height: 15, color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter by service…"
              className="glass-input"
              style={{ paddingLeft: 36 }}
            />
          </div>

          {/* Service dropdown */}
          <Dropdown
            label="All services"
            icon={<Filter style={{ width: 13, height: 13 }} />}
            value={serviceFilter}
            onClear={() => setServiceFilter('')}
          >
            <DropdownItem label="All services" active={!serviceFilter} onClick={() => setServiceFilter('')} />
            <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
            {services.map(s => (
              <DropdownItem key={s.name} label={s.name} active={serviceFilter === s.name} onClick={() => setServiceFilter(s.name)} />
            ))}
          </Dropdown>

          {/* Status dropdown */}
          <Dropdown
            label="All statuses"
            icon={<Filter style={{ width: 13, height: 13 }} />}
            value={statusFilter ? `Status: ${statusFilter}` : ''}
            onClear={() => setStatusFilter('')}
          >
            {['', 'ok', 'error', 'timeout', 'in_progress'].map(s => (
              <DropdownItem key={s} label={s || 'All statuses'} active={statusFilter === s} onClick={() => setStatusFilter(s)} />
            ))}
          </Dropdown>

          {/* Date range */}
          <Dropdown
            label="Date range"
            icon={<Calendar style={{ width: 13, height: 13 }} />}
            value={dateLabel}
            onClear={() => { setDateFrom(''); setDateTo('') }}
          >
            <div style={{ padding: '6px 8px' }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                {QUICK_DATES.map(q => (
                  <button
                    key={q.label}
                    onClick={() => { setDateFrom(q.from()); setDateTo(q.to()) }}
                    style={{
                      background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)',
                      color: 'var(--accent-primary)', fontSize: '0.7rem', fontWeight: 600,
                      padding: '3px 9px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >{q.label}</button>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 4, letterSpacing: '0.04em' }}>DE</div>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inputStyle()} />
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 4, letterSpacing: '0.04em' }}>ATÉ</div>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inputStyle()} />
                </div>
              </div>
            </div>
          </Dropdown>

          {/* Hour range */}
          <Dropdown
            label="Hour range"
            icon={<Clock style={{ width: 13, height: 13 }} />}
            value={hourLabel}
            onClear={() => { setHourFrom(''); setHourTo('') }}
          >
            <div style={{ padding: '6px 8px' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                {['00:00', '06:00', '08:00', '12:00', '18:00', '22:00'].map(h => (
                  <button
                    key={h}
                    onClick={() => setHourFrom(h)}
                    style={{
                      background: hourFrom === h ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${hourFrom === h ? 'rgba(249,115,22,0.4)' : 'var(--border-subtle)'}`,
                      color: hourFrom === h ? 'var(--accent-primary)' : 'var(--text-muted)',
                      fontSize: '0.7rem', fontWeight: 600, padding: '3px 9px',
                      borderRadius: 20, cursor: 'pointer', fontFamily: 'monospace',
                    }}
                  >{h}</button>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 4, letterSpacing: '0.04em' }}>HORA INÍCIO</div>
                  <input type="time" value={hourFrom} onChange={e => setHourFrom(e.target.value)} style={inputStyle()} />
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 4, letterSpacing: '0.04em' }}>HORA FIM</div>
                  <input type="time" value={hourTo} onChange={e => setHourTo(e.target.value)} style={inputStyle()} />
                </div>
              </div>
            </div>
          </Dropdown>

          {/* Jump to trace ID */}
          <div style={{ position: 'relative', flex: 1, maxWidth: 240, minWidth: 160 }}>
            <Hash style={{ position: 'absolute', left: 12, top: 10, width: 15, height: 15, color: 'var(--text-muted)' }} />
            <input
              value={traceIdSearch}
              onChange={e => setTraceIdSearch(e.target.value)}
              placeholder="Jump to trace ID…"
              className="glass-input"
              style={{ paddingLeft: 36, fontFamily: 'monospace', fontSize: '0.78rem' }}
              onKeyDown={e => {
                if (e.key === 'Enter' && traceIdSearch.trim()) {
                  window.location.href = `/traces/${traceIdSearch.trim()}`
                }
              }}
            />
          </div>
        </div>

        {/* ── Active filter pills ── */}
        {activeFilters.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
            {activeFilters.map(f => (
              <FilterPill key={f.label} label={f.label} onRemove={f.clear} />
            ))}
            <button
              onClick={() => { setServiceFilter(''); setStatusFilter(''); setDateFrom(''); setDateTo(''); setHourFrom(''); setHourTo(''); setSearch('') }}
              style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
            >
              Limpar tudo
            </button>
          </div>
        )}

        {error && (
          <div className="text-sm p-3 mb-4" style={{ background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)' }}>
            {error}
          </div>
        )}

        {/* ── Table ── */}
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
              {loading && Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} style={{ opacity: 1 - i * 0.09 }}>
                  <td><div className="skeleton" style={{ width: '140px', height: '14px', borderRadius: '4px' }} /></td>
                  <td><div className="skeleton" style={{ width: '90px',  height: '14px', borderRadius: '4px' }} /></td>
                  <td><div className="skeleton" style={{ width: '160px', height: '14px', borderRadius: '4px' }} /></td>
                  <td><div className="skeleton" style={{ width: '48px',  height: '20px', borderRadius: '8px' }} /></td>
                  <td className="text-right"><div className="skeleton" style={{ width: '48px',  height: '14px', borderRadius: '4px', marginLeft: 'auto' }} /></td>
                  <td className="text-right"><div className="skeleton" style={{ width: '24px',  height: '14px', borderRadius: '4px', marginLeft: 'auto' }} /></td>
                  <td className="text-right"><div className="skeleton" style={{ width: '100px', height: '14px', borderRadius: '4px', marginLeft: 'auto' }} /></td>
                </tr>
              ))}
              {!loading && traces.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-muted py-3" style={{ padding: '48px 0' }}>
                    Nenhum trace encontrado para os filtros selecionados.
                  </td>
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

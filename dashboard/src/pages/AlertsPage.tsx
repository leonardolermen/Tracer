import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Plus, Trash2, Bell } from 'lucide-react'
import { formatDate } from '../lib/utils'

interface Alert {
  id: string
  name: string
  condition: { type: string; service: string; threshold_ms: number; window_minutes: number }
  channels: { type: string }[]
  created_at: string
}

export function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', service: '', threshold_ms: '1000', window_minutes: '5' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const { alerts } = await fetch('/api/v1/alerts', {
      headers: { Authorization: `Bearer ${localStorage.getItem('tf_token')}` },
    }).then(r => r.json())
    setAlerts(alerts ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await fetch('/api/v1/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('tf_token')}`,
        },
        body: JSON.stringify({
          name: form.name,
          condition: {
            type: 'latency_p95',
            service: form.service,
            threshold_ms: Number(form.threshold_ms),
            window_minutes: Number(form.window_minutes),
          },
          channels: [],
        }),
      })
      setShowForm(false)
      setForm({ name: '', service: '', threshold_ms: '1000', window_minutes: '5' })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create alert')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/v1/alerts/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('tf_token')}` },
    })
    load()
  }

  return (
    <div className="flex-1 overflow-auto p-6 animate-fade-in">
      <div className="max-w-6xl flex-col gap-4">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-xl font-bold text-primary" style={{ letterSpacing: '0.02em' }}>Alerts Configuration</h1>
          <button
            onClick={() => setShowForm(v => !v)}
            className="btn-primary"
            style={{ width: 'auto', padding: '8px 16px', gap: '8px', fontSize: '0.875rem' }}
          >
            <Plus style={{ width: '16px', height: '16px' }} />
            New Alert
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="glass-panel p-6 mb-6" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h2 className="text-lg font-bold text-primary mb-2">Create New Alert</h2>
            {error && <div className="text-sm p-3" style={{ background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)' }}>{error}</div>}
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
              {[
                { label: 'Alert Name', key: 'name', placeholder: 'Checkout slow', type: 'text' },
                { label: 'Target Service', key: 'service', placeholder: 'checkout-service', type: 'text' },
                { label: 'Latency Threshold (ms)', key: 'threshold_ms', placeholder: '1000', type: 'number' },
                { label: 'Time Window (minutes)', key: 'window_minutes', placeholder: '5', type: 'number' },
              ].map(({ label, key, placeholder, type }) => (
                <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label className="text-xs text-secondary font-medium" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
                  <input
                    type={type}
                    value={form[key as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    required
                    className="glass-input"
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-3" style={{ marginTop: '1rem' }}>
              <button type="submit" disabled={saving} className="btn-primary" style={{ width: 'auto' }}>
                {saving ? 'Creating...' : 'Create Alert'}
              </button>
              <button 
                type="button" 
                onClick={() => setShowForm(false)} 
                style={{
                  background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)',
                  padding: '10px 20px', borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all 0.2s', fontWeight: 500
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="text-muted text-sm py-4">Loading alerts…</div>
        ) : alerts.length === 0 ? (
          <div className="glass-card flex-col items-center justify-center p-8 text-muted" style={{ minHeight: '200px', gap: '16px' }}>
            <Bell style={{ width: '48px', height: '48px', opacity: 0.2, color: 'var(--accent-primary)' }} />
            <p className="text-sm font-medium">No alerts configured</p>
          </div>
        ) : (
          <div className="flex-col gap-3">
            {alerts.map(alert => (
              <div key={alert.id} className="glass-card p-4 flex items-center justify-between gap-4">
                <div className="flex-col gap-1">
                  <div className="text-base font-bold text-primary">{alert.name}</div>
                  <div className="text-sm text-secondary">
                    Trigger when <strong style={{ color: 'var(--warning)' }}>p95 latency &gt; {alert.condition.threshold_ms}ms</strong> on 
                    <span className="font-mono text-xs px-1 py-0.5 rounded ml-1 mr-1" style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)' }}>{alert.condition.service}</span> 
                    over {alert.condition.window_minutes}min window
                  </div>
                  <div className="text-xs text-muted mt-1">Created on {formatDate(alert.created_at)}</div>
                </div>
                <button 
                  onClick={() => handleDelete(alert.id)} 
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--error)',
                    width: '36px', height: '36px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--error)'; e.currentTarget.style.color = 'white'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = 'var(--error)'; }}
                  title="Delete Alert"
                >
                  <Trash2 style={{ width: '16px', height: '16px' }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

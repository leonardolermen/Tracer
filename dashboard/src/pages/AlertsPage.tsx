import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Plus, Trash2, Bell } from 'lucide-react'
import { formatDate } from '../lib/utils'

interface Alert {
  id: string
  name: string
  condition: { type: string; service: string; threshold_ms?: number; threshold?: number; window_minutes: number }
  channels: { type: string; url?: string; address?: string }[]
  created_at: string
  enabled: boolean
  last_fired_at: string | null
  fired_count: number
}

export function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ 
    name: '', service: '', conditionType: 'latency_p95', threshold: '1000', window_minutes: '5',
    channelType: 'webhook', webhookUrl: '', emailAddress: ''
  })
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
          enabled: true,
          condition: {
            type: form.conditionType,
            service: form.service,
            threshold: Number(form.threshold),
            window_minutes: Number(form.window_minutes),
          },
          channels: form.channelType === 'webhook' 
            ? [{ type: 'webhook', url: form.webhookUrl }] 
            : [{ type: 'email', address: form.emailAddress }],
        }),
      })
      setShowForm(false)
      setForm({ name: '', service: '', conditionType: 'latency_p95', threshold: '1000', window_minutes: '5', channelType: 'webhook', webhookUrl: '', emailAddress: '' })
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label className="text-xs text-secondary font-medium uppercase" style={{ letterSpacing: '0.05em' }}>Alert Name</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Checkout slow" required className="glass-input" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label className="text-xs text-secondary font-medium uppercase" style={{ letterSpacing: '0.05em' }}>Target Service</label>
                <input type="text" value={form.service} onChange={e => setForm(f => ({ ...f, service: e.target.value }))} placeholder="checkout-service" required className="glass-input" />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label className="text-xs text-secondary font-medium uppercase" style={{ letterSpacing: '0.05em' }}>Condition Type</label>
                <select value={form.conditionType} onChange={e => setForm(f => ({ ...f, conditionType: e.target.value }))} className="glass-input">
                  <option value="latency_p95">P95 Latency</option>
                  <option value="error_rate">Error Rate (%)</option>
                  <option value="service_down">Service Down</option>
                </select>
              </div>

              {form.conditionType !== 'service_down' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label className="text-xs text-secondary font-medium uppercase" style={{ letterSpacing: '0.05em' }}>Threshold {form.conditionType === 'latency_p95' ? '(ms)' : '(%)'}</label>
                  <input type="number" value={form.threshold} onChange={e => setForm(f => ({ ...f, threshold: e.target.value }))} placeholder={form.conditionType === 'latency_p95' ? '1000' : '5'} required className="glass-input" />
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label className="text-xs text-secondary font-medium uppercase" style={{ letterSpacing: '0.05em' }}>Channel Type</label>
                <select value={form.channelType} onChange={e => setForm(f => ({ ...f, channelType: e.target.value }))} className="glass-input">
                  <option value="webhook">Webhook</option>
                  <option value="email">Email</option>
                </select>
              </div>

              {form.channelType === 'webhook' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label className="text-xs text-secondary font-medium uppercase" style={{ letterSpacing: '0.05em' }}>Webhook URL</label>
                  <input type="url" value={form.webhookUrl} onChange={e => setForm(f => ({ ...f, webhookUrl: e.target.value }))} placeholder="https://..." className="glass-input" required={form.channelType === 'webhook'} />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label className="text-xs text-secondary font-medium uppercase" style={{ letterSpacing: '0.05em' }}>Email Address</label>
                  <input type="email" value={form.emailAddress} onChange={e => setForm(f => ({ ...f, emailAddress: e.target.value }))} placeholder="admin@domain.com" className="glass-input" required={form.channelType === 'email'} />
                </div>
              )}
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
                    Trigger when <strong style={{ color: 'var(--warning)' }}>
                      {alert.condition.type === 'latency_p95' && `p95 latency > ${alert.condition.threshold ?? alert.condition.threshold_ms}ms`}
                      {alert.condition.type === 'error_rate' && `error rate > ${alert.condition.threshold}%`}
                      {alert.condition.type === 'service_down' && `service is down`}
                    </strong> on 
                    <span className="font-mono text-xs px-1 py-0.5 rounded ml-1 mr-1" style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-primary)' }}>{alert.condition.service}</span> 
                    over {alert.condition.window_minutes}min window
                  </div>
                  <div className="text-xs text-muted mt-1">
                    Created on {formatDate(alert.created_at)} · Last fired: {alert.last_fired_at ? formatDate(alert.last_fired_at) : 'Never'} · Count: {alert.fired_count ?? 0}
                  </div>
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

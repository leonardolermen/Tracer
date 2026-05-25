import { useEffect, useState, FormEvent } from 'react'
import { Plus, Trash2, Bell } from 'lucide-react'
import { api } from '../lib/api'
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
    const res = await api.traces({ limit: 0 }).catch(() => null)
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
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-white">Alerts</h1>
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New alert
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <h2 className="text-sm font-medium text-slate-300">Create alert</h2>
            {error && <div className="text-red-400 text-xs">{error}</div>}
            {[
              { label: 'Alert name', key: 'name', placeholder: 'Checkout slow' },
              { label: 'Service', key: 'service', placeholder: 'checkout-service' },
              { label: 'Threshold (ms)', key: 'threshold_ms', placeholder: '1000' },
              { label: 'Window (minutes)', key: 'window_minutes', placeholder: '5' },
            ].map(({ label, key, placeholder }) => (
              <div key={key} className="space-y-1">
                <label className="text-xs text-slate-400">{label}</label>
                <input
                  value={form[key as keyof typeof form]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            ))}
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm px-3 py-1.5 rounded-lg transition-colors">
                {saving ? 'Creating…' : 'Create'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-200 text-sm px-3 py-1.5 rounded-lg transition-colors">
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="text-slate-500 text-sm">Loading…</div>
        ) : alerts.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 flex flex-col items-center gap-3 text-slate-500">
            <Bell className="w-8 h-8 opacity-30" />
            <p className="text-sm">No alerts configured</p>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map(alert => (
              <div key={alert.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-white">{alert.name}</div>
                  <div className="text-xs text-slate-400">
                    p95 latency &gt; {alert.condition.threshold_ms}ms on <span className="text-slate-300">{alert.condition.service}</span> over {alert.condition.window_minutes}min window
                  </div>
                  <div className="text-xs text-slate-600">{formatDate(alert.created_at)}</div>
                </div>
                <button onClick={() => handleDelete(alert.id)} className="text-slate-600 hover:text-red-400 transition-colors shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/traces')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center h-screen w-full p-4">
      <div className="w-full max-w-sm animate-fade-in" style={{ zIndex: 10 }}>
        <div className="flex flex-col items-center justify-center gap-3 mb-8">
          <div style={{
            background: 'rgba(99, 102, 241, 0.1)',
            padding: '12px',
            borderRadius: '16px',
            boxShadow: '0 0 20px rgba(99, 102, 241, 0.3)'
          }}>
            <Zap style={{ width: '32px', height: '32px', color: 'var(--accent-primary)' }} />
          </div>
          <span className="text-2xl font-bold text-primary" style={{ letterSpacing: '0.02em' }}>TraceFlow</span>
          <span className="text-sm text-secondary text-center">Sign in to your workspace</span>
        </div>

        <form onSubmit={handleSubmit} className="glass-panel p-6" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {error && (
            <div className="text-sm p-3" style={{ background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label className="text-xs text-secondary font-medium" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="glass-input"
              placeholder="dev@example.com"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label className="text-xs text-secondary font-medium" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="glass-input"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ marginTop: '0.5rem', height: '44px' }}
          >
            {loading ? 'Authenticating...' : 'Access Dashboard'}
          </button>
        </form>
      </div>
    </div>
  )
}

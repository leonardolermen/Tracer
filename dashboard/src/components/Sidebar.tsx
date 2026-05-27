import React from 'react'
import { NavLink } from 'react-router-dom'
import { Activity, Server, Bell, LogOut, Zap, LayoutDashboard } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const links: { to: string; icon: React.ElementType; label: string; exact: boolean }[] = [
  { to: '/', icon: LayoutDashboard, label: 'Overview', exact: true },
  { to: '/traces', icon: Activity, label: 'Traces', exact: false },
  { to: '/services', icon: Server, label: 'Services', exact: false },
  { to: '/alerts', icon: Bell, label: 'Alerts', exact: false },
]

export function Sidebar() {
  const { workspaceName, logout } = useAuth()

  return (
    <aside style={{
      width: '240px',
      flexShrink: 0,
      background: 'rgba(10, 10, 10, 0.6)',
      backdropFilter: 'blur(20px)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 20
    }}>
      <div className="p-4 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{
          background: 'var(--accent-glow)',
          padding: '6px',
          borderRadius: '8px',
          display: 'flex'
        }}>
          <Zap style={{ width: '20px', height: '20px', color: 'var(--accent-primary)' }} />
        </div>
        <span className="font-semibold text-primary" style={{ letterSpacing: '0.02em' }}>TraceFlow</span>
      </div>

      {workspaceName && (
        <div className="px-4 py-3 text-xs text-secondary" style={{ borderBottom: '1px solid var(--border-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {workspaceName}
        </div>
      )}

      <nav className="flex-1 p-3" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {links.map(({ to, icon: Icon, label, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
              fontWeight: 500,
              textDecoration: 'none',
              transition: 'all 0.2s ease',
              background: isActive ? 'rgba(249, 115, 22, 0.15)' : 'transparent',
              color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
              borderLeft: isActive ? '3px solid var(--accent-primary)' : '3px solid transparent'
            })}
            onMouseEnter={(e) => {
              if (e.currentTarget.style.background === 'transparent') {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (e.currentTarget.style.borderLeft === '3px solid transparent') {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}
          >
            <Icon style={{ width: '18px', height: '18px' }} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3">
        <button
          onClick={logout}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 12px',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            fontFamily: 'inherit',
            fontWeight: 500
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
            e.currentTarget.style.color = 'var(--error)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          <LogOut style={{ width: '18px', height: '18px' }} />
          Sign out
        </button>
      </div>
    </aside>
  )
}

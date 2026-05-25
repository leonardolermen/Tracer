import { NavLink } from 'react-router-dom'
import { Activity, Server, Bell, LogOut, Zap } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/utils'

const links = [
  { to: '/traces', icon: Activity, label: 'Traces' },
  { to: '/services', icon: Server, label: 'Services' },
  { to: '/alerts', icon: Bell, label: 'Alerts' },
]

export function Sidebar() {
  const { workspaceName, logout } = useAuth()

  return (
    <aside className="w-56 shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col">
      <div className="p-4 border-b border-slate-800 flex items-center gap-2">
        <Zap className="w-5 h-5 text-indigo-400" />
        <span className="font-semibold text-white text-sm">TraceFlow</span>
      </div>

      {workspaceName && (
        <div className="px-4 py-2 text-xs text-slate-500 truncate border-b border-slate-800">
          {workspaceName}
        </div>
      )}

      <nav className="flex-1 p-2 space-y-0.5">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-indigo-500/20 text-indigo-300'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              )
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <button
        onClick={logout}
        className="m-2 flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Sign out
      </button>
    </aside>
  )
}

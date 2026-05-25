import clsx from 'clsx'
import type { ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)}s`
  return `${(ms / 60_000).toFixed(1)}m`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}

export function statusColor(status: string): string {
  switch (status) {
    case 'ok': return 'var(--success)'
    case 'error': return 'var(--error)'
    case 'timeout': return 'var(--warning)'
    default: return 'var(--text-muted)'
  }
}

export function statusBgStyle(status: string): React.CSSProperties {
  switch (status) {
    case 'ok': return { background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid rgba(16, 185, 129, 0.3)' }
    case 'error': return { background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid rgba(239, 68, 68, 0.3)' }
    case 'timeout': return { background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)', border: '1px solid rgba(245, 158, 11, 0.3)' }
    default: return { background: 'rgba(100, 116, 139, 0.15)', color: 'var(--text-secondary)', border: '1px solid rgba(100, 116, 139, 0.3)' }
  }
}

export function serviceColor(index: number): string {
  const colors = [
    '#6366f1', '#06b6d4', '#10b981', '#f59e0b',
    '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
  ]
  return colors[index % colors.length]
}

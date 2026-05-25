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
    case 'ok': return 'text-emerald-400'
    case 'error': return 'text-red-400'
    case 'timeout': return 'text-amber-400'
    default: return 'text-slate-400'
  }
}

export function statusBg(status: string): string {
  switch (status) {
    case 'ok': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    case 'error': return 'bg-red-500/20 text-red-300 border-red-500/30'
    case 'timeout': return 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    default: return 'bg-slate-500/20 text-slate-300 border-slate-500/30'
  }
}

export function serviceColor(index: number): string {
  const colors = [
    '#6366f1', '#06b6d4', '#10b981', '#f59e0b',
    '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
  ]
  return colors[index % colors.length]
}

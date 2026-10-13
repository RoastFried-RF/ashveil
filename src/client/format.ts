import type { LogEntry } from '../core'

export const KIND_CLASS: Record<LogEntry['kind'], string> = {
  info: 'text-ash-200',
  combat: 'text-ash-100',
  warn: 'text-amber-300',
  danger: 'text-blood-300',
  flavor: 'text-ash-400 italic',
  good: 'text-moss-300',
}

export function pct(v: number): string {
  return `${Math.round(v * 100)}%`
}

export function barClass(v: number, inverse = false): string {
  const x = inverse ? 1 - v : v
  if (x > 0.66) return 'bg-moss-500'
  if (x > 0.33) return 'bg-amber-500'
  return 'bg-blood-500'
}

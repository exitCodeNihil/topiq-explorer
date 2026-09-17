import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { AppSettings } from '../../shared/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const relativeFormatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

export function formatTimestamp(timestamp: string | number, format: AppSettings['timestampFormat'] = 'local'): string {
  const n = Number(timestamp)
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (format === 'utc') return new Date(n).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
  if (format === 'relative') {
    const sec = Math.round((n - Date.now()) / 1000)
    const abs = Math.abs(sec)
    if (abs < 60) return relativeFormatter.format(sec, 'second')
    if (abs < 3600) return relativeFormatter.format(Math.round(sec / 60), 'minute')
    if (abs < 86400) return relativeFormatter.format(Math.round(sec / 3600), 'hour')
    return relativeFormatter.format(Math.round(sec / 86400), 'day')
  }
  return new Date(n).toLocaleString()
}

export function tryParseJson(str: string): { parsed: unknown; isJson: boolean } {
  try {
    const parsed = JSON.parse(str)
    return { parsed, isJson: true }
  } catch {
    return { parsed: str, isJson: false }
  }
}

export function formatJson(str: string): string {
  const { parsed, isJson } = tryParseJson(str)
  if (isJson) {
    return JSON.stringify(parsed, null, 2)
  }
  return str
}

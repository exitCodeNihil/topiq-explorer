import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTimestamp(timestamp: string | number): string {
  const n = Number(timestamp)
  return Number.isFinite(n) && n > 0 ? new Date(n).toLocaleString() : '—'
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

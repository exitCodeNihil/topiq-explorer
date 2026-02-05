import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat().format(num)
}

export function formatTimestamp(timestamp: string | number): string {
  const date = new Date(typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp)
  return date.toLocaleString()
}

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'just now'
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

export const CONNECTION_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#96CEB4', // Green
  '#FFEAA7', // Yellow
  '#DDA0DD', // Plum
  '#98D8C8', // Mint
  '#F7DC6F', // Gold
  '#BB8FCE', // Purple
  '#85C1E9', // Light Blue
]

export function getRandomColor(): string {
  return CONNECTION_COLORS[Math.floor(Math.random() * CONNECTION_COLORS.length)]
}

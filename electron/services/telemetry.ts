import { app } from 'electron'
import os from 'os'
import { getInstallId, getLastHeartbeatAt, getSettings, setLastHeartbeatAt } from './settings'

// Injected by vite at build time from the POSTHOG_KEY env var (see vite.config.ts); empty = telemetry off.
declare const __POSTHOG_KEY__: string
const POSTHOG_KEY = __POSTHOG_KEY__
const POSTHOG_HOST = 'https://eu.i.posthog.com'
const HEARTBEAT_INTERVAL_MS = 24 * 60 * 60 * 1000
const FLUSH_DELAY_MS = 10_000
const MAX_QUEUE = 100

const enabled = () => Boolean(POSTHOG_KEY) && getSettings().telemetryEnabled

// Every event is anonymous: install ID only, counts and booleans, never brokers, topics, keys or payloads.
type Props = Record<string, string | number | boolean | null>

interface Event {
  event: string
  distinct_id: string
  timestamp: string
  properties: Props
}

const queue: Event[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let flushing: Promise<void> | null = null

function baseProps(): Props {
  return {
    app_version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    // Anonymous event: PostHog keeps no person profile for it
    $process_person_profile: false
  }
}

// Queue a feature-usage event; flushed in a batch shortly after, or on quit.
export function track(event: string, properties: Props = {}): void {
  if (!enabled()) return
  if (queue.length >= MAX_QUEUE) queue.shift()
  queue.push({ event, distinct_id: getInstallId(), timestamp: new Date().toISOString(), properties: { ...baseProps(), ...properties } })
  if (!flushTimer) flushTimer = setTimeout(() => void flushTelemetry(), FLUSH_DELAY_MS)
}

// Called when the user turns telemetry off: drop anything not yet sent
export function clearTelemetryQueue(): void {
  queue.length = 0
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
}

export async function flushTelemetry(): Promise<void> {
  if (flushing) return flushing
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  if (queue.length === 0) return
  const batch = queue.splice(0, queue.length)

  if (process.env.VITE_DEV_SERVER_URL) {
    console.log(`[telemetry] dev mode, not sending ${batch.length} event(s):`, JSON.stringify(batch.map((e) => ({ event: e.event, properties: e.properties }))))
    return
  }

  flushing = (async () => {
    try {
      const res = await fetch(`${POSTHOG_HOST}/batch/`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // sent_at lets PostHog correct for client clock skew when placing events in time
        body: JSON.stringify({ api_key: POSTHOG_KEY, sent_at: new Date().toISOString(), batch }),
        signal: AbortSignal.timeout(5000)
      })
      console.log(`[telemetry] sent ${batch.length} event(s): ${res.status}`)
    } catch {
      // Telemetry must never affect the app; dropped events are not retried
    } finally {
      flushing = null
    }
  })()
  return flushing
}

// One heartbeat per install per day, so "unique users of app_heartbeat" = active installs.
export async function sendHeartbeat(reason: 'startup' | 'enabled'): Promise<void> {
  if (!enabled()) return
  const last = getLastHeartbeatAt()
  if (reason === 'startup' && Date.now() - last < HEARTBEAT_INTERVAL_MS) return

  track('app_heartbeat', {
    os_version: os.release(),
    locale: app.getLocale(),
    first_run: last === 0,
    reason
  })
  setLastHeartbeatAt(Date.now())
  await flushTelemetry()
}

import { app } from 'electron'
import Store from 'electron-store'
import { randomUUID } from 'crypto'
import os from 'os'
import { getStorePath } from './connection.store'
import type { AppSettings } from '../../shared/types'

// Injected by vite at build time from the POSTHOG_KEY env var (see vite.config.ts); empty = telemetry off.
declare const __POSTHOG_KEY__: string
const POSTHOG_KEY = __POSTHOG_KEY__
const POSTHOG_HOST = 'https://eu.i.posthog.com'
const HEARTBEAT_INTERVAL_MS = 24 * 60 * 60 * 1000
const FLUSH_DELAY_MS = 10_000
const MAX_QUEUE = 100

interface SettingsSchema extends AppSettings {
  installId: string
  lastHeartbeatAt: number
}

const storeName = 'topiq-explorer-settings'
// Plain (unencrypted) file: nothing in it is sensitive, and deleting it resets the install ID.
const store = new Store<SettingsSchema>({
  name: storeName,
  cwd: getStorePath(storeName).replace(`/${storeName}.json`, ''),
  defaults: { installId: '', telemetryEnabled: true, lastHeartbeatAt: 0 },
  clearInvalidConfig: true
})

function installId(): string {
  let id = store.get('installId')
  if (!id) {
    id = randomUUID()
    store.set('installId', id)
  }
  return id
}

export function getSettings(): AppSettings {
  return { telemetryEnabled: store.get('telemetryEnabled') }
}

export function setSettings(patch: Partial<AppSettings>): AppSettings {
  const wasEnabled = store.get('telemetryEnabled')
  if (patch.telemetryEnabled !== undefined) store.set('telemetryEnabled', patch.telemetryEnabled)
  if (!wasEnabled && patch.telemetryEnabled) void sendHeartbeat('enabled')
  if (wasEnabled && patch.telemetryEnabled === false) queue.length = 0
  return getSettings()
}

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
  if (!POSTHOG_KEY || !store.get('telemetryEnabled')) return
  if (queue.length >= MAX_QUEUE) queue.shift()
  queue.push({ event, distinct_id: installId(), timestamp: new Date().toISOString(), properties: { ...baseProps(), ...properties } })
  if (!flushTimer) flushTimer = setTimeout(() => void flushTelemetry(), FLUSH_DELAY_MS)
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
  if (!POSTHOG_KEY || !store.get('telemetryEnabled')) return
  const last = store.get('lastHeartbeatAt')
  if (reason === 'startup' && Date.now() - last < HEARTBEAT_INTERVAL_MS) return

  track('app_heartbeat', {
    os_version: os.release(),
    locale: app.getLocale(),
    first_run: last === 0,
    reason
  })
  store.set('lastHeartbeatAt', Date.now())
  await flushTelemetry()
}

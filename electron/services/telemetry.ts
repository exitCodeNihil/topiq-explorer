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
  return getSettings()
}

// One anonymous ping per install per day. No machine ID, no connection details, no message content.
export async function sendHeartbeat(reason: 'startup' | 'enabled'): Promise<void> {
  if (!POSTHOG_KEY || !store.get('telemetryEnabled')) return
  const last = store.get('lastHeartbeatAt')
  if (reason === 'startup' && Date.now() - last < HEARTBEAT_INTERVAL_MS) return

  const payload = {
    event: 'app_heartbeat',
    distinct_id: installId(),
    timestamp: new Date().toISOString(),
    properties: {
      app_version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      os_version: os.release(),
      locale: app.getLocale(),
      first_run: last === 0,
      reason,
      // Anonymous event: PostHog keeps no person profile for it
      $process_person_profile: false
    }
  }

  if (process.env.VITE_DEV_SERVER_URL) {
    console.log('[telemetry] dev mode, not sending:', JSON.stringify(payload))
    return
  }

  try {
    const res = await fetch(`${POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ api_key: POSTHOG_KEY, ...payload }),
      signal: AbortSignal.timeout(5000)
    })
    if (res.ok) store.set('lastHeartbeatAt', Date.now())
    console.log(`[telemetry] heartbeat ${res.status}`)
  } catch {
    // Telemetry must never affect the app
  }
}

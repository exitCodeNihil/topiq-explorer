import { shell } from 'electron'
import Store from 'electron-store'
import { randomUUID } from 'crypto'
import { getStorePath } from './connection.store'
import { APP_SETTINGS_DEFAULTS, APP_SETTING_OPTIONS } from '../../shared/types'
import type { AppSettings } from '../../shared/types'

interface SettingsSchema extends AppSettings {
  installId: string
  lastHeartbeatAt: number
}

const storeName = 'topiq-explorer-settings'
const storeDir = getStorePath(storeName).replace(`/${storeName}.json`, '')

// Plain (unencrypted) file: nothing in it is sensitive, and deleting it resets the install ID.
const store = new Store<SettingsSchema>({
  name: storeName,
  cwd: storeDir,
  defaults: { ...APP_SETTINGS_DEFAULTS, installId: '', lastHeartbeatAt: 0 },
  clearInvalidConfig: true
})

const SETTING_KEYS = Object.keys(APP_SETTINGS_DEFAULTS) as (keyof AppSettings)[]

export function getSettings(): AppSettings {
  const out = { ...APP_SETTINGS_DEFAULTS }
  for (const key of SETTING_KEYS) {
    const value = store.get(key)
    if (value !== undefined) (out as Record<string, unknown>)[key] = value
  }
  return out
}

export function setSettings(patch: Partial<AppSettings>): AppSettings {
  for (const key of SETTING_KEYS) {
    const value = patch[key]
    if (value !== undefined) store.set(key, value as never)
  }
  return getSettings()
}

// Renderer input: only known keys, each with an allowed value
export function validateSettingsPatch(patch: unknown): asserts patch is Partial<AppSettings> {
  if (patch == null || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('Invalid settings')
  for (const [key, value] of Object.entries(patch)) {
    const options = (APP_SETTING_OPTIONS as Record<string, readonly unknown[]>)[key]
    const ok = options ? options.includes(value) : SETTING_KEYS.includes(key as keyof AppSettings) && typeof value === 'boolean'
    if (!ok) throw new Error(`Invalid setting: ${key}`)
  }
}

export function getInstallId(): string {
  let id = store.get('installId')
  if (!id) {
    id = randomUUID()
    store.set('installId', id)
  }
  return id
}

export function resetInstallId(): void {
  store.set('installId', randomUUID())
  store.set('lastHeartbeatAt', 0)
}

export function getLastHeartbeatAt(): number {
  return store.get('lastHeartbeatAt')
}

export function setLastHeartbeatAt(at: number): void {
  store.set('lastHeartbeatAt', at)
}

export async function openDataFolder(): Promise<void> {
  const error = await shell.openPath(storeDir)
  if (error) throw new Error(error)
}

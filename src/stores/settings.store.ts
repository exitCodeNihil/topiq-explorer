import { create } from 'zustand'
import type { AppSettings } from '../../shared/types'
import { APP_SETTINGS_DEFAULTS } from '../../shared/types'

interface SettingsState {
  settings: AppSettings
  loaded: boolean
  load: () => Promise<void>
  update: (patch: Partial<AppSettings>) => Promise<void>
}

const systemDark = window.matchMedia('(prefers-color-scheme: dark)')

function applyTheme(theme: AppSettings['theme']) {
  const dark = theme === 'system' ? systemDark.matches : theme === 'dark'
  document.documentElement.classList.toggle('dark', dark)
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: APP_SETTINGS_DEFAULTS,
  loaded: false,

  load: async () => {
    const result = await window.api.settings.get()
    if (!result.success) return
    set({ settings: result.data, loaded: true })
    applyTheme(result.data.theme)
  },

  update: async (patch) => {
    // Optimistic: apply immediately, then reconcile with what main persisted
    set((s) => ({ settings: { ...s.settings, ...patch } }))
    if (patch.theme) applyTheme(patch.theme)
    const result = await window.api.settings.set(patch).catch(() => null)
    if (result?.success) {
      set({ settings: result.data })
      applyTheme(result.data.theme)
    } else {
      // Revert to the last persisted state on failure
      await get().load()
    }
  }
}))

// Follow OS theme changes while "System" is selected
systemDark.addEventListener('change', () => {
  if (useSettingsStore.getState().settings.theme === 'system') applyTheme('system')
})

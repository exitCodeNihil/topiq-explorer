import { create } from 'zustand'

interface ThemeState {
  theme: 'dark'
  resolvedTheme: 'dark'
  initializeTheme: () => void
}

function applyTheme() {
  document.documentElement.classList.add('dark')
}

export const useThemeStore = create<ThemeState>(() => ({
  theme: 'dark',
  resolvedTheme: 'dark',

  initializeTheme: () => {
    applyTheme()
  },
}))

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'

// PostHog project key is injected at build time from the environment, never committed.
// Production builds require it unless TELEMETRY=off; `vite` dev serve never sends anyway.
function posthogKey(command: 'build' | 'serve'): string {
  if (command !== 'build' || process.env.TELEMETRY === 'off') return ''
  const key = process.env.POSTHOG_KEY
  if (!key) throw new Error('POSTHOG_KEY is not set. Export it (or set the GitHub secret), or build with TELEMETRY=off.')
  return key
}

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        onstart(options) {
          options.startup()
        },
        vite: {
          define: {
            __POSTHOG_KEY__: JSON.stringify(posthogKey(command))
          },
          build: {
            target: 'node22',
            outDir: 'dist-electron',
            emptyOutDir: true, // main builds first; stale tsc output must not ship
            rollupOptions: {
              external: ['electron', 'electron-store', 'kafkajs']
            }
          }
        }
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            target: 'node22',
            outDir: 'dist-electron'
          }
        }
      }
    ]),
    renderer()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: true
  }
}))

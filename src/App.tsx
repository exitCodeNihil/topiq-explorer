import { useEffect } from 'react'
import { MainLayout } from './components/layout/MainLayout'
import { Toaster } from './components/ui/toaster'
import { useConnectionStore } from './stores/connection.store'
import { useThemeStore } from './stores/theme.store'

export default function App() {
  const loadConnections = useConnectionStore((state) => state.loadConnections)
  const initializeTheme = useThemeStore((state) => state.initializeTheme)

  useEffect(() => {
    initializeTheme()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initializeTheme is a stable store action
  }, [])

  useEffect(() => {
    loadConnections()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadConnections is a stable store action
  }, [])

  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground font-sans antialiased">
      <MainLayout />
      <Toaster />
    </div>
  )
}

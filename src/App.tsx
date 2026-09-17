import { useEffect } from 'react'
import { MainLayout } from './components/layout/MainLayout'
import { Toaster } from './components/ui/toaster'
import { useConnectionStore } from './stores/connection.store'
import { useSettingsStore } from './stores/settings.store'

export default function App() {
  const loadConnections = useConnectionStore((state) => state.loadConnections)

  useEffect(() => {
    useSettingsStore.getState().load()
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

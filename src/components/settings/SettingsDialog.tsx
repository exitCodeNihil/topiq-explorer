import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  // null until loaded, so the checkbox can't flash the wrong state
  const [telemetryEnabled, setTelemetryEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    if (!open) return
    window.api.settings
      .get()
      .then((r) => {
        if (r.success) setTelemetryEnabled(r.data.telemetryEnabled)
      })
      .catch(() => {})
  }, [open])

  const toggle = async (enabled: boolean) => {
    setTelemetryEnabled(enabled)
    const r = await window.api.settings.set({ telemetryEnabled: enabled }).catch(() => null)
    if (r?.success) setTelemetryEnabled(r.data.telemetryEnabled)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Preferences for this installation.</DialogDescription>
        </DialogHeader>
        <label htmlFor="telemetry" className="flex cursor-pointer items-start gap-3">
          <input
            id="telemetry"
            type="checkbox"
            className="mt-1 h-4 w-4 accent-accent-active"
            checked={telemetryEnabled ?? false}
            disabled={telemetryEnabled === null}
            onChange={(e) => toggle(e.target.checked)}
          />
          <span className="space-y-1">
            <span className="block text-sm font-medium text-text-primary">Send anonymous usage statistics</span>
            <span className="block text-xs text-text-secondary">
              The app sends an anonymous install ID, app version, OS and locale once a day, plus which features are
              used (counts only) to PostHog so we know how many people use Topiq and what matters to them. Your
              country is derived from your IP address, which is not stored. Broker addresses, credentials, topic
              names, keys and message contents are never sent.
            </span>
          </span>
        </label>
      </DialogContent>
    </Dialog>
  )
}

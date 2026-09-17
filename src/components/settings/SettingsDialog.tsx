import { useEffect, useState } from 'react'
import { Bug, Lightbulb, MessageCircleQuestion, ExternalLink, RefreshCw } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { useSettingsStore } from '@/stores/settings.store'
import { APP_SETTING_OPTIONS, type AppSettings } from '../../../shared/types'
import { cn } from '@/lib/utils'

const REPO = 'https://github.com/exitCodeNihil/topiq-explorer'
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-active focus-visible:ring-offset-2 focus-visible:ring-offset-bg-sidebar'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const THEMES: { value: AppSettings['theme']; label: string; hint: string; swatch: string }[] = [
  { value: 'dark', label: 'Dark', hint: 'Always dark', swatch: 'bg-[#0D0F12] border-[#2D3139]' },
  { value: 'light', label: 'Light', hint: 'Always light', swatch: 'bg-white border-[#D1D5DB]' },
  { value: 'system', label: 'System', hint: 'Follow the OS', swatch: 'bg-gradient-to-r from-[#0D0F12] from-50% to-white to-50% border-[#6B7280]' }
]

const PAGE_SIZES = APP_SETTING_OPTIONS.messagePageSize
const VALUE_FORMATS: Record<AppSettings['messageValueFormat'], string> = { auto: 'Pretty-print JSON when possible', raw: 'Raw' }
const TIMESTAMP_FORMATS: Record<AppSettings['timestampFormat'], string> = { local: 'Local time', utc: 'UTC', relative: 'Relative (2 minutes ago)' }

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm text-text-primary">{label}</Label>
      {children}
      {hint && <p className="text-xs text-text-secondary">{hint}</p>}
    </div>
  )
}

function Check({ id, label, hint, checked, onChange }: { id: string; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
      <input id={id} type="checkbox" className={cn('mt-1 h-4 w-4 accent-accent-active', FOCUS)} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="space-y-1">
        <span className="block text-sm font-medium text-text-primary">{label}</span>
        {hint && <span className="block text-xs text-text-secondary">{hint}</span>}
      </span>
    </label>
  )
}

type CheckState = 'idle' | 'checking' | 'up-to-date' | 'update-available' | 'error'

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const settings = useSettingsStore((s) => s.settings)
  const update = useSettingsStore((s) => s.update)
  const [version, setVersion] = useState('')
  const [checkState, setCheckState] = useState<CheckState>('idle')
  const [availableVersion, setAvailableVersion] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)

  useEffect(() => {
    if (open) window.api.updater.getVersion().then(setVersion).catch(() => {})
  }, [open])

  const checkNow = async () => {
    setCheckState('checking')
    try {
      const r = await window.api.updater.checkForUpdates()
      if (r.updateAvailable) {
        setAvailableVersion(r.version)
        setCheckState('update-available')
      } else {
        setCheckState('up-to-date')
      }
    } catch {
      setCheckState('error')
    }
  }

  const openExternal = (url: string) => window.api.shell.openExternal(url).catch(() => {})
  const issue = (template: string, extra = '') => `${REPO}/issues/new?template=${template}${extra}`

  const checkLabel =
    checkState === 'checking' ? 'Checking…' :
    checkState === 'up-to-date' ? 'Up to date' :
    checkState === 'update-available' ? `v${availableVersion} available` :
    checkState === 'error' ? 'Check failed' : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription className="sr-only">Preferences for this installation. Changes are saved immediately.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="appearance" className="px-6 pb-6">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="updates">Updates</TabsTrigger>
            <TabsTrigger value="privacy">Privacy</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
          </TabsList>

          <TabsContent value="appearance" className="min-h-[300px] pt-4">
            <fieldset className="space-y-3">
              <legend className="text-sm text-text-primary">Theme</legend>
              <div className="grid grid-cols-3 gap-3">
                {THEMES.map((t) => {
                  const id = `theme-${t.value}`
                  const active = settings.theme === t.value
                  return (
                    <label
                      key={t.value}
                      htmlFor={id}
                      className={cn(
                        'flex cursor-pointer flex-col gap-2 rounded-md border p-3 transition-colors',
                        active ? 'border-accent-active bg-bg-panel' : 'border-border-mute hover:bg-bg-panel',
                        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent-active has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-bg-sidebar'
                      )}
                    >
                      <input
                        id={id}
                        type="radio"
                        name="theme"
                        value={t.value}
                        checked={active}
                        onChange={() => update({ theme: t.value })}
                        className="sr-only"
                      />
                      <span aria-hidden className={cn('block h-6 w-10 rounded border', t.swatch)} />
                      <span className="text-sm font-medium text-text-primary">{t.label}</span>
                      <span className="text-xs text-text-secondary">{t.hint}</span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          </TabsContent>

          <TabsContent value="messages" className="min-h-[300px] space-y-5 pt-4">
            <Field id="page-size" label="Messages per page" hint="Default page size when opening a topic.">
              <Select value={String(settings.messagePageSize)} onValueChange={(v) => update({ messagePageSize: Number(v) as AppSettings['messagePageSize'] })}>
                <SelectTrigger id="page-size"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((n) => <SelectItem key={n} value={String(n)}>{n} messages</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field id="value-format" label="Value display">
              <Select value={settings.messageValueFormat} onValueChange={(v) => update({ messageValueFormat: v as AppSettings['messageValueFormat'] })}>
                <SelectTrigger id="value-format"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {APP_SETTING_OPTIONS.messageValueFormat.map((v) => <SelectItem key={v} value={v}>{VALUE_FORMATS[v]}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field id="timestamp-format" label="Timestamps">
              <Select value={settings.timestampFormat} onValueChange={(v) => update({ timestampFormat: v as AppSettings['timestampFormat'] })}>
                <SelectTrigger id="timestamp-format"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {APP_SETTING_OPTIONS.timestampFormat.map((v) => <SelectItem key={v} value={v}>{TIMESTAMP_FORMATS[v]}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </TabsContent>

          <TabsContent value="updates" className="min-h-[300px] space-y-5 pt-4">
            <Check id="check-startup" label="Check for updates on startup" checked={settings.checkUpdatesOnStartup} onChange={(v) => update({ checkUpdatesOnStartup: v })} />
            <Check id="prerelease" label="Include pre-releases" hint="Offer beta builds as updates. They may be less stable." checked={settings.allowPrerelease} onChange={(v) => update({ allowPrerelease: v })} />
            <div className="flex items-center gap-3 pt-1">
              <Button variant="secondary" size="sm" onClick={checkNow} disabled={checkState === 'checking'}>
                <RefreshCw className={cn('mr-2 h-4 w-4', checkState === 'checking' && 'animate-spin')} />
                Check now
              </Button>
              <span className="text-xs text-text-secondary" aria-live="polite">{checkLabel}</span>
            </div>
          </TabsContent>

          <TabsContent value="privacy" className="min-h-[300px] space-y-5 pt-4">
            <Check
              id="telemetry"
              label="Send anonymous usage statistics"
              hint="The app sends an anonymous install ID, app version, OS and locale once a day, plus which features are used (counts only) to PostHog so we know how many people use Topiq and what matters to them. Your country is derived from your IP address, which is not stored. Broker addresses, credentials, topic names, keys and message contents are never sent."
              checked={settings.telemetryEnabled}
              onChange={(v) => update({ telemetryEnabled: v })}
            />
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" size="sm" onClick={() => setConfirmReset(true)}>Reset anonymous install ID</Button>
              <Button variant="secondary" size="sm" onClick={() => window.api.settings.openDataFolder().catch(() => {})}>Open data folder</Button>
            </div>
          </TabsContent>

          <TabsContent value="about" className="min-h-[300px] space-y-5 pt-4">
            <div>
              <p className="text-sm font-medium text-text-primary">Topiq Explorer</p>
              <p className="font-mono text-xs text-text-secondary">v{version || '…'}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" size="sm" onClick={() => openExternal(REPO)}>
                Repository <ExternalLink className="ml-2 h-3.5 w-3.5" />
              </Button>
              <Button variant="secondary" size="sm" onClick={() => openExternal(`${REPO}/releases`)}>
                Releases <ExternalLink className="ml-2 h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-text-primary">Feedback</p>
              <p className="text-xs text-text-secondary">Opens a pre-filled form on GitHub in your browser.</p>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" size="sm" onClick={() => openExternal(issue('bug_report.yml', `&version=${encodeURIComponent(version)}&os=${encodeURIComponent(window.api.platform)}`))}>
                  <Bug className="mr-2 h-4 w-4" /> Report a bug
                </Button>
                <Button variant="outline" size="sm" onClick={() => openExternal(issue('feature_request.yml'))}>
                  <Lightbulb className="mr-2 h-4 w-4" /> Request a feature
                </Button>
                <Button variant="outline" size="sm" onClick={() => openExternal(issue('question.yml'))}>
                  <MessageCircleQuestion className="mr-2 h-4 w-4" /> Ask a question
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset anonymous install ID?</AlertDialogTitle>
            <AlertDialogDescription>
              A new random ID is generated. Past usage statistics can no longer be linked to this installation. Nothing else changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => window.api.settings.resetInstallId().catch(() => {})}>Reset</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}

import { useState } from 'react'
import { useConnectionStore } from '@/stores/connection.store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import type { KafkaConnection, TLSConfig } from '@/types/kafka.types'
import { Loader2, Check, X, Upload, SlidersHorizontal, ChevronDown } from 'lucide-react'

interface CertFile {
  filename: string
  content: string
}

function getInitialSecurityProtocol(connection?: KafkaConnection | null): string {
  if (!connection) return 'PLAINTEXT'
  const hasSsl = connection.ssl === true || (typeof connection.ssl === 'object' && connection.ssl !== null)
  const hasSasl = !!connection.sasl
  if (hasSasl && hasSsl) return 'SASL_SSL'
  if (hasSasl) return 'SASL_PLAINTEXT'
  if (hasSsl) return 'SSL'
  return 'PLAINTEXT'
}

function getInitialCertFile(value: string | undefined): CertFile | null {
  if (!value) return null
  return { filename: 'loaded from connection', content: value }
}

interface ConnectionFormProps {
  connection?: KafkaConnection | null
  onClose: () => void
}

export function ConnectionForm({ connection, onClose }: ConnectionFormProps) {
  const existingSsl = connection?.ssl
  const existingTls = typeof existingSsl === 'object' && existingSsl !== null ? existingSsl as TLSConfig : null

  const [name, setName] = useState(connection?.name || '')
  const [brokers, setBrokers] = useState(connection?.brokers.join(', ') || '')
  const [securityProtocol, setSecurityProtocol] = useState(getInitialSecurityProtocol(connection))
  const [advancedOpen, setAdvancedOpen] = useState(false)

  // TLS fields
  const [caCert, setCaCert] = useState<CertFile | null>(getInitialCertFile(existingTls?.ca))
  const [clientCert, setClientCert] = useState<CertFile | null>(getInitialCertFile(existingTls?.cert))
  const [clientKey, setClientKey] = useState<CertFile | null>(getInitialCertFile(existingTls?.key))
  const [passphrase, setPassphrase] = useState(existingTls?.passphrase || '')
  const [rejectUnauthorized, setRejectUnauthorized] = useState(existingTls?.rejectUnauthorized !== false)

  // SASL fields
  const [saslMechanism, setSaslMechanism] = useState<'plain' | 'scram-sha-256' | 'scram-sha-512'>(
    connection?.sasl?.mechanism || 'plain'
  )
  const [username, setUsername] = useState(connection?.sasl?.username || '')
  const [password, setPassword] = useState(connection?.sasl?.password || '')

  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const addConnection = useConnectionStore((state) => state.addConnection)
  const updateConnection = useConnectionStore((state) => state.updateConnection)
  const testConnection = useConnectionStore((state) => state.testConnection)

  const useSsl = securityProtocol === 'SSL' || securityProtocol === 'SASL_SSL'
  const useSasl = securityProtocol === 'SASL_PLAINTEXT' || securityProtocol === 'SASL_SSL'

  const handlePickCertFile = async (
    setter: (file: CertFile | null) => void
  ) => {
    try {
      const result = await window.api.connections.pickCertFile()
      if (!result.success) {
        toast({
          title: 'Invalid File',
          description: result.error,
          variant: 'destructive'
        })
        return
      }
      if (result.data) {
        setter(result.data)
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to pick certificate file',
        variant: 'destructive'
      })
    }
  }

  const getSslValue = (): boolean | TLSConfig | undefined => {
    if (!useSsl) return undefined

    if (!caCert && !clientCert && !clientKey && !passphrase && rejectUnauthorized) {
      return true
    }

    const tlsConfig: TLSConfig = {}
    if (caCert) tlsConfig.ca = caCert.content
    if (clientCert) tlsConfig.cert = clientCert.content
    if (clientKey) tlsConfig.key = clientKey.content
    if (passphrase) tlsConfig.passphrase = passphrase
    if (!rejectUnauthorized) tlsConfig.rejectUnauthorized = false

    if (Object.keys(tlsConfig).length === 0) return true

    return tlsConfig
  }

  const getConnectionData = () => ({
    name: name.trim(),
    brokers: brokers.split(',').map((b) => b.trim()).filter(Boolean),
    ssl: getSslValue(),
    sasl:
      useSasl
        ? {
            mechanism: saslMechanism,
            username,
            password
          }
        : undefined,
  })

  const handleTest = async () => {
    setIsTesting(true)
    setTestResult(null)
    try {
      const result = await testConnection(getConnectionData())
      setTestResult(result)
    } catch (error) {
      setTestResult({ success: false, error: error instanceof Error ? error.message : 'Test failed' })
    } finally {
      setIsTesting(false)
    }
  }

  const handleSave = async () => {
    if (!name.trim() || !brokers.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Name and brokers are required',
        variant: 'destructive'
      })
      return
    }

    setIsSaving(true)
    try {
      const data = getConnectionData()
      if (connection) {
        await updateConnection({ ...connection, ...data })
        toast({ title: 'Updated', description: 'Connection updated successfully' })
      } else {
        await addConnection(data)
        toast({ title: 'Created', description: 'Connection created successfully' })
      }
      onClose()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save connection',
        variant: 'destructive'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const CertFileInput = ({
    label,
    value,
    onChange
  }: {
    label: string
    value: CertFile | null
    onChange: (file: CertFile | null) => void
  }) => (
    <div className="space-y-1">
      <Label className="text-text-secondary text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        {value ? (
          <>
            <span className="flex-1 truncate rounded-md border border-border-mute bg-bg-main px-3 py-2 text-sm font-mono text-text-secondary">
              {value.filename}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => onChange(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => handlePickCertFile(onChange)}
          >
            <Upload className="h-4 w-4" />
            Select File
          </Button>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col">
      <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-text-secondary text-xs">Connection Name</Label>
          <Input
            id="name"
            placeholder="My Kafka Cluster"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="brokers" className="text-text-secondary text-xs">Bootstrap Servers</Label>
          <Input
            id="brokers"
            placeholder="localhost:9092, localhost:9093"
            value={brokers}
            onChange={(e) => setBrokers(e.target.value)}
            className="font-mono"
          />
          <p className="text-[10px] text-text-secondary/60">Comma-separated list of broker addresses</p>
        </div>

        <div className="space-y-2">
          <Label className="text-text-secondary text-xs">Security Protocol</Label>
          <Select value={securityProtocol} onValueChange={setSecurityProtocol}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PLAINTEXT">PLAINTEXT</SelectItem>
              <SelectItem value="SSL">SSL</SelectItem>
              <SelectItem value="SASL_PLAINTEXT">SASL_PLAINTEXT</SelectItem>
              <SelectItem value="SASL_SSL">SASL_SSL</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {useSasl && (
          <div className="space-y-4 rounded-md border border-border-mute bg-bg-main/30 p-4">
            <div className="space-y-2">
              <Label className="text-text-secondary text-xs">SASL Mechanism</Label>
              <Select value={saslMechanism} onValueChange={(v) => setSaslMechanism(v as typeof saslMechanism)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="plain">PLAIN</SelectItem>
                  <SelectItem value="scram-sha-256">SCRAM-SHA-256</SelectItem>
                  <SelectItem value="scram-sha-512">SCRAM-SHA-512</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username" className="text-text-secondary text-xs">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-text-secondary text-xs">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Advanced Options */}
        {useSsl && (
          <div>
            <button
              type="button"
              onClick={() => setAdvancedOpen(!advancedOpen)}
              className="flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary transition-colors w-full py-2"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Advanced Options</span>
              <ChevronDown className={`h-3.5 w-3.5 ml-auto transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
            </button>

            {advancedOpen && (
              <div className="space-y-4 rounded-md border border-border-mute bg-bg-main/30 p-4 mt-2">
                <CertFileInput label="CA Certificate" value={caCert} onChange={setCaCert} />
                <CertFileInput label="Client Certificate" value={clientCert} onChange={setClientCert} />
                <CertFileInput label="Client Key" value={clientKey} onChange={setClientKey} />

                <div className="space-y-1">
                  <Label htmlFor="passphrase" className="text-text-secondary text-xs">Key Passphrase</Label>
                  <Input
                    id="passphrase"
                    type="password"
                    placeholder="Leave empty if key is not encrypted"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="rejectUnauthorized"
                      checked={!rejectUnauthorized}
                      onChange={(e) => setRejectUnauthorized(!e.target.checked)}
                      className="h-4 w-4 rounded border-border-mute accent-accent-active"
                    />
                    <Label htmlFor="rejectUnauthorized" className="cursor-pointer text-text-secondary text-xs">
                      Skip certificate verification
                    </Label>
                  </div>
                  {!rejectUnauthorized && (
                    <p className="text-[10px] text-amber-500">
                      Warning: Disabling certificate verification makes the connection vulnerable to man-in-the-middle attacks.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {testResult && (
          <div
            className={`flex items-center gap-2 rounded-md p-3 text-sm ${
              testResult.success
                ? 'bg-accent-active/10 text-accent-active'
                : 'bg-destructive/10 text-destructive'
            }`}
          >
            {testResult.success ? (
              <>
                <Check className="h-4 w-4" />
                Connection successful
              </>
            ) : (
              <>
                <X className="h-4 w-4" />
                {testResult.error || 'Connection failed'}
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 pb-6 pt-4 border-t border-border-mute">
        <Button variant="outline" onClick={handleTest} disabled={isTesting || !brokers.trim()} size="sm">
          {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Test Connection
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onClose} size="sm">
            Cancel
          </Button>
          <Button variant="accent" onClick={handleSave} disabled={isSaving || !name.trim() || !brokers.trim()} size="sm">
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {connection ? 'Update' : 'Connect'}
          </Button>
        </div>
      </div>
    </div>
  )
}

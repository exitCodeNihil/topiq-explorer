import { useState } from 'react'
import { useConnectionStore } from '@/stores/connection.store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { getRandomColor, CONNECTION_COLORS } from '@/lib/utils'
import type { KafkaConnection } from '@/types/kafka.types'
import { Loader2, Check, X } from 'lucide-react'

interface ConnectionFormProps {
  connection?: KafkaConnection | null
  onClose: () => void
}

export function ConnectionForm({ connection, onClose }: ConnectionFormProps) {
  const [name, setName] = useState(connection?.name || '')
  const [brokers, setBrokers] = useState(connection?.brokers.join(', ') || '')
  const [ssl, setSsl] = useState(connection?.ssl || false)
  const [authType, setAuthType] = useState<'none' | 'sasl'>(connection?.sasl ? 'sasl' : 'none')
  const [saslMechanism, setSaslMechanism] = useState<'plain' | 'scram-sha-256' | 'scram-sha-512'>(
    connection?.sasl?.mechanism || 'plain'
  )
  const [username, setUsername] = useState(connection?.sasl?.username || '')
  const [password, setPassword] = useState(connection?.sasl?.password || '')
  const [color, setColor] = useState(connection?.color || getRandomColor())

  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const addConnection = useConnectionStore((state) => state.addConnection)
  const updateConnection = useConnectionStore((state) => state.updateConnection)
  const testConnection = useConnectionStore((state) => state.testConnection)

  const getConnectionData = () => ({
    name: name.trim(),
    brokers: brokers.split(',').map((b) => b.trim()).filter(Boolean),
    ssl,
    sasl:
      authType === 'sasl'
        ? {
            mechanism: saslMechanism,
            username,
            password
          }
        : undefined,
    color
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

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Connection Name</Label>
        <Input
          id="name"
          placeholder="My Kafka Cluster"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="brokers">Bootstrap Servers</Label>
        <Input
          id="brokers"
          placeholder="localhost:9092, localhost:9093"
          value={brokers}
          onChange={(e) => setBrokers(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">Comma-separated list of broker addresses</p>
      </div>

      <div className="space-y-2">
        <Label>Color</Label>
        <div className="flex gap-2">
          {CONNECTION_COLORS.map((c) => (
            <button
              key={c}
              className={`h-6 w-6 rounded-full transition-transform ${
                color === c ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-110' : ''
              }`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="ssl"
            checked={ssl}
            onChange={(e) => setSsl(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          <Label htmlFor="ssl" className="cursor-pointer">
            Use SSL
          </Label>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Authentication</Label>
        <Select value={authType} onValueChange={(v) => setAuthType(v as 'none' | 'sasl')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="sasl">SASL</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {authType === 'sasl' && (
        <div className="space-y-4 rounded-md border border-border p-4">
          <div className="space-y-2">
            <Label>SASL Mechanism</Label>
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
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>
      )}

      {testResult && (
        <div
          className={`flex items-center gap-2 rounded-md p-3 text-sm ${
            testResult.success
              ? 'bg-success/10 text-success-foreground'
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

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="secondary" onClick={handleTest} disabled={isTesting || !brokers.trim()}>
          {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Test Connection
        </Button>
        <Button onClick={handleSave} disabled={isSaving || !name.trim() || !brokers.trim()}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {connection ? 'Update' : 'Create'}
        </Button>
      </div>
    </div>
  )
}

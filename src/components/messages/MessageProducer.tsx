import { useState } from 'react'
import { useTopicStore } from '@/stores/topic.store'
import { useConnectionStore } from '@/stores/connection.store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { Loader2, Plus, Trash2 } from 'lucide-react'

interface MessageProducerProps {
  topic: string
  onClose: () => void
}

interface Header {
  key: string
  value: string
}

export function MessageProducer({ topic, onClose }: MessageProducerProps) {
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const [partition, setPartition] = useState('')
  const [headers, setHeaders] = useState<Header[]>([])
  const [isSending, setIsSending] = useState(false)

  const produceMessage = useTopicStore((state) => state.produceMessage)
  const loadMessages = useTopicStore((state) => state.loadMessages)
  const activeConnectionId = useConnectionStore((state) => state.activeConnectionId)

  const addHeader = () => {
    setHeaders([...headers, { key: '', value: '' }])
  }

  const updateHeader = (index: number, field: 'key' | 'value', value: string) => {
    const newHeaders = [...headers]
    newHeaders[index][field] = value
    setHeaders(newHeaders)
  }

  const removeHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index))
  }

  const handleSend = async () => {
    if (!activeConnectionId || !value.trim()) return

    setIsSending(true)
    try {
      const messageHeaders: Record<string, string> = {}
      headers.forEach((h) => {
        if (h.key.trim()) {
          messageHeaders[h.key.trim()] = h.value
        }
      })

      await produceMessage(activeConnectionId, topic, {
        key: key.trim() || undefined,
        value: value,
        headers: Object.keys(messageHeaders).length > 0 ? messageHeaders : undefined,
        partition: partition ? parseInt(partition, 10) : undefined
      })

      toast({ title: 'Message Sent', description: 'Message has been produced to the topic' })

      // Refresh messages
      await loadMessages(activeConnectionId, topic, { limit: 100 })

      onClose()
    } catch (error) {
      toast({
        title: 'Send Failed',
        description: error instanceof Error ? error.message : 'Failed to send message',
        variant: 'destructive'
      })
    } finally {
      setIsSending(false)
    }
  }

  const formatValue = () => {
    try {
      const parsed = JSON.parse(value)
      setValue(JSON.stringify(parsed, null, 2))
    } catch {
      // Not valid JSON, leave as is
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="key">Key (optional)</Label>
          <Input
            id="key"
            placeholder="Message key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="partition">Partition (optional)</Label>
          <Input
            id="partition"
            type="number"
            placeholder="Auto"
            value={partition}
            onChange={(e) => setPartition(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="value">Value</Label>
          <Button variant="ghost" size="sm" onClick={formatValue}>
            Format JSON
          </Button>
        </div>
        <textarea
          id="value"
          className="w-full h-48 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          placeholder='{"example": "value"}'
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Headers (optional)</Label>
          <Button variant="ghost" size="sm" onClick={addHeader}>
            <Plus className="mr-1 h-4 w-4" />
            Add Header
          </Button>
        </div>
        {headers.length > 0 && (
          <div className="space-y-2">
            {headers.map((header, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  placeholder="Key"
                  value={header.key}
                  onChange={(e) => updateHeader(index, 'key', e.target.value)}
                  className="flex-1"
                />
                <Input
                  placeholder="Value"
                  value={header.value}
                  onChange={(e) => updateHeader(index, 'value', e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeHeader(index)}
                  className="h-10 w-10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSend} disabled={isSending || !value.trim()}>
          {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Send Message
        </Button>
      </div>
    </div>
  )
}

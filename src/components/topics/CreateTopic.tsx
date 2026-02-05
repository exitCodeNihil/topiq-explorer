import { useState } from 'react'
import { useTopicStore } from '@/stores/topic.store'
import { useConnectionStore } from '@/stores/connection.store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'

interface CreateTopicProps {
  onClose: () => void
}

export function CreateTopic({ onClose }: CreateTopicProps) {
  const [name, setName] = useState('')
  const [partitions, setPartitions] = useState('3')
  const [replicationFactor, setReplicationFactor] = useState('1')
  const [isSaving, setIsSaving] = useState(false)

  const createTopic = useTopicStore((state) => state.createTopic)
  const activeConnectionId = useConnectionStore((state) => state.activeConnectionId)

  const handleCreate = async () => {
    if (!activeConnectionId || !name.trim()) return

    setIsSaving(true)
    try {
      await createTopic(activeConnectionId, {
        name: name.trim(),
        numPartitions: parseInt(partitions, 10) || 3,
        replicationFactor: parseInt(replicationFactor, 10) || 1
      })
      toast({ title: 'Topic Created', description: `Topic "${name}" has been created` })
      onClose()
    } catch (error) {
      toast({
        title: 'Create Failed',
        description: error instanceof Error ? error.message : 'Failed to create topic',
        variant: 'destructive'
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="topic-name">Topic Name</Label>
        <Input
          id="topic-name"
          placeholder="my-topic"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="partitions">Partitions</Label>
          <Input
            id="partitions"
            type="number"
            min="1"
            value={partitions}
            onChange={(e) => setPartitions(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="replication">Replication Factor</Label>
          <Input
            id="replication"
            type="number"
            min="1"
            value={replicationFactor}
            onChange={(e) => setReplicationFactor(e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleCreate} disabled={isSaving || !name.trim()}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create Topic
        </Button>
      </div>
    </div>
  )
}

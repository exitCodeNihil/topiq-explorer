import { useState } from 'react'
import { useConsumerStore } from '@/stores/consumer.store'
import { useConnectionStore } from '@/stores/connection.store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'
import type { PartitionOffset, ResetOffsetOptions } from '@/types/kafka.types'

interface OffsetManagerProps {
  groupId: string
  topic: string
  partitions: PartitionOffset[]
  onClose: () => void
}

export function OffsetManager({ groupId, topic, partitions, onClose }: OffsetManagerProps) {
  const [resetType, setResetType] = useState<'earliest' | 'latest' | 'offset'>('latest')
  const [offset, setOffset] = useState('')
  const [selectedPartitions, setSelectedPartitions] = useState<number[]>(partitions.map((p) => p.partition))
  const [isResetting, setIsResetting] = useState(false)

  const resetOffsets = useConsumerStore((state) => state.resetOffsets)
  const activeConnectionId = useConnectionStore((state) => state.activeConnectionId)

  const togglePartition = (partition: number) => {
    if (selectedPartitions.includes(partition)) {
      setSelectedPartitions(selectedPartitions.filter((p) => p !== partition))
    } else {
      setSelectedPartitions([...selectedPartitions, partition])
    }
  }

  const selectAll = () => {
    setSelectedPartitions(partitions.map((p) => p.partition))
  }

  const deselectAll = () => {
    setSelectedPartitions([])
  }

  const handleReset = async () => {
    if (!activeConnectionId || selectedPartitions.length === 0) return

    setIsResetting(true)
    try {
      const options: ResetOffsetOptions = {
        type: resetType,
        partitions: selectedPartitions
      }

      if (resetType === 'offset') {
        options.offset = offset
      }

      await resetOffsets(activeConnectionId, groupId, topic, options)
      toast({
        title: 'Offsets Reset',
        description: `Successfully reset offsets for ${selectedPartitions.length} partition(s)`
      })
      onClose()
    } catch (error) {
      toast({
        title: 'Reset Failed',
        description: error instanceof Error ? error.message : 'Failed to reset offsets',
        variant: 'destructive'
      })
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Reset To</Label>
        <Select value={resetType} onValueChange={(v) => setResetType(v as typeof resetType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="earliest">Earliest (Beginning)</SelectItem>
            <SelectItem value="latest">Latest (End)</SelectItem>
            <SelectItem value="offset">Specific Offset</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {resetType === 'offset' && (
        <div className="space-y-2">
          <Label htmlFor="offset">Offset</Label>
          <Input
            id="offset"
            type="number"
            placeholder="Enter offset"
            value={offset}
            onChange={(e) => setOffset(e.target.value)}
          />
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Partitions</Label>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={selectAll}>
              Select All
            </Button>
            <Button variant="ghost" size="sm" onClick={deselectAll}>
              Deselect All
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 rounded-md border border-border p-3">
          {partitions.map((partition) => (
            <button
              key={partition.partition}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                selectedPartitions.includes(partition.partition)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
              onClick={() => togglePartition(partition.partition)}
            >
              P{partition.partition}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{selectedPartitions.length} partition(s) selected</p>
      </div>

      <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
        Warning: Resetting offsets will affect how messages are consumed. Make sure the consumer group is
        stopped before resetting.
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={handleReset}
          disabled={isResetting || selectedPartitions.length === 0 || (resetType === 'offset' && !offset)}
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          {isResetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Reset Offsets
        </Button>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useTopicStore } from '@/stores/topic.store'
import { useConnectionStore } from '@/stores/connection.store'
import { MessageViewer } from '../messages/MessageViewer'
import { MessageProducer } from '../messages/MessageProducer'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { MessageSquare, Settings, LayoutGrid, Send, Database } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

export function TopicDetails() {
  const [activeTab, setActiveTab] = useState('messages')
  const [isProducerOpen, setIsProducerOpen] = useState(false)

  const selectedTopic = useTopicStore((state) => state.selectedTopic)
  const topicMetadata = useTopicStore((state) => state.topicMetadata)
  const topicConfig = useTopicStore((state) => state.topicConfig)
  const loadMessages = useTopicStore((state) => state.loadMessages)
  const activeConnectionId = useConnectionStore((state) => state.activeConnectionId)

  useEffect(() => {
    if (activeConnectionId && selectedTopic) {
      loadMessages(activeConnectionId, selectedTopic, { limit: 100 })
    }
  }, [activeConnectionId, selectedTopic, loadMessages])

  if (!selectedTopic || !topicMetadata) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <Skeleton className="h-6 w-48 mb-2" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-5 w-32 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Database className="mx-auto h-12 w-12 mb-3 opacity-30" />
            <p>Select a topic to view details</p>
          </div>
        </div>
      </div>
    )
  }

  const totalMessages = topicMetadata.partitions.reduce((sum, p) => {
    const high = parseInt(p.high, 10)
    const low = parseInt(p.low, 10)
    return sum + (high - low)
  }, 0)

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <div>
          <h2 className="text-lg font-semibold">{selectedTopic}</h2>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{topicMetadata.partitions.length} partitions</Badge>
            <Badge variant="secondary">{totalMessages.toLocaleString()} messages</Badge>
          </div>
        </div>
        <Dialog open={isProducerOpen} onOpenChange={setIsProducerOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Send className="mr-2 h-4 w-4" />
              Produce Message
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Produce Message to {selectedTopic}</DialogTitle>
            </DialogHeader>
            <MessageProducer topic={selectedTopic} onClose={() => setIsProducerOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col">
        <TabsList className="mx-4 mt-2 justify-start bg-transparent">
          <TabsTrigger value="messages" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Messages
          </TabsTrigger>
          <TabsTrigger value="partitions" className="gap-2">
            <LayoutGrid className="h-4 w-4" />
            Partitions
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2">
            <Settings className="h-4 w-4" />
            Configuration
          </TabsTrigger>
        </TabsList>

        <TabsContent value="messages" className="flex-1 m-0 p-4">
          <MessageViewer />
        </TabsContent>

        <TabsContent value="partitions" className="flex-1 m-0 p-4">
          <ScrollArea className="h-full">
            <div className="space-y-2">
              <div className="grid grid-cols-6 gap-4 px-4 py-2 text-sm font-medium text-muted-foreground">
                <div>Partition</div>
                <div>Leader</div>
                <div>Replicas</div>
                <div>ISR</div>
                <div>Low Offset</div>
                <div>High Offset</div>
              </div>
              {topicMetadata.partitions.map((partition) => (
                <div
                  key={partition.partition}
                  className="grid grid-cols-6 gap-4 rounded-md border border-border px-4 py-3 text-sm transition-colors hover:bg-accent/50"
                >
                  <div className="font-medium">{partition.partition}</div>
                  <div>{partition.leader}</div>
                  <div>{partition.replicas.join(', ')}</div>
                  <div>{partition.isr.join(', ')}</div>
                  <div className="font-mono text-muted-foreground">{partition.low}</div>
                  <div className="font-mono text-muted-foreground">{partition.high}</div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="config" className="flex-1 m-0 p-4">
          <ScrollArea className="h-full">
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-4 px-4 py-2 text-sm font-medium text-muted-foreground">
                <div>Name</div>
                <div>Value</div>
                <div>Source</div>
              </div>
              {topicConfig.map((config) => (
                <div
                  key={config.configName}
                  className="grid grid-cols-3 gap-4 rounded-md border border-border px-4 py-3 text-sm transition-colors hover:bg-accent/50"
                >
                  <div className="font-medium">{config.configName}</div>
                  <div className="font-mono text-muted-foreground truncate">
                    {config.isSensitive ? '********' : config.configValue || '-'}
                  </div>
                  <div className="flex items-center gap-2">
                    {config.isDefault && <Badge variant="secondary">Default</Badge>}
                    {config.readOnly && <Badge variant="outline">Read Only</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}

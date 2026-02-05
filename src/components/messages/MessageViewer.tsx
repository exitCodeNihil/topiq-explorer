import { useState } from 'react'
import { useTopicStore } from '@/stores/topic.store'
import { useConnectionStore } from '@/stores/connection.store'
import { MessageFilters } from './MessageFilters'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatJson, formatTimestamp, tryParseJson } from '@/lib/utils'
import { RefreshCw, Copy, ChevronDown, ChevronRight, MessageSquare } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import type { KafkaMessage, MessageOptions } from '@/types/kafka.types'

export function MessageViewer() {
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState<MessageOptions>({ limit: 100 })

  const messages = useTopicStore((state) => state.messages)
  const isLoadingMessages = useTopicStore((state) => state.isLoadingMessages)
  const selectedTopic = useTopicStore((state) => state.selectedTopic)
  const loadMessages = useTopicStore((state) => state.loadMessages)
  const activeConnectionId = useConnectionStore((state) => state.activeConnectionId)

  const handleRefresh = async () => {
    if (!activeConnectionId || !selectedTopic) return
    await loadMessages(activeConnectionId, selectedTopic, filters)
  }

  const handleFilterChange = async (newFilters: MessageOptions) => {
    setFilters(newFilters)
    if (!activeConnectionId || !selectedTopic) return
    await loadMessages(activeConnectionId, selectedTopic, newFilters)
  }

  const toggleExpanded = (messageId: string) => {
    const newExpanded = new Set(expandedMessages)
    if (newExpanded.has(messageId)) {
      newExpanded.delete(messageId)
    } else {
      newExpanded.add(messageId)
    }
    setExpandedMessages(newExpanded)
  }

  const copyToClipboard = async (message: KafkaMessage) => {
    const content = JSON.stringify(
      {
        partition: message.partition,
        offset: message.offset,
        timestamp: message.timestamp,
        key: message.key,
        value: tryParseJson(message.value || '').parsed,
        headers: message.headers
      },
      null,
      2
    )
    await navigator.clipboard.writeText(content)
    toast({ title: 'Copied', description: 'Message copied to clipboard' })
  }

  const getMessageId = (message: KafkaMessage) => `${message.partition}-${message.offset}`

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between pb-4">
        <MessageFilters filters={filters} onFilterChange={handleFilterChange} />
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoadingMessages}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingMessages ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <ScrollArea className="flex-1 rounded-md border border-border">
        {isLoadingMessages && messages.length === 0 ? (
          <div className="divide-y divide-border">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start gap-2 p-3">
                <Skeleton className="h-4 w-4 mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Skeleton className="h-5 w-12 rounded-full" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center py-12">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p>No messages found</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {messages.map((message) => {
              const messageId = getMessageId(message)
              const isExpanded = expandedMessages.has(messageId)
              const { parsed, isJson } = tryParseJson(message.value || '')

              return (
                <div key={messageId} className="group">
                  <div
                    className="flex items-start gap-2 p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => toggleExpanded(messageId)}
                  >
                    <button className="mt-1 text-muted-foreground">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          P{message.partition}
                        </Badge>
                        <Badge variant="secondary" className="font-mono text-xs">
                          O{message.offset}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(message.timestamp)}
                        </span>
                        {message.key && (
                          <Badge variant="outline" className="font-mono text-xs">
                            Key: {message.key}
                          </Badge>
                        )}
                      </div>

                      <div className="mt-1 truncate font-mono text-sm text-muted-foreground">
                        {isJson
                          ? JSON.stringify(parsed).substring(0, 100) + (JSON.stringify(parsed).length > 100 ? '...' : '')
                          : message.value?.substring(0, 100) || '(empty)'}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation()
                        copyToClipboard(message)
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border bg-muted/30 p-4">
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-xs font-medium text-muted-foreground mb-1">Value</h4>
                          <pre className="json-viewer overflow-auto rounded-md bg-background p-3 text-sm">
                            {isJson ? formatJson(message.value || '') : message.value || '(empty)'}
                          </pre>
                        </div>

                        {message.key && (
                          <div>
                            <h4 className="text-xs font-medium text-muted-foreground mb-1">Key</h4>
                            <pre className="json-viewer overflow-auto rounded-md bg-background p-3 text-sm">
                              {message.key}
                            </pre>
                          </div>
                        )}

                        {Object.keys(message.headers).length > 0 && (
                          <div>
                            <h4 className="text-xs font-medium text-muted-foreground mb-1">Headers</h4>
                            <pre className="json-viewer overflow-auto rounded-md bg-background p-3 text-sm">
                              {JSON.stringify(message.headers, null, 2)}
                            </pre>
                          </div>
                        )}

                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>Partition: {message.partition}</span>
                          <span>Offset: {message.offset}</span>
                          <span>Timestamp: {formatTimestamp(message.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>

      <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
        <span>{messages.length} messages loaded</span>
      </div>
    </div>
  )
}

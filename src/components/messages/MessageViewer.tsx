import { useState, useMemo, useCallback } from 'react'
import { Virtuoso } from 'react-virtuoso'
import { useTopicStore } from '@/stores/topic.store'
import { useConnectionStore } from '@/stores/connection.store'
import { MessageFilters } from './MessageFilters'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatJson, formatTimestamp, tryParseJson } from '@/lib/utils'
import { RefreshCw, Copy, ChevronDown, ChevronRight, MessageSquare, Trash2, RotateCcw, Loader2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import type { KafkaMessage, MessageOptions } from '@/types/kafka.types'

interface ParsedMessage extends KafkaMessage {
  parsedValue: unknown
  isJson: boolean
  messageId: string
  stringifiedPreview: string
}

export function MessageViewer() {
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState<MessageOptions>({ limit: 100 })
  const [tombstoneMessage, setTombstoneMessage] = useState<ParsedMessage | null>(null)
  const [isSendingTombstone, setIsSendingTombstone] = useState(false)

  const messages = useTopicStore((state) => state.messages)
  const isLoadingMessages = useTopicStore((state) => state.isLoadingMessages)
  const selectedTopic = useTopicStore((state) => state.selectedTopic)
  const loadMessages = useTopicStore((state) => state.loadMessages)
  const produceMessage = useTopicStore((state) => state.produceMessage)
  const setMessageToRepublish = useTopicStore((state) => state.setMessageToRepublish)
  const activeConnectionId = useConnectionStore((state) => state.activeConnectionId)

  // Memoize parsed messages to avoid re-parsing JSON on every render
  const parsedMessages = useMemo<ParsedMessage[]>(() => {
    return messages.map((message) => {
      const { parsed, isJson } = tryParseJson(message.value || '')
      const stringified = isJson ? JSON.stringify(parsed) : (message.value || '')
      return {
        ...message,
        parsedValue: parsed,
        isJson,
        messageId: `${message.partition}-${message.offset}`,
        stringifiedPreview: stringified.substring(0, 100) + (stringified.length > 100 ? '...' : '')
      }
    })
  }, [messages])

  const handleRefresh = useCallback(async () => {
    if (!activeConnectionId || !selectedTopic) return
    await loadMessages(activeConnectionId, selectedTopic, filters)
  }, [activeConnectionId, selectedTopic, filters, loadMessages])

  const handleFilterChange = useCallback(async (newFilters: MessageOptions) => {
    setFilters(newFilters)
    if (!activeConnectionId || !selectedTopic) return
    await loadMessages(activeConnectionId, selectedTopic, newFilters)
  }, [activeConnectionId, selectedTopic, loadMessages])

  const toggleExpanded = useCallback((messageId: string) => {
    setExpandedMessages((prev) => {
      const newExpanded = new Set(prev)
      if (newExpanded.has(messageId)) {
        newExpanded.delete(messageId)
      } else {
        newExpanded.add(messageId)
      }
      return newExpanded
    })
  }, [])

  const copyToClipboard = useCallback(async (message: ParsedMessage) => {
    const content = JSON.stringify(
      {
        partition: message.partition,
        offset: message.offset,
        timestamp: message.timestamp,
        key: message.key,
        value: message.parsedValue,
        headers: message.headers
      },
      null,
      2
    )
    await navigator.clipboard.writeText(content)
    toast({ title: 'Copied', description: 'Message copied to clipboard' })
  }, [])

  const handleTombstone = useCallback(async () => {
    if (!activeConnectionId || !selectedTopic || !tombstoneMessage?.key) return

    setIsSendingTombstone(true)
    try {
      await produceMessage(activeConnectionId, selectedTopic, {
        key: tombstoneMessage.key,
        value: null,
        partition: tombstoneMessage.partition
      })

      toast({
        title: 'Tombstone Sent',
        description: `Tombstone message sent for key "${tombstoneMessage.key}"`
      })

      // Refresh messages
      await loadMessages(activeConnectionId, selectedTopic, filters)
    } catch (error) {
      toast({
        title: 'Tombstone Failed',
        description: error instanceof Error ? error.message : 'Failed to send tombstone',
        variant: 'destructive'
      })
    } finally {
      setIsSendingTombstone(false)
      setTombstoneMessage(null)
    }
  }, [activeConnectionId, selectedTopic, tombstoneMessage, produceMessage, loadMessages, filters])

  const handleRepublish = useCallback((message: ParsedMessage) => {
    if (!setMessageToRepublish) return
    setMessageToRepublish({
      key: message.key || undefined,
      value: message.value || '',
      headers: message.headers,
      partition: message.partition
    })
    toast({ title: 'Message Ready', description: 'Open the message producer to republish' })
  }, [setMessageToRepublish])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between pb-4">
        <MessageFilters filters={filters} onFilterChange={handleFilterChange} />
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoadingMessages}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingMessages ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="flex-1 rounded-md border border-border overflow-hidden">
        {isLoadingMessages && parsedMessages.length === 0 ? (
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
        ) : parsedMessages.length === 0 ? (
          <div className="flex h-full items-center justify-center py-12">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p>No messages found</p>
            </div>
          </div>
        ) : (
          <Virtuoso
            data={parsedMessages}
            itemContent={(_, message) => {
              const isExpanded = expandedMessages.has(message.messageId)

              return (
                <div className="group border-b border-border last:border-b-0">
                  <div
                    className="flex items-start gap-2 p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => toggleExpanded(message.messageId)}
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
                        {message.stringifiedPreview || '(empty)'}
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
                            {message.isJson ? formatJson(message.value || '') : message.value || '(empty)'}
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

                        <div className="flex items-center justify-between">
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            <span>Partition: {message.partition}</span>
                            <span>Offset: {message.offset}</span>
                            <span>Timestamp: {formatTimestamp(message.timestamp)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleRepublish(message)
                                    }}
                                  >
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    Republish
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Create a new message with this data pre-filled</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            {message.key && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setTombstoneMessage(message)
                                      }}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Tombstone
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Send a null message for this key (compacted topics only)</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            }}
          />
        )}
      </div>

      <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
        <span>{messages.length} messages loaded</span>
      </div>

      <AlertDialog open={!!tombstoneMessage} onOpenChange={() => setTombstoneMessage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Tombstone Message</AlertDialogTitle>
            <AlertDialogDescription>
              This will produce a message with a null value for the key "{tombstoneMessage?.key}".
              <span className="block mt-2 text-warning">
                Note: Tombstones only work on topics with log compaction enabled. The original message will remain until compaction runs.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleTombstone} disabled={isSendingTombstone}>
              {isSendingTombstone && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Tombstone
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

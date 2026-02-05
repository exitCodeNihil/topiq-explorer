import { useState, useMemo } from 'react'
import { Search, Plus, RefreshCw, Database, Trash2, Inbox } from 'lucide-react'
import { useTopicStore } from '@/stores/topic.store'
import { useConnectionStore } from '@/stores/connection.store'
import { CreateTopic } from './CreateTopic'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { toast } from '@/hooks/use-toast'

export function TopicList() {
  const [search, setSearch] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [deleteTopicName, setDeleteTopicName] = useState<string | null>(null)

  const topics = useTopicStore((state) => state.topics)
  const selectedTopic = useTopicStore((state) => state.selectedTopic)
  const isLoading = useTopicStore((state) => state.isLoading)
  const selectTopic = useTopicStore((state) => state.selectTopic)
  const loadTopics = useTopicStore((state) => state.loadTopics)
  const loadTopicMetadata = useTopicStore((state) => state.loadTopicMetadata)
  const loadTopicConfig = useTopicStore((state) => state.loadTopicConfig)
  const deleteTopic = useTopicStore((state) => state.deleteTopic)

  const activeConnectionId = useConnectionStore((state) => state.activeConnectionId)

  const filteredTopics = useMemo(
    () => topics.filter((topic) => topic.toLowerCase().includes(search.toLowerCase())),
    [topics, search]
  )

  const handleSelectTopic = async (topic: string) => {
    if (!activeConnectionId) return
    selectTopic(topic)
    await Promise.all([
      loadTopicMetadata(activeConnectionId, topic),
      loadTopicConfig(activeConnectionId, topic)
    ])
  }

  const handleRefresh = async () => {
    if (!activeConnectionId) return
    await loadTopics(activeConnectionId)
    if (selectedTopic) {
      await Promise.all([
        loadTopicMetadata(activeConnectionId, selectedTopic),
        loadTopicConfig(activeConnectionId, selectedTopic)
      ])
    }
  }

  const handleDeleteTopic = async () => {
    if (!activeConnectionId || !deleteTopicName) return
    try {
      await deleteTopic(activeConnectionId, deleteTopicName)
      toast({ title: 'Topic Deleted', description: `Topic "${deleteTopicName}" has been deleted` })
    } catch (error) {
      toast({
        title: 'Delete Failed',
        description: error instanceof Error ? error.message : 'Failed to delete topic',
        variant: 'destructive'
      })
    } finally {
      setDeleteTopicName(null)
    }
  }

  return (
    <div className="flex h-full flex-col border-r border-border">
      <div className="flex items-center gap-2 border-b border-border p-3">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search topics..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8"
          />
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Plus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Topic</DialogTitle>
            </DialogHeader>
            <CreateTopic onClose={() => setIsCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1.5">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </div>
          ) : filteredTopics.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Inbox className="mx-auto h-8 w-8 mb-2 opacity-50" />
              {topics.length === 0 ? 'No topics found' : 'No matching topics'}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredTopics.map((topic) => (
                <div
                  key={topic}
                  className={`group flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-colors ${
                    selectedTopic === topic ? 'bg-accent' : 'hover:bg-accent/50'
                  }`}
                  onClick={() => handleSelectTopic(topic)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setDeleteTopicName(topic)
                  }}
                >
                  <Database className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 truncate text-sm">{topic}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteTopicName(topic)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Topic
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-border p-2 text-xs text-muted-foreground">
        {filteredTopics.length} of {topics.length} topics
      </div>

      <AlertDialog open={!!deleteTopicName} onOpenChange={() => setDeleteTopicName(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Topic</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the topic "{deleteTopicName}"? This action cannot be undone
              and all messages in this topic will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTopic} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

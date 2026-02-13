import { useState, useMemo } from 'react'
import { Search, Plus, RefreshCw, Trash2, Inbox } from 'lucide-react'
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
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 p-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
          <Input
            placeholder="Search topics..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-bg-main border-border-mute font-mono text-sm"
          />
        </div>
        <Button variant="ghost" size="icon" className="h-9 w-9 text-text-secondary" onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-text-secondary">
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
        <div>
          {isLoading ? (
            <div className="space-y-1 px-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-3">
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </div>
          ) : filteredTopics.length === 0 ? (
            <div className="py-8 text-center text-sm text-text-secondary">
              <Inbox className="mx-auto h-8 w-8 mb-2 opacity-50" />
              {topics.length === 0 ? 'No topics found' : 'No matching topics'}
            </div>
          ) : (
            <div>
              {filteredTopics.map((topic) => (
                <div
                  key={topic}
                  className={`group flex items-center cursor-pointer transition-colors ${
                    selectedTopic === topic
                      ? 'bg-bg-main border-l-2 border-l-accent-active pl-[18px] pr-5 py-4'
                      : 'hover:bg-bg-main/50 px-5 py-4'
                  }`}
                  onClick={() => handleSelectTopic(topic)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setDeleteTopicName(topic)
                  }}
                >
                  <span className="flex-1 truncate text-sm font-mono text-text-primary">{topic}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3 w-3 text-text-secondary" />
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

      <div className="px-4 py-3 text-[10px] uppercase tracking-wider font-mono text-text-secondary border-t border-border-mute">
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

import { useState, useMemo } from 'react'
import { Search, RefreshCw, Trash2, Inbox } from 'lucide-react'
import { useConsumerStore } from '@/stores/consumer.store'
import { useConnectionStore } from '@/stores/connection.store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import { Skeleton } from '@/components/ui/skeleton'

export function ConsumerGroupList() {
  const [search, setSearch] = useState('')
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null)

  const consumerGroups = useConsumerStore((state) => state.consumerGroups)
  const selectedGroupId = useConsumerStore((state) => state.selectedGroupId)
  const isLoading = useConsumerStore((state) => state.isLoading)
  const selectGroup = useConsumerStore((state) => state.selectGroup)
  const loadConsumerGroups = useConsumerStore((state) => state.loadConsumerGroups)
  const loadGroupDetails = useConsumerStore((state) => state.loadGroupDetails)
  const deleteGroup = useConsumerStore((state) => state.deleteGroup)

  const activeConnectionId = useConnectionStore((state) => state.activeConnectionId)

  const filteredGroups = useMemo(
    () => consumerGroups.filter((group) => group.groupId.toLowerCase().includes(search.toLowerCase())),
    [consumerGroups, search]
  )

  const handleSelectGroup = async (groupId: string) => {
    if (!activeConnectionId) return
    selectGroup(groupId)
    await loadGroupDetails(activeConnectionId, groupId)
  }

  const handleRefresh = async () => {
    if (!activeConnectionId) return
    await loadConsumerGroups(activeConnectionId)
    if (selectedGroupId) {
      await loadGroupDetails(activeConnectionId, selectedGroupId)
    }
  }

  const handleDeleteGroup = async () => {
    if (!activeConnectionId || !deleteGroupId) return
    try {
      await deleteGroup(activeConnectionId, deleteGroupId)
      toast({ title: 'Group Deleted', description: `Consumer group "${deleteGroupId}" has been deleted` })
    } catch (error) {
      toast({
        title: 'Delete Failed',
        description: error instanceof Error ? error.message : 'Failed to delete consumer group',
        variant: 'destructive'
      })
    } finally {
      setDeleteGroupId(null)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 p-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
          <Input
            placeholder="Search groups..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-bg-main border-border-mute font-mono text-sm"
          />
        </div>
        <Button variant="ghost" size="icon" className="h-9 w-9 text-text-secondary" onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
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
          ) : filteredGroups.length === 0 ? (
            <div className="py-8 text-center text-sm text-text-secondary">
              <Inbox className="mx-auto h-8 w-8 mb-2 opacity-50" />
              {consumerGroups.length === 0 ? 'No consumer groups found' : 'No matching groups'}
            </div>
          ) : (
            <div>
              {filteredGroups.map((group) => (
                <div
                  key={group.groupId}
                  className={`group flex items-center cursor-pointer transition-colors ${
                    selectedGroupId === group.groupId
                      ? 'bg-bg-main border-l-2 border-l-accent-active pl-[18px] pr-5 py-4'
                      : 'hover:bg-bg-main/50 px-5 py-4'
                  }`}
                  onClick={() => handleSelectGroup(group.groupId)}
                >
                  <div className="flex-1 min-w-0">
                    <span className="truncate text-sm font-mono text-text-primary block">{group.groupId}</span>
                    <span className="text-[10px] uppercase tracking-wider text-text-secondary mt-0.5 block">
                      {group.protocolType || 'consumer'}
                    </span>
                  </div>
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
                        onClick={() => setDeleteGroupId(group.groupId)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Group
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
        {filteredGroups.length} of {consumerGroups.length} groups
      </div>

      <AlertDialog open={!!deleteGroupId} onOpenChange={() => setDeleteGroupId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Consumer Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the consumer group "{deleteGroupId}"? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteGroup} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

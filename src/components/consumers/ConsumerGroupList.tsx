import { useState, useMemo } from 'react'
import { Search, RefreshCw, Users, Trash2, Inbox } from 'lucide-react'
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
    <div className="flex h-full flex-col border-r border-border">
      <div className="flex items-center gap-2 border-b border-border p-3">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search groups..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8"
          />
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
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
          ) : filteredGroups.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Inbox className="mx-auto h-8 w-8 mb-2 opacity-50" />
              {consumerGroups.length === 0 ? 'No consumer groups found' : 'No matching groups'}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredGroups.map((group) => (
                <div
                  key={group.groupId}
                  className={`group flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-colors ${
                    selectedGroupId === group.groupId ? 'bg-accent' : 'hover:bg-accent/50'
                  }`}
                  onClick={() => handleSelectGroup(group.groupId)}
                >
                  <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 truncate text-sm">{group.groupId}</span>
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

      <div className="border-t border-border p-2 text-xs text-muted-foreground">
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

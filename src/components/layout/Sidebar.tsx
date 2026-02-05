import { useState } from 'react'
import { Plus, Settings, Trash2, MoreVertical, Power, PowerOff } from 'lucide-react'
import { useConnectionStore } from '@/stores/connection.store'
import { useTopicStore } from '@/stores/topic.store'
import { useConsumerStore } from '@/stores/consumer.store'
import { ConnectionForm } from '../connections/ConnectionForm'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from '@/hooks/use-toast'
import type { KafkaConnection } from '@/types/kafka.types'

export function Sidebar() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingConnection, setEditingConnection] = useState<KafkaConnection | null>(null)
  const [deleteConnectionId, setDeleteConnectionId] = useState<string | null>(null)

  const connections = useConnectionStore((state) => state.connections)
  const activeConnectionId = useConnectionStore((state) => state.activeConnectionId)
  const connectionStatus = useConnectionStore((state) => state.connectionStatus)
  const connectToCluster = useConnectionStore((state) => state.connectToCluster)
  const disconnectFromCluster = useConnectionStore((state) => state.disconnectFromCluster)
  const deleteConnection = useConnectionStore((state) => state.deleteConnection)

  const loadTopics = useTopicStore((state) => state.loadTopics)
  const resetTopics = useTopicStore((state) => state.reset)
  const loadConsumerGroups = useConsumerStore((state) => state.loadConsumerGroups)
  const resetConsumers = useConsumerStore((state) => state.reset)

  const handleConnect = async (connection: KafkaConnection) => {
    try {
      // Disconnect current connection if different
      if (activeConnectionId && activeConnectionId !== connection.id) {
        const currentStatus = connectionStatus[activeConnectionId]
        if (currentStatus === 'connected') {
          await disconnectFromCluster(activeConnectionId)
          resetTopics()
          resetConsumers()
        }
      }

      await connectToCluster(connection.id)
      await Promise.all([loadTopics(connection.id), loadConsumerGroups(connection.id)])
      toast({ title: 'Connected', description: `Connected to ${connection.name}` })
    } catch (error) {
      toast({
        title: 'Connection Failed',
        description: error instanceof Error ? error.message : 'Failed to connect',
        variant: 'destructive'
      })
    }
  }

  const handleDisconnect = async (connectionId: string) => {
    try {
      await disconnectFromCluster(connectionId)
      resetTopics()
      resetConsumers()
      toast({ title: 'Disconnected', description: 'Disconnected from cluster' })
    } catch (error) {
      toast({
        title: 'Disconnect Failed',
        description: error instanceof Error ? error.message : 'Failed to disconnect',
        variant: 'destructive'
      })
    }
  }

  const handleDelete = async () => {
    if (!deleteConnectionId) return
    try {
      if (connectionStatus[deleteConnectionId] === 'connected') {
        await disconnectFromCluster(deleteConnectionId)
      }
      await deleteConnection(deleteConnectionId)
      resetTopics()
      resetConsumers()
      toast({ title: 'Deleted', description: 'Connection deleted' })
    } catch (error) {
      toast({
        title: 'Delete Failed',
        description: error instanceof Error ? error.message : 'Failed to delete',
        variant: 'destructive'
      })
    } finally {
      setDeleteConnectionId(null)
    }
  }

  const handleEdit = (connection: KafkaConnection) => {
    setEditingConnection(connection)
    setIsDialogOpen(true)
  }

  const handleDialogClose = () => {
    setIsDialogOpen(false)
    setEditingConnection(null)
  }

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col border-r border-border bg-card">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <span className="text-sm font-medium text-muted-foreground">Connections</span>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{editingConnection ? 'Edit Connection' : 'New Connection'}</DialogTitle>
              </DialogHeader>
              <ConnectionForm connection={editingConnection} onClose={handleDialogClose} />
            </DialogContent>
          </Dialog>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {connections.length === 0 ? (
              <div className="px-2 py-8 text-center text-sm text-muted-foreground">
                <p>No connections yet</p>
                <p className="mt-1">Click + to add one</p>
              </div>
            ) : (
              connections.map((connection) => {
                const status = connectionStatus[connection.id] || 'disconnected'
                const isActive = activeConnectionId === connection.id
                const isConnected = status === 'connected'
                const isConnecting = status === 'connecting'

                return (
                  <div
                    key={connection.id}
                    className={`group flex items-center gap-2 rounded-md px-2 py-2 cursor-pointer transition-colors ${
                      isActive ? 'bg-accent' : 'hover:bg-accent/50'
                    }`}
                    onClick={() => {
                      if (isActive && isConnected) return // Already active and connected
                      if (isConnecting) return // Still connecting
                      handleConnect(connection)
                    }}
                  >
                    <div
                      className={`h-3 w-3 rounded-full flex-shrink-0 ${
                        isConnected ? '' : 'border-2'
                      }`}
                      style={{
                        backgroundColor: isConnected ? (connection.color || 'hsl(var(--primary))') : 'transparent',
                        borderColor: isConnected ? undefined : (connection.color || 'hsl(var(--primary))')
                      }}
                    />
                    <span className="flex-1 truncate text-sm">{connection.name}</span>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {isConnected ? (
                          <DropdownMenuItem onClick={() => handleDisconnect(connection.id)}>
                            <PowerOff className="mr-2 h-4 w-4" />
                            Disconnect
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => handleConnect(connection)}>
                            <Power className="mr-2 h-4 w-4" />
                            Connect
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleEdit(connection)}>
                          <Settings className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteConnectionId(connection.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {isConnecting && (
                      <Tooltip>
                        <TooltipTrigger>
                          <div className="h-2 w-2 rounded-full bg-warning animate-pulse" />
                        </TooltipTrigger>
                        <TooltipContent>Connecting...</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>

        <AlertDialog open={!!deleteConnectionId} onOpenChange={() => setDeleteConnectionId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Connection</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this connection? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  )
}

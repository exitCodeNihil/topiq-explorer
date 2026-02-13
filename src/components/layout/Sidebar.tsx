import { useState } from 'react'
import { Plus, Settings, Trash2, MoreVertical, Power, PowerOff } from 'lucide-react'
import { useConnectionStore } from '@/stores/connection.store'
import { useTopicStore } from '@/stores/topic.store'
import { useConsumerStore } from '@/stores/consumer.store'
import { ConnectionForm } from '../connections/ConnectionForm'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
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
import { toast } from '@/hooks/use-toast'
import type { KafkaConnection } from '@/types/kafka.types'

function getAbbreviation(name: string): string {
  const words = name.split(/[\s\-_]+/)
  if (words.length >= 2) {
    return words.slice(0, 3).map(w => w.charAt(0)).join('').toUpperCase()
  }
  return name.substring(0, 3).toUpperCase()
}

function getConnectionId(name: string): string {
  const words = name.split(/[\s\-_]+/)
  if (words.length >= 2) {
    return words.slice(0, 2).map(w => w.charAt(0)).join('').toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

export function Sidebar() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingConnection, setEditingConnection] = useState<KafkaConnection | null>(null)
  const [deleteConnectionId, setDeleteConnectionId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [contextMenuOpenId, setContextMenuOpenId] = useState<string | null>(null)

  const connections = useConnectionStore((state) => state.connections)
  const activeConnectionId = useConnectionStore((state) => state.activeConnectionId)
  const connectionStatus = useConnectionStore((state) => state.connectionStatus)
  const connectToCluster = useConnectionStore((state) => state.connectToCluster)
  const disconnectFromCluster = useConnectionStore((state) => state.disconnectFromCluster)
  const deleteConnection = useConnectionStore((state) => state.deleteConnection)

  const loadClusterInfo = useConnectionStore((state) => state.loadClusterInfo)
  const loadTopics = useTopicStore((state) => state.loadTopics)
  const resetTopics = useTopicStore((state) => state.reset)
  const loadConsumerGroups = useConsumerStore((state) => state.loadConsumerGroups)
  const resetConsumers = useConsumerStore((state) => state.reset)

  const handleConnect = async (connection: KafkaConnection) => {
    try {
      if (activeConnectionId && activeConnectionId !== connection.id) {
        const currentStatus = connectionStatus[activeConnectionId]
        if (currentStatus === 'connected') {
          await disconnectFromCluster(activeConnectionId)
          resetTopics()
          resetConsumers()
        }
      }

      await connectToCluster(connection.id)
      await Promise.all([loadTopics(connection.id), loadConsumerGroups(connection.id), loadClusterInfo(connection.id)])
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
    <>
      <div className="flex h-full w-[80px] flex-shrink-0 flex-col items-center border-r border-border-mute bg-bg-sidebar py-6">
        <ScrollArea className="flex-1 w-full">
          <div className="flex flex-col items-center gap-4">
            {connections.map((connection) => {
              const status = connectionStatus[connection.id] || 'disconnected'
              const isActive = activeConnectionId === connection.id
              const isConnected = status === 'connected'
              const isConnecting = status === 'connecting'
              const abbr = getAbbreviation(connection.name)
              const shortId = getConnectionId(connection.name)

              return (
                <div
                  key={connection.id}
                  className="relative group flex items-center justify-center"
                  onMouseEnter={() => setHoveredId(connection.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {/* Active left green bar */}
                  {isActive && isConnected && (
                    <div className="absolute -left-[17px] top-1/2 -translate-y-1/2 w-0.5 h-8 bg-accent-active rounded-r" />
                  )}

                  {/* Button */}
                  <button
                    className={`relative flex w-14 h-14 flex-col items-center justify-center rounded-lg text-[10px] font-mono transition-all duration-200 outline-none ${
                      isActive && isConnected
                        ? 'bg-bg-panel border border-border-mute shadow-subtle text-text-primary'
                        : 'bg-transparent border border-transparent text-text-secondary hover:bg-bg-panel/50 hover:border-border-mute/50'
                    } ${isConnecting ? 'animate-pulse' : ''}`}
                    onClick={() => {
                      if (isActive && isConnected) return
                      if (isConnecting) return
                      handleConnect(connection)
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setContextMenuOpenId(connection.id)
                    }}
                  >
                    <span className="text-xs font-bold leading-tight">{abbr}</span>
                    <span className="text-[9px] text-text-secondary/70 leading-tight">{shortId}</span>
                  </button>

                  {/* Tooltip on hover */}
                  {hoveredId === connection.id && (
                    <div className="absolute left-16 top-1/2 -translate-y-1/2 z-50 whitespace-nowrap bg-bg-panel border border-border-mute rounded-md px-3 py-2 shadow-subtle pointer-events-none">
                      <p className="text-xs font-semibold text-text-primary">{connection.name}</p>
                      {isConnected && <p className="text-[10px] text-accent-active">Connected</p>}
                      {isConnecting && <p className="text-[10px] text-yellow-500">Connecting...</p>}
                    </div>
                  )}

                  {/* Status dot */}
                  <div
                    className={`absolute top-1 right-3 w-2 h-2 rounded-full pointer-events-none ${
                      isConnected
                        ? 'bg-green-600'
                        : isConnecting
                        ? 'bg-yellow-600 animate-pulse'
                        : 'border border-border-mute bg-transparent'
                    }`}
                  />

                  {/* Context menu */}
                  <DropdownMenu
                    open={contextMenuOpenId === connection.id}
                    onOpenChange={(open) => setContextMenuOpenId(open ? connection.id : null)}
                  >
                    <DropdownMenuTrigger asChild>
                      <button
                        className={`absolute -top-1.5 -right-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-bg-panel border border-border-mute text-text-secondary transition-opacity shadow-md hover:text-text-primary ${
                          isConnected || isConnecting
                            ? 'opacity-0 pointer-events-none'
                            : 'opacity-0 group-hover:opacity-100'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-2.5 w-2.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start" sideOffset={4}>
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
                </div>
              )
            })}
          </div>
        </ScrollArea>

        {/* Separator */}
        <div className="my-3 h-px w-8 bg-border-mute" />

        {/* Add Connection Button */}
        <button
          onClick={() => {
            setEditingConnection(null)
            setIsDialogOpen(true)
          }}
          className="flex w-10 h-10 items-center justify-center rounded-full border border-dashed border-border-mute text-text-secondary transition-all duration-200 hover:border-accent-active hover:text-accent-active active:scale-95"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {/* Connection Form Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingConnection(null) }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editingConnection ? 'Edit Connection' : 'New Connection'}</DialogTitle>
          </DialogHeader>
          <ConnectionForm connection={editingConnection} onClose={handleDialogClose} />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
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
    </>
  )
}

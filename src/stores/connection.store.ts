import { create } from 'zustand'
import type { KafkaConnection, ConnectionStatus } from '../types/kafka.types'

interface ConnectionState {
  connections: KafkaConnection[]
  activeConnectionId: string | null
  connectionStatus: Record<string, ConnectionStatus>
  isLoading: boolean
  error: string | null

  // Actions
  loadConnections: () => Promise<void>
  addConnection: (connection: Omit<KafkaConnection, 'id' | 'createdAt' | 'updatedAt'>) => Promise<KafkaConnection>
  updateConnection: (connection: KafkaConnection) => Promise<KafkaConnection>
  deleteConnection: (id: string) => Promise<void>
  testConnection: (connection: Omit<KafkaConnection, 'id' | 'createdAt' | 'updatedAt'>) => Promise<{ success: boolean; error?: string }>
  setActiveConnection: (id: string | null) => void
  connectToCluster: (id: string) => Promise<void>
  disconnectFromCluster: (id: string) => Promise<void>
  getActiveConnection: () => KafkaConnection | null
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  connections: [],
  activeConnectionId: null,
  connectionStatus: {},
  isLoading: false,
  error: null,

  loadConnections: async () => {
    set({ isLoading: true, error: null })
    try {
      const connections = await window.api.connections.getAll()
      set({ connections, isLoading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load connections', isLoading: false })
    }
  },

  addConnection: async (connection) => {
    set({ isLoading: true, error: null })
    try {
      const saved = await window.api.connections.save(connection)
      set((state) => ({
        connections: [...state.connections, saved].sort((a, b) => a.name.localeCompare(b.name)),
        isLoading: false
      }))
      return saved
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to save connection', isLoading: false })
      throw error
    }
  },

  updateConnection: async (connection) => {
    set({ isLoading: true, error: null })
    try {
      const saved = await window.api.connections.save(connection)
      set((state) => ({
        connections: state.connections
          .map((c) => (c.id === saved.id ? saved : c))
          .sort((a, b) => a.name.localeCompare(b.name)),
        isLoading: false
      }))
      return saved
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to update connection', isLoading: false })
      throw error
    }
  },

  deleteConnection: async (id) => {
    set({ isLoading: true, error: null })
    try {
      await window.api.connections.delete(id)
      set((state) => ({
        connections: state.connections.filter((c) => c.id !== id),
        activeConnectionId: state.activeConnectionId === id ? null : state.activeConnectionId,
        isLoading: false
      }))
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete connection', isLoading: false })
      throw error
    }
  },

  testConnection: async (connection) => {
    return window.api.connections.test(connection)
  },

  setActiveConnection: (id) => {
    set({ activeConnectionId: id })
  },

  connectToCluster: async (id) => {
    set((state) => ({
      connectionStatus: { ...state.connectionStatus, [id]: 'connecting' }
    }))
    try {
      await window.api.kafka.connect(id)
      set((state) => ({
        connectionStatus: { ...state.connectionStatus, [id]: 'connected' },
        activeConnectionId: id
      }))
    } catch (error) {
      set((state) => ({
        connectionStatus: { ...state.connectionStatus, [id]: 'error' },
        error: error instanceof Error ? error.message : 'Failed to connect'
      }))
      throw error
    }
  },

  disconnectFromCluster: async (id) => {
    try {
      await window.api.kafka.disconnect(id)
      set((state) => ({
        connectionStatus: { ...state.connectionStatus, [id]: 'disconnected' },
        activeConnectionId: state.activeConnectionId === id ? null : state.activeConnectionId
      }))
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to disconnect' })
      throw error
    }
  },

  getActiveConnection: () => {
    const { connections, activeConnectionId } = get()
    return connections.find((c) => c.id === activeConnectionId) || null
  }
}))

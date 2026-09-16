import { create } from 'zustand'
import type { KafkaConnection, ConnectionStatus, ClusterInfo, ConfigEntry } from '../types/kafka.types'

interface ConnectionState {
  connections: KafkaConnection[]
  activeConnectionId: string | null
  connectionStatus: Record<string, ConnectionStatus>
  clusterInfo: ClusterInfo | null
  brokerConfig: ConfigEntry[]
  isLoadingClusterInfo: boolean
  isLoadingBrokerConfig: boolean
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
  loadClusterInfo: (connectionId: string) => Promise<void>
  loadBrokerConfig: (connectionId: string) => Promise<void>
}

const byName = (a: KafkaConnection, b: KafkaConnection) => a.name.localeCompare(b.name)

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  connections: [],
  activeConnectionId: null,
  connectionStatus: {},
  clusterInfo: null,
  brokerConfig: [],
  isLoadingClusterInfo: false,
  isLoadingBrokerConfig: false,
  isLoading: false,
  error: null,

  loadConnections: async () => {
    set({ isLoading: true, error: null })
    try {
      const result = await window.api.connections.getAll()
      if (!result.success) throw new Error(result.error || 'Failed to load connections')
      set({ connections: result.data, isLoading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load connections', isLoading: false })
    }
  },

  addConnection: async (connection) => {
    set({ isLoading: true, error: null })
    try {
      const result = await window.api.connections.save(connection)
      if (!result.success) throw new Error(result.error || 'Failed to save connection')
      const saved = result.data
      set((state) => ({
        connections: [...state.connections, saved].sort(byName),
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
      const result = await window.api.connections.save(connection)
      if (!result.success) throw new Error(result.error || 'Failed to update connection')
      const saved = result.data
      set((state) => ({
        connections: state.connections.map((c) => (c.id === saved.id ? saved : c)).sort(byName),
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
      const result = await window.api.connections.delete(id)
      if (!result.success) throw new Error(result.error || 'Failed to delete connection')
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
    const result = await window.api.connections.test(connection)
    return result.success ? result.data : { success: false, error: result.error }
  },

  setActiveConnection: (id) => {
    set({ activeConnectionId: id })
  },

  connectToCluster: async (id) => {
    set((state) => ({
      connectionStatus: { ...state.connectionStatus, [id]: 'connecting' }
    }))
    try {
      const result = await window.api.kafka.connect(id)
      if (!result.success) throw new Error(result.error || 'Failed to connect')
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
      const result = await window.api.kafka.disconnect(id)
      if (!result.success) throw new Error(result.error || 'Failed to disconnect')
      set((state) => ({
        connectionStatus: { ...state.connectionStatus, [id]: 'disconnected' },
        activeConnectionId: state.activeConnectionId === id ? null : state.activeConnectionId,
        clusterInfo: state.activeConnectionId === id ? null : state.clusterInfo,
        brokerConfig: state.activeConnectionId === id ? [] : state.brokerConfig
      }))
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to disconnect' })
      throw error
    }
  },

  getActiveConnection: () => {
    const { connections, activeConnectionId } = get()
    return connections.find((c) => c.id === activeConnectionId) || null
  },

  loadClusterInfo: async (connectionId) => {
    set({ isLoadingClusterInfo: true })
    try {
      const result = await window.api.kafka.getClusterInfo(connectionId)
      if (!result.success) throw new Error(result.error || 'Failed to load cluster info')
      set({ clusterInfo: result.data, isLoadingClusterInfo: false })
    } catch (error) {
      set({ isLoadingClusterInfo: false, error: error instanceof Error ? error.message : 'Failed to load cluster info' })
    }
  },

  loadBrokerConfig: async (connectionId) => {
    set({ isLoadingBrokerConfig: true })
    try {
      const result = await window.api.kafka.getBrokerConfig(connectionId)
      if (!result.success) throw new Error(result.error || 'Failed to load broker config')
      set({ brokerConfig: result.data, isLoadingBrokerConfig: false })
    } catch (error) {
      set({ isLoadingBrokerConfig: false, error: error instanceof Error ? error.message : 'Failed to load broker config' })
    }
  }
}))

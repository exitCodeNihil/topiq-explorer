import { create } from 'zustand'
import type { ConsumerGroup, ConsumerGroupDetails, ResetOffsetOptions } from '../types/kafka.types'

interface ConsumerState {
  consumerGroups: ConsumerGroup[]
  selectedGroupId: string | null
  groupDetails: ConsumerGroupDetails | null
  isLoading: boolean // list-level operations
  isLoadingDetails: boolean
  error: string | null

  // Actions
  loadConsumerGroups: (connectionId: string) => Promise<void>
  selectGroup: (groupId: string | null) => void
  loadGroupDetails: (connectionId: string, groupId: string) => Promise<void>
  deleteGroup: (connectionId: string, groupId: string) => Promise<void>
  resetOffsets: (connectionId: string, groupId: string, topic: string, options: ResetOffsetOptions) => Promise<void>
  reset: () => void
}

async function fetchGroupDetails(connectionId: string, groupId: string): Promise<ConsumerGroupDetails> {
  const result = await window.api.kafka.getConsumerGroupDetails(connectionId, groupId)
  if (!result.success) throw new Error(result.error || 'Failed to load group details')
  return result.data
}

export const useConsumerStore = create<ConsumerState>((set) => ({
  consumerGroups: [],
  selectedGroupId: null,
  groupDetails: null,
  isLoading: false,
  isLoadingDetails: false,
  error: null,

  loadConsumerGroups: async (connectionId) => {
    set({ isLoading: true, error: null })
    try {
      const result = await window.api.kafka.getConsumerGroups(connectionId)
      if (!result.success) throw new Error(result.error || 'Failed to load consumer groups')
      set({ consumerGroups: [...result.data].sort((a, b) => a.groupId.localeCompare(b.groupId)), isLoading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load consumer groups', isLoading: false })
    }
  },

  selectGroup: (groupId) => {
    set({ selectedGroupId: groupId, groupDetails: null })
  },

  loadGroupDetails: async (connectionId, groupId) => {
    set({ isLoadingDetails: true, error: null })
    try {
      set({ groupDetails: await fetchGroupDetails(connectionId, groupId), isLoadingDetails: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load group details', isLoadingDetails: false })
    }
  },

  deleteGroup: async (connectionId, groupId) => {
    set({ isLoading: true, error: null })
    try {
      const result = await window.api.kafka.deleteConsumerGroup(connectionId, groupId)
      if (!result.success) throw new Error(result.error || 'Failed to delete consumer group')
      set((state) => ({
        consumerGroups: state.consumerGroups.filter((g) => g.groupId !== groupId),
        selectedGroupId: state.selectedGroupId === groupId ? null : state.selectedGroupId,
        groupDetails: state.selectedGroupId === groupId ? null : state.groupDetails,
        isLoading: false
      }))
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete consumer group', isLoading: false })
      throw error
    }
  },

  resetOffsets: async (connectionId, groupId, topic, options) => {
    set({ isLoadingDetails: true, error: null })
    try {
      const result = await window.api.kafka.resetOffsets(connectionId, groupId, topic, options)
      if (!result.success) throw new Error(result.error || 'Failed to reset offsets')
      set({ groupDetails: await fetchGroupDetails(connectionId, groupId), isLoadingDetails: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to reset offsets', isLoadingDetails: false })
      throw error
    }
  },

  reset: () => {
    set({
      consumerGroups: [],
      selectedGroupId: null,
      groupDetails: null,
      isLoading: false,
      isLoadingDetails: false,
      error: null
    })
  }
}))

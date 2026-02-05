import { create } from 'zustand'
import type { TopicMetadata, ConfigEntry, KafkaMessage, TopicConfig, MessageOptions, ProduceMessage } from '../types/kafka.types'

interface TopicState {
  topics: string[]
  selectedTopic: string | null
  topicMetadata: TopicMetadata | null
  topicConfig: ConfigEntry[]
  messages: KafkaMessage[]
  isLoading: boolean // Kept for backward compatibility
  isLoadingTopics: boolean
  isLoadingMetadata: boolean
  isLoadingConfig: boolean
  isLoadingMessages: boolean
  error: string | null

  // Actions
  loadTopics: (connectionId: string) => Promise<void>
  selectTopic: (topic: string | null) => void
  loadTopicMetadata: (connectionId: string, topic: string) => Promise<void>
  loadTopicConfig: (connectionId: string, topic: string) => Promise<void>
  createTopic: (connectionId: string, config: TopicConfig) => Promise<void>
  deleteTopic: (connectionId: string, topic: string) => Promise<void>
  loadMessages: (connectionId: string, topic: string, options?: MessageOptions) => Promise<void>
  produceMessage: (connectionId: string, topic: string, message: ProduceMessage) => Promise<void>
  clearMessages: () => void
  reset: () => void
}

export const useTopicStore = create<TopicState>((set) => ({
  topics: [],
  selectedTopic: null,
  topicMetadata: null,
  topicConfig: [],
  messages: [],
  isLoading: false,
  isLoadingTopics: false,
  isLoadingMetadata: false,
  isLoadingConfig: false,
  isLoadingMessages: false,
  error: null,

  loadTopics: async (connectionId) => {
    set({ isLoadingTopics: true, isLoading: true, error: null })
    try {
      const topics = await window.api.kafka.getTopics(connectionId)
      set({ topics: topics.sort(), isLoadingTopics: false, isLoading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load topics', isLoadingTopics: false, isLoading: false })
    }
  },

  selectTopic: (topic) => {
    set({ selectedTopic: topic, topicMetadata: null, topicConfig: [], messages: [] })
  },

  loadTopicMetadata: async (connectionId, topic) => {
    set({ isLoadingMetadata: true, error: null })
    try {
      const metadata = await window.api.kafka.getTopicMetadata(connectionId, topic)
      set({ topicMetadata: metadata, isLoadingMetadata: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load topic metadata', isLoadingMetadata: false })
    }
  },

  loadTopicConfig: async (connectionId, topic) => {
    set({ isLoadingConfig: true, error: null })
    try {
      const config = await window.api.kafka.getTopicConfig(connectionId, topic)
      set({ topicConfig: config, isLoadingConfig: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load topic config', isLoadingConfig: false })
    }
  },

  createTopic: async (connectionId, config) => {
    set({ isLoadingTopics: true, isLoading: true, error: null })
    try {
      await window.api.kafka.createTopic(connectionId, config)
      const topics = await window.api.kafka.getTopics(connectionId)
      set({ topics: topics.sort(), isLoadingTopics: false, isLoading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create topic', isLoadingTopics: false, isLoading: false })
      throw error
    }
  },

  deleteTopic: async (connectionId, topic) => {
    set({ isLoadingTopics: true, isLoading: true, error: null })
    try {
      await window.api.kafka.deleteTopic(connectionId, topic)
      set((state) => ({
        topics: state.topics.filter((t) => t !== topic),
        selectedTopic: state.selectedTopic === topic ? null : state.selectedTopic,
        isLoadingTopics: false,
        isLoading: false
      }))
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete topic', isLoadingTopics: false, isLoading: false })
      throw error
    }
  },

  loadMessages: async (connectionId, topic, options) => {
    set({ isLoadingMessages: true, error: null })
    try {
      const result = await window.api.kafka.getMessages(connectionId, topic, options) as unknown
      // Handle structured response format from IPC handler
      if (result && typeof result === 'object' && 'success' in result) {
        const typedResult = result as { success: boolean; error?: string; data?: { messages: KafkaMessage[] } }
        if (!typedResult.success) {
          throw new Error(typedResult.error || 'Failed to load messages')
        }
        // New format: { success: true, data: { messages, hasMore, nextOffset } }
        const messages = typedResult.data?.messages ?? []
        set({ messages, isLoadingMessages: false })
      } else if (Array.isArray(result)) {
        // Legacy format: direct array
        set({ messages: result as KafkaMessage[], isLoadingMessages: false })
      } else {
        // Fallback for other formats
        const typedResult = result as { messages?: KafkaMessage[] }
        const messages = typedResult?.messages ?? []
        set({ messages, isLoadingMessages: false })
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load messages', isLoadingMessages: false })
    }
  },

  produceMessage: async (connectionId, topic, message) => {
    set({ isLoading: true, error: null })
    try {
      await window.api.kafka.produceMessage(connectionId, topic, message)
      set({ isLoading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to produce message', isLoading: false })
      throw error
    }
  },

  clearMessages: () => {
    set({ messages: [] })
  },

  reset: () => {
    set({
      topics: [],
      selectedTopic: null,
      topicMetadata: null,
      topicConfig: [],
      messages: [],
      isLoading: false,
      isLoadingTopics: false,
      isLoadingMetadata: false,
      isLoadingConfig: false,
      isLoadingMessages: false,
      error: null
    })
  }
}))

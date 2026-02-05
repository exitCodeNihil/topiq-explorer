import { create } from 'zustand'
import type { TopicMetadata, ConfigEntry, KafkaMessage, TopicConfig, MessageOptions, ProduceMessage } from '../types/kafka.types'

interface TopicState {
  topics: string[]
  selectedTopic: string | null
  topicMetadata: TopicMetadata | null
  topicConfig: ConfigEntry[]
  messages: KafkaMessage[]
  isLoading: boolean
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
  isLoadingMessages: false,
  error: null,

  loadTopics: async (connectionId) => {
    set({ isLoading: true, error: null })
    try {
      const topics = await window.api.kafka.getTopics(connectionId)
      set({ topics: topics.sort(), isLoading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load topics', isLoading: false })
    }
  },

  selectTopic: (topic) => {
    set({ selectedTopic: topic, topicMetadata: null, topicConfig: [], messages: [] })
  },

  loadTopicMetadata: async (connectionId, topic) => {
    set({ isLoading: true, error: null })
    try {
      const metadata = await window.api.kafka.getTopicMetadata(connectionId, topic)
      set({ topicMetadata: metadata, isLoading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load topic metadata', isLoading: false })
    }
  },

  loadTopicConfig: async (connectionId, topic) => {
    set({ isLoading: true, error: null })
    try {
      const config = await window.api.kafka.getTopicConfig(connectionId, topic)
      set({ topicConfig: config, isLoading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load topic config', isLoading: false })
    }
  },

  createTopic: async (connectionId, config) => {
    set({ isLoading: true, error: null })
    try {
      await window.api.kafka.createTopic(connectionId, config)
      const topics = await window.api.kafka.getTopics(connectionId)
      set({ topics: topics.sort(), isLoading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create topic', isLoading: false })
      throw error
    }
  },

  deleteTopic: async (connectionId, topic) => {
    set({ isLoading: true, error: null })
    try {
      await window.api.kafka.deleteTopic(connectionId, topic)
      set((state) => ({
        topics: state.topics.filter((t) => t !== topic),
        selectedTopic: state.selectedTopic === topic ? null : state.selectedTopic,
        isLoading: false
      }))
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete topic', isLoading: false })
      throw error
    }
  },

  loadMessages: async (connectionId, topic, options) => {
    set({ isLoadingMessages: true, error: null })
    try {
      const messages = await window.api.kafka.getMessages(connectionId, topic, options)
      set({ messages, isLoadingMessages: false })
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
      isLoadingMessages: false,
      error: null
    })
  }
}))

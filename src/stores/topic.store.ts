import { create } from 'zustand'
import { useConnectionStore } from './connection.store'
import type { TopicMetadata, ConfigEntry, KafkaMessage, TopicConfig, MessageOptions, ProduceMessage, SearchMessageOptions } from '../types/kafka.types'

interface MessageToRepublish {
  key?: string
  value: string
  headers?: Record<string, string>
  partition?: number
}

// Track request IDs to prevent stale data from race conditions
let messageRequestId = 0
let searchRequestCounter = 0
// Track in-flight requests to prevent duplicates
const inFlightRequests = new Map<string, Promise<void>>()
// Maximum number of search results to keep in memory
const MAX_SEARCH_RESULTS = 10_000

interface TopicState {
  topics: string[]
  selectedTopic: string | null
  topicMetadata: TopicMetadata | null
  topicConfig: ConfigEntry[]
  messages: KafkaMessage[]
  messageToRepublish: MessageToRepublish | null
  isLoadingTopics: boolean
  isLoadingMetadata: boolean
  isLoadingConfig: boolean
  isLoadingMessages: boolean
  error: string | null
  messageError: string | null
  hasMore: boolean
  nextOffset: string | null
  nextPartition: number | undefined
  nextOffsets: Record<number, string> | undefined

  // Server-side search state
  isSearchActive: boolean
  isSearching: boolean
  searchQuery: string
  searchResults: KafkaMessage[]
  searchScanned: number
  searchHasMore: boolean
  searchNextOffset: string | null
  searchNextPartition: number | undefined
  searchRequestId: string | null
  searchError: string | null

  // Actions
  loadTopics: (connectionId: string) => Promise<void>
  selectTopic: (topic: string | null) => void
  loadTopicMetadata: (connectionId: string, topic: string) => Promise<void>
  loadTopicConfig: (connectionId: string, topic: string) => Promise<void>
  createTopic: (connectionId: string, config: TopicConfig) => Promise<void>
  deleteTopic: (connectionId: string, topic: string) => Promise<void>
  loadMessages: (connectionId: string, topic: string, options?: MessageOptions) => Promise<void>
  produceMessage: (connectionId: string, topic: string, message: ProduceMessage) => Promise<void>
  setMessageToRepublish: (message: MessageToRepublish | null) => void
  searchMessages: (connectionId: string, topic: string, query: string, partition?: number) => Promise<void>
  searchMoreMessages: (connectionId: string, topic: string) => Promise<void>
  clearSearch: () => void
  cancelSearch: (connectionId: string) => Promise<void>
  reset: () => void
}

const emptySearch = {
  isSearchActive: false,
  isSearching: false,
  searchQuery: '',
  searchResults: [] as KafkaMessage[],
  searchScanned: 0,
  searchHasMore: false,
  searchNextOffset: null,
  searchNextPartition: undefined,
  searchRequestId: null,
  searchError: null
}

const emptyMessages = {
  messages: [] as KafkaMessage[],
  hasMore: false,
  nextOffset: null,
  nextPartition: undefined,
  nextOffsets: undefined,
  messageError: null
}

async function fetchTopics(connectionId: string): Promise<string[]> {
  const result = await window.api.kafka.getTopics(connectionId)
  if (!result.success) throw new Error(result.error || 'Failed to load topics')
  return [...result.data].sort()
}

function cancelActiveSearch(connectionId: string | null, requestId: string | null) {
  if (!connectionId || !requestId) return
  window.api.kafka.cancelSearch(connectionId, requestId).catch(() => {})
}

export const useTopicStore = create<TopicState>((set, get) => ({
  topics: [],
  selectedTopic: null,
  topicMetadata: null,
  topicConfig: [],
  messageToRepublish: null,
  isLoadingTopics: false,
  isLoadingMetadata: false,
  isLoadingConfig: false,
  isLoadingMessages: false,
  error: null,
  ...emptyMessages,
  ...emptySearch,

  loadTopics: async (connectionId) => {
    // Deduplicate in-flight requests
    const requestKey = `loadTopics:${connectionId}`
    const existingRequest = inFlightRequests.get(requestKey)
    if (existingRequest) return existingRequest

    const doLoad = async () => {
      set({ isLoadingTopics: true, error: null })
      try {
        set({ topics: await fetchTopics(connectionId), isLoadingTopics: false })
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to load topics', isLoadingTopics: false })
      } finally {
        inFlightRequests.delete(requestKey)
      }
    }

    const promise = doLoad()
    inFlightRequests.set(requestKey, promise)
    return promise
  },

  selectTopic: (topic) => {
    cancelActiveSearch(useConnectionStore.getState().activeConnectionId, get().searchRequestId)
    set({ selectedTopic: topic, topicMetadata: null, topicConfig: [], ...emptyMessages, ...emptySearch })
  },

  loadTopicMetadata: async (connectionId, topic) => {
    set({ isLoadingMetadata: true, error: null })
    try {
      const result = await window.api.kafka.getTopicMetadata(connectionId, topic)
      if (get().selectedTopic !== topic) return
      if (!result.success) throw new Error(result.error || 'Failed to load topic metadata')
      set({ topicMetadata: result.data, isLoadingMetadata: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load topic metadata', isLoadingMetadata: false })
    }
  },

  loadTopicConfig: async (connectionId, topic) => {
    set({ isLoadingConfig: true, error: null })
    try {
      const result = await window.api.kafka.getTopicConfig(connectionId, topic)
      if (get().selectedTopic !== topic) return
      if (!result.success) throw new Error(result.error || 'Failed to load topic config')
      set({ topicConfig: result.data, isLoadingConfig: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load topic config', isLoadingConfig: false })
    }
  },

  createTopic: async (connectionId, config) => {
    set({ isLoadingTopics: true, error: null })
    try {
      const result = await window.api.kafka.createTopic(connectionId, config)
      if (!result.success) throw new Error(result.error || 'Failed to create topic')
      set({ topics: await fetchTopics(connectionId), isLoadingTopics: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create topic', isLoadingTopics: false })
      throw error
    }
  },

  deleteTopic: async (connectionId, topic) => {
    set({ isLoadingTopics: true, error: null })
    try {
      const result = await window.api.kafka.deleteTopic(connectionId, topic)
      if (!result.success) throw new Error(result.error || 'Failed to delete topic')
      set((state) => ({
        topics: state.topics.filter((t) => t !== topic),
        selectedTopic: state.selectedTopic === topic ? null : state.selectedTopic,
        isLoadingTopics: false
      }))
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete topic', isLoadingTopics: false })
      throw error
    }
  },

  loadMessages: async (connectionId, topic, options) => {
    // Deduplicate identical in-flight requests
    const requestKey = `loadMessages:${connectionId}:${topic}:${JSON.stringify(options ?? {})}`
    const existingRequest = inFlightRequests.get(requestKey)
    if (existingRequest) return existingRequest

    const doLoad = async () => {
      // Track this request to prevent stale data from race conditions
      const currentRequestId = ++messageRequestId
      set({ isLoadingMessages: true, error: null, ...emptyMessages, messages: get().messages })
      try {
        const result = await window.api.kafka.getMessages(connectionId, topic, options)
        // Discard stale response if a newer request was made
        if (currentRequestId !== messageRequestId) return
        if (!result.success) throw new Error(result.error || 'Failed to load messages')
        const data = result.data
        set({
          messages: data.messages,
          isLoadingMessages: false,
          hasMore: data.hasMore,
          nextOffset: data.nextOffset,
          nextPartition: data.nextPartition,
          nextOffsets: data.nextOffsets
        })
      } catch (error) {
        if (currentRequestId !== messageRequestId) return
        const errorMsg = error instanceof Error ? error.message : 'Failed to load messages'
        set({ error: errorMsg, messageError: errorMsg, isLoadingMessages: false })
      } finally {
        inFlightRequests.delete(requestKey)
      }
    }

    const promise = doLoad()
    inFlightRequests.set(requestKey, promise)
    return promise
  },

  produceMessage: async (connectionId, topic, message) => {
    set({ error: null })
    try {
      const result = await window.api.kafka.produceMessage(connectionId, topic, message)
      if (!result.success) throw new Error(result.error || 'Failed to produce message')
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to produce message' })
      throw error
    }
  },

  setMessageToRepublish: (message) => {
    set({ messageToRepublish: message })
  },

  searchMessages: async (connectionId, topic, query, partition?) => {
    cancelActiveSearch(connectionId, get().searchRequestId)

    const currentRequestId = `search-${++searchRequestCounter}`
    set({ ...emptySearch, isSearchActive: true, isSearching: true, searchQuery: query, searchRequestId: currentRequestId })

    try {
      const options: SearchMessageOptions = { query, partition, requestId: currentRequestId }
      const result = await window.api.kafka.searchMessages(connectionId, topic, options)

      // Stale-response detection
      if (get().searchRequestId !== currentRequestId) return
      if (!result.success) throw new Error(result.error || 'Search failed')
      const data = result.data
      set({
        searchResults: data.matches,
        searchScanned: data.scanned,
        searchHasMore: data.hasMore,
        searchNextOffset: data.nextOffset,
        searchNextPartition: data.nextPartition,
        isSearching: false
      })
    } catch (error) {
      if (get().searchRequestId !== currentRequestId) return
      set({ searchError: error instanceof Error ? error.message : 'Search failed', isSearching: false })
    }
  },

  searchMoreMessages: async (connectionId, topic) => {
    const state = get()
    if (!state.searchHasMore || !state.searchNextOffset || state.isSearching) return

    const currentRequestId = `search-${++searchRequestCounter}`
    set({ isSearching: true, searchRequestId: currentRequestId })

    try {
      const options: SearchMessageOptions = {
        query: state.searchQuery,
        partition: state.searchNextPartition,
        fromOffset: state.searchNextOffset,
        fromPartition: state.searchNextPartition,
        requestId: currentRequestId
      }
      const result = await window.api.kafka.searchMessages(connectionId, topic, options)

      if (get().searchRequestId !== currentRequestId) return
      if (!result.success) throw new Error(result.error || 'Search failed')
      const data = result.data
      set((s) => {
        // Cap search results to prevent unbounded memory growth
        const combined = [...s.searchResults, ...data.matches].slice(-MAX_SEARCH_RESULTS)
        return {
          searchResults: combined,
          searchScanned: s.searchScanned + data.scanned,
          searchHasMore: data.hasMore,
          searchNextOffset: data.nextOffset,
          searchNextPartition: data.nextPartition,
          isSearching: false
        }
      })
    } catch (error) {
      if (get().searchRequestId !== currentRequestId) return
      set({ searchError: error instanceof Error ? error.message : 'Search failed', isSearching: false })
    }
  },

  clearSearch: () => {
    set({ ...emptySearch })
  },

  cancelSearch: async (connectionId) => {
    cancelActiveSearch(connectionId, get().searchRequestId)
    set({ isSearching: false })
  },

  reset: () => {
    set({
      topics: [],
      selectedTopic: null,
      topicMetadata: null,
      topicConfig: [],
      messageToRepublish: null,
      isLoadingTopics: false,
      isLoadingMetadata: false,
      isLoadingConfig: false,
      isLoadingMessages: false,
      error: null,
      ...emptyMessages,
      ...emptySearch
    })
  }
}))

// Reset topic store when active connection changes to prevent stale data from previous cluster
let _prevConnectionId: string | null = useConnectionStore.getState().activeConnectionId
useConnectionStore.subscribe((state) => {
  if (state.activeConnectionId !== _prevConnectionId) {
    _prevConnectionId = state.activeConnectionId
    useTopicStore.getState().reset()
  }
})

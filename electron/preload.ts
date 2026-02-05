import { contextBridge, ipcRenderer } from 'electron'

export interface KafkaConnection {
  id: string
  name: string
  brokers: string[]
  ssl?: boolean
  sasl?: {
    mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512'
    username: string
    password: string
  }
  schemaRegistry?: {
    url: string
    username?: string
    password?: string
  }
  color?: string
  createdAt: number
  updatedAt: number
}

export interface TopicConfig {
  name: string
  numPartitions: number
  replicationFactor: number
  configEntries?: Record<string, string>
}

export interface MessageOptions {
  partition?: number
  fromOffset?: string
  fromTimestamp?: number
  limit?: number
}

export interface ProduceMessage {
  key?: string
  value: string
  headers?: Record<string, string>
  partition?: number
}

export interface ResetOffsetOptions {
  type: 'earliest' | 'latest' | 'timestamp' | 'offset'
  timestamp?: number
  offset?: string
  partitions?: number[]
}

const api = {
  // Connection operations
  connections: {
    getAll: (): Promise<KafkaConnection[]> => ipcRenderer.invoke('connections:getAll'),
    get: (id: string): Promise<KafkaConnection | undefined> => ipcRenderer.invoke('connections:get', id),
    save: (connection: Omit<KafkaConnection, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<KafkaConnection> =>
      ipcRenderer.invoke('connections:save', connection),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('connections:delete', id),
    test: (connection: Omit<KafkaConnection, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('connections:test', connection)
  },

  // Kafka operations
  kafka: {
    connect: (connectionId: string): Promise<void> => ipcRenderer.invoke('kafka:connect', connectionId),
    disconnect: (connectionId: string): Promise<void> => ipcRenderer.invoke('kafka:disconnect', connectionId),

    // Topics
    getTopics: (connectionId: string): Promise<string[]> => ipcRenderer.invoke('kafka:getTopics', connectionId),
    getTopicMetadata: (connectionId: string, topic: string) => ipcRenderer.invoke('kafka:getTopicMetadata', connectionId, topic),
    getTopicConfig: (connectionId: string, topic: string) => ipcRenderer.invoke('kafka:getTopicConfig', connectionId, topic),
    createTopic: (connectionId: string, config: TopicConfig) => ipcRenderer.invoke('kafka:createTopic', connectionId, config),
    deleteTopic: (connectionId: string, topic: string) => ipcRenderer.invoke('kafka:deleteTopic', connectionId, topic),

    // Messages
    getMessages: (connectionId: string, topic: string, options?: MessageOptions) =>
      ipcRenderer.invoke('kafka:getMessages', connectionId, topic, options),
    produceMessage: (connectionId: string, topic: string, message: ProduceMessage) =>
      ipcRenderer.invoke('kafka:produceMessage', connectionId, topic, message),

    // Consumer Groups
    getConsumerGroups: (connectionId: string) => ipcRenderer.invoke('kafka:getConsumerGroups', connectionId),
    getConsumerGroupDetails: (connectionId: string, groupId: string) =>
      ipcRenderer.invoke('kafka:getConsumerGroupDetails', connectionId, groupId),
    deleteConsumerGroup: (connectionId: string, groupId: string) =>
      ipcRenderer.invoke('kafka:deleteConsumerGroup', connectionId, groupId),
    resetOffsets: (connectionId: string, groupId: string, topic: string, options: ResetOffsetOptions) =>
      ipcRenderer.invoke('kafka:resetOffsets', connectionId, groupId, topic, options)
  }
}

contextBridge.exposeInMainWorld('api', api)

declare global {
  interface Window {
    api: typeof api
  }
}

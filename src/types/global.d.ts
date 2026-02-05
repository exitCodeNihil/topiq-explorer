interface KafkaConnection {
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

interface TopicConfig {
  name: string
  numPartitions: number
  replicationFactor: number
  configEntries?: Record<string, string>
}

interface MessageOptions {
  partition?: number
  fromOffset?: string
  fromTimestamp?: number
  limit?: number
}

interface ProduceMessage {
  key?: string
  value: string
  headers?: Record<string, string>
  partition?: number
}

interface ResetOffsetOptions {
  type: 'earliest' | 'latest' | 'timestamp' | 'offset'
  timestamp?: number
  offset?: string
  partitions?: number[]
}

interface WindowApi {
  connections: {
    getAll: () => Promise<KafkaConnection[]>
    get: (id: string) => Promise<KafkaConnection | undefined>
    save: (connection: Omit<KafkaConnection, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<KafkaConnection>
    delete: (id: string) => Promise<void>
    test: (connection: Omit<KafkaConnection, 'id' | 'createdAt' | 'updatedAt'>) => Promise<{ success: boolean; error?: string }>
  }
  kafka: {
    connect: (connectionId: string) => Promise<void>
    disconnect: (connectionId: string) => Promise<void>
    getTopics: (connectionId: string) => Promise<string[]>
    getTopicMetadata: (connectionId: string, topic: string) => Promise<any>
    getTopicConfig: (connectionId: string, topic: string) => Promise<any>
    createTopic: (connectionId: string, config: TopicConfig) => Promise<void>
    deleteTopic: (connectionId: string, topic: string) => Promise<void>
    getMessages: (connectionId: string, topic: string, options?: MessageOptions) => Promise<any[]>
    produceMessage: (connectionId: string, topic: string, message: ProduceMessage) => Promise<void>
    getConsumerGroups: (connectionId: string) => Promise<any[]>
    getConsumerGroupDetails: (connectionId: string, groupId: string) => Promise<any>
    deleteConsumerGroup: (connectionId: string, groupId: string) => Promise<void>
    resetOffsets: (connectionId: string, groupId: string, topic: string, options: ResetOffsetOptions) => Promise<void>
  }
}

declare global {
  interface Window {
    api: WindowApi
  }
}

export {}

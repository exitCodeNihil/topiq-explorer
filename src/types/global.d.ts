import type {
  KafkaConnection,
  TopicConfig,
  TopicMetadata,
  ConfigEntry,
  ClusterInfo,
  MessageOptions,
  MessageFetchResult,
  SearchMessageOptions,
  SearchMessageResult,
  ProduceMessage,
  ConsumerGroup,
  ConsumerGroupDetails,
  ResetOffsetOptions,
  UpdateCheckResult,
  DownloadProgress,
  AppSettings,
  IpcResponse
} from '../../shared/types'

type ConnectionInput = Omit<KafkaConnection, 'id' | 'createdAt' | 'updatedAt'>

declare global {
  interface Window {
    api: {
      connections: {
        getAll: () => Promise<IpcResponse<KafkaConnection[]>>
        get: (id: string) => Promise<IpcResponse<KafkaConnection | undefined>>
        save: (connection: ConnectionInput & { id?: string }) => Promise<IpcResponse<KafkaConnection>>
        delete: (id: string) => Promise<IpcResponse<void>>
        test: (connection: ConnectionInput) => Promise<IpcResponse<{ success: boolean; error?: string }>>
        pickCertFile: () => Promise<IpcResponse<{ filename: string; content: string } | null>>
      }
      kafka: {
        connect: (connectionId: string) => Promise<IpcResponse<void>>
        disconnect: (connectionId: string) => Promise<IpcResponse<void>>
        getClusterInfo: (connectionId: string) => Promise<IpcResponse<ClusterInfo>>
        getTopics: (connectionId: string) => Promise<IpcResponse<string[]>>
        getTopicMetadata: (connectionId: string, topic: string) => Promise<IpcResponse<TopicMetadata>>
        getTopicConfig: (connectionId: string, topic: string) => Promise<IpcResponse<ConfigEntry[]>>
        getBrokerConfig: (connectionId: string) => Promise<IpcResponse<ConfigEntry[]>>
        createTopic: (connectionId: string, config: TopicConfig) => Promise<IpcResponse<void>>
        deleteTopic: (connectionId: string, topic: string) => Promise<IpcResponse<void>>
        getMessages: (connectionId: string, topic: string, options?: MessageOptions) => Promise<IpcResponse<MessageFetchResult>>
        produceMessage: (connectionId: string, topic: string, message: ProduceMessage) => Promise<IpcResponse<void>>
        getConsumerGroups: (connectionId: string) => Promise<IpcResponse<ConsumerGroup[]>>
        getConsumerGroupDetails: (connectionId: string, groupId: string) => Promise<IpcResponse<ConsumerGroupDetails>>
        deleteConsumerGroup: (connectionId: string, groupId: string) => Promise<IpcResponse<void>>
        resetOffsets: (connectionId: string, groupId: string, topic: string, options: ResetOffsetOptions) => Promise<IpcResponse<void>>
        deleteRecords: (connectionId: string, topic: string, partitionOffsets: { partition: number; offset: string }[]) => Promise<IpcResponse<void>>
        searchMessages: (connectionId: string, topic: string, options: SearchMessageOptions) => Promise<IpcResponse<SearchMessageResult>>
        cancelSearch: (connectionId: string, requestId: string) => Promise<IpcResponse<void>>
      }
      settings: {
        get: () => Promise<IpcResponse<AppSettings>>
        set: (patch: Partial<AppSettings>) => Promise<IpcResponse<AppSettings>>
      }
      updater: {
        checkForUpdates: () => Promise<UpdateCheckResult>
        downloadUpdate: () => Promise<{ success: boolean }>
        installUpdate: () => Promise<void>
        getVersion: () => Promise<string>
        onCheckingForUpdate: (callback: () => void) => () => void
        onUpdateAvailable: (callback: (info: UpdateCheckResult) => void) => () => void
        onUpdateNotAvailable: (callback: () => void) => () => void
        onDownloadProgress: (callback: (progress: DownloadProgress) => void) => () => void
        onUpdateDownloaded: (callback: (info: UpdateCheckResult) => void) => () => void
        onError: (callback: (error: string) => void) => () => void
      }
    }
  }
}

export {}

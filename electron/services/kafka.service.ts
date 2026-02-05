import { Kafka, Admin, Producer, Consumer, logLevel, SASLOptions } from 'kafkajs'
import { randomUUID } from 'crypto'

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

interface KafkaInstance {
  kafka: Kafka
  admin: Admin
  producer: Producer
  consumers: Map<string, Consumer>
}

export class KafkaService {
  private instances: Map<string, KafkaInstance> = new Map()

  private createKafkaClient(connection: KafkaConnection): Kafka {
    const sasl: SASLOptions | undefined = connection.sasl
      ? {
          mechanism: connection.sasl.mechanism,
          username: connection.sasl.username,
          password: connection.sasl.password
        }
      : undefined

    return new Kafka({
      clientId: `kafka-explorer-${connection.id}`,
      brokers: connection.brokers,
      ssl: connection.ssl,
      sasl,
      logLevel: logLevel.WARN,
      connectionTimeout: 10000,
      requestTimeout: 30000
    })
  }

  async testConnection(connection: Omit<KafkaConnection, 'id'>): Promise<{ success: boolean; error?: string }> {
    const tempConnection = { ...connection, id: 'test' }
    const kafka = this.createKafkaClient(tempConnection)
    const admin = kafka.admin()

    try {
      await admin.connect()
      await admin.listTopics()
      await admin.disconnect()
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  async connect(connection: KafkaConnection): Promise<void> {
    if (this.instances.has(connection.id)) {
      return
    }

    const kafka = this.createKafkaClient(connection)
    const admin = kafka.admin()
    const producer = kafka.producer()

    await admin.connect()
    await producer.connect()

    this.instances.set(connection.id, {
      kafka,
      admin,
      producer,
      consumers: new Map()
    })
  }

  async disconnect(connectionId: string): Promise<void> {
    const instance = this.instances.get(connectionId)
    if (!instance) return

    for (const consumer of instance.consumers.values()) {
      await consumer.disconnect()
    }
    await instance.producer.disconnect()
    await instance.admin.disconnect()

    this.instances.delete(connectionId)
  }

  async disconnectAll(): Promise<void> {
    const connectionIds = Array.from(this.instances.keys())
    await Promise.all(connectionIds.map((id) => this.disconnect(id)))
  }

  private getInstance(connectionId: string): KafkaInstance {
    const instance = this.instances.get(connectionId)
    if (!instance) {
      throw new Error('Not connected to this cluster')
    }
    return instance
  }

  async getTopics(connectionId: string): Promise<string[]> {
    const { admin } = this.getInstance(connectionId)
    return admin.listTopics()
  }

  async getTopicMetadata(connectionId: string, topic: string) {
    const { admin } = this.getInstance(connectionId)
    const metadata = await admin.fetchTopicMetadata({ topics: [topic] })
    const topicMetadata = metadata.topics[0]

    const offsets = await admin.fetchTopicOffsets(topic)

    return {
      name: topicMetadata.name,
      partitions: topicMetadata.partitions.map((p, index) => ({
        partition: p.partitionId,
        leader: p.leader,
        replicas: p.replicas,
        isr: p.isr,
        offset: offsets[index]?.offset || '0',
        high: offsets[index]?.high || '0',
        low: offsets[index]?.low || '0'
      }))
    }
  }

  async getTopicConfig(connectionId: string, topic: string) {
    const { admin } = this.getInstance(connectionId)
    const configs = await admin.describeConfigs({
      includeSynonyms: false,
      resources: [{ type: 2, name: topic }] // 2 = TOPIC
    })

    return configs.resources[0]?.configEntries || []
  }

  async createTopic(connectionId: string, config: TopicConfig): Promise<void> {
    const { admin } = this.getInstance(connectionId)
    await admin.createTopics({
      topics: [
        {
          topic: config.name,
          numPartitions: config.numPartitions,
          replicationFactor: config.replicationFactor,
          configEntries: config.configEntries
            ? Object.entries(config.configEntries).map(([name, value]) => ({ name, value }))
            : undefined
        }
      ]
    })
  }

  async deleteTopic(connectionId: string, topic: string): Promise<void> {
    const { admin } = this.getInstance(connectionId)
    await admin.deleteTopics({ topics: [topic] })
  }

  async getMessages(connectionId: string, topic: string, options: MessageOptions = {}) {
    const { kafka, admin } = this.getInstance(connectionId)
    const { partition, fromOffset, fromTimestamp, limit = 100 } = options

    // Hard cap at 500 messages maximum
    const maxLimit = Math.min(limit, 500)
    const groupId = `kafka-explorer-consumer-${randomUUID()}`
    const consumer = kafka.consumer({ groupId })

    try {
      await consumer.connect()

      const topicOffsets = await admin.fetchTopicOffsets(topic)
      const _partitions =
        partition !== undefined
          ? [{ partition, offset: fromOffset || topicOffsets.find((p) => p.partition === partition)?.low || '0' }]
          : topicOffsets.map((p) => ({
              partition: p.partition,
              offset: fromOffset || p.low || '0'
            }))
      void _partitions // Prepared for future use with seek functionality

      await consumer.subscribe({ topic, fromBeginning: !fromOffset && !fromTimestamp })

      const messages: Array<{
        partition: number
        offset: string
        timestamp: string
        key: string | null
        value: string | null
        headers: Record<string, string>
      }> = []

      return new Promise((resolve, reject) => {
        let messageCount = 0
        let lastOffset: string | null = null
        let lastPartition: number | null = null

        const timeout = setTimeout(() => {
          consumer.disconnect().then(() =>
            resolve({
              messages,
              hasMore: false,
              nextOffset: null
            })
          )
        }, 5000)

        consumer
          .run({
            eachMessage: async ({ partition: msgPartition, message }) => {
              if (messageCount >= maxLimit) {
                clearTimeout(timeout)
                await consumer.disconnect()
                resolve({
                  messages,
                  hasMore: true,
                  nextOffset: lastOffset ? String(BigInt(lastOffset) + 1n) : null,
                  nextPartition: lastPartition
                })
                return
              }

              const headers: Record<string, string> = {}
              if (message.headers) {
                for (const [key, value] of Object.entries(message.headers)) {
                  headers[key] = value?.toString() || ''
                }
              }

              messages.push({
                partition: msgPartition,
                offset: message.offset,
                timestamp: message.timestamp,
                key: message.key?.toString() || null,
                value: message.value?.toString() || null,
                headers
              })

              messageCount++
              lastOffset = message.offset
              lastPartition = msgPartition

              if (messageCount >= maxLimit) {
                clearTimeout(timeout)
                await consumer.disconnect()
                resolve({
                  messages,
                  hasMore: true,
                  nextOffset: String(BigInt(lastOffset) + 1n),
                  nextPartition: lastPartition
                })
              }
            }
          })
          .catch((error) => {
            clearTimeout(timeout)
            consumer.disconnect().then(() => reject(error))
          })
      })
    } catch (error) {
      await consumer.disconnect()
      throw error
    }
  }

  async produceMessage(connectionId: string, topic: string, message: ProduceMessage): Promise<void> {
    const { producer } = this.getInstance(connectionId)

    const headers: Record<string, string> = message.headers || {}

    await producer.send({
      topic,
      messages: [
        {
          key: message.key,
          value: message.value,
          headers,
          partition: message.partition
        }
      ]
    })
  }

  async getConsumerGroups(connectionId: string) {
    const { admin } = this.getInstance(connectionId)
    const groups = await admin.listGroups()

    return groups.groups.map((g) => ({
      groupId: g.groupId,
      protocolType: g.protocolType
    }))
  }

  async getConsumerGroupDetails(connectionId: string, groupId: string) {
    const { admin } = this.getInstance(connectionId)

    const [description, offsets] = await Promise.all([
      admin.describeGroups([groupId]),
      admin.fetchOffsets({ groupId })
    ])

    const group = description.groups[0]

    // Batch fetch all topic offsets at once to avoid N+1 queries
    const topics = [...new Set(offsets.map((o) => o.topic))]
    const topicHighOffsetsMap: Record<string, Array<{ partition: number; high: string }>> = {}

    try {
      // Fetch all topic offsets in parallel (single batch operation)
      const allTopicOffsets = await Promise.all(
        topics.map(async (topic) => {
          try {
            const offsets = await admin.fetchTopicOffsets(topic)
            return { topic, offsets, error: null }
          } catch (error) {
            return { topic, offsets: null, error }
          }
        })
      )

      for (const result of allTopicOffsets) {
        if (result.offsets) {
          topicHighOffsetsMap[result.topic] = result.offsets.map((o) => ({
            partition: o.partition,
            high: o.high || '0'
          }))
        }
      }
    } catch {
      // If batch fetch fails, continue with empty map (lag will be null)
    }

    const topicOffsets: Record<string, Array<{ partition: number; offset: string; lag: number | null }>> = {}

    for (const topicOffset of offsets) {
      const topic = topicOffset.topic
      if (!topicOffsets[topic]) {
        topicOffsets[topic] = []
      }

      const topicHighOffsets = topicHighOffsetsMap[topic]

      for (const partitionData of topicOffset.partitions) {
        if (topicHighOffsets) {
          const partitionInfo = topicHighOffsets.find((p) => p.partition === partitionData.partition)
          const currentOffset = parseInt(partitionData.offset, 10)
          const highOffset = parseInt(partitionInfo?.high || '0', 10)
          const lag = Math.max(0, highOffset - currentOffset)

          topicOffsets[topic].push({
            partition: partitionData.partition,
            offset: partitionData.offset,
            lag
          })
        } else {
          // Return null for lag when we couldn't fetch offsets (not 0, which is misleading)
          topicOffsets[topic].push({
            partition: partitionData.partition,
            offset: partitionData.offset,
            lag: null
          })
        }
      }
    }

    return {
      groupId: group.groupId,
      state: group.state,
      protocolType: group.protocolType,
      protocol: group.protocol,
      members: group.members.map((m) => ({
        memberId: m.memberId,
        clientId: m.clientId,
        clientHost: m.clientHost
      })),
      offsets: topicOffsets
    }
  }

  async deleteConsumerGroup(connectionId: string, groupId: string): Promise<void> {
    const { admin } = this.getInstance(connectionId)
    await admin.deleteGroups([groupId])
  }

  async resetOffsets(
    connectionId: string,
    groupId: string,
    topic: string,
    options: ResetOffsetOptions
  ): Promise<void> {
    const { admin } = this.getInstance(connectionId)

    const topicOffsets = await admin.fetchTopicOffsets(topic)
    const partitions =
      options.partitions || topicOffsets.map((p) => p.partition)

    let newOffsets: Array<{ partition: number; offset: string }>

    switch (options.type) {
      case 'earliest':
        newOffsets = partitions.map((partition) => {
          const info = topicOffsets.find((p) => p.partition === partition)
          return { partition, offset: info?.low || '0' }
        })
        break
      case 'latest':
        newOffsets = partitions.map((partition) => {
          const info = topicOffsets.find((p) => p.partition === partition)
          return { partition, offset: info?.high || '0' }
        })
        break
      case 'timestamp':
        if (!options.timestamp) throw new Error('Timestamp required')
        const offsetsByTimestamp = await admin.fetchTopicOffsetsByTimestamp(topic, options.timestamp)
        newOffsets = partitions.map((partition) => {
          const info = offsetsByTimestamp.find((p) => p.partition === partition)
          return { partition, offset: info?.offset || '0' }
        })
        break
      case 'offset':
        if (!options.offset) throw new Error('Offset required')
        newOffsets = partitions.map((partition) => ({
          partition,
          offset: options.offset!
        }))
        break
      default:
        throw new Error('Invalid reset type')
    }

    await admin.setOffsets({
      groupId,
      topic,
      partitions: newOffsets
    })
  }
}

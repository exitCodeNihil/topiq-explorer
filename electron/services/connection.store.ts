import Store from 'electron-store'
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
  schemaRegistry?: {
    url: string
    username?: string
    password?: string
  }
  color?: string
  createdAt: number
  updatedAt: number
}

interface StoreSchema {
  connections: Record<string, KafkaConnection>
}

export class ConnectionStore {
  private store: Store<StoreSchema>

  constructor() {
    this.store = new Store<StoreSchema>({
      name: 'kafka-explorer-connections',
      defaults: {
        connections: {}
      },
      encryptionKey: 'kafka-explorer-encryption-key'
    })
  }

  getAll(): KafkaConnection[] {
    const connections = this.store.get('connections', {})
    return Object.values(connections).sort((a, b) => a.name.localeCompare(b.name))
  }

  get(id: string): KafkaConnection | undefined {
    const connections = this.store.get('connections', {})
    return connections[id]
  }

  save(connection: Omit<KafkaConnection, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): KafkaConnection {
    const connections = this.store.get('connections', {})
    const now = Date.now()

    const id = connection.id || randomUUID()
    const existing = connections[id]

    const savedConnection: KafkaConnection = {
      ...connection,
      id,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    }

    connections[id] = savedConnection
    this.store.set('connections', connections)

    return savedConnection
  }

  delete(id: string): void {
    const connections = this.store.get('connections', {})
    delete connections[id]
    this.store.set('connections', connections)
  }
}

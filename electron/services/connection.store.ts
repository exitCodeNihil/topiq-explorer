import Store from 'electron-store'
import { randomUUID, createHash } from 'crypto'
import { machineIdSync } from 'node-machine-id'
import os from 'os'
import type { KafkaConnection } from '../../shared/types'

// Derive encryption key from machine-specific data
function deriveEncryptionKey(): string {
  try {
    // Use machine ID as primary source (unique per machine)
    const machineId = machineIdSync()
    return createHash('sha256')
      .update(`topiq-explorer-${machineId}`)
      .digest('hex')
      .slice(0, 32)
  } catch {
    // Fallback: derive from hostname + username + homedir
    const fallbackData = `${os.hostname()}-${os.userInfo().username}-${os.homedir()}`
    return createHash('sha256')
      .update(`topiq-explorer-${fallbackData}`)
      .digest('hex')
      .slice(0, 32)
  }
}

interface StoreSchema {
  connections: Record<string, KafkaConnection>
}

// Get the store path without creating a Store instance
function getStorePath(storeName: string): string {
  const appName = 'topiq-explorer' // Must match the app name in package.json
  let configDir: string

  switch (process.platform) {
    case 'darwin':
      configDir = `${os.homedir()}/Library/Application Support/${appName}`
      break
    case 'win32':
      configDir = `${process.env.APPDATA || os.homedir()}/${appName}`
      break
    default: // Linux and others
      configDir = `${process.env.XDG_CONFIG_HOME || `${os.homedir()}/.config`}/${appName}`
  }

  return `${configDir}/${storeName}.json`
}

export class ConnectionStore {
  private store: Store<StoreSchema>
  // In-memory copy: every store.get() re-reads and re-decrypts the file (10k-iteration PBKDF2)
  private connections: Record<string, KafkaConnection>

  constructor() {
    const encryptionKey = deriveEncryptionKey()
    const storeName = 'topiq-explorer-connections'

    this.store = new Store<StoreSchema>({
      name: storeName,
      cwd: getStorePath(storeName).replace(`/${storeName}.json`, ''),
      defaults: {
        connections: {}
      },
      encryptionKey,
      // A store that cannot be decrypted (machine ID changed, corrupt file) starts empty instead of crashing the app on boot
      clearInvalidConfig: true
    })
    this.connections = this.store.get('connections', {})
  }

  getAll(): KafkaConnection[] {
    return Object.values(this.connections).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
  }

  get(id: string): KafkaConnection | undefined {
    return this.connections[id]
  }

  save(connection: Omit<KafkaConnection, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): KafkaConnection {
    const connections = this.connections
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
    const connections = this.connections
    delete connections[id]
    this.store.set('connections', connections)
  }
}

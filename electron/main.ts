import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { autoUpdater } from 'electron-updater'
import Store from 'electron-store'
import { KafkaService } from './services/kafka.service'
import { ConnectionStore } from './services/connection.store'

// Configure electron-store for updater settings
const settingsStore = new Store<{ updateChannel: 'stable' | 'beta' | 'alpha' }>({
  defaults: {
    updateChannel: 'stable'
  }
})

// Configure autoUpdater
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

function configureUpdaterChannel() {
  const channel = settingsStore.get('updateChannel', 'stable')

  switch (channel) {
    case 'alpha':
      autoUpdater.allowPrerelease = true
      autoUpdater.allowDowngrade = false
      break
    case 'beta':
      autoUpdater.allowPrerelease = true
      autoUpdater.allowDowngrade = false
      break
    case 'stable':
    default:
      autoUpdater.allowPrerelease = false
      autoUpdater.allowDowngrade = false
      break
  }
}

// Check if version matches the current channel filter
function isVersionAllowedForChannel(version: string, channel: 'stable' | 'beta' | 'alpha'): boolean {
  const isAlpha = version.includes('-alpha')
  const isBeta = version.includes('-beta')
  const isPrerelease = isAlpha || isBeta

  switch (channel) {
    case 'alpha':
      return true // Accept all versions
    case 'beta':
      return !isAlpha // Accept stable and beta, not alpha
    case 'stable':
    default:
      return !isPrerelease // Accept only stable versions
  }
}

let mainWindow: BrowserWindow | null = null
const kafkaService = new KafkaService()
const connectionStore = new ConnectionStore()

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
    backgroundColor: '#0a0a0b',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })

  // Configure and check for updates (skip in dev mode)
  if (!process.env.VITE_DEV_SERVER_URL) {
    configureUpdaterChannel()

    // Auto-check for updates 3 seconds after app ready
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(() => {
        // Silently ignore update check errors on startup
      })
    }, 3000)
  }
})

// Forward autoUpdater events to renderer
autoUpdater.on('checking-for-update', () => {
  mainWindow?.webContents.send('updater:checking-for-update')
})

autoUpdater.on('update-available', (info) => {
  const channel = settingsStore.get('updateChannel', 'stable')
  // Filter out updates that don't match the channel
  if (isVersionAllowedForChannel(info.version, channel)) {
    mainWindow?.webContents.send('updater:update-available', info)
  }
})

autoUpdater.on('update-not-available', (info) => {
  mainWindow?.webContents.send('updater:update-not-available', info)
})

autoUpdater.on('download-progress', (progress) => {
  mainWindow?.webContents.send('updater:download-progress', progress)
})

autoUpdater.on('update-downloaded', (info) => {
  mainWindow?.webContents.send('updater:update-downloaded', info)
})

autoUpdater.on('error', (error) => {
  mainWindow?.webContents.send('updater:error', error.message)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async () => {
  await kafkaService.disconnectAll()
})

// Connection IPC Handlers
ipcMain.handle('connections:getAll', () => {
  return connectionStore.getAll()
})

ipcMain.handle('connections:get', (_, id: string) => {
  return connectionStore.get(id)
})

ipcMain.handle('connections:save', (_, connection) => {
  return connectionStore.save(connection)
})

ipcMain.handle('connections:delete', (_, id: string) => {
  return connectionStore.delete(id)
})

ipcMain.handle('connections:test', async (_, connection) => {
  return kafkaService.testConnection(connection)
})

// Kafka IPC Handlers
ipcMain.handle('kafka:connect', async (_, connectionId: string) => {
  const connection = connectionStore.get(connectionId)
  if (!connection) {
    throw new Error('Connection not found')
  }
  await kafkaService.connect(connection)

  // Clean up any orphaned consumer groups from previous sessions (crash recovery)
  try {
    const groups = await kafkaService.getConsumerGroups(connectionId)
    const orphaned = groups
      .filter((g) => g.groupId.startsWith('kafka-explorer-consumer-'))
      .map((g) => g.groupId)
    if (orphaned.length > 0) {
      await kafkaService.deleteOrphanedGroups(connectionId, orphaned)
    }
  } catch {
    // Ignore cleanup errors - don't fail the connection
  }
})

ipcMain.handle('kafka:disconnect', async (_, connectionId: string) => {
  return kafkaService.disconnect(connectionId)
})

ipcMain.handle('kafka:getTopics', async (_, connectionId: string) => {
  return kafkaService.getTopics(connectionId)
})

ipcMain.handle('kafka:getTopicMetadata', async (_, connectionId: string, topic: string) => {
  return kafkaService.getTopicMetadata(connectionId, topic)
})

ipcMain.handle('kafka:getTopicConfig', async (_, connectionId: string, topic: string) => {
  return kafkaService.getTopicConfig(connectionId, topic)
})

ipcMain.handle('kafka:createTopic', async (_, connectionId: string, config) => {
  return kafkaService.createTopic(connectionId, config)
})

ipcMain.handle('kafka:deleteTopic', async (_, connectionId: string, topic: string) => {
  return kafkaService.deleteTopic(connectionId, topic)
})

ipcMain.handle('kafka:getMessages', async (_, connectionId: string, topic: string, options) => {
  try {
    return { success: true, data: await kafkaService.getMessages(connectionId, topic, options) }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to get messages' }
  }
})

ipcMain.handle('kafka:produceMessage', async (_, connectionId: string, topic: string, message) => {
  return kafkaService.produceMessage(connectionId, topic, message)
})

ipcMain.handle('kafka:getConsumerGroups', async (_, connectionId: string) => {
  return kafkaService.getConsumerGroups(connectionId)
})

ipcMain.handle('kafka:getConsumerGroupDetails', async (_, connectionId: string, groupId: string) => {
  try {
    return { success: true, data: await kafkaService.getConsumerGroupDetails(connectionId, groupId) }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to get consumer group details' }
  }
})

ipcMain.handle('kafka:deleteConsumerGroup', async (_, connectionId: string, groupId: string) => {
  return kafkaService.deleteConsumerGroup(connectionId, groupId)
})

ipcMain.handle('kafka:resetOffsets', async (_, connectionId: string, groupId: string, topic: string, options) => {
  return kafkaService.resetOffsets(connectionId, groupId, topic, options)
})

ipcMain.handle('kafka:deleteRecords', async (_, connectionId: string, topic: string, partitionOffsets: { partition: number; offset: string }[]) => {
  return kafkaService.deleteRecords(connectionId, topic, partitionOffsets)
})

// Updater IPC Handlers
ipcMain.handle('updater:checkForUpdates', async () => {
  if (process.env.VITE_DEV_SERVER_URL) {
    return { updateAvailable: false, version: app.getVersion() }
  }
  try {
    configureUpdaterChannel()
    const result = await autoUpdater.checkForUpdates()
    if (result && result.updateInfo) {
      const channel = settingsStore.get('updateChannel', 'stable')
      const isAllowed = isVersionAllowedForChannel(result.updateInfo.version, channel)
      return {
        updateAvailable: isAllowed,
        version: result.updateInfo.version,
        releaseNotes: result.updateInfo.releaseNotes,
        releaseDate: result.updateInfo.releaseDate
      }
    }
    return { updateAvailable: false, version: app.getVersion() }
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Failed to check for updates')
  }
})

ipcMain.handle('updater:downloadUpdate', async () => {
  if (process.env.VITE_DEV_SERVER_URL) {
    throw new Error('Cannot download updates in development mode')
  }
  try {
    await autoUpdater.downloadUpdate()
    return { success: true }
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Failed to download update')
  }
})

ipcMain.handle('updater:installUpdate', () => {
  autoUpdater.quitAndInstall(false, true)
})

ipcMain.handle('updater:getVersion', () => {
  return app.getVersion()
})

ipcMain.handle('updater:getChannel', () => {
  return settingsStore.get('updateChannel', 'stable')
})

ipcMain.handle('updater:setChannel', (_, channel: 'stable' | 'beta' | 'alpha') => {
  settingsStore.set('updateChannel', channel)
  configureUpdaterChannel()
  return channel
})

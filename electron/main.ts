import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { KafkaService } from './services/kafka.service'
import { ConnectionStore } from './services/connection.store'

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
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
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
  return kafkaService.connect(connection)
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
  return kafkaService.getMessages(connectionId, topic, options)
})

ipcMain.handle('kafka:produceMessage', async (_, connectionId: string, topic: string, message) => {
  return kafkaService.produceMessage(connectionId, topic, message)
})

ipcMain.handle('kafka:getConsumerGroups', async (_, connectionId: string) => {
  return kafkaService.getConsumerGroups(connectionId)
})

ipcMain.handle('kafka:getConsumerGroupDetails', async (_, connectionId: string, groupId: string) => {
  return kafkaService.getConsumerGroupDetails(connectionId, groupId)
})

ipcMain.handle('kafka:deleteConsumerGroup', async (_, connectionId: string, groupId: string) => {
  return kafkaService.deleteConsumerGroup(connectionId, groupId)
})

ipcMain.handle('kafka:resetOffsets', async (_, connectionId: string, groupId: string, topic: string, options) => {
  return kafkaService.resetOffsets(connectionId, groupId, topic, options)
})

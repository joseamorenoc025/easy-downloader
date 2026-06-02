import { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import Store from 'electron-store'
import { DownloadManager } from './downloader/manager'
import { fetchMetadata } from './downloader/metadata'
import { checkFfmpegInstalled } from './downloader/ffmpeg'

const store = new Store({
  defaults: {
    downloadPath: join(app.getPath('downloads'), 'EasyDownloader'),
    themeMode: 'system' as 'light' | 'dark' | 'system'
  }
})

let mainWindow: BrowserWindow | null = null
let downloadManager: DownloadManager | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 700,
    minWidth: 600,
    minHeight: 500,
    show: false,
    autoHideMenuBar: true,
    title: 'EasyDownloader',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function setupIPC(): void {
  ipcMain.handle('fetch-metadata', async (_event, url: string) => {
    return fetchMetadata(url)
  })

  ipcMain.handle('add-download', async (_event, options) => {
    if (!downloadManager) return null
    return downloadManager.addToQueue(options)
  })

  ipcMain.handle('cancel-download', async (_event, itemId: string) => {
    downloadManager?.cancelItem(itemId)
  })

  ipcMain.handle('cancel-all', async () => {
    downloadManager?.cancelAll()
  })

  ipcMain.handle('get-queue', async () => {
    return downloadManager?.getQueue() || []
  })

  ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory']
    })
    if (!result.canceled && result.filePaths.length > 0) {
      store.set('downloadPath', result.filePaths[0])
      return result.filePaths[0]
    }
    return null
  })

  ipcMain.handle('get-settings', async () => {
    return {
      downloadPath: store.get('downloadPath') as string,
      themeMode: store.get('themeMode') as string
    }
  })

  ipcMain.handle('set-theme', async (_event, mode: 'light' | 'dark' | 'system') => {
    store.set('themeMode', mode)
    if (mode === 'system') {
      nativeTheme.themeSource = 'system'
    } else {
      nativeTheme.themeSource = mode
    }
  })

  ipcMain.handle('check-ffmpeg', async () => {
    return checkFfmpegInstalled()
  })
}

function initDownloadManager(): void {
  downloadManager = new DownloadManager(
    (progress) => {
      mainWindow?.webContents.send('download-progress', progress)
    },
    (item) => {
      mainWindow?.webContents.send('download-complete', item)
    },
    (itemId, error) => {
      mainWindow?.webContents.send('download-error', { itemId, error })
    }
  )
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.easydownloader')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const themeMode = store.get('themeMode') as string
  if (themeMode === 'dark') nativeTheme.themeSource = 'dark'
  else if (themeMode === 'light') nativeTheme.themeSource = 'light'
  else nativeTheme.themeSource = 'system'

  setupIPC()
  createWindow()
  initDownloadManager()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

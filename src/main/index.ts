import { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme, Notification } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { default: Store } = require('electron-store')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { autoUpdater } = require('electron-updater')
import { DownloadManager } from './downloader/manager'
import { SpotifyDownloadManager } from './downloader/spotdl'
import { fetchMetadata } from './downloader/metadata'
import { checkFfmpegInstalled } from './downloader/ffmpeg'

const store = new Store({
  defaults: {
    downloadPath: join(app.getPath('downloads'), 'EasyDownloader'),
    themeMode: 'system' as 'light' | 'dark' | 'system',
    downloadQueue: [] as Array<{ url: string; format: string; quality: string; source: string }>
  }
})

let mainWindow: BrowserWindow | null = null
let downloadManager: DownloadManager | null = null
let spotifyManager: SpotifyDownloadManager | null = null

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

  ipcMain.handle('add-spotify-download', async (_event, url: string) => {
    if (!spotifyManager) return null
    const dlPath = (store.get('downloadPath') as string) || join(app.getPath('downloads'), 'EasyDownloader')
    return spotifyManager.addToQueue(url, dlPath)
  })

  ipcMain.handle('open-folder', async (_event, folderPath?: string) => {
    const path = folderPath || (store.get('downloadPath') as string) || join(app.getPath('downloads'), 'EasyDownloader')
    shell.openPath(path)
  })

  ipcMain.handle('check-spotdl', async () => {
    try {
      const { execSync } = require('child_process')
      execSync('spotdl --version', { stdio: 'ignore' })
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('save-queue', async (_event, queue: Array<{ url: string; format: string; quality: string; source: string }>) => {
    store.set('downloadQueue', queue)
  })

  ipcMain.handle('get-saved-queue', async () => {
    return store.get('downloadQueue') as Array<{ url: string; format: string; quality: string; source: string }>
  })

  ipcMain.handle('check-for-updates', async () => {
    return autoUpdater.checkForUpdates().catch(() => null)
  })

  ipcMain.handle('quit-and-install', async () => {
    autoUpdater.quitAndInstall()
  })
}

function initDownloadManager(): void {
  const dlPath = (store.get('downloadPath') as string) || join(app.getPath('downloads'), 'EasyDownloader')
  downloadManager = new DownloadManager(
    dlPath,
    (progress) => {
      mainWindow?.webContents.send('download-progress', progress)
    },
    (item) => {
      mainWindow?.webContents.send('download-complete', item)

      if (item.status === 'completed' && Notification.isSupported()) {
        const notif = new Notification({
          title: 'Download Complete',
          body: item.title || 'Your download has finished',
          silent: true
        })
        notif.show()
      }
    },
    (itemId, error) => {
      mainWindow?.webContents.send('download-error', { itemId, error })
    }
  )
}

function initSpotifyManager(): void {
  spotifyManager = new SpotifyDownloadManager(
    (item) => {
      mainWindow?.webContents.send('download-complete', item)

      if (item.status === 'completed' && Notification.isSupported()) {
        const notif = new Notification({
          title: 'Spotify Download Complete',
          body: item.title || 'Your Spotify download has finished',
          silent: true
        })
        notif.show()
      }
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
  initSpotifyManager()

  // Auto-updater
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', () => {
    if (mainWindow && Notification.isSupported()) {
      const notif = new Notification({
        title: 'Update Available',
        body: 'A new version is being downloaded...',
        silent: true
      })
      notif.show()
    }
  })

  autoUpdater.on('update-downloaded', () => {
    if (mainWindow && Notification.isSupported()) {
      const notif = new Notification({
        title: 'Update Ready',
        body: 'A new version is ready. Restart to apply.',
        silent: false
      })
      notif.show()
      notif.on('click', () => {
        autoUpdater.quitAndInstall()
      })
    }
  })

  autoUpdater.on('error', (err: Error) => {
    console.error('Auto-updater error:', err)
  })

  // Check for updates after 3 seconds
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 3000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

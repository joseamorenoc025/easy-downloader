import { app, BrowserWindow, Menu, nativeTheme, Notification, clipboard } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { store } from './store'
import { createWindow } from './window'
import { setupIPC, sessionHistory } from './ipc'
import { setupTray } from './tray'
import { setupAutoUpdater } from './updater'
import { DownloadManager } from './downloader/manager'
import { SpotifyDownloadManager } from './downloader/spotify-native'
import { YtDlpUpdater } from './downloader/core/yt-dlp-updater'

// Global error handlers
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason)
})
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err)
})

let mainWindow: BrowserWindow | null = null
let downloadManager: DownloadManager | null = null
let spotifyManager: SpotifyDownloadManager | null = null
let tray: ReturnType<typeof setupTray> = null
let isQuitting = false
let isUpdateDownloaded = false

const isTestMode = process.env.EASYDOWNLOADER_TEST === '1'

// Single instance lock — prevent multiple windows
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

function getMainWindow(): BrowserWindow | null {
  return mainWindow
}
function getDownloadManager(): DownloadManager | null {
  return downloadManager
}
function getSpotifyManager(): SpotifyDownloadManager | null {
  return spotifyManager
}
function getIsUpdateDownloaded(): boolean {
  return isUpdateDownloaded
}
function setIsUpdateDownloaded(v: boolean): void {
  isUpdateDownloaded = v
}
function setIsQuitting(v: boolean): void {
  isQuitting = v
}

function initDownloadManager(): void {
  const dlPath = (store.get('downloadPath') as string) || app.getPath('downloads')
  downloadManager = new DownloadManager(
    dlPath,
    (progress) => {
      mainWindow?.webContents.send('download-progress', progress)
    },
    (item) => {
      mainWindow?.webContents.send('download-complete', item)

      const globalIncognito = (store.get('incognitoMode') as boolean) || false
      if (item.incognito || globalIncognito) return

      if (item.status === 'completed') {
        const entry = {
          id: item.id,
          url: item.url,
          title: item.title,
          format: item.format,
          quality: item.quality,
          source: item.source,
          outputPath: item.outputPath,
          completedAt: new Date().toISOString()
        }
        sessionHistory.unshift(entry)
        if (sessionHistory.length > 200) sessionHistory.length = 200

        // Notify renderer of new history entry (for real-time history view updates)
        mainWindow?.webContents.send('history-entry-added', entry)

        if (Notification.isSupported() && (store.get('notificationsEnabled') as boolean)) {
          const notif = new Notification({
            title: 'Download Complete',
            body: item.title || 'Your download has finished',
            silent: true
          })
          notif.show()
        }
      }
    },
    (itemId, errorCategory, errorDetails) => {
      mainWindow?.webContents.send('download-error', {
        itemId,
        error: errorCategory,
        category: errorCategory,
        details: errorDetails
      })
    }
  )

  const cookiesPath = (store.get('cookiesPath') as string) || ''
  if (cookiesPath) {
    downloadManager.setCookiesPath(cookiesPath)
  }
}

function initSpotifyManager(): void {
  const dlPath = (store.get('downloadPath') as string) || app.getPath('downloads')
  spotifyManager = new SpotifyDownloadManager(
    dlPath,
    (progress) => {
      mainWindow?.webContents.send('download-progress', progress)
    },
    (item) => {
      mainWindow?.webContents.send('download-complete', item)

      const globalIncognito = (store.get('incognitoMode') as boolean) || false
      if (item.incognito || globalIncognito) return

      if (item.status === 'completed') {
        const entry = {
          id: item.id,
          url: item.url,
          title: item.title,
          format: item.format,
          quality: item.quality,
          source: item.source,
          outputPath: item.outputPath,
          completedAt: new Date().toISOString()
        }
        sessionHistory.unshift(entry)
        if (sessionHistory.length > 200) sessionHistory.length = 200

        // Notify renderer of new history entry (for real-time history view updates)
        mainWindow?.webContents.send('history-entry-added', entry)

        if (Notification.isSupported() && (store.get('notificationsEnabled') as boolean)) {
          const notif = new Notification({
            title: 'Spotify Download Complete',
            body: item.title || 'Your Spotify download has finished',
            silent: true
          })
          notif.show()
        }
      }
    },
    (itemId, errorCategory, errorDetails) => {
      mainWindow?.webContents.send('download-error', {
        itemId,
        error: errorCategory,
        category: errorCategory,
        details: errorDetails
      })
    },
    (itemId, trackTitle) => {
      mainWindow?.webContents.send('spotify-track-error', { itemId, trackTitle })
    }
  )

  const cookiesPath = (store.get('cookiesPath') as string) || ''
  if (cookiesPath) {
    spotifyManager.setCookiesPath(cookiesPath)
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.easydownloader')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Application menu
  const template = [{ role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' }]
  if (process.platform === 'darwin') {
    template.unshift({ role: 'appMenu' })
  }
  const menu = Menu.buildFromTemplate(template as Array<Electron.MenuItemConstructorOptions>)
  Menu.setApplicationMenu(menu)

  // Theme
  const themeMode = store.get('themeMode') as string
  if (themeMode === 'dark') nativeTheme.themeSource = 'dark'
  else if (themeMode === 'light') nativeTheme.themeSource = 'light'
  else nativeTheme.themeSource = 'system'

  // Always start unpaused — stale globalPause from previous session causes
  // UI/main-process state mismatch (UI shows "paused" indicator but downloads run)
  store.set('globalPause', false)

  // Init managers
  initDownloadManager()
  initSpotifyManager()

  // IPC
  setupIPC({
    getMainWindow,
    getDownloadManager,
    getSpotifyManager,
    getIsUpdateDownloaded,
    setIsUpdateDownloaded,
    setIsQuitting
  })

  // Window
  mainWindow = createWindow()

  // Context menu (right-click)
  if (!isTestMode) {
    mainWindow.webContents.on('context-menu', (_, params) => {
      const template: Electron.MenuItemConstructorOptions[] = []

      if (params.selectionText) {
        template.push({ role: 'copy' })
        template.push({ type: 'separator' })
      }

      if (params.isEditable) {
        template.push({
          label: 'Pegar',
          accelerator: 'CmdOrCtrl+V',
          click: () => {
            const text = clipboard.readText()
            if (text) {
              mainWindow?.webContents.send('context-paste', { text, autoGo: false })
            }
          }
        })
        template.push({
          label: 'Pegar e ir',
          click: () => {
            const text = clipboard.readText()
            if (text) {
              mainWindow?.webContents.send('context-paste', { text, autoGo: true })
            }
          }
        })
        template.push({ type: 'separator' })
        template.push({ role: 'cut' })
        template.push({ role: 'selectAll' })
      }

      if (template.length > 0) {
        Menu.buildFromTemplate(template).popup()
      }
    })
  }

  // Tray
  tray = setupTray(getMainWindow)

  // Minimize to tray on close (skip in test mode)
  if (!isTestMode) {
    mainWindow.on('close', (event) => {
      if (!isQuitting && !app.isQuitting) {
        event.preventDefault()
        mainWindow?.hide()
      }
    })
  }

  // Eager check: verify yt-dlp binary on startup (skip in test mode)
  if (!isTestMode) {
    downloadManager?.ensureBinary().catch(() => {
      console.error('Failed to download yt-dlp binary')
    })

    // Auto-update yt-dlp binary every 24h
    const ytDlpUpdater = new YtDlpUpdater()
    ytDlpUpdater.checkAndUpdate().catch((err: Error) => console.error(err))
    setInterval(
      () => {
        ytDlpUpdater.checkAndUpdate().catch((err: Error) => console.error(err))
      },
      24 * 60 * 60 * 1000
    )
  }

  // Auto-updater (skip in test mode)
  if (!isTestMode) {
    setupAutoUpdater({ getMainWindow, getIsUpdateDownloaded, setIsUpdateDownloaded })
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (isQuitting) return
  isQuitting = true
  try {
    tray?.destroy()
    downloadManager?.cancelAll()
    spotifyManager?.cancelAll()
  } catch (e) {
    console.error('Error during cleanup on quit:', e)
  }
})

process.on('SIGTERM', () => {
  if (!isQuitting) app.quit()
})
process.on('SIGINT', () => {
  if (!isQuitting) app.quit()
})

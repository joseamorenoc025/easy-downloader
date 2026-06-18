import { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme, Notification, Tray, Menu } from 'electron'
import { join, resolve, sep } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { default: Store } = require('electron-store')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { autoUpdater } = require('electron-updater')
import { DownloadManager } from './downloader/manager'
import { SpotifyDownloadManager } from './downloader/spotdl'
import { fetchMetadata } from './downloader/metadata'
import { checkFfmpegInstalled } from './downloader/ffmpeg'
import { isValidHttpUrl } from './utils/url'

// Global error handlers — log and continue. In production these should surface
// a user-facing dialog; for now a single point of visibility is enough.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason)
})
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err)
})

const store = new Store({
  defaults: {
    downloadPath: app.getPath('downloads'),
    themeMode: 'system' as 'light' | 'dark' | 'system',
    downloadQueue: [] as Array<{ url: string; format: string; quality: string; source: string }>
  }
})

let mainWindow: BrowserWindow | null = null
let downloadManager: DownloadManager | null = null
let spotifyManager: SpotifyDownloadManager | null = null
let tray: Tray | null = null
let isQuitting = false

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
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { action: 'deny' }
      }
    } catch {
      return { action: 'deny' }
    }
    shell.openExternal(url)
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
    if (!isValidHttpUrl(url)) {
      throw new Error('URL inválida: solo http/https')
    }
    return fetchMetadata(url)
  })

  ipcMain.handle('add-download', async (_event, options) => {
    if (!options || !isValidHttpUrl(options?.url)) {
      throw new Error('URL inválida')
    }
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
    if (!isValidHttpUrl(url)) {
      throw new Error('URL inválida: solo http/https')
    }
    if (!spotifyManager) return null
    const dlPath = (store.get('downloadPath') as string) || app.getPath('downloads')
    return spotifyManager.addToQueue(url, dlPath)
  })

  ipcMain.handle('open-folder', async (_event, folderPath?: string) => {
    const storedPath = (store.get('downloadPath') as string) || app.getPath('downloads')
    const target = folderPath || storedPath
    // Si el renderer pasa un path, debe estar dentro de storedPath
    if (folderPath && folderPath !== storedPath) {
      const resolved = resolve(folderPath)
      const root = resolve(storedPath)
      if (!resolved.startsWith(root + sep) && resolved !== root) {
        return
      }
    }
    const result = await shell.openPath(target)
    if (result) {
      console.error('Failed to open path:', result)
    }
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

  ipcMain.handle('check-ytdlp', async () => {
    if (!downloadManager) return false
    try {
      await downloadManager.ensureBinary()
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('check-dependencies', async () => {
    const ffmpegOk = checkFfmpegInstalled()
    const spotdlOk = await (async () => {
      try {
        const { execSync } = require('child_process')
        execSync('spotdl --version', { stdio: 'ignore' })
        return true
      } catch {
        return false
      }
    })()
    const ytdlpOk = downloadManager ? await (async () => {
      try {
        await downloadManager.ensureBinary()
        return true
      } catch {
        return false
      }
    })() : false
    return { ffmpeg: ffmpegOk, spotdl: spotdlOk, ytdlp: ytdlpOk }
  })

  ipcMain.handle('quit-and-install', async () => {
    if (!isUpdateDownloaded) {
      console.warn('quit-and-install called but no update is downloaded; ignoring')
      return
    }
    isUpdateDownloaded = false
    autoUpdater.quitAndInstall()
  })

  ipcMain.handle('get-history', async () => {
    return store.get('downloadHistory', [])
  })

  ipcMain.handle('add-history-entry', async (_event, entry) => {
    const history = store.get('downloadHistory', []) as Array<Record<string, unknown>>
    history.unshift(entry)
    store.set('downloadHistory', history.slice(0, 200))
  })

  ipcMain.handle('clear-history', async () => {
    store.set('downloadHistory', [])
  })

  ipcMain.handle('quit-app', async () => {
    isQuitting = true
    app.quit()
  })
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

      if (item.status === 'completed') {
        const history = store.get('downloadHistory', []) as Array<Record<string, unknown>>
        history.unshift({
          id: item.id,
          url: item.url,
          title: item.title,
          format: item.format,
          quality: item.quality,
          source: item.source,
          outputPath: item.outputPath,
          completedAt: new Date().toISOString()
        })
        store.set('downloadHistory', history.slice(0, 200))

        if (Notification.isSupported()) {
          const notif = new Notification({
            title: 'Download Complete',
            body: item.title || 'Your download has finished',
            silent: true
          })
          notif.show()
        }
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

      if (item.status === 'completed') {
        const history = store.get('downloadHistory', []) as Array<Record<string, unknown>>
        history.unshift({
          id: item.id,
          url: item.url,
          title: item.title,
          format: item.format,
          quality: item.quality,
          source: item.source,
          outputPath: item.outputPath,
          completedAt: new Date().toISOString()
        })
        store.set('downloadHistory', history.slice(0, 200))

        if (Notification.isSupported()) {
          const notif = new Notification({
            title: 'Spotify Download Complete',
            body: item.title || 'Your Spotify download has finished',
            silent: true
          })
          notif.show()
        }
      }
    },
    (itemId, error) => {
      mainWindow?.webContents.send('download-error', { itemId, error })
    }
  )
}

function setupTray(): void {
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(__dirname, '../../resources/icon.png')

  try {
    tray = new Tray(iconPath)
    tray.setToolTip('EasyDownloader')

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show EasyDownloader',
        click: () => {
          mainWindow?.show()
          mainWindow?.focus()
        }
      },
      { type: 'separator' },
      {
        label: 'Exit',
        click: () => {
          tray?.destroy()
          tray = null
          app.quit()
        }
      }
    ])

    tray.setContextMenu(contextMenu)

    tray.on('double-click', () => {
      if (mainWindow?.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow?.show()
        mainWindow?.focus()
      }
    })
  } catch {
    // Tray not supported (Linux without libappindicator)
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.easydownloader')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Set application menu to enable standard keyboard shortcuts (Ctrl+C / Ctrl+V)
  const template = [
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' }
  ]
  if (process.platform === 'darwin') {
    template.unshift({ role: 'appMenu' })
  }
  const menu = Menu.buildFromTemplate(template as any)
  Menu.setApplicationMenu(menu)

  const themeMode = store.get('themeMode') as string
  if (themeMode === 'dark') nativeTheme.themeSource = 'dark'
  else if (themeMode === 'light') nativeTheme.themeSource = 'light'
  else nativeTheme.themeSource = 'system'

  setupIPC()
  createWindow()
  setupTray()
  initDownloadManager()
  initSpotifyManager()

  // Eager check: verify yt-dlp binary on startup
  if (downloadManager) {
    downloadManager.ensureBinary().catch(() => {
      console.error('Failed to download yt-dlp binary')
    })
  }

  // Minimize to tray on close
  mainWindow?.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  // Auto-updater
  // In dev / unpackaged builds, electron-updater throws or no-ops because there
  // is no app-update.yml. Skip the check entirely to avoid noisy error logs.
  const isPackaged = app.isPackaged
  let isUpdateDownloaded = false

  autoUpdater.autoDownload = isPackaged
  autoUpdater.autoInstallOnAppQuit = isPackaged

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

  autoUpdater.on('update-not-available', () => {
    // Quiet by design; users with manual "Check for updates" want feedback, but
    // the silent 3s startup check shouldn't spam.
  })

  autoUpdater.on('update-downloaded', () => {
    isUpdateDownloaded = true
    if (mainWindow && Notification.isSupported()) {
      const notif = new Notification({
        title: 'Update Ready',
        body: 'A new version is ready. Restart to apply.',
        silent: false
      })
      notif.show()
      notif.on('click', () => {
        if (isUpdateDownloaded) {
          isUpdateDownloaded = false
          autoUpdater.quitAndInstall()
        }
      })
    }
  })

  autoUpdater.on('update-cancelled', () => {
    isUpdateDownloaded = false
  })

  autoUpdater.on('error', (err: Error) => {
    // Suppress the "no app-update.yml" / "no published versions" noise in dev.
    if (!isPackaged) return
    console.error('Auto-updater error:', err)
  })

  // Check for updates after 3 seconds — only in packaged builds.
  if (isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err) => {
        console.error('checkForUpdates failed:', err)
      })
    }, 3000)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Ensure child processes (yt-dlp, spotdl, ffmpeg) are killed on quit.
// Without this, downloads started moments before closing the app leave zombies.
app.on('before-quit', (event) => {
  if (isQuitting) return
  isQuitting = true
  event.preventDefault()
  try {
    downloadManager?.cancelAll()
    spotifyManager?.cancelAll()
  } catch (e) {
    console.error('Error during cancelAll on quit:', e)
  }
  // Give children a moment to actually die before the main process exits.
  setTimeout(() => app.quit(), 500)
})

process.on('SIGTERM', () => {
  isQuitting = true
  app.quit()
})
process.on('SIGINT', () => {
  isQuitting = true
  app.quit()
})

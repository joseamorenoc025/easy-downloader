import { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme } from 'electron'
import { resolve, sep } from 'path'
import { store } from './store'
import { DownloadManager } from './downloader/manager'
import { SpotifyDownloadManager } from './downloader/spotify-native'
import { fetchMetadata } from './downloader/metadata'
import { checkFfmpegInstalled } from './downloader/ffmpeg'
import { isValidHttpUrl } from './utils/url'
import { autoUpdater } from './lib/updater'

interface IpcDeps {
  getMainWindow: () => BrowserWindow | null
  getDownloadManager: () => DownloadManager | null
  getSpotifyManager: () => SpotifyDownloadManager | null
  getIsUpdateDownloaded: () => boolean
  setIsUpdateDownloaded: (v: boolean) => void
  setIsQuitting: (v: boolean) => void
}

export function setupIPC(deps: IpcDeps): void {
  const {
    getMainWindow,
    getDownloadManager,
    getSpotifyManager,
    getIsUpdateDownloaded,
    setIsUpdateDownloaded,
    setIsQuitting
  } = deps

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
    const dm = getDownloadManager()
    if (!dm) return null

    const settings = store.get('settings') as Record<string, unknown>
    const incognito = (settings as { incognitoMode?: boolean })?.incognitoMode || false

    return dm.addToQueue({ ...options, incognito })
  })

  ipcMain.handle('cancel-download', async (_event, itemId: string) => {
    if (itemId.startsWith('spot-')) {
      getSpotifyManager()?.cancelItem(itemId)
    } else {
      getDownloadManager()?.cancelItem(itemId)
    }
  })

  ipcMain.handle('cancel-all', async () => {
    getDownloadManager()?.cancelAll()
    getSpotifyManager()?.cancelAll()
  })

  ipcMain.handle('get-queue', async () => {
    const ytQueue = getDownloadManager()?.getQueue() || []
    const spotQueue = getSpotifyManager()?.getQueue() || []
    return [...ytQueue, ...spotQueue]
  })

  ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(getMainWindow()!, {
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
      themeMode: store.get('themeMode') as string,
      fetchMetadata: store.get('fetchMetadata') as boolean,
      incognitoMode: store.get('incognitoMode') as boolean,
      globalPause: store.get('globalPause') as boolean,
      maxConcurrent: store.get('maxConcurrent') as number
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

  ipcMain.handle('set-fetch-metadata', async (_event, enabled: boolean) => {
    store.set('fetchMetadata', enabled)
  })

  ipcMain.handle('set-incognito-mode', async (_event, enabled: boolean) => {
    store.set('incognitoMode', enabled)
  })

  ipcMain.handle('set-max-concurrent', async (_event, value: number) => {
    const clamped = Math.max(1, Math.min(8, Math.round(value)))
    store.set('maxConcurrent', clamped)
    getDownloadManager()?.setMaxConcurrent(clamped)
  })

  ipcMain.handle('set-global-pause', async (_event, enabled: boolean) => {
    store.set('globalPause', enabled)
    if (enabled) {
      getDownloadManager()?.pauseAll()
      getSpotifyManager()?.pauseAll()
    } else {
      getDownloadManager()?.resumeAll()
      getSpotifyManager()?.resumeAll()
    }
  })

  ipcMain.handle('pause-all', async () => {
    store.set('globalPause', true)
    getDownloadManager()?.pauseAll()
    getSpotifyManager()?.pauseAll()
  })

  ipcMain.handle('resume-all', async () => {
    store.set('globalPause', false)
    getDownloadManager()?.resumeAll()
    getSpotifyManager()?.resumeAll()
  })

  ipcMain.handle('check-ffmpeg', async () => {
    return checkFfmpegInstalled()
  })

  ipcMain.handle('add-spotify-download', async (_event, url: string, quality?: string) => {
    if (!isValidHttpUrl(url)) {
      throw new Error('URL inválida: solo http/https')
    }
    const sm = getSpotifyManager()
    if (!sm) return null
    return sm.addSpotifyUrl(url, quality)
  })

  ipcMain.handle('open-folder', async (_event, folderPath?: string) => {
    const storedPath = (store.get('downloadPath') as string) || app.getPath('downloads')
    const target = folderPath || storedPath
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
    return true
  })

  ipcMain.handle(
    'save-queue',
    async (
      _event,
      queue: Array<{ url: string; format: string; quality: string; source: string }>
    ) => {
      store.set('downloadQueue', queue)
    }
  )

  ipcMain.handle('get-saved-queue', async () => {
    return store.get('downloadQueue') as Array<{
      url: string
      format: string
      quality: string
      source: string
    }>
  })

  ipcMain.handle('check-for-updates', async () => {
    return autoUpdater.checkForUpdates().catch(() => null)
  })

  ipcMain.handle('check-ytdlp', async () => {
    const dm = getDownloadManager()
    if (!dm) return false
    try {
      await dm.ensureBinary()
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('check-dependencies', async () => {
    const ffmpegOk = checkFfmpegInstalled()
    const spotdlOk = true
    const dm = getDownloadManager()
    const ytdlpOk = dm
      ? await (async () => {
          try {
            await dm.ensureBinary()
            return true
          } catch {
            return false
          }
        })()
      : false
    return { ffmpeg: ffmpegOk, spotdl: spotdlOk, ytdlp: ytdlpOk }
  })

  ipcMain.handle('quit-and-install', async () => {
    if (!getIsUpdateDownloaded()) {
      console.warn('quit-and-install called but no update is downloaded; ignoring')
      return
    }
    setIsUpdateDownloaded(false)
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
    setIsQuitting(true)
    app.quit()
  })
}

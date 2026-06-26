import { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme } from 'electron'
import { resolve, sep } from 'path'
import { existsSync } from 'fs'
import { store } from './store'
import { DownloadManager } from './downloader/manager'
import { SpotifyDownloadManager } from './downloader/spotify-native'
import { fetchMetadata } from './downloader/metadata'
import { checkFfmpegInstalled } from './downloader/ffmpeg'
import { isValidHttpUrl } from './utils/url'
import { autoUpdater } from './lib/updater'
import YtDlpWrap from 'yt-dlp-wrap'
import type { HistoryEntry } from '../src/types'

// Session-only history — no persistence, cleared on app quit
export const sessionHistory: HistoryEntry[] = []
const SESSION_HISTORY_MAX = 200

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
      const newPath = result.filePaths[0]
      store.set('downloadPath', newPath)
      getDownloadManager()?.setDownloadPath(newPath)
      getSpotifyManager()?.setDownloadPath(newPath)
      return newPath
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
      maxConcurrent: store.get('maxConcurrent') as number,
      cookiesPath: store.get('cookiesPath') as string,
      notificationsEnabled: store.get('notificationsEnabled') as boolean
    }
  })

  ipcMain.handle('select-cookies-file', async () => {
    const result = await dialog.showOpenDialog(getMainWindow()!, {
      properties: ['openFile'],
      filters: [
        { name: 'Netscape Cookie File', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    if (!result.canceled && result.filePaths.length > 0) {
      store.set('cookiesPath', result.filePaths[0])
      return result.filePaths[0]
    }
    return null
  })

  ipcMain.handle('set-cookies-path', async (_event, path: string) => {
    store.set('cookiesPath', path)
    getDownloadManager()?.setCookiesPath(path)
    getSpotifyManager()?.setCookiesPath(path)
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

  ipcMain.handle('set-notifications', async (_event, enabled: boolean) => {
    store.set('notificationsEnabled', enabled)
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

  ipcMain.handle('extract-metadata', async (_event, url: string) => {
    try {
      const ytDlp = new YtDlpWrap()
      await getDownloadManager()?.ensureBinary()
      const isWin = process.platform === 'win32'
      const binaryName = isWin ? 'yt-dlp.exe' : 'yt-dlp'
      const { join } = await import('path')
      const { existsSync } = await import('fs')
      const { app: electronApp } = await import('electron')
      const binaryPath = join(electronApp.getPath('userData'), binaryName)
      if (existsSync(binaryPath)) {
        ytDlp.setBinaryPath(binaryPath)
      }
      const stdout = await ytDlp.execRaw([
        url,
        '--dump-json',
        '--no-warnings',
        '--no-playlist',
        '--skip-download'
      ])
      const data = JSON.parse(stdout)
      return {
        title: data.title || data.fulltitle || '',
        artist: data.artist || data.uploader || data.channel || '',
        album: data.album || '',
        year: data.upload_year?.toString() || data.release_year?.toString() || '',
        genre: data.genres?.[0] || data.tags?.[0] || '',
        track: data.track || data.playlist_index?.toString() || '',
        thumbnail: data.thumbnail || data.thumbnails?.[data.thumbnails.length - 1]?.url || ''
      }
    } catch (err) {
      return {
        title: '',
        artist: '',
        album: '',
        year: '',
        genre: '',
        track: '',
        thumbnail: ''
      }
    }
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
    return sessionHistory
  })

  ipcMain.handle('add-history-entry', async (_event, entry: HistoryEntry) => {
    sessionHistory.unshift(entry)
    if (sessionHistory.length > SESSION_HISTORY_MAX) {
      sessionHistory.length = SESSION_HISTORY_MAX
    }
  })

  ipcMain.handle('clear-history', async () => {
    sessionHistory.length = 0
  })

  ipcMain.handle('check-file-exists', async (_event, filePath: string) => {
    try {
      return existsSync(filePath)
    } catch {
      return false
    }
  })

  ipcMain.handle('show-in-folder', async (_event, filePath: string) => {
    try {
      shell.showItemInFolder(filePath)
    } catch (err) {
      console.error('show-in-folder failed:', err)
    }
  })

  ipcMain.handle('quit-app', async () => {
    setIsQuitting(true)
    app.quit()
  })
}

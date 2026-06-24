import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock electron — use vi.hoisted for the handle mock
const { mockHandle } = vi.hoisted(() => ({
  mockHandle: vi.fn()
}))
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => (name === 'downloads' ? '/mock/downloads' : '/mock/path')),
    quit: vi.fn()
  },
  BrowserWindow: vi.fn(),
  ipcMain: { handle: mockHandle },
  dialog: {
    showOpenDialog: vi.fn().mockResolvedValue({ canceled: false, filePaths: ['/new/path'] })
  },
  shell: { openPath: vi.fn().mockResolvedValue('') },
  nativeTheme: { themeSource: 'system' },
  Menu: { buildFromTemplate: vi.fn() },
  Notification: vi.fn()
}))

// Mock autoUpdater — use vi.hoisted so it's available in hoisted vi.mock
const { mockAutoUpdater } = vi.hoisted(() => ({
  mockAutoUpdater: { checkForUpdates: vi.fn(), quitAndInstall: vi.fn() }
}))
vi.mock('../main/lib/updater', () => ({ autoUpdater: mockAutoUpdater }))

// Mock store module directly — use vi.hoisted for access in vi.mock
const { mockStoreInstance, mockStoreData } = vi.hoisted(() => {
  const data: Record<string, any> = {}
  return {
    mockStoreData: data,
    mockStoreInstance: {
      get: vi.fn((key: string, defaultValue?: any) => data[key] ?? defaultValue),
      set: vi.fn((key: string, value: any) => {
        data[key] = value
      })
    }
  }
})
vi.mock('../main/store', () => ({ store: mockStoreInstance }))

// Mock dependencies
vi.mock('../main/downloader/metadata', () => ({
  fetchMetadata: vi.fn().mockResolvedValue({ title: 'Test' })
}))
vi.mock('../main/downloader/ffmpeg', () => ({ checkFfmpegInstalled: vi.fn(() => true) }))
vi.mock('../main/downloader/manager', () => ({ DownloadManager: vi.fn() }))
vi.mock('../main/downloader/spotify-native', () => ({ SpotifyDownloadManager: vi.fn() }))

import { setupIPC } from '../main/ipc'

describe('IPC handlers', () => {
  const handlers: Record<string, (...args: any[]) => Promise<any>> = {}

  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(mockStoreData).forEach((k) => delete mockStoreData[k])

    // Capture all ipcMain.handle registrations
    mockHandle.mockImplementation((channel: string, handler: (...args: any[]) => Promise<any>) => {
      handlers[channel] = handler
    })

    setupIPC({
      getMainWindow: () => null,
      getDownloadManager: () => null,
      getSpotifyManager: () => null,
      getIsUpdateDownloaded: () => false,
      setIsUpdateDownloaded: vi.fn(),
      setIsQuitting: vi.fn()
    })
  })

  it('should register all expected handlers', () => {
    const expectedChannels = [
      'fetch-metadata',
      'add-download',
      'cancel-download',
      'cancel-all',
      'get-queue',
      'select-directory',
      'get-settings',
      'set-theme',
      'set-fetch-metadata',
      'set-incognito-mode',
      'set-global-pause',
      'pause-all',
      'resume-all',
      'check-ffmpeg',
      'add-spotify-download',
      'open-folder',
      'check-spotdl',
      'save-queue',
      'get-saved-queue',
      'check-for-updates',
      'check-ytdlp',
      'check-dependencies',
      'quit-and-install',
      'get-history',
      'add-history-entry',
      'clear-history',
      'quit-app'
    ]
    for (const ch of expectedChannels) {
      expect(handlers[ch]).toBeDefined()
    }
  })

  it('get-settings should return stored values', async () => {
    mockStoreData['downloadPath'] = '/my/downloads'
    mockStoreData['themeMode'] = 'dark'
    mockStoreData['fetchMetadata'] = false
    mockStoreData['incognitoMode'] = true
    mockStoreData['globalPause'] = false

    const result = await handlers['get-settings']()
    expect(result).toEqual({
      downloadPath: '/my/downloads',
      themeMode: 'dark',
      fetchMetadata: false,
      incognitoMode: true,
      globalPause: false
    })
  })

  it('set-theme should store theme', async () => {
    await handlers['set-theme']({}, 'dark')
    expect(mockStoreData['themeMode']).toBe('dark')
  })

  it('set-fetch-metadata should store value', async () => {
    await handlers['set-fetch-metadata']({}, false)
    expect(mockStoreData['fetchMetadata']).toBe(false)
  })

  it('set-incognito-mode should store value', async () => {
    await handlers['set-incognito-mode']({}, true)
    expect(mockStoreData['incognitoMode']).toBe(true)
  })

  it('save-queue and get-saved-queue should persist', async () => {
    const queue = [
      { url: 'https://example.com', format: 'video', quality: 'best', source: 'youtube' }
    ]
    await handlers['save-queue']({}, queue)
    expect(mockStoreData['downloadQueue']).toEqual(queue)

    const result = await handlers['get-saved-queue']()
    expect(result).toEqual(queue)
  })

  it('add-history-entry should prepend and cap at 200', async () => {
    const entries = Array.from({ length: 200 }, (_, i) => ({ id: `old-${i}` }))
    mockStoreData['downloadHistory'] = entries

    await handlers['add-history-entry']({}, { id: 'new-1' })

    const history = mockStoreData['downloadHistory']
    expect(history[0].id).toBe('new-1')
    expect(history.length).toBe(200)
  })

  it('clear-history should empty history', async () => {
    mockStoreData['downloadHistory'] = [{ id: '1' }, { id: '2' }]
    await handlers['clear-history']()
    expect(mockStoreData['downloadHistory']).toEqual([])
  })

  it('check-spotdl should always return true', async () => {
    const result = await handlers['check-spotdl']()
    expect(result).toBe(true)
  })

  it('fetch-metadata should throw on invalid URL', async () => {
    await expect(handlers['fetch-metadata']({}, 'not-a-url')).rejects.toThrow('URL inválida')
  })

  it('add-download should throw on invalid URL', async () => {
    await expect(handlers['add-download']({}, { url: 'ftp://bad' })).rejects.toThrow('URL inválida')
  })

  it('add-download should return null when no download manager', async () => {
    const result = await handlers['add-download']({}, { url: 'https://example.com' })
    expect(result).toBeNull()
  })

  it('add-spotify-download should throw on invalid URL', async () => {
    await expect(handlers['add-spotify-download']({}, 'bad-url')).rejects.toThrow('URL inválida')
  })

  it('quit-app should call setIsQuitting and app.quit', async () => {
    const { app } = await import('electron')
    const setIsQuitting = vi.fn()

    // Re-setup with our spy
    vi.clearAllMocks()
    Object.keys(mockStoreData).forEach((k) => delete mockStoreData[k])
    mockHandle.mockImplementation((channel: string, handler: (...args: any[]) => Promise<any>) => {
      handlers[channel] = handler
    })
    setupIPC({
      getMainWindow: () => null,
      getDownloadManager: () => null,
      getSpotifyManager: () => null,
      getIsUpdateDownloaded: () => false,
      setIsUpdateDownloaded: vi.fn(),
      setIsQuitting
    })

    await handlers['quit-app']()
    expect(setIsQuitting).toHaveBeenCalledWith(true)
    expect(app.quit).toHaveBeenCalled()
  })

  it('check-dependencies should return status object', async () => {
    const result = await handlers['check-dependencies']()
    expect(result).toHaveProperty('ffmpeg')
    expect(result).toHaveProperty('spotdl')
    expect(result).toHaveProperty('ytdlp')
    expect(result.spotdl).toBe(true)
  })

  it('open-folder with valid path should call shell.openPath', async () => {
    const { shell } = await import('electron')
    mockStoreData['downloadPath'] = '/mock/downloads'

    await handlers['open-folder']({}, '/mock/downloads')
    expect(shell.openPath).toHaveBeenCalledWith('/mock/downloads')
  })

  it('get-history should return empty array by default', async () => {
    const result = await handlers['get-history']()
    expect(result).toEqual([])
  })
})

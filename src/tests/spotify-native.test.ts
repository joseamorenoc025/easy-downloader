import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'events'

// Mock electron-store
vi.mock('electron-store', () => ({
  default: class MockStore {
    private data: Record<string, any> = {}
    get(key: string) {
      return this.data[key]
    }
    set(key: string, value: any) {
      this.data[key] = value
    }
  }
}))

// Mock fs
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
    default: { ...actual.default, existsSync: vi.fn().mockReturnValue(true), mkdirSync: vi.fn() }
  }
})

// Mock electron
vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/mock/path') },
  BrowserWindow: vi.fn(),
  ipcMain: { handle: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
  shell: { openPath: vi.fn() },
  nativeTheme: { on: vi.fn() },
  Tray: vi.fn(() => ({ setToolTip: vi.fn(), on: vi.fn() })),
  Menu: { buildFromTemplate: vi.fn() },
  Notification: vi.fn()
}))

// Mock child_process
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  spawn: vi.fn(() => ({ stdout: { on: vi.fn() }, stderr: { on: vi.fn() }, on: vi.fn(), pid: 1 }))
}))

// Mock spotify-url-info wrapper — vitest can't intercept the import inside spotify-native
// due to class field initializer timing, so we override the property on the instance instead
const { mockGetData, mockGetPreview, mockGetTracks } = vi.hoisted(() => {
  const mockGetData = vi.fn()
  const mockGetPreview = vi.fn().mockResolvedValue({ track: 'Preview', artist: 'Preview Artist' })
  const mockGetTracks = vi.fn().mockResolvedValue([])
  return { mockGetData, mockGetPreview, mockGetTracks }
})

// Mock yt-dlp-search — use vi.hoisted for access in vi.mock
const { mockSearchFirst } = vi.hoisted(() => ({
  mockSearchFirst: vi
    .fn()
    .mockResolvedValue({ url: 'https://youtube.com/watch?v=fake', title: 'Found on YT' })
}))
vi.mock('../main/downloader/core/providers/ytdlp-search.provider', () => {
  class MockYtdlpSearchProvider {
    searchFirst = mockSearchFirst
  }
  return { YtdlpSearchProvider: MockYtdlpSearchProvider }
})

// Mock yt-dlp-wrap — all refs need vi.hoisted for vi.mock access
const { mockExec, mockGetBinaryPath, mockSetBinaryPath } = vi.hoisted(() => ({
  mockExec: vi.fn(),
  mockGetBinaryPath: vi.fn().mockReturnValue('/mock/yt-dlp'),
  mockSetBinaryPath: vi.fn()
}))

vi.mock('yt-dlp-wrap', () => {
  const MockClass = function (this: any) {
    this.exec = mockExec
    this.getBinaryPath = mockGetBinaryPath
    this.setBinaryPath = mockSetBinaryPath
  }
  MockClass.downloadFromGithub = vi.fn().mockResolvedValue(undefined)
  return { default: MockClass, downloadFromGithub: MockClass.downloadFromGithub }
})

vi.mock('../main/downloader/options', () => ({
  buildDownloadOptions: vi.fn(() => ({ format: 'best', outtmpl: '/mock/%(title)s.%(ext)s' })),
  AUDIO_FORMAT_MAP: { '128': 'bestaudio', '256': 'bestaudio', '320': 'bestaudio' }
}))
vi.mock('../main/downloader/ffmpeg', () => ({
  getFfmpegPath: vi.fn(() => '/mock/ffmpeg'),
  checkFfmpegInstalled: vi.fn(() => true)
}))

import { SpotifyDownloadManager } from '../main/downloader/spotify-native'
import type { DownloadItem } from '../src/types'

describe('SpotifyDownloadManager', () => {
  let manager: SpotifyDownloadManager
  const mockOnProgress = vi.fn()
  const mockOnComplete = vi.fn()
  const mockOnError = vi.fn()
  const mockOnTrackError = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    manager = new SpotifyDownloadManager(
      '/mock/downloads',
      mockOnProgress,
      mockOnComplete,
      mockOnError,
      mockOnTrackError
    )
    ;(manager as any).binaryReady = true
    ;(manager as any).spotifyUrlInfo = {
      getData: mockGetData,
      getPreview: mockGetPreview,
      getTracks: mockGetTracks
    }
    ;(manager as any).ytDlp = {
      exec: mockExec,
      getBinaryPath: mockGetBinaryPath,
      setBinaryPath: mockSetBinaryPath
    }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('addSpotifyUrl()', () => {
    it('should resolve a single track and add to queue', async () => {
      mockGetData.mockResolvedValue({
        uri: 'spotify:track:abc',
        name: 'My Song',
        artists: [{ name: 'Artist' }],
        duration_ms: 200000
      })

      const items = await manager.addSpotifyUrl('https://open.spotify.com/track/abc')

      expect(items).toHaveLength(1)
      expect(items[0].title).toBe('Artist - My Song')
      expect(items[0].source).toBe('spotify')
      expect(items[0].format).toBe('audio')
    })

    it('should resolve a playlist and add all tracks', async () => {
      mockGetData.mockResolvedValue({
        uri: 'spotify:playlist:xyz',
        name: 'My Playlist'
      })
      mockGetTracks.mockResolvedValueOnce([
        { name: 'Song 1', artist: 'A1', uri: 'spotify:track:1' },
        { name: 'Song 2', artist: 'A2', uri: 'spotify:track:2' }
      ])

      const items = await manager.addSpotifyUrl('https://open.spotify.com/playlist/xyz')

      expect(items).toHaveLength(2)
      expect(items[0].title).toBe('A1 - Song 1')
      expect(items[1].title).toBe('A2 - Song 2')
    })

    it('should return error item when Spotify API fails', async () => {
      mockGetData.mockRejectedValue(new Error('Spotify unavailable'))

      const items = await manager.addSpotifyUrl('https://open.spotify.com/track/abc')

      expect(items).toHaveLength(1)
      expect(items[0].status).toBe('error')
      expect(mockOnError).toHaveBeenCalled()
    })

    it('should use provided quality', async () => {
      mockGetData.mockResolvedValue({
        uri: 'spotify:track:abc',
        name: 'Song',
        artists: [{ name: 'Artist' }]
      })

      const items = await manager.addSpotifyUrl('https://open.spotify.com/track/abc', '320')

      expect(items[0].quality).toBe('320')
    })

    it('should use preview data as fallback for track metadata', async () => {
      mockGetData.mockResolvedValue({
        uri: 'spotify:track:abc',
        name: null,
        artists: null
      })

      const items = await manager.addSpotifyUrl('https://open.spotify.com/track/abc')

      expect(items).toHaveLength(1)
      expect(items[0].title).toContain('Preview')
    })
  })

  describe('startDownload()', () => {
    it('should error on invalid URL', () => {
      const item = {
        id: 'spot-test',
        url: 'not-a-url',
        title: 'Test',
        status: 'downloading' as const,
        progress: 0,
        speed: '',
        eta: '',
        totalBytes: 0,
        downloadedBytes: 0,
        format: 'audio',
        quality: '320',
        source: 'spotify'
      }

      ;(manager as any).startDownload(item, 1)

      expect(item.status).toBe('error')
      expect(mockOnError).toHaveBeenCalled()
    })

    it('should search YouTube and download when spotifyTrack is set', async () => {
      mockExec.mockImplementation(() => {
        const emitter = new EventEmitter() as any
        emitter.ytDlpProcess = { kill: vi.fn() }
        return emitter
      })

      const item: DownloadItem = {
        id: 'spot-test',
        url: 'https://open.spotify.com/track/abc',
        title: 'Test',
        status: 'downloading',
        progress: 0,
        speed: '',
        eta: '',
        totalBytes: 0,
        downloadedBytes: 0,
        format: 'audio',
        quality: '320',
        source: 'spotify'
      }
      ;(item as any).spotifyTrack = { name: 'Test Song', artist: 'Test Artist' }
      ;(manager as any).startDownload(item, 1)

      await vi.advanceTimersByTimeAsync(200)

      expect(mockSearchFirst).toHaveBeenCalledWith('Test Artist', 'Test Song')
      expect(mockExec).toHaveBeenCalled()
    })

    it('should report error when YouTube search finds nothing', async () => {
      mockSearchFirst.mockResolvedValueOnce(null)

      const item: DownloadItem = {
        id: 'spot-test',
        url: 'https://open.spotify.com/track/abc',
        title: 'Test',
        status: 'downloading',
        progress: 0,
        speed: '',
        eta: '',
        totalBytes: 0,
        downloadedBytes: 0,
        format: 'audio',
        quality: '320',
        source: 'spotify'
      }
      ;(item as any).spotifyTrack = { name: 'Song', artist: 'Artist' }
      ;(manager as any).startDownload(item, 1)

      await vi.advanceTimersByTimeAsync(200)

      expect(item.status).toBe('error')
      expect(item.error).toContain('No se encontró en YouTube')
      expect(mockOnTrackError).toHaveBeenCalled()
    })

    it('should execute directly when no spotifyTrack is set', () => {
      mockExec.mockImplementation(() => {
        const emitter = new EventEmitter() as any
        emitter.ytDlpProcess = { kill: vi.fn() }
        return emitter
      })

      const item: DownloadItem = {
        id: 'spot-test',
        url: 'https://youtube.com/watch?v=abc',
        title: 'Direct',
        status: 'downloading',
        progress: 0,
        speed: '',
        eta: '',
        totalBytes: 0,
        downloadedBytes: 0,
        format: 'audio',
        quality: '320',
        source: 'spotify'
      }

      ;(manager as any).startDownload(item, 1)

      expect(mockExec).toHaveBeenCalled()
    })

    it('should handle exec throwing an error', () => {
      mockExec.mockImplementation(() => {
        throw new Error('exec failed')
      })

      const item: DownloadItem = {
        id: 'spot-test',
        url: 'https://youtube.com/watch?v=abc',
        title: 'Fail',
        status: 'downloading',
        progress: 0,
        speed: '',
        eta: '',
        totalBytes: 0,
        downloadedBytes: 0,
        format: 'audio',
        quality: '320',
        source: 'spotify'
      }

      ;(manager as any).startDownload(item, 1)

      expect(item.status).toBe('error')
      expect(item.error).toBe('exec failed')
      expect(mockOnError).toHaveBeenCalled()
    })
  })
})

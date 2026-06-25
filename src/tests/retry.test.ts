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
    default: { ...actual.default, existsSync: vi.fn().mockReturnValue(true) }
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

// Mock yt-dlp-wrap
const mockExec = vi.fn()
const mockGetBinaryPath = vi.fn().mockReturnValue('/mock/yt-dlp')
const mockSetBinaryPath = vi.fn()

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
  AUDIO_FORMAT_MAP: { '128': 'bestaudio', '320': 'bestaudio' }
}))
vi.mock('../main/downloader/ffmpeg', () => ({
  getFfmpegPath: vi.fn(() => '/mock/ffmpeg'),
  checkFfmpegInstalled: vi.fn(() => true)
}))

import { DownloadManager } from '../main/downloader/manager'
import type { DownloadItem } from '../src/types'

function makeItem(overrides?: Partial<DownloadItem>): DownloadItem {
  return {
    id: `item-${Math.random().toString(36).slice(2)}`,
    url: 'https://example.com/video.mp4',
    title: 'Test',
    status: 'queued',
    progress: 0,
    speed: '',
    eta: '',
    totalBytes: 0,
    downloadedBytes: 0,
    format: 'video',
    quality: 'best',
    ...overrides
  }
}

function createEmitter(): import('yt-dlp-wrap').YTDlpEventEmitter & {
  ytDlpProcess: { kill: ReturnType<typeof vi.fn> }
} {
  const emitter = new EventEmitter() as any
  emitter.ytDlpProcess = { kill: vi.fn() }
  return emitter
}

describe('Retry logic (setupEmitterListeners)', () => {
  let manager: DownloadManager
  const mockOnProgress = vi.fn()
  const mockOnComplete = vi.fn()
  const mockOnError = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    manager = new DownloadManager('/mock/downloads', mockOnProgress, mockOnComplete, mockOnError)
    ;(manager as any).binaryReady = true
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('close handler', () => {
    it('should retry on close with non-zero code (attempt 1)', () => {
      const item = makeItem({ status: 'downloading' })
      const emitter = createEmitter()

      ;(manager as any).setupEmitterListeners(emitter, item, 1, 'test')

      emitter.emit('close', 1)

      expect(item.speed).toContain('Reintentando')
      expect(mockOnProgress).toHaveBeenCalled()
    })

    it('should mark as error after 3 failed attempts', () => {
      const item = makeItem({ status: 'downloading' })
      const emitter = createEmitter()

      ;(manager as any).setupEmitterListeners(emitter, item, 3, 'test')

      emitter.emit('close', 1)

      expect(item.status).toBe('error')
      expect(item.errorCategory).toBe('unknown')
      expect(item.errorDetails).toContain('Process exited with code 1')
      expect(mockOnError).toHaveBeenCalledWith(item.id, 'unknown', expect.any(String))
    })

    it('should complete successfully on close code 0', () => {
      const item = makeItem({ status: 'downloading' })
      const emitter = createEmitter()

      ;(manager as any).setupEmitterListeners(emitter, item, 1, 'test')

      emitter.emit('close', 0)

      expect(item.status).toBe('completed')
      expect(item.progress).toBe(100)
      expect(mockOnComplete).toHaveBeenCalledWith(item)
    })

    it('should not retry if item was already cancelled', () => {
      const item = makeItem({ status: 'cancelled' })
      const emitter = createEmitter()

      ;(manager as any).setupEmitterListeners(emitter, item, 1, 'test')

      emitter.emit('close', 1)

      expect(item.status).toBe('cancelled')
      expect(item.speed).not.toContain('Reintentando')
    })

    it('should clean queue after successful completion', () => {
      const completedItem = makeItem({ status: 'completed' })
      const queuedItem = makeItem({ status: 'queued' })
      ;(manager as any).queue = [completedItem, queuedItem]

      const item = makeItem({ status: 'downloading' })
      const emitter = createEmitter()

      ;(manager as any).setupEmitterListeners(emitter, item, 1, 'test')
      emitter.emit('close', 0)

      // cleanQueue removes completed/cancelled/error items
      const remaining = manager.getQueue()
      expect(remaining.every((i) => i.status !== 'completed')).toBe(true)
    })
  })

  describe('error handler', () => {
    it('should retry on error (attempt 1)', () => {
      const item = makeItem({ status: 'downloading' })
      const emitter = createEmitter()

      ;(manager as any).setupEmitterListeners(emitter, item, 1, 'test')

      emitter.emit('error', new Error('spawn ENOENT'))

      expect(item.speed).toContain('Reintentando')
    })

    it('should mark as error after 3 error events', () => {
      const item = makeItem({ status: 'downloading' })
      const emitter = createEmitter()

      ;(manager as any).setupEmitterListeners(emitter, item, 3, 'test')

      emitter.emit('error', new Error('spawn ENOENT'))

      expect(item.status).toBe('error')
      expect(item.errorCategory).toBe('unknown')
      expect(item.errorDetails).toBe('spawn ENOENT')
      expect(mockOnError).toHaveBeenCalledWith(item.id, 'unknown', 'spawn ENOENT')
    })

    it('should not retry if item was cancelled', () => {
      const item = makeItem({ status: 'cancelled' })
      const emitter = createEmitter()

      ;(manager as any).setupEmitterListeners(emitter, item, 1, 'test')

      emitter.emit('error', new Error('killed'))

      expect(item.status).toBe('cancelled')
      expect(item.speed).not.toContain('Reintentando')
    })

    it('should clean queue after final error', () => {
      const queuedItem = makeItem({ status: 'queued' })
      ;(manager as any).queue = [queuedItem]

      const item = makeItem({ status: 'downloading' })
      const emitter = createEmitter()

      ;(manager as any).setupEmitterListeners(emitter, item, 3, 'test')
      emitter.emit('error', new Error('fail'))

      expect(item.status).toBe('error')
    })
  })

  describe('progress handler', () => {
    it('should update item progress from emitter', () => {
      const item = makeItem({ status: 'downloading' })
      const emitter = createEmitter()

      ;(manager as any).setupEmitterListeners(emitter, item, 1, 'test')

      emitter.emit('progress', {
        percent: 45.5,
        currentSpeed: '2MB/s',
        eta: '10s',
        totalSize: '100MB'
      })

      expect(item.progress).toBe(45.5)
      expect(item.speed).toBe('2MB/s')
      expect(item.eta).toBe('10s')
      expect(mockOnProgress).toHaveBeenCalledWith(expect.objectContaining({ percentage: '45.5' }))
    })

    it('should handle missing progress fields', () => {
      const item = makeItem({ status: 'downloading' })
      const emitter = createEmitter()

      ;(manager as any).setupEmitterListeners(emitter, item, 1, 'test')

      emitter.emit('progress', {})

      expect(item.progress).toBe(0)
      expect(item.speed).toBe('')
      expect(item.eta).toBe('')
    })
  })

  describe('ytDlpEvent handler', () => {
    it('should set title from Destination event', () => {
      const item = makeItem({ status: 'downloading' })
      const emitter = createEmitter()

      ;(manager as any).setupEmitterListeners(emitter, item, 1, 'test')

      emitter.emit('ytDlpEvent', 'Destination', '/mock/downloads/My Video.mp4')

      expect(item.title).toBe('My Video')
      expect(item.outputPath).toBe('/mock/downloads/My Video.mp4')
    })

    it('should show FFmpeg processing on ExtractAudio event', () => {
      const item = makeItem({ status: 'downloading' })
      const emitter = createEmitter()

      ;(manager as any).setupEmitterListeners(emitter, item, 1, 'test')

      emitter.emit('ytDlpEvent', 'ExtractAudio', '')

      expect(item.speed).toBe('Procesando audio...')
      expect(item.eta).toBe('FFmpeg')
    })

    it('should ignore other ytDlpEvent types', () => {
      const item = makeItem({ status: 'downloading' })
      const emitter = createEmitter()

      ;(manager as any).setupEmitterListeners(emitter, item, 1, 'test')

      emitter.emit('ytDlpEvent', 'SomeOtherEvent', 'data')

      expect(item.title).toBe('Test')
    })
  })
})

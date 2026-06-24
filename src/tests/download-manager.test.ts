import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock electron-store
vi.mock('electron-store', () => ({
  default: class MockStore {
    private data: Record<string, any> = {}
    get(key: string) { return this.data[key] }
    set(key: string, value: any) { this.data[key] = value }
  },
}))

// Mock electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/path'),
    getAppPath: vi.fn(() => '/mock/app/path'),
  },
  BrowserWindow: vi.fn(),
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
  shell: { openPath: vi.fn() },
  nativeTheme: { on: vi.fn() },
  Tray: vi.fn(() => ({ setToolTip: vi.fn(), on: vi.fn(), setImage: vi.fn() })),
  Menu: { buildFromTemplate: vi.fn() },
  Notification: vi.fn(),
}))

// Mock child_process
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  spawn: vi.fn(() => ({
    stdout: { on: vi.fn(), setEncoding: vi.fn() },
    stderr: { on: vi.fn(), setEncoding: vi.fn() },
    on: vi.fn(),
    pid: 12345,
  })),
  default: {
    execSync: vi.fn(),
    spawn: vi.fn(),
  },
}))

// Mock yt-dlp-wrap
const mockExec = vi.fn()
const mockGetBinaryPath = vi.fn()
const mockSetBinaryPath = vi.fn()
const mockDownloadFromGithub = vi.fn().mockResolvedValue(undefined)

vi.mock('yt-dlp-wrap', () => ({
  default: class MockYtDlpWrap {
    exec = mockExec
    getBinaryPath = mockGetBinaryPath
    setBinaryPath = mockSetBinaryPath
    static downloadFromGithub = mockDownloadFromGithub
  },
  downloadFromGithub: mockDownloadFromGithub,
}))

import { DownloadManager } from '../main/downloader/manager'
import type { DownloadItem } from '../src/types'

describe('BaseDownloadManager (via DownloadManager)', () => {
  let manager: DownloadManager
  const mockOnProgress = vi.fn()
  const mockOnComplete = vi.fn()
  const mockOnError = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    manager = new DownloadManager(
      '/mock/downloads',
      mockOnProgress,
      mockOnComplete,
      mockOnError
    )
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('ensureBinary()', () => {
    it('should set binaryReady to true when getBinaryPath succeeds', async () => {
      mockGetBinaryPath.mockReturnValue('/mock/yt-dlp')
      await manager.ensureBinary()
      expect((manager as any).binaryReady).toBe(true)
    })

    it('should set binaryReady after download when getBinaryPath throws', async () => {
      mockGetBinaryPath.mockImplementation(() => { throw new Error('not found') })
      await manager.ensureBinary()
      expect((manager as any).binaryReady).toBe(true)
    })

    it('should not re-download if already ready', async () => {
      mockGetBinaryPath.mockReturnValue('/mock/yt-dlp')
      ;(manager as any).binaryReady = true
      await manager.ensureBinary()
      expect(mockDownloadFromGithub).not.toHaveBeenCalled()
    })
  })

  describe('Queue management', () => {
    it('should initialize with empty queue', () => {
      expect(manager.getQueue()).toEqual([])
    })

    it('should return a copy of the queue', () => {
      const queue1 = manager.getQueue()
      const queue2 = manager.getQueue()
      expect(queue1).not.toBe(queue2)
      expect(queue1).toEqual(queue2)
    })
  })

  describe('cancelItem()', () => {
    it('should cancel an active download and call onComplete', () => {
      const mockKill = vi.fn()
      const item: DownloadItem = {
        id: 'test-1',
        url: 'https://example.com/video.mp4',
        title: 'Test Video',
        status: 'downloading',
        progress: 50,
        speed: '1 MB/s',
        eta: '10s',
        totalBytes: 1000,
        downloadedBytes: 500,
        format: 'video',
        quality: 'best',
      }
      const emitter = { ytDlpProcess: { kill: mockKill }, on: vi.fn() }
      ;(manager as any).activeItems.set('test-1', { item, emitter })

      manager.cancelItem('test-1')

      expect(mockKill).toHaveBeenCalledWith('SIGTERM')
      expect(item.status).toBe('cancelled')
      expect(mockOnComplete).toHaveBeenCalledWith(item)
      expect((manager as any).activeItems.has('test-1')).toBe(false)
    })

    it('should cancel a queued item', () => {
      const item: DownloadItem = {
        id: 'test-2',
        url: 'https://example.com/video2.mp4',
        title: 'Queued Video',
        status: 'queued',
        progress: 0,
        speed: '',
        eta: '',
        totalBytes: 0,
        downloadedBytes: 0,
        format: 'video',
        quality: 'best',
      }
      ;(manager as any).queue.push(item)

      manager.cancelItem('test-2')

      expect(item.status).toBe('cancelled')
      expect(mockOnComplete).toHaveBeenCalledWith(item)
      expect(manager.getQueue()).not.toContainEqual(item)
    })
  })

  describe('cancelAll()', () => {
    it('should cancel all active and queued items', () => {
      const mockKill = vi.fn()
      const activeItem: DownloadItem = {
        id: 'active-1',
        url: 'https://example.com/a.mp4',
        title: 'Active',
        status: 'downloading',
        progress: 30,
        speed: '',
        eta: '',
        totalBytes: 0,
        downloadedBytes: 0,
        format: 'video',
        quality: 'best',
      }
      const queuedItem: DownloadItem = {
        id: 'queued-1',
        url: 'https://example.com/q.mp4',
        title: 'Queued',
        status: 'queued',
        progress: 0,
        speed: '',
        eta: '',
        totalBytes: 0,
        downloadedBytes: 0,
        format: 'video',
        quality: 'best',
      }
      const emitter = { ytDlpProcess: { kill: mockKill }, on: vi.fn() }
      ;(manager as any).activeItems.set('active-1', { item: activeItem, emitter })
      ;(manager as any).queue.push(queuedItem)

      manager.cancelAll()

      expect(mockKill).toHaveBeenCalledWith('SIGTERM')
      expect(activeItem.status).toBe('cancelled')
      expect(queuedItem.status).toBe('cancelled')
      expect((manager as any).activeItems.size).toBe(0)
      expect(manager.getQueue()).toEqual([])
    })
  })

  describe('Pause/Resume', () => {
    it('should set paused state to true on pauseAll', () => {
      manager.pauseAll()
      expect((manager as any).paused).toBe(true)
    })

    it('should set paused state to false on resumeAll', () => {
      manager.pauseAll()
      manager.resumeAll()
      expect((manager as any).paused).toBe(false)
    })

    it('should kill active downloads on pauseAll', () => {
      const mockKill = vi.fn()
      const item: DownloadItem = {
        id: 'p-1',
        url: 'https://example.com/v.mp4',
        title: 'Pause Test',
        status: 'downloading',
        progress: 40,
        speed: '2 MB/s',
        eta: '5s',
        totalBytes: 1000,
        downloadedBytes: 400,
        format: 'video',
        quality: 'best',
      }
      const emitter = { ytDlpProcess: { kill: mockKill }, on: vi.fn() }
      ;(manager as any).activeItems.set('p-1', { item, emitter })

      manager.pauseAll()

      expect(mockKill).toHaveBeenCalledWith('SIGTERM')
      expect(item.status).toBe('queued')
      expect(item.speed).toBe('Pausado')
    })
  })

  describe('validateUrl()', () => {
    it('should accept valid HTTP URLs', () => {
      expect((manager as any).validateUrl('https://youtube.com/watch?v=abc')).toBe(true)
      expect((manager as any).validateUrl('http://example.com')).toBe(true)
    })

    it('should reject invalid URLs', () => {
      expect((manager as any).validateUrl('ftp://files.com')).toBe(false)
      expect((manager as any).validateUrl('not-a-url')).toBe(false)
      expect((manager as any).validateUrl('')).toBe(false)
    })
  })

  describe('cleanQueue()', () => {
    it('should remove completed, cancelled, and error items', () => {
      const items: DownloadItem[] = [
        { id: '1', url: '', title: '', status: 'completed', progress: 100, speed: '', eta: '', totalBytes: 0, downloadedBytes: 0, format: 'video', quality: 'best' },
        { id: '2', url: '', title: '', status: 'cancelled', progress: 0, speed: '', eta: '', totalBytes: 0, downloadedBytes: 0, format: 'video', quality: 'best' },
        { id: '3', url: '', title: '', status: 'error', progress: 0, speed: '', eta: '', totalBytes: 0, downloadedBytes: 0, format: 'video', quality: 'best' },
        { id: '4', url: '', title: '', status: 'queued', progress: 0, speed: '', eta: '', totalBytes: 0, downloadedBytes: 0, format: 'video', quality: 'best' },
        { id: '5', url: '', title: '', status: 'downloading', progress: 50, speed: '', eta: '', totalBytes: 0, downloadedBytes: 0, format: 'video', quality: 'best' },
      ]
      ;(manager as any).queue = items

      ;(manager as any).cleanQueue()

      const remaining = manager.getQueue()
      expect(remaining).toHaveLength(2)
      expect(remaining.every(i => i.status === 'queued' || i.status === 'downloading')).toBe(true)
    })
  })
})

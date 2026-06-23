import { describe, it, expect, vi, beforeEach } from 'vitest'

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

import { DownloadManager } from '../main/downloader/manager'

describe('DownloadManager', () => {
  let manager: DownloadManager
  const mockOnProgress = vi.fn()
  const mockOnComplete = vi.fn()
  const mockOnError = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    manager = new DownloadManager(
      '/mock/downloads',
      mockOnProgress,
      mockOnComplete,
      mockOnError
    )
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
  })

  describe('Cancel', () => {
    it('should clear queue on cancelAll', () => {
      manager.cancelAll()
      expect(manager.getQueue()).toEqual([])
    })
  })
})

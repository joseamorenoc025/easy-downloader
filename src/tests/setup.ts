import { vi } from 'vitest'
import '@testing-library/jest-dom'

// Mock electron APIs for renderer tests
window.easyDownloader = {
  checkDependencies: vi.fn().mockResolvedValue({
    ffmpeg: true,
    ytdlp: true,
  }),
  onSpotifyTrackError: vi.fn(),
  removeAllListeners: vi.fn(),
  setGlobalPause: vi.fn(),
  addDownload: vi.fn(),
  addSpotifyDownload: vi.fn(),
  cancelDownload: vi.fn(),
  cancelAll: vi.fn(),
  openFolder: vi.fn(),
  getSettings: vi.fn().mockResolvedValue({}),
  setSetting: vi.fn(),
  getHistory: vi.fn().mockResolvedValue([]),
  addToHistory: vi.fn(),
  clearHistory: vi.fn(),
} as any

// Mock URL validation
vi.mock('../main/utils/url', () => ({
  isValidHttpUrl: vi.fn((url: string) => {
    try {
      const parsed = new URL(url)
      return ['http:', 'https:'].includes(parsed.protocol)
    } catch {
      return false
    }
  }),
}))

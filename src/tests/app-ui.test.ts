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

// Mock i18n context
vi.mock('../renderer/src/i18n/context', () => ({
  I18nProvider: ({ children }: any) => children,
  useI18n: () => ({
    t: (key: string) => key,
    locale: 'en',
    setLocale: vi.fn(),
  }),
}))

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: (props: any) => {
      const { children, ...rest } = props || {}
      return { type: 'div', props: rest, children }
    },
  },
  AnimatePresence: (props: any) => props.children,
}))

// Mock components
vi.mock('../renderer/src/components/download-form', () => ({
  DownloadForm: () => 'DownloadForm',
}))

vi.mock('../renderer/src/components/queue-list', () => ({
  QueueList: () => 'QueueList',
}))

vi.mock('../renderer/src/components/history', () => ({
  History: () => 'History',
}))

vi.mock('../renderer/src/components/theme-toggle', () => ({
  ThemeToggle: () => 'ThemeToggle',
}))

vi.mock('../renderer/src/components/dependency-banner', () => ({
  DependencyBanner: () => 'DependencyBanner',
}))

vi.mock('../renderer/src/components/toast', () => ({
  ToastProvider: ({ children }: any) => children,
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

// Mock hooks
vi.mock('../renderer/src/hooks/use-downloads', () => ({
  useDownloads: () => ({
    queue: [],
    isLoading: false,
    addDownload: vi.fn(),
    addSpotifyDownload: vi.fn(),
    cancelDownload: vi.fn(),
    cancelAll: vi.fn(),
    openFolder: vi.fn(),
  }),
}))

vi.mock('../renderer/src/hooks/use-settings', () => ({
  useSettings: () => ({
    settings: {
      themeMode: 'dark',
      downloadPath: '/downloads',
      incognitoMode: false,
      fetchMetadata: true,
      globalPause: false,
    },
    updateTheme: vi.fn(),
    setFetchMetadata: vi.fn(),
    setIncognitoMode: vi.fn(),
    selectDirectory: vi.fn(),
  }),
}))

// Mock IPC
vi.mock('../renderer/src/lib/ipc', () => ({}))

// Mock URL validation for renderer
vi.mock('../renderer/src/lib/utils', () => ({
  isValidUrl: vi.fn((url: string) => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }),
}))

import App from '../renderer/src/App'

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should export App as default', () => {
    expect(App).toBeDefined()
    expect(typeof App).toBe('function')
  })
})

import '@testing-library/jest-dom'

// Mock de electron APIs para tests en renderer
window.electron = {
  ipcRenderer: {
    send: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
    invoke: vi.fn(),
  },
  store: {
    get: vi.fn(),
    set: vi.fn(),
  },
} as any

// Mock de URL validation
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

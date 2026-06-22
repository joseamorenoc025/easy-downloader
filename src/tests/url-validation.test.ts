import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock de módulos de Node/Electron que no existen en entorno de test
vi.mock('electron-store', () => ({
  default: class MockStore {
    private data: Record<string, any> = {}
    get(key: string) { return this.data[key] }
    set(key: string, value: any) { this.data[key] = value }
  },
}))

vi.mock('child_process', () => ({
  spawn: vi.fn(() => ({
    stdout: { on: vi.fn(), setEncoding: vi.fn() },
    stderr: { on: vi.fn(), setEncoding: vi.fn() },
    on: vi.fn(),
    pid: 12345,
  })),
}))

import { isValidHttpUrl } from '../main/utils/url'

describe('URL Validation', () => {
  describe('isValidHttpUrl', () => {
    it('debe aceptar URLs HTTP válidas', () => {
      expect(isValidHttpUrl('http://example.com')).toBe(true)
      expect(isValidHttpUrl('https://youtube.com/watch?v=abc123')).toBe(true)
    })

    it('debe rechazar protocolos peligrosos', () => {
      expect(isValidHttpUrl('file:///etc/passwd')).toBe(false)
      expect(isValidHttpUrl('javascript:alert(1)')).toBe(false)
      expect(isValidHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
    })

    it('debe rechazar URLs inválidas', () => {
      expect(isValidHttpUrl('not-a-url')).toBe(false)
      expect(isValidHttpUrl('')).toBe(false)
      expect(isValidHttpUrl(null as any)).toBe(false)
    })

    it('debe aceptar URLs de Spotify válidas', () => {
      expect(isValidHttpUrl('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M')).toBe(true)
      expect(isValidHttpUrl('https://open.spotify.com/track/3n3Ppam7vgaVa1iaRUc9Lp')).toBe(true)
    })
  })
})

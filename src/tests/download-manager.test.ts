import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron-store', () => ({
  default: class MockStore {
    private data: Record<string, any> = {}
    get(key: string) { return this.data[key] }
    set(key: string, value: any) { this.data[key] = value }
  },
}))

import DownloadManager from '../main/downloader/manager'

describe('DownloadManager - Rendimiento y Cola', () => {
  let manager: DownloadManager

  beforeEach(() => {
    manager = new DownloadManager()
    vi.clearAllMocks()
  })

  describe('Gestión de Cola', () => {
    it('debe limitar a 3 descargas simultáneas', async () => {
      // Simular 5 descargas añadidas
      const promises = []
      for (let i = 0; i < 5; i++) {
        promises.push(
          manager.addToQueue(`https://youtube.com/watch?v=test${i}`, 'mp4', false)
        )
      }

      // Verificar que solo 3 están activas inicialmente
      expect(manager.getActiveCount()).toBeLessThanOrEqual(3)
    })

    it('debe permitir pausar todas las descargas', () => {
      manager.pauseAll()
      // El estado interno debe reflejar la pausa
      expect((manager as any).paused).toBe(true)
    })

    it('debe permitir reanudar todas las descargas', () => {
      manager.pauseAll()
      manager.resumeAll()
      expect((manager as any).paused).toBe(false)
    })
  })

  describe('Modo Incógnito', () => {
    it('debe marcar descargas como incógnito', async () => {
      await manager.addToQueue('https://youtube.com/watch?v=test', 'mp3', true)
      
      const queue = (manager as any).queue
      expect(queue.some((item: any) => item.incognito === true)).toBe(true)
    })

    it('debe marcar descargas normales como no incógnito por defecto', async () => {
      await manager.addToQueue('https://youtube.com/watch?v=test', 'mp3', false)
      
      const queue = (manager as any).queue
      expect(queue.some((item: any) => item.incognito === false)).toBe(true)
    })
  })

  describe('Optimización de Eventos', () => {
    it('debe tener throttling configurado para 100ms', () => {
      // Verificar que el intervalo de throttle está optimizado
      expect((manager as any).throttleInterval).toBe(100)
    })
  })
})

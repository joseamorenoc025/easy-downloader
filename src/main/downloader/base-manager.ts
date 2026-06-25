const { default: YtDlpWrap } = require('yt-dlp-wrap')
import { join } from 'path'
import { existsSync } from 'fs'
import { app } from 'electron'
import { isValidHttpUrl } from '../utils/url'
import type { DownloadItem, DownloadProgress, DownloadErrorCategory } from '../../src/types'
import { classifyYtDlpError } from './error-parser'

export type ProgressCallback = (progress: DownloadProgress) => void
export type CompleteCallback = (item: DownloadItem) => void
export type ErrorCallback = (
  itemId: string,
  category: DownloadErrorCategory,
  details?: string
) => void

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec === 0) return '0 B/s'
  if (bytesPerSec < 1024) return `${Math.round(bytesPerSec)} B/s`
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KiB/s`
  if (bytesPerSec < 1024 * 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MiB/s`
  return `${(bytesPerSec / (1024 * 1024 * 1024)).toFixed(1)} GiB/s`
}

function parseSize(str: string): number {
  if (!str) return 0
  const match = str.match(/([\d.]+)\s*(B|KB|MB|GB|TB|KiB|MiB|GiB|TiB)/i)
  if (!match) return 0
  const val = parseFloat(match[1])
  const unit = match[2].toLowerCase()
  const multipliers: Record<string, number> = {
    b: 1,
    kb: 1024,
    kib: 1024,
    mb: 1024 * 1024,
    mib: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
    gib: 1024 * 1024 * 1024,
    tb: 1024 * 1024 * 1024 * 1024,
    tib: 1024 * 1024 * 1024 * 1024
  }
  return val * (multipliers[unit] || 1)
}

export interface ActiveDownload {
  item: DownloadItem
  emitter: import('yt-dlp-wrap').YTDlpEventEmitter
}

export abstract class BaseDownloadManager {
  protected queue: DownloadItem[] = []
  protected activeItems: Map<string, ActiveDownload> = new Map()
  protected maxConcurrent = 3
  protected ytDlp: import('yt-dlp-wrap').default
  protected binaryReady = false
  protected downloadPath: string
  protected paused = false
  /** Acumulador de stderr por item, para clasificar el error al cierre. */
  protected stderrBuffers: Map<string, string> = new Map()

  protected onProgress: ProgressCallback
  protected onComplete: CompleteCallback
  protected onError: ErrorCallback

  constructor(
    downloadPath: string,
    onProgress: ProgressCallback,
    onComplete: CompleteCallback,
    onError: ErrorCallback
  ) {
    this.downloadPath = downloadPath
    this.ytDlp = new YtDlpWrap()
    this.onProgress = onProgress
    this.onComplete = onComplete
    this.onError = onError
  }

  async ensureBinary(): Promise<void> {
    if (this.binaryReady) return
    const isWin = process.platform === 'win32'
    const binaryName = isWin ? 'yt-dlp.exe' : 'yt-dlp'
    const ytDlpPath = join(app.getPath('userData'), binaryName)

    // Check if binary already exists on disk
    if (existsSync(ytDlpPath)) {
      this.ytDlp.setBinaryPath(ytDlpPath)
      this.binaryReady = true
      return
    }

    // Try the default path from yt-dlp-wrap
    try {
      const binPath = this.ytDlp.getBinaryPath()
      if (existsSync(binPath)) {
        this.binaryReady = true
        return
      }
    } catch {
      // getBinaryPath throws when not found — expected
    }

    // Download fresh binary
    await YtDlpWrap.downloadFromGithub(ytDlpPath)
    this.ytDlp.setBinaryPath(ytDlpPath)
    this.binaryReady = true
  }

  cancelItem(itemId: string): void {
    const active = this.activeItems.get(itemId)
    if (active) {
      active.emitter.ytDlpProcess?.kill('SIGTERM')
      active.item.status = 'cancelled'
      this.onComplete(active.item)
      this.activeItems.delete(itemId)
      this.cleanQueue()
      setTimeout(() => this.processQueue(), 100)
      return
    }

    const item = this.queue.find((i) => i.id === itemId)
    if (item) {
      item.status = 'cancelled'
      this.onComplete(item)
      this.queue = this.queue.filter((i) => i.id !== itemId)
    }
  }

  cancelAll(): void {
    for (const [, active] of this.activeItems) {
      active.emitter.ytDlpProcess?.kill('SIGTERM')
      active.item.status = 'cancelled'
      this.onComplete(active.item)
    }
    this.activeItems.clear()

    this.queue.forEach((item) => {
      if (item.status === 'queued') {
        item.status = 'cancelled'
        this.onComplete(item)
      }
    })
    this.queue = []
  }

  getQueue(): DownloadItem[] {
    return [...this.queue]
  }

  protected cleanQueue(): void {
    this.queue = this.queue.filter(
      (i) => i.status !== 'completed' && i.status !== 'cancelled' && i.status !== 'error'
    )
  }

  protected processQueue(): void {
    if (this.paused) return
    const slots = this.maxConcurrent - this.activeItems.size
    if (slots <= 0) return

    const queued = this.queue.filter((i) => i.status === 'queued').slice(0, slots)
    if (queued.length === 0) return

    for (const item of queued) {
      this.startDownload(item)
    }
  }

  protected abstract startDownload(item: DownloadItem, attempt?: number): void | Promise<void>

  protected setupEmitterListeners(
    emitter: import('yt-dlp-wrap').YTDlpEventEmitter,
    item: DownloadItem,
    attempt: number,
    context?: string
  ): void {
    emitter.on('progress', (progress) => {
      const pct = progress.percent ?? 0
      item.progress = pct

      // Format speed as human-readable string for the renderer
      const rawSpeed = progress.currentSpeed
      if (typeof rawSpeed === 'number') {
        item.speed = formatSpeed(rawSpeed)
      } else if (typeof rawSpeed === 'string' && rawSpeed.trim()) {
        item.speed = rawSpeed.trim()
      }
      item.eta = progress.eta ?? ''

      const totalSizeStr = progress.totalSize ?? ''
      const totalBytes = parseSize(totalSizeStr)
      const downloadedBytes = totalBytes > 0 ? Math.round((pct / 100) * totalBytes) : 0

      console.log('[PROGRESS]', {
        id: item.id,
        pct,
        speed: item.speed,
        rawSpeed: progress.currentSpeed,
        totalSize: totalSizeStr,
        totalBytes,
        downloadedBytes
      })

      this.onProgress({
        id: item.id,
        percentage: pct.toFixed(1),
        speed: item.speed,
        eta: item.eta,
        downloaded: downloadedBytes > 0 ? `${downloadedBytes} B` : '',
        total: totalSizeStr,
        title: item.title,
        totalSize: totalSizeStr
      })
    })

    emitter.on('ytDlpEvent', (eventType, eventData) => {
      if (eventType === 'Destination') {
        const filePath = eventData.trim()
        const fileName = filePath.split(/[\\/]/).pop() || ''
        item.title = fileName.replace(/\.[^.]+$/, '')
        item.outputPath = filePath
        // Notify renderer of the title update
        this.onProgress({
          id: item.id,
          percentage: item.progress.toString(),
          speed: item.speed,
          eta: item.eta,
          downloaded: '',
          total: '',
          title: item.title
        })
      }
      if (eventType === 'ExtractAudio') {
        item.speed = 'Procesando audio...'
        item.eta = 'FFmpeg'
        this.onProgress({
          id: item.id,
          percentage: '100',
          speed: item.speed,
          eta: item.eta,
          downloaded: '',
          total: '',
          title: item.title
        })
      }
      // Acumular stderr / mensajes de error para clasificar al cierre.
      // yt-dlp-wrap emite líneas de error como 'ytDlpEvent' con eventType
      // que contiene 'ERROR', 'WARNING', o variantes según el evento.
      if (
        typeof eventData === 'string' &&
        (eventType === 'error' || eventType === 'stderr' || /error|warning/i.test(eventType))
      ) {
        const buf = this.stderrBuffers.get(item.id) || ''
        this.stderrBuffers.set(item.id, buf + eventData + '\n')
      }
    })

    emitter.on('close', (code) => {
      this.activeItems.delete(item.id)
      const stderr = this.stderrBuffers.get(item.id) || ''
      this.stderrBuffers.delete(item.id)
      const classified = classifyYtDlpError(stderr, code)

      if (code === 0) {
        item.status = 'completed'
        item.progress = 100
        this.onComplete(item)
        this.cleanQueue()
        setTimeout(() => this.processQueue(), 100)
      } else if (item.status !== 'cancelled') {
        if (context) console.error(`[${context}] Download failed (code=${code}): ${item.url}`)
        if (attempt < 3 && !this.paused) {
          item.speed = `Reintentando (${attempt}/3)...`
          this.onProgress({
            id: item.id,
            percentage: item.progress.toString(),
            speed: item.speed,
            eta: '',
            downloaded: '',
            total: '',
            title: item.title
          })
          setTimeout(() => this.startDownload(item, attempt + 1), 3000)
        } else {
          const details = stderr || `Process exited with code ${code}`
          item.status = 'error'
          item.error = details
          item.errorCategory = classified.category
          item.errorDetails = details
          this.onError(item.id, classified.category, details)
          this.cleanQueue()
          setTimeout(() => this.processQueue(), 100)
        }
      }
    })

    emitter.on('error', (err) => {
      this.activeItems.delete(item.id)
      const stderr = this.stderrBuffers.get(item.id) || err.message || ''
      this.stderrBuffers.delete(item.id)
      const classified = classifyYtDlpError(stderr)
      if (context) console.error(`[${context}] Download error: ${err.message} for ${item.url}`)
      if (item.status !== 'cancelled') {
        if (attempt < 3 && !this.paused) {
          item.speed = `Reintentando (${attempt}/3)...`
          this.onProgress({
            id: item.id,
            percentage: item.progress.toString(),
            speed: item.speed,
            eta: '',
            downloaded: '',
            total: '',
            title: item.title
          })
          setTimeout(() => this.startDownload(item, attempt + 1), 3000)
        } else {
          item.status = 'error'
          item.error = stderr || err.message
          item.errorCategory = classified.category
          item.errorDetails = stderr || err.message
          this.onError(item.id, classified.category, stderr || err.message)
          this.cleanQueue()
          setTimeout(() => this.processQueue(), 100)
        }
      }
    })
  }

  protected validateUrl(url: string): boolean {
    if (!isValidHttpUrl(url)) {
      return false
    }
    return true
  }
}

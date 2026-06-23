// eslint-disable-next-line @typescript-eslint/no-var-requires
const { default: YtDlpWrap } = require('yt-dlp-wrap')
import { join } from 'path'
import { app } from 'electron'
import { isValidHttpUrl } from '../utils/url'
import type { DownloadItem, DownloadProgress } from '../../src/types'

export type ProgressCallback = (progress: DownloadProgress) => void
export type CompleteCallback = (item: DownloadItem) => void
export type ErrorCallback = (itemId: string, error: string) => void

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
    try {
      this.ytDlp.getBinaryPath()
      this.binaryReady = true
    } catch {
      await YtDlpWrap.downloadFromGithub(ytDlpPath)
      this.ytDlp.setBinaryPath(ytDlpPath)
      this.binaryReady = true
    }
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

    const item = this.queue.find(i => i.id === itemId)
    if (item) {
      item.status = 'cancelled'
      this.onComplete(item)
      this.queue = this.queue.filter(i => i.id !== itemId)
    }
  }

  cancelAll(): void {
    for (const [, active] of this.activeItems) {
      active.emitter.ytDlpProcess?.kill('SIGTERM')
      active.item.status = 'cancelled'
      this.onComplete(active.item)
    }
    this.activeItems.clear()

    this.queue.forEach(item => {
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
      i => i.status !== 'completed' && i.status !== 'cancelled' && i.status !== 'error'
    )
  }

  protected processQueue(): void {
    if (this.paused) return
    const slots = this.maxConcurrent - this.activeItems.size
    if (slots <= 0) return

    const queued = this.queue.filter(i => i.status === 'queued').slice(0, slots)
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
      item.speed = progress.currentSpeed ?? ''
      item.eta = progress.eta ?? ''

      this.onProgress({
        id: item.id,
        percentage: pct.toFixed(1),
        speed: item.speed,
        eta: item.eta,
        downloaded: '',
        total: progress.totalSize ?? ''
      })
    })

    emitter.on('ytDlpEvent', (eventType, eventData) => {
      if (eventType === 'Destination') {
        const filePath = eventData.trim()
        const fileName = filePath.split(/[\\/]/).pop() || ''
        item.title = fileName.replace(/\.[^.]+$/, '')
        item.outputPath = filePath
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
          total: ''
        })
      }
    })

    emitter.on('close', (code) => {
      this.activeItems.delete(item.id)

      if (code === 0) {
        item.status = 'completed'
        item.progress = 100
        this.onComplete(item)
        this.cleanQueue()
        setTimeout(() => this.processQueue(), 100)
      } else if (item.status !== 'cancelled') {
        if (context) console.error(`[${context}] Download failed (code=${code}): ${item.url}`)
        if (attempt < 3) {
          item.speed = `Reintentando (${attempt}/3)...`
          this.onProgress({
            id: item.id,
            percentage: item.progress.toString(),
            speed: item.speed,
            eta: '',
            downloaded: '',
            total: ''
          })
          setTimeout(() => this.startDownload(item, attempt + 1), 3000)
        } else {
          item.status = 'error'
          item.error = `Process exited with code ${code}`
          this.onError(item.id, item.error)
          this.cleanQueue()
          setTimeout(() => this.processQueue(), 100)
        }
      }
    })

    emitter.on('error', (err) => {
      this.activeItems.delete(item.id)
      if (context) console.error(`[${context}] Download error: ${err.message} for ${item.url}`)
      if (item.status !== 'cancelled') {
        if (attempt < 3) {
          item.speed = `Reintentando (${attempt}/3)...`
          this.onProgress({
            id: item.id,
            percentage: item.progress.toString(),
            speed: item.speed,
            eta: '',
            downloaded: '',
            total: ''
          })
          setTimeout(() => this.startDownload(item, attempt + 1), 3000)
        } else {
          item.status = 'error'
          item.error = err.message
          this.onError(item.id, err.message)
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

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { default: YtDlpWrap } = require('yt-dlp-wrap')
import { randomUUID } from 'crypto'
import { join } from 'path'
import { app } from 'electron'
import { buildDownloadOptions } from './options'
import { getFfmpegPath } from './ffmpeg'
import type { DownloadItem, DownloadOptions, DownloadProgress } from '../../src/types'

type ProgressCallback = (progress: DownloadProgress) => void
type CompleteCallback = (item: DownloadItem) => void
type ErrorCallback = (itemId: string, error: string) => void

interface ActiveDownload {
  item: DownloadItem
  emitter: import('yt-dlp-wrap').YTDlpEventEmitter
}

export class DownloadManager {
  private queue: DownloadItem[] = []
  private activeItems: Map<string, ActiveDownload> = new Map()
  private maxConcurrent = 3
  private ytDlp: import('yt-dlp-wrap').default
  private binaryReady = false
  private downloadPath: string

  private onProgress: ProgressCallback
  private onComplete: CompleteCallback
  private onError: ErrorCallback

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

  async addToQueue(options: DownloadOptions): Promise<DownloadItem> {
    await this.ensureBinary()

    const item: DownloadItem = {
      id: randomUUID(),
      url: options.url,
      title: 'Queued...',
      status: 'queued',
      progress: 0,
      speed: '',
      eta: '',
      totalBytes: 0,
      downloadedBytes: 0,
      format: options.format,
      quality: options.quality
    }

    this.queue.push(item)
    this.processQueue()
    return item
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

  private cleanQueue(): void {
    this.queue = this.queue.filter(
      i => i.status !== 'completed' && i.status !== 'cancelled' && i.status !== 'error'
    )
  }

  private processQueue(): void {
    const slots = this.maxConcurrent - this.activeItems.size
    if (slots <= 0) return

    const queued = this.queue.filter(i => i.status === 'queued').slice(0, slots)
    if (queued.length === 0) return

    for (const item of queued) {
      this.startDownload(item)
    }
  }

  private startDownload(item: DownloadItem): void {
    item.status = 'downloading'

    const opts = buildDownloadOptions({
      url: item.url,
      format: item.format,
      quality: item.quality,
      outputDir: this.downloadPath
    })

    const args = [
      ...(item.url.includes('list=') ? ['--yes-playlist'] : ['--no-playlist']),
      item.url,
      '--no-warnings',
      '--newline',
      '--progress',
      '--ffmpeg-location', getFfmpegPath(),
      '-f', String(opts.format),
      '-o', String(opts.outtmpl),
      ...(item.format === 'audio'
        ? ['--extract-audio', '--audio-format', 'mp3', '--audio-quality', item.quality]
        : [])
    ]

    try {
      const emitter = this.ytDlp.exec(args)

      this.activeItems.set(item.id, { item, emitter })

      emitter.on('progress', (progress) => {
        const pct = progress.percent ?? 0
        item.progress = pct
        item.speed = progress.currentSpeed ?? ''
        item.eta = progress.eta ?? ''

        if (progress.totalSize) {
          const sizeStr = progress.totalSize.replace('~', '')
          const sizeMatch = sizeStr.match(/^([\d.]+)\s*(MiB|GiB|KiB)/)
          if (sizeMatch) {
            const val = parseFloat(sizeMatch[1])
            const unit = sizeMatch[2]
            item.totalBytes = unit === 'GiB' ? val * 1024 * 1024 * 1024
              : unit === 'MiB' ? val * 1024 * 1024
              : val * 1024
          }
        }

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
          item.title = eventData.trim()
        }
      })

      emitter.on('close', (code) => {
        this.activeItems.delete(item.id)

        if (code === 0) {
          item.status = 'completed'
          item.progress = 100
          this.onComplete(item)
        } else if (item.status !== 'cancelled') {
          item.status = 'error'
          item.error = `Process exited with code ${code}`
          this.onError(item.id, item.error)
        }

        this.cleanQueue()
        setTimeout(() => this.processQueue(), 100)
      })

      emitter.on('error', (err) => {
        this.activeItems.delete(item.id)
        item.status = 'error'
        item.error = err.message
        this.onError(item.id, err.message)
        this.cleanQueue()
        setTimeout(() => this.processQueue(), 100)
      })
    } catch (err) {
      item.status = 'error'
      item.error = (err as Error).message
      this.onError(item.id, (err as Error).message)
    }
  }
}

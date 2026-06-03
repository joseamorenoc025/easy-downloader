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

export class DownloadManager {
  private queue: DownloadItem[] = []
  private currentItem: DownloadItem | null = null
  private currentEmitter: import('yt-dlp-wrap').YTDlpEventEmitter | null = null
  private cancelled = false
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
    const item = this.queue.find(i => i.id === itemId)
    if (!item) return

    if (this.currentItem?.id === itemId && this.currentEmitter) {
      this.cancelled = true
      this.currentEmitter.ytDlpProcess?.kill('SIGTERM')
      item.status = 'cancelled'
      this.currentItem = null
      this.currentEmitter = null
      this.onComplete(item)
      this.processQueue()
    } else {
      item.status = 'cancelled'
      this.onComplete(item)
      this.queue = this.queue.filter(i => i.id !== itemId)
    }
  }

  cancelAll(): void {
    if (this.currentEmitter) {
      this.cancelled = true
      this.currentEmitter.ytDlpProcess?.kill('SIGTERM')
    }
    this.queue.forEach(item => {
      if (item.status === 'queued') {
        item.status = 'cancelled'
        this.onComplete(item)
      }
    })
    this.queue = []
    this.currentItem = null
    this.currentEmitter = null
  }

  getQueue(): DownloadItem[] {
    return [...this.queue]
  }

  private async processQueue(): Promise<void> {
    if (this.currentItem || this.queue.length === 0) return

    const item = this.queue.find(i => i.status === 'queued')
    if (!item) return

    this.currentItem = item
    item.status = 'downloading'

    try {
      this.cancelled = false
      const opts = buildDownloadOptions({
        url: item.url,
        format: item.format,
        quality: item.quality,
        outputDir: this.downloadPath
      })

      const args = [
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

      const emitter = this.ytDlp.exec(args)
      this.currentEmitter = emitter

      emitter.on('progress', (progress) => {
        if (this.cancelled) return
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

      await new Promise<void>((resolve) => {
        emitter.on('close', (code) => {
          if (this.cancelled) { resolve(); return }
          if (code === 0) {
            item.status = 'completed'
            item.progress = 100
            this.onComplete(item)
          } else if (item.status !== 'error') {
            item.status = 'error'
            item.error = `Process exited with code ${code}`
            this.onError(item.id, item.error)
          }
          resolve()
        })

        emitter.on('error', (err) => {
          if (!this.cancelled) {
            item.status = 'error'
            item.error = err.message
            this.onError(item.id, err.message)
          }
          resolve()
        })
      })
    } catch (err) {
      item.status = 'error'
      item.error = (err as Error).message
      this.onError(item.id, (err as Error).message)
    }

    this.currentItem = null
    this.currentEmitter = null
    this.queue = this.queue.filter(i => i.status !== 'completed' && i.status !== 'cancelled' && i.status !== 'error')

    setTimeout(() => this.processQueue(), 100)
  }
}

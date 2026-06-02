import YtDlpWrap from 'yt-dlp-wrap'
import { randomUUID } from 'crypto'
import { buildDownloadOptions } from './options'
import type { DownloadItem, DownloadOptions, DownloadProgress } from '../../src/types'

type ProgressCallback = (progress: DownloadProgress) => void
type CompleteCallback = (item: DownloadItem) => void
type ErrorCallback = (itemId: string, error: string) => void

export class DownloadManager {
  private queue: DownloadItem[] = []
  private currentItem: DownloadItem | null = null
  private currentProcess: YtDlpWrap | null = null
  private cancelled = false
  private ytDlp: YtDlpWrap

  private onProgress: ProgressCallback
  private onComplete: CompleteCallback
  private onError: ErrorCallback

  constructor(
    onProgress: ProgressCallback,
    onComplete: CompleteCallback,
    onError: ErrorCallback
  ) {
    this.ytDlp = new YtDlpWrap()
    this.onProgress = onProgress
    this.onComplete = onComplete
    this.onError = onError
  }

  async addToQueue(options: DownloadOptions): Promise<DownloadItem> {
    const item: DownloadItem = {
      id: randomUUID(),
      url: options.url,
      title: 'Fetching info...',
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

    if (this.currentItem?.id === itemId && this.currentProcess) {
      this.cancelled = true
      this.currentProcess.kill('SIGTERM')
      item.status = 'cancelled'
      this.currentItem = null
      this.currentProcess = null
      this.onComplete(item)
      this.processQueue()
    } else {
      item.status = 'cancelled'
      this.onComplete(item)
      this.queue = this.queue.filter(i => i.id !== itemId)
    }
  }

  cancelAll(): void {
    if (this.currentProcess) {
      this.cancelled = true
      this.currentProcess.kill('SIGTERM')
    }
    this.queue.forEach(item => {
      if (item.status === 'queued') {
        item.status = 'cancelled'
        this.onComplete(item)
      }
    })
    this.queue = []
    this.currentItem = null
    this.currentProcess = null
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
      const ytDlpOptions = buildDownloadOptions({
        url: item.url,
        format: item.format,
        quality: item.quality,
        outputDir: undefined
      })

      this.cancelled = false
      this.currentProcess = this.ytDlp

      const progressRegex = /\[download\]\s+([\d.]+)%/

      const stream = this.ytDlp.exec([
        item.url,
        '--no-warnings',
        '--newline',
        '--progress',
        '-f', String(ytDlpOptions.format),
        '-o', String(ytDlpOptions.outtmpl),
        ...(item.format === 'audio'
          ? ['--extract-audio', '--audio-format', 'mp3', '--audio-quality', item.quality]
          : [])
      ])

      stream.stdout?.on('data', (data: Buffer) => {
        if (this.cancelled) return
        const line = data.toString().trim()

        const progressMatch = line.match(progressRegex)
        if (progressMatch) {
          const percentage = parseFloat(progressMatch[1])
          item.progress = percentage

          const speedMatch = line.match(/at\s+([\d.]+[KMG]?i?B\/s)/)
          const etaMatch = line.match(/ETA\s+(\S+)/)
          const sizeMatch = line.match(/of\s+([\d.]+)\s*(MiB|GiB|KiB)/)

          if (speedMatch) item.speed = speedMatch[1]
          if (etaMatch) item.eta = etaMatch[1]
          if (sizeMatch) {
            const sizeVal = parseFloat(sizeMatch[1])
            const unit = sizeMatch[2]
            item.totalBytes = unit === 'GiB' ? sizeVal * 1024 * 1024 * 1024
              : unit === 'MiB' ? sizeVal * 1024 * 1024
              : sizeVal * 1024
          }

          this.onProgress({
            id: item.id,
            percentage: percentage.toFixed(1),
            speed: item.speed,
            eta: item.eta,
            downloaded: formatBytes(item.downloadedBytes),
            total: formatBytes(item.totalBytes)
          })
        }

        const titleMatch = line.match(/^\[download\] Destination:\s+(.+)/)
        if (titleMatch) {
          const filePath = titleMatch[1]
          const fileName = filePath.split(/[\\/]/).pop() || ''
          item.title = fileName.replace(/\.[^.]+$/, '')
          item.outputPath = filePath
        }
      })

      stream.stderr?.on('data', (data: Buffer) => {
        const line = data.toString()
        if (line.includes('ERROR:')) {
          item.status = 'error'
          item.error = line.replace('ERROR:', '').trim()
          this.onError(item.id, item.error)
        }
      })

      await new Promise<void>((resolve, reject) => {
        stream.on('close', (code: number | null) => {
          if (this.cancelled) {
            resolve()
            return
          }
          if (code === 0) {
            item.status = 'completed'
            item.progress = 100
            this.onComplete(item)
            resolve()
          } else if (item.status !== 'error') {
            item.status = 'error'
            item.error = `Process exited with code ${code}`
            this.onError(item.id, item.error)
            resolve()
          } else {
            resolve()
          }
        })

        stream.on('error', (err: Error) => {
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
    this.currentProcess = null
    this.queue = this.queue.filter(i => i.status !== 'completed' && i.status !== 'cancelled' && i.status !== 'error')

    setTimeout(() => this.processQueue(), 100)
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`
}

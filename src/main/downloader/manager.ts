import { randomUUID } from 'crypto'
import { buildDownloadOptions } from './options'
import { getFfmpegPath } from './ffmpeg'
import { BaseDownloadManager } from './base-manager'
import type { DownloadItem, DownloadOptions } from '../../src/types'

export class DownloadManager extends BaseDownloadManager {
  private progressTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()
  private lastProgressUpdate: Map<string, number> = new Map()
  private readonly PROGRESS_THROTTLE_MS = 100

  constructor(
    downloadPath: string,
    onProgress: (progress: import('../../src/types').DownloadProgress) => void,
    onComplete: (item: DownloadItem) => void,
    onError: (itemId: string, error: string) => void
  ) {
    super(downloadPath, onProgress, onComplete, onError)
  }

  async addToQueue(options: DownloadOptions & { incognito?: boolean }): Promise<DownloadItem> {
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
      quality: options.quality,
      incognito: options.incognito || false
    }

    this.queue.push(item)
    this.processQueue()
    return item
  }

  pauseAll(): void {
    this.paused = true
    for (const [, active] of this.activeItems) {
      active.emitter.ytDlpProcess?.kill('SIGTERM')
      active.item.status = 'queued'
      active.item.speed = 'Pausado'
      this.onProgress({
        id: active.item.id,
        percentage: active.item.progress.toString(),
        speed: 'Pausado',
        eta: '',
        downloaded: '',
        total: ''
      })
    }
  }

  resumeAll(): void {
    this.paused = false
    const queuedItems = this.queue.filter((i) => i.status === 'queued' && i.speed === 'Pausado')
    for (const item of queuedItems) {
      item.status = 'queued'
      item.speed = ''
    }
    this.processQueue()
  }

  protected startDownload(item: DownloadItem, attempt = 1): void {
    if (!this.validateUrl(item.url)) {
      item.status = 'error'
      item.error = 'URL inválida: solo se permiten http y https'
      this.onError(item.id, item.error)
      return
    }
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
      '--socket-timeout',
      '20',
      '--retries',
      '3',
      '--ffmpeg-location',
      getFfmpegPath(),
      '-f',
      String(opts.format),
      '-o',
      String(opts.outtmpl),
      ...(item.format === 'audio'
        ? ['--extract-audio', '--audio-format', 'mp3', '--audio-quality', item.quality]
        : [])
    ]

    try {
      const emitter = this.ytDlp.exec(args)
      this.activeItems.set(item.id, { item, emitter })
      this.setupEmitterListeners(emitter, item, attempt)

      emitter.on('ytDlpEvent', (eventType, eventData) => {
        if (eventType === 'Merger') {
          item.speed = 'Fusionando (FFmpeg)...'
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
        if (eventType === 'download' && eventData.includes('Downloading video')) {
          const match = eventData.match(/Downloading video (\d+) of (\d+)/)
          if (match) {
            item.title = `[Video ${match[1]}/${match[2]}] ${item.title.replace(/^\[Video \d+\/\d+\] /, '')}`
            this.onProgress({
              id: item.id,
              percentage: item.progress.toString(),
              speed: item.speed,
              eta: item.eta,
              downloaded: '',
              total: ''
            })
          }
        }
      })
    } catch (err) {
      item.status = 'error'
      item.error = (err as Error).message
      this.onError(item.id, (err as Error).message)
    }
  }
}

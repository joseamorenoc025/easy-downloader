import { spawn, ChildProcess } from 'child_process'
import { randomUUID } from 'crypto'
import { mkdirSync, existsSync } from 'fs'
import { getFfmpegPath } from './ffmpeg'
import { isValidHttpUrl } from '../utils/url'
import type { DownloadItem } from '../../src/types'

type CompleteCallback = (item: DownloadItem) => void
type ErrorCallback = (itemId: string, error: string) => void

export class SpotifyDownloadManager {
  private queue: DownloadItem[] = []
  private currentItem: DownloadItem | null = null
  private currentProcess: ChildProcess | null = null
  private onComplete: CompleteCallback
  private onError: ErrorCallback

  constructor(onComplete: CompleteCallback, onError: ErrorCallback) {
    this.onComplete = onComplete
    this.onError = onError
  }

  async addToQueue(url: string, downloadPath: string): Promise<DownloadItem> {
    const item: DownloadItem = {
      id: `spot-${randomUUID()}`,
      url,
      title: 'Fetching from Spotify...',
      status: 'queued',
      progress: 0,
      speed: '',
      eta: '',
      totalBytes: 0,
      downloadedBytes: 0,
      format: 'audio',
      quality: '128',
      source: 'spotify'
    }

    this.queue.push(item)
    this.processQueue(downloadPath)
    return item
  }

  cancelItem(itemId: string): void {
    const item = this.queue.find(i => i.id === itemId)
    if (!item) return
    if (this.currentItem?.id === itemId && this.currentProcess) {
      this.currentProcess.kill('SIGTERM')
    }
    item.status = 'cancelled'
    this.currentItem = null
    this.currentProcess = null
    this.onComplete(item)
    this.queue = this.queue.filter(i => i.id !== itemId)
  }

  cancelAll(): void {
    if (this.currentProcess) {
      this.currentProcess.kill('SIGTERM')
    }
    this.queue.forEach(item => item.status = 'cancelled')
    this.queue = []
    this.currentItem = null
    this.currentProcess = null
  }

  private processQueue(downloadPath: string): void {
    if (this.currentItem || this.queue.length === 0) return

    const item = this.queue.find(i => i.status === 'queued')
    if (!item) return

    this.currentItem = item
    item.status = 'downloading'

    try {
      if (!existsSync(downloadPath)) {
        mkdirSync(downloadPath, { recursive: true })
      }
    } catch {
      item.status = 'error'
      item.error = `Cannot create output directory: ${downloadPath}`
      this.onError(item.id, item.error)
      this.currentItem = null
      this.currentProcess = null
      return
    }

    const isWin = process.platform === 'win32'
    const spotdlCmd = isWin ? 'spotdl' : 'spotdl'

    try {
      // Defense in depth: validate URL before spawn. The IPC handler also
      // validates, but a direct call to addToQueue (e.g. from queue restore)
      // would bypass that — this guard is the last line of defense.
      // Also fixes the "Spotify saves to project root" bug: with `shell: true`,
      // downloadPath containing spaces (e.g. "C:\Users\José\Mi Música\") gets
      // split by the shell and spotdl falls back to the cwd. `shell: false`
      // sends args literally so the path arrives intact.
      if (!isValidHttpUrl(item.url)) {
        item.status = 'error'
        item.error = `URL inválida: solo se permiten http y https`
        this.onError(item.id, item.error)
        this.currentItem = null
        this.currentProcess = null
        this.queue = this.queue.filter(i => i.id !== item.id)
        return
      }
      this.currentProcess = spawn(spotdlCmd, [
        item.url,
        '--output', downloadPath,
        '--format', 'mp3',
        '--bitrate', '128k',
        '--ffmpeg', getFfmpegPath()
      ], { shell: false })

      let fullOutput = ''

      this.currentProcess.stdout?.on('data', (data: Buffer) => {
        const text = data.toString()
        fullOutput += text

        if (item.title === 'Fetching from Spotify...') {
          const match = text.match(/:?\s*(.+?)\s*$/m)
          if (match && match[1].trim()) {
            item.title = match[1].trim()
          }
        }
      })

      this.currentProcess.stderr?.on('data', (data: Buffer) => {
        fullOutput += data.toString()
      })

      this.currentProcess.on('close', (code) => {
        if (item.status === 'cancelled') return

        if (code === 0) {
          item.status = 'completed'
          item.progress = 100
          this.onComplete(item)
          this.currentItem = null
          this.currentProcess = null
          this.queue = this.queue.filter(i => i.id !== item.id)
          setTimeout(() => this.processQueue(downloadPath), 100)
        } else {
          const lower = fullOutput.toLowerCase()
          const notFound = lower.includes('not recognized') ||
            lower.includes('no se reconoce') ||
            lower.includes('command not found') ||
            lower.includes('not found') ||
            lower.includes('no encontrado')

          if (notFound) {
            item.status = 'error'
            item.error = 'spotdl is not installed. Run: pip install spotdl'
            this.onError(item.id, item.error)
            this.currentItem = null
            this.currentProcess = null
            this.queue = this.queue.filter(i => i.id !== item.id)
            setTimeout(() => this.processQueue(downloadPath), 100)
          } else {
            const retries = (item as any).retries || 0
            if (retries < 3) {
              ;(item as any).retries = retries + 1
              item.status = 'queued'
              this.currentItem = null
              this.currentProcess = null
              setTimeout(() => this.processQueue(downloadPath), 3000)
            } else {
              item.status = 'error'
              item.error = fullOutput.split('\n').filter(l => l.trim()).slice(-3).join('; ') || `Process exited with code ${code}`
              this.onError(item.id, item.error)
              this.currentItem = null
              this.currentProcess = null
              this.queue = this.queue.filter(i => i.id !== item.id)
              setTimeout(() => this.processQueue(downloadPath), 100)
            }
          }
        }
      })

      this.currentProcess.on('error', (err) => {
        if (item.status === 'cancelled') return
        
        const isEnoent = err.message.includes('ENOENT')
        if (isEnoent) {
          item.status = 'error'
          item.error = 'spotdl is not installed. Run: pip install spotdl'
          this.onError(item.id, item.error)
          this.currentItem = null
          this.currentProcess = null
          this.queue = this.queue.filter(i => i.id !== item.id)
          setTimeout(() => this.processQueue(downloadPath), 100)
        } else {
          const retries = (item as any).retries || 0
          if (retries < 3) {
            ;(item as any).retries = retries + 1
            item.status = 'queued'
            this.currentItem = null
            this.currentProcess = null
            setTimeout(() => this.processQueue(downloadPath), 3000)
          } else {
            item.status = 'error'
            item.error = err.message
            this.onError(item.id, item.error)
            this.currentItem = null
            this.currentProcess = null
            this.queue = this.queue.filter(i => i.id !== item.id)
            setTimeout(() => this.processQueue(downloadPath), 100)
          }
        }
      })
    } catch (err) {
      item.status = 'error'
      item.error = (err as Error).message
      this.onError(item.id, item.error)
      this.currentItem = null
      this.currentProcess = null
    }
  }
}

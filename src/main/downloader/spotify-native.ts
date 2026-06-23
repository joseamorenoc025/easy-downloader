// eslint-disable-next-line @typescript-eslint/no-var-requires
const { default: YtDlpWrap } = require('yt-dlp-wrap')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const spotifyUrlInfo = require('spotify-url-info')(globalThis.fetch)
import { randomUUID } from 'crypto'
import { join } from 'path'
import { mkdirSync, existsSync } from 'fs'
import { app } from 'electron'
import { getFfmpegPath } from './ffmpeg'
import { isValidHttpUrl } from '../utils/url'
import { AUDIO_FORMAT_MAP } from './options'
import { YtdlpSearchProvider } from './core/providers/ytdlp-search.provider'
import type { DownloadItem, DownloadProgress } from '../../src/types'

type CompleteCallback = (item: DownloadItem) => void
type ErrorCallback = (itemId: string, error: string) => void
type ProgressCallback = (progress: DownloadProgress) => void
type TrackErrorCallback = (itemId: string, trackTitle: string) => void

interface SpotifyTrack {
  name: string
  artist: string
  duration?: number
  uri?: string
}

interface ResolvedPlaylist {
  playlistName?: string
  tracks: SpotifyTrack[]
}

interface ActiveDownload {
  item: DownloadItem
  emitter: import('yt-dlp-wrap').YTDlpEventEmitter
}

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim()
}

const MAX_FILENAME_LENGTH = 200

export class SpotifyDownloadManager {
  private queue: DownloadItem[] = []
  private activeItems: Map<string, ActiveDownload> = new Map()
  private maxConcurrent = 3
  private ytDlp: import('yt-dlp-wrap').default
  private binaryReady = false
  private downloadPath: string
  private searcher: YtdlpSearchProvider
  private paused = false

  private onComplete: CompleteCallback
  private onError: ErrorCallback
  private onProgress: ProgressCallback
  private onTrackError: TrackErrorCallback

  constructor(
    downloadPath: string,
    onProgress: ProgressCallback,
    onComplete: CompleteCallback,
    onError: ErrorCallback,
    onTrackError: TrackErrorCallback
  ) {
    this.downloadPath = downloadPath
    this.ytDlp = new YtDlpWrap()
    this.searcher = new YtdlpSearchProvider()
    this.onComplete = onComplete
    this.onError = onError
    this.onProgress = onProgress
    this.onTrackError = onTrackError
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

  async addSpotifyUrl(url: string, quality?: string): Promise<DownloadItem[]> {
    await this.ensureBinary()

    const addedItems: DownloadItem[] = []

    try {
      const resolved = await this.resolveSpotifyUrl(url)

      if (resolved.tracks.length === 0) {
        const item = this.createItem(url, 'No tracks found')
        item.status = 'error'
        item.error = 'No se encontraron canciones en la URL de Spotify'
        this.onError(item.id, item.error)
        return [item]
      }

      for (const track of resolved.tracks) {
        const title = `${track.artist} - ${track.name}`
        const item = this.createItem(url, title)
        ;(item as any).spotifyTrack = track
        if (quality) item.quality = quality
        if (resolved.playlistName) {
          ;(item as any).playlistName = resolved.playlistName
        }
        this.queue.push(item)
        addedItems.push(item)
      }

      this.processQueue()
    } catch (err) {
      const item = this.createItem(url, 'Fetching from Spotify...')
      item.status = 'error'
      item.error = (err as Error).message
      this.onError(item.id, item.error)
      addedItems.push(item)
    }

    return addedItems
  }

  private createItem(url: string, title: string): DownloadItem {
    return {
      id: `spot-${randomUUID()}`,
      url,
      title,
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
  }

  private async resolveSpotifyUrl(url: string): Promise<ResolvedPlaylist> {
    try {
      const data = await spotifyUrlInfo.getData(url)
      const type = data.uri?.split(':')[1]

      if (type === 'track') {
        const preview = spotifyUrlInfo.getPreview
          ? await spotifyUrlInfo.getPreview(url)
          : null
        const trackData = data
        const artist = trackData.artists
          ?.map((a: any) => a.name)
          .join(', ') || preview?.artist || 'Unknown'
        const name = trackData.name || preview?.track || 'Unknown'
        return { tracks: [{ name, artist, duration: trackData.duration_ms, uri: trackData.uri }] }
      }

      const playlistName = data.name || 'Playlist'

      if (type === 'playlist' || type === 'album') {
        const tracksResult = await spotifyUrlInfo.getTracks(url)
        const tracks = tracksResult.map((t: any) => ({
          name: t.name,
          artist: t.artist,
          duration: t.duration,
          uri: t.uri
        }))
        return { playlistName, tracks }
      }

      const preview = await spotifyUrlInfo.getPreview(url)
      return { tracks: [{ name: preview.track, artist: preview.artist, uri: url }] }
    } catch (err) {
      throw new Error(`Error al obtener metadata de Spotify: ${(err as Error).message}`)
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

  pauseAll(): void {
    this.paused = true
  }

  resumeAll(): void {
    this.paused = false
    this.processQueue()
  }

  private cleanQueue(): void {
    this.queue = this.queue.filter(
      i => i.status !== 'completed' && i.status !== 'cancelled' && i.status !== 'error'
    )
  }

  private processQueue(): void {
    if (this.paused) return
    const slots = this.maxConcurrent - this.activeItems.size
    if (slots <= 0) return

    const queued = this.queue.filter(i => i.status === 'queued').slice(0, slots)
    if (queued.length === 0) return

    for (const item of queued) {
      this.startDownload(item)
    }
  }

  private async startDownload(item: DownloadItem, attempt = 1): Promise<void> {
    if (!isValidHttpUrl(item.url)) {
      item.status = 'error'
      item.error = 'URL inválida: solo se permiten http y https'
      this.onError(item.id, item.error)
      return
    }

    item.status = 'downloading'
    const spotifyTrack = (item as any).spotifyTrack as SpotifyTrack | undefined

    let youtubeUrl: string
    if (spotifyTrack) {
      try {
        const match = await this.searcher.searchFirst(spotifyTrack.artist, spotifyTrack.name)

        if (!match) {
          const trackName = `${spotifyTrack.artist} - ${spotifyTrack.name}`
          item.status = 'error'
          item.error = `No se encontró en YouTube: ${trackName}`
          this.onTrackError(item.id, trackName)
          this.onError(item.id, item.error)
          this.cleanQueue()
          setTimeout(() => this.processQueue(), 100)
          return
        }

        console.log(`[spotify] Found: "${match.title}" for "${spotifyTrack.artist} - ${spotifyTrack.name}"`)
        youtubeUrl = match.url
      } catch (err) {
        item.status = 'error'
        item.error = (err as Error).message
        this.onError(item.id, item.error)
        this.cleanQueue()
        setTimeout(() => this.processQueue(), 100)
        return
      }
    } else {
      youtubeUrl = item.url
    }

    const playlistName = (item as any).playlistName as string | undefined
    const sanitizedArtist = spotifyTrack ? sanitizeFilename(spotifyTrack.artist) : ''
    const sanitizedTitle = spotifyTrack ? sanitizeFilename(spotifyTrack.name) : `track-${item.id}`
    const trackFilename = `${sanitizedArtist} - ${sanitizedTitle}`.slice(0, MAX_FILENAME_LENGTH)

    let outputDir = this.downloadPath
    if (playlistName) {
      const sanitizedPlaylist = sanitizeFilename(playlistName).slice(0, 100)
      outputDir = join(this.downloadPath, sanitizedPlaylist)
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true })
      }
    }

    const outTemplate = join(outputDir, `${trackFilename}.%(ext)s`)

    const quality = item.quality || '128'
    const formatStr = AUDIO_FORMAT_MAP[quality] || AUDIO_FORMAT_MAP['128']

    const args = [
      youtubeUrl,
      '--no-warnings',
      '--newline',
      '--progress',
      '--socket-timeout', '20',
      '--retries', '3',
      '--ffmpeg-location', getFfmpegPath(),
      '-f', formatStr,
      '-o', outTemplate,
      '--extract-audio',
      '--audio-format', 'mp3',
      '--audio-quality', quality
    ]

    try {
      const emitter = this.ytDlp.exec(args)

      this.activeItems.set(item.id, { item, emitter })

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
          if (spotifyTrack) {
            item.title = `${spotifyTrack.artist} - ${spotifyTrack.name}`
          }
          this.onComplete(item)
          this.cleanQueue()
          setTimeout(() => this.processQueue(), 100)
        } else if (item.status !== 'cancelled') {
          console.error(`[spotify] Download failed (code=${code}): ${youtubeUrl}`)
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
            const trackName = spotifyTrack
              ? `${spotifyTrack.artist} - ${spotifyTrack.name}`
              : item.title
            item.status = 'error'
            item.error = `No se pudo descargar: ${trackName}`
            this.onTrackError(item.id, trackName)
            this.onError(item.id, item.error)
            this.cleanQueue()
            setTimeout(() => this.processQueue(), 100)
          }
        }
      })

      emitter.on('error', (err) => {
        this.activeItems.delete(item.id)
        console.error(`[spotify] Download error: ${err.message} for ${youtubeUrl}`)
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
            const trackName = spotifyTrack
              ? `${spotifyTrack.artist} - ${spotifyTrack.name}`
              : item.title
            item.status = 'error'
            item.error = `No se pudo descargar: ${trackName}`
            this.onTrackError(item.id, trackName)
            this.onError(item.id, item.error)
            this.cleanQueue()
            setTimeout(() => this.processQueue(), 100)
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

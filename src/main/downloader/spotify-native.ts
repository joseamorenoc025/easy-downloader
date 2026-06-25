import { randomUUID } from 'crypto'
import { join } from 'path'
import { mkdirSync, existsSync } from 'fs'
import { getFfmpegPath } from './ffmpeg'
import { AUDIO_FORMAT_MAP } from './options'
import { YtdlpSearchProvider } from './core/providers/ytdlp-search.provider'
import { BaseDownloadManager, type ErrorCallback } from './base-manager'
import spotifyUrlInfoFactory from '../lib/spotify-url-info'
import type { DownloadItem, DownloadProgress } from '../../src/types'

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

function sanitizeFilename(name: string): string {
  return (
    name
      // eslint-disable-next-line no-control-regex
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

const MAX_FILENAME_LENGTH = 200

export class SpotifyDownloadManager extends BaseDownloadManager {
  private searcher: YtdlpSearchProvider
  private onTrackError: TrackErrorCallback
  private spotifyUrlInfo = spotifyUrlInfoFactory(globalThis.fetch)

  constructor(
    downloadPath: string,
    onProgress: (progress: DownloadProgress) => void,
    onComplete: (item: DownloadItem) => void,
    onError: ErrorCallback,
    onTrackError: TrackErrorCallback
  ) {
    super(downloadPath, onProgress, onComplete, onError)
    this.searcher = new YtdlpSearchProvider()
    this.onTrackError = onTrackError
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
        this.onError(item.id, 'unavailable', item.error)
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
      const data = await this.spotifyUrlInfo.getData(url)
      const type = data.uri?.split(':')[1]

      if (type === 'track') {
        const preview = this.spotifyUrlInfo.getPreview
          ? await this.spotifyUrlInfo.getPreview(url)
          : null
        const trackData = data
        const artist =
          trackData.artists?.map((a: any) => a.name).join(', ') || preview?.artist || 'Unknown'
        const name = trackData.name || preview?.track || 'Unknown'
        return { tracks: [{ name, artist, duration: trackData.duration_ms, uri: trackData.uri }] }
      }

      const playlistName = data.name || 'Playlist'

      if (type === 'playlist' || type === 'album') {
        const tracksResult = await this.spotifyUrlInfo.getTracks(url)
        const tracks = tracksResult.map((t: any) => ({
          name: t.name,
          artist: t.artist,
          duration: t.duration,
          uri: t.uri
        }))
        return { playlistName, tracks }
      }

      const preview = await this.spotifyUrlInfo.getPreview(url)
      return { tracks: [{ name: preview.track, artist: preview.artist, uri: url }] }
    } catch (err) {
      throw new Error(`Error al obtener metadata de Spotify: ${(err as Error).message}`, {
        cause: err
      })
    }
  }

  protected startDownload(item: DownloadItem, attempt = 1): void {
    if (!this.validateUrl(item.url)) {
      item.status = 'error'
      item.error = 'URL inválida: solo se permiten http y https'
      this.onError(item.id, 'unsupported', item.error)
      return
    }

    item.status = 'downloading'
    const spotifyTrack = (item as any).spotifyTrack as SpotifyTrack | undefined

    const executeDownload = (youtubeUrl: string) => {
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
        '--socket-timeout',
        '20',
        '--retries',
        '3',
        '--ffmpeg-location',
        getFfmpegPath(),
        '-f',
        formatStr,
        '-o',
        outTemplate,
        '--extract-audio',
        '--audio-format',
        'mp3',
        '--audio-quality',
        quality
      ]

      try {
        const emitter = this.ytDlp.exec(args)
        this.activeItems.set(item.id, { item, emitter })
        this.setupEmitterListeners(emitter, item, attempt, 'spotify')

        const originalComplete = this.onComplete
        const wrappedOnComplete = (completedItem: DownloadItem) => {
          if (spotifyTrack) {
            completedItem.title = `${spotifyTrack.artist} - ${spotifyTrack.name}`
          }
          originalComplete(completedItem)
        }
        this.onComplete = wrappedOnComplete

        emitter.on('close', () => {
          this.onComplete = originalComplete
        })
      } catch (err) {
        item.status = 'error'
        item.error = (err as Error).message
        this.onError(item.id, 'unknown', (err as Error).message)
      }
    }

    if (spotifyTrack) {
      this.searcher
        .searchFirst(spotifyTrack.artist, spotifyTrack.name)
        .then((match) => {
          if (!match) {
            const trackName = `${spotifyTrack.artist} - ${spotifyTrack.name}`
            item.status = 'error'
            item.error = `No se encontró en YouTube: ${trackName}`
            this.onTrackError(item.id, trackName)
            this.onError(item.id, 'unavailable', item.error)
            this.cleanQueue()
            setTimeout(() => this.processQueue(), 100)
            return
          }
          console.log(
            `[spotify] Found: "${match.title}" for "${spotifyTrack.artist} - ${spotifyTrack.name}"`
          )
          executeDownload(match.url)
        })
        .catch((err) => {
          item.status = 'error'
          item.error = (err as Error).message
          this.onError(item.id, 'unknown', item.error)
          this.cleanQueue()
          setTimeout(() => this.processQueue(), 100)
        })
    } else {
      executeDownload(item.url)
    }
  }
}

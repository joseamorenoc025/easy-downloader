import YtDlpWrap from 'yt-dlp-wrap'
import type { MetadataResult } from '../../src/types'

const ytDlp = new YtDlpWrap()

export async function fetchMetadata(url: string): Promise<MetadataResult> {
  try {
    const raw = await ytDlp.getVideoInfo(url)
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw

    const isPlaylist = !!(data._type === 'playlist' || data.entries)

    if (isPlaylist) {
      return {
        title: data.title || 'Playlist',
        duration: data.duration || 0,
        uploader: data.uploader,
        isPlaylist: true,
        playlistCount: data.playlist_count || data.entries?.length || 0,
        thumbnail: data.thumbnail
      }
    }

    return {
      title: data.title || 'Unknown',
      duration: data.duration || 0,
      uploader: data.uploader,
      isPlaylist: false,
      thumbnail: data.thumbnail,
      formats: (data.formats || [])
        .filter((f: Record<string, unknown>) => f.vcodec !== 'none' || f.acodec !== 'none')
        .map((f: Record<string, unknown>) => ({
          id: String(f.format_id || ''),
          ext: String(f.ext || ''),
          resolution: f.resolution ? String(f.resolution) : undefined,
          filesize: f.filesize ? Number(f.filesize) : undefined,
          format_note: f.format_note ? String(f.format_note) : undefined,
          vcodec: String(f.vcodec || ''),
          acodec: String(f.acodec || ''),
          tbr: f.tbr ? Number(f.tbr) : undefined
        }))
    }
  } catch (err) {
    throw new Error(`Failed to fetch metadata: ${(err as Error).message}`)
  }
}

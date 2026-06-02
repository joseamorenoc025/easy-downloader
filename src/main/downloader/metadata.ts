// eslint-disable-next-line @typescript-eslint/no-var-requires
const { default: YtDlpWrap } = require('yt-dlp-wrap')
import type { MetadataResult } from '../../src/types'

export async function fetchMetadata(url: string): Promise<MetadataResult> {
  const ytDlp = new YtDlpWrap()

  try {
    const stdout = await ytDlp.execPromise([
      '--dump-json',
      '--flat-playlist',
      '--no-warnings',
      url
    ])

    const lines = stdout.trim().split('\n')
    const firstLine = lines[0]
    if (!firstLine) throw new Error('No metadata returned')

    const data = JSON.parse(firstLine)

    const isPlaylist = data._type === 'playlist' || !!data.entries || lines.length > 1

    if (isPlaylist) {
      const entries = lines.map(l => {
        try { return JSON.parse(l) } catch { return null }
      }).filter(Boolean)

      return {
        title: data.title || 'Playlist',
        duration: data.duration || 0,
        uploader: data.uploader,
        isPlaylist: true,
        playlistCount: data.playlist_count || entries.length,
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

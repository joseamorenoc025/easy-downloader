import https from 'node:https'
import { getFfmpegPath } from '../../ffmpeg'

function parseDuration(text: string): number {
  const parts = text.split(':').map(Number)
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return parts[0] || 0
}

function extractText(runs: any): string {
  if (!runs) return ''
  if (typeof runs === 'string') return runs
  if (Array.isArray(runs)) return runs.map((r: any) => r.text || '').join('')
  if (runs.runs) return runs.runs.map((r: any) => r.text || '').join('')
  return runs.simpleText || ''
}

function httpsGet(url: string, headers: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
        reject(new Error(`HTTP ${res.statusCode}`))
        return
      }
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
      res.on('error', reject)
    })
    req.on('error', reject)
    req.setTimeout(15000, () => {
      req.destroy()
      reject(new Error('Timeout'))
    })
  })
}

export interface SearchResult {
  id: string
  title: string
  uploader: string
  duration: number
  url: string
}

export class YtdlpSearchProvider {
  private cache = new Map<string, SearchResult[]>()
  private MAX_CACHE = 100

  async searchFirst(artist: string, title: string): Promise<SearchResult | null> {
    const query = `${artist} - ${title}`
    const cacheKey = query.toLowerCase()

    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!
      return cached.length > 0 ? cached[0] : null
    }

    const candidates = await this.fetchCandidates(query)

    // Fallback: usar binario de yt-dlp si el scraping falló
    if (candidates.length === 0) {
      console.warn('[yt-search] Scraping failed, falling back to yt-dlp binary')
      const fallbackResults = await this.fallbackBinarySearch(query)
      if (this.cache.size >= this.MAX_CACHE) {
        const firstKey = this.cache.keys().next().value
        if (firstKey) this.cache.delete(firstKey)
      }
      this.cache.set(cacheKey, fallbackResults)
      return fallbackResults.length > 0 ? fallbackResults[0] : null
    }

    if (this.cache.size >= this.MAX_CACHE) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) this.cache.delete(firstKey)
    }
    this.cache.set(cacheKey, candidates)

    return candidates.length > 0 ? candidates[0] : null
  }

  private async fetchCandidates(query: string): Promise<SearchResult[]> {
    try {
      const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`

      const html = await httpsGet(url, {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        Accept: 'text/html,application/xhtml+xml'
      })

      const match = html.match(/ytInitialData\s*=\s*({.+?});\s*<\/script>/)
      if (!match) return []

      const data = JSON.parse(match[1])
      const contents =
        data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
          ?.contents || []

      const results: SearchResult[] = []

      for (const section of contents) {
        const items = section?.itemSectionRenderer?.contents || []
        for (const item of items) {
          const r = item?.videoRenderer
          if (!r || !r.videoId) continue

          results.push({
            id: r.videoId,
            title: extractText(r.title),
            uploader: extractText(r.ownerText || r.shortBylineText),
            duration: parseDuration(r.lengthText?.simpleText || ''),
            url: `https://www.youtube.com/watch?v=${r.videoId}`
          })

          if (results.length >= 5) break
        }
        if (results.length >= 5) break
      }

      return results
    } catch (err) {
      console.error('[yt-search] Failed:', err)
      return []
    }
  }

  protected createYtDlpInstance(): any {
    const YtDlpWrap = require('yt-dlp-wrap')
    return new YtDlpWrap()
  }

  private async fallbackBinarySearch(query: string): Promise<SearchResult[]> {
    try {
      const ytDlp = this.createYtDlpInstance()
      const ffmpegPath = getFfmpegPath()

      const args = [
        `ytsearch1:${query}`,
        '--dump-json',
        '--skip-download',
        '--no-warnings',
        '--no-playlist'
      ]
      if (ffmpegPath) {
        args.push('--ffmpeg-location', ffmpegPath)
      }

      const output = await ytDlp.execRaw(args)
      const data = JSON.parse(output)

      if (!data || !data.id) return []

      return [
        {
          id: data.id,
          title: data.title || query,
          uploader: data.uploader || data.channel || '',
          duration: data.duration || 0,
          url: `https://www.youtube.com/watch?v=${data.id}`
        }
      ]
    } catch (err) {
      console.error('[yt-search] Fallback binary search failed:', err)
      return []
    }
  }
}

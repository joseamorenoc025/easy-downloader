import { describe, it, expect, vi, beforeEach } from 'vitest'
import { YtdlpSearchProvider } from '../main/downloader/core/providers/ytdlp-search.provider'
import https from 'node:https'

// Mock https — returns empty/invalid HTML to trigger fallback
vi.mock('node:https', () => {
  const mockGet = vi.fn()
  return {
    default: { get: mockGet },
    get: mockGet
  }
})

// Mock ffmpeg
vi.mock('../main/downloader/ffmpeg', () => ({
  getFfmpegPath: vi.fn(() => '/mock/ffmpeg')
}))

describe('YtdlpSearchProvider - Fallback Binary Search', () => {
  let provider: YtdlpSearchProvider
  const mockGet = vi.fn()
  const mockExecRaw = vi.fn()

  beforeEach(async () => {
    vi.clearAllMocks()
    mockGet.mockReset()
    mockExecRaw.mockReset()
    ;(https as any).get = mockGet
    provider = new YtdlpSearchProvider()
    // Spy on the protected method so we can inject our mock
    vi.spyOn(provider, 'createYtDlpInstance' as any).mockReturnValue({ execRaw: mockExecRaw })
  })

  function mockScrapingReturnsNothing() {
    mockGet.mockImplementation((_url: string, _opts: any, cb: any) => {
      const res = {
        statusCode: 403,
        on: (event: string, handler: any) => {
          if (event === 'data') handler(Buffer.from('<html>Forbidden</html>'))
          if (event === 'end') handler()
        }
      }
      cb(res)
      return { on: vi.fn(), setTimeout: vi.fn(), destroy: vi.fn() }
    })
  }

  function mockScrapingReturnsNoVideos() {
    mockGet.mockImplementation((_url: string, _opts: any, cb: any) => {
      const res = {
        statusCode: 200,
        on: (event: string, handler: any) => {
          if (event === 'data')
            handler(Buffer.from('<html><script>var ytInitialData = {};</script></html>'))
          if (event === 'end') handler()
        }
      }
      cb(res)
      return { on: vi.fn(), setTimeout: vi.fn(), destroy: vi.fn() }
    })
  }

  function mockFallbackReturnsResult(videoId = 'dQw4w9WgXcQ', title = 'Fallback Video') {
    mockExecRaw.mockResolvedValue(
      JSON.stringify({
        id: videoId,
        title,
        uploader: 'Fallback Channel',
        duration: 225
      })
    )
  }

  it('should call fallback when scraping returns 403', async () => {
    mockScrapingReturnsNothing()
    mockFallbackReturnsResult('fallback123', 'Fallback Result')

    const result = await provider.searchFirst('Artist', 'Song')

    expect(mockGet).toHaveBeenCalled()
    expect(mockExecRaw).toHaveBeenCalled()
    expect(result).not.toBeNull()
    expect(result!.url).toContain('fallback123')
    expect(result!.title).toBe('Fallback Result')
    expect(result!.uploader).toBe('Fallback Channel')
  })

  it('should call fallback when scraping returns empty ytInitialData', async () => {
    mockScrapingReturnsNoVideos()
    mockFallbackReturnsResult('empty456', 'Found via Binary')

    const result = await provider.searchFirst('Artist', 'Song')

    expect(mockGet).toHaveBeenCalled()
    expect(mockExecRaw).toHaveBeenCalled()
    expect(result).not.toBeNull()
    expect(result!.url).toContain('empty456')
  })

  it('should return null when fallback also fails', async () => {
    mockScrapingReturnsNothing()
    mockExecRaw.mockRejectedValue(new Error('yt-dlp binary not found'))

    const result = await provider.searchFirst('Artist', 'Song')

    expect(mockGet).toHaveBeenCalled()
    expect(mockExecRaw).toHaveBeenCalled()
    expect(result).toBeNull()
  })

  it('should return null when fallback returns invalid JSON', async () => {
    mockScrapingReturnsNothing()
    mockExecRaw.mockResolvedValue('not valid json {{{')

    const result = await provider.searchFirst('Artist', 'Song')

    expect(mockGet).toHaveBeenCalled()
    expect(mockExecRaw).toHaveBeenCalled()
    expect(result).toBeNull()
  })

  it('should return null when fallback returns JSON without id', async () => {
    mockScrapingReturnsNothing()
    mockExecRaw.mockResolvedValue(JSON.stringify({ title: 'No ID' }))

    const result = await provider.searchFirst('Artist', 'Song')

    expect(mockGet).toHaveBeenCalled()
    expect(mockExecRaw).toHaveBeenCalled()
    expect(result).toBeNull()
  })

  it('should NOT call fallback when scraping succeeds', async () => {
    const html = `<html><script>var ytInitialData = ${JSON.stringify({
      contents: {
        twoColumnSearchResultsRenderer: {
          primaryContents: {
            sectionListRenderer: {
              contents: [
                {
                  itemSectionRenderer: {
                    contents: [
                      {
                        videoRenderer: {
                          videoId: 'scraped123',
                          title: { runs: [{ text: 'Scraped Video' }] },
                          ownerText: { runs: [{ text: 'Scraped Channel' }] },
                          lengthText: { simpleText: '3:45' }
                        }
                      }
                    ]
                  }
                }
              ]
            }
          }
        }
      }
    })};</script></html>`

    mockGet.mockImplementation((_url: string, _opts: any, cb: any) => {
      const res = {
        statusCode: 200,
        on: (event: string, handler: any) => {
          if (event === 'data') handler(Buffer.from(html))
          if (event === 'end') handler()
        }
      }
      cb(res)
      return { on: vi.fn(), setTimeout: vi.fn(), destroy: vi.fn() }
    })

    const result = await provider.searchFirst('Artist', 'Song')

    expect(mockGet).toHaveBeenCalled()
    expect(mockExecRaw).not.toHaveBeenCalled()
    expect(result).not.toBeNull()
    expect(result!.url).toContain('scraped123')
  })

  it('should pass correct args to yt-dlp binary in fallback', async () => {
    mockScrapingReturnsNothing()
    mockFallbackReturnsResult()

    await provider.searchFirst('The Weeknd', 'Blinding Lights')

    expect(mockExecRaw).toHaveBeenCalledWith([
      'ytsearch1:The Weeknd - Blinding Lights',
      '--dump-json',
      '--skip-download',
      '--no-warnings',
      '--no-playlist',
      '--ffmpeg-location',
      '/mock/ffmpeg'
    ])
  })

  it('should omit --ffmpeg-location when ffmpeg path is empty', async () => {
    const { getFfmpegPath } = await import('../main/downloader/ffmpeg')
    vi.mocked(getFfmpegPath).mockReturnValue('')

    mockScrapingReturnsNothing()
    mockFallbackReturnsResult()

    await provider.searchFirst('Artist', 'Song')

    const args = mockExecRaw.mock.calls[0][0]
    expect(args).not.toContain('--ffmpeg-location')
  })
})

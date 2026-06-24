import { describe, it, expect, vi, beforeEach } from 'vitest'
import { YtdlpSearchProvider } from '../main/downloader/core/providers/ytdlp-search.provider'

// Mock https module
vi.mock('node:https', () => {
  const mockGet = vi.fn()
  return {
    default: { get: mockGet },
    get: mockGet,
  }
})

describe('YtdlpSearchProvider - LRU Cache', () => {
  let provider: YtdlpSearchProvider
  const mockGet = vi.fn()

  beforeEach(async () => {
    vi.clearAllMocks()
    const https = await import('node:https')
    mockGet.mockReset()
    ;(https.default || https).get = mockGet
    provider = new YtdlpSearchProvider()
  })

  function mockYouTubeResponse(searchQuery: string, videoId: string = 'dQw4w9WgXcQ') {
    const html = `<html><script>var ytInitialData = ${JSON.stringify({
      contents: {
        twoColumnSearchResultsRenderer: {
          primaryContents: {
            sectionListRenderer: {
              contents: [{
                itemSectionRenderer: {
                  contents: [{
                    videoRenderer: {
                      videoId,
                      title: { runs: [{ text: `Mock Video for ${searchQuery}` }] },
                      ownerText: { runs: [{ text: 'Mock Channel' }] },
                      lengthText: { simpleText: '3:45' },
                    },
                  }],
                },
              }],
            },
          },
        },
      },
    })};</script></html>`

    mockGet.mockImplementation((_url: string, _opts: any, cb: any) => {
      const res = {
        statusCode: 200,
        on: (event: string, handler: any) => {
          if (event === 'data') handler(Buffer.from(html))
          if (event === 'end') handler()
        },
      }
      cb(res)
      return { on: vi.fn(), setTimeout: vi.fn(), destroy: vi.fn() }
    })
  }

  it('should cache search results', async () => {
    mockYouTubeResponse('Artist - Song', 'video123')

    const result1 = await provider.searchFirst('Artist', 'Song')
    expect(result1).not.toBeNull()
    expect(result1!.url).toContain('video123')

    // Second call should use cache (no additional HTTP request)
    mockGet.mockClear()
    const result2 = await provider.searchFirst('Artist', 'Song')
    expect(result2).not.toBeNull()
    expect(result2!.url).toContain('video123')
    expect(mockGet).not.toHaveBeenCalled() // No HTTP call = cache hit
  })

  it('should normalize cache keys to lowercase', async () => {
    mockYouTubeResponse('Test', 'vid1')

    await provider.searchFirst('TEST', 'SONG')
    mockGet.mockClear()

    // Same query in different case should hit cache
    await provider.searchFirst('test', 'song')
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('should evict oldest entry when cache is full', async () => {
    // Fill cache to max (100)
    for (let i = 0; i < 100; i++) {
      mockYouTubeResponse(`query${i}`, `vid${i}`)
      await provider.searchFirst(`Artist${i}`, `Song${i}`)
    }

    // Cache is full. Adding one more should evict the oldest
    mockGet.mockClear()
    mockYouTubeResponse('newquery', 'newvid')
    await provider.searchFirst('NewArtist', 'NewSong')
    expect(mockGet).toHaveBeenCalled() // Should make HTTP request (evicted + new)

    // The first entry should be evicted
    mockGet.mockClear()
    mockYouTubeResponse('query0', 'vid0')
    const result = await provider.searchFirst('Artist0', 'Song0')
    // This should make an HTTP request since it was evicted
    expect(mockGet).toHaveBeenCalled()
  })

  it('should return null when no results found', async () => {
    mockGet.mockImplementation((_url: string, _opts: any, cb: any) => {
      const res = {
        statusCode: 200,
        on: (event: string, handler: any) => {
          if (event === 'data') handler(Buffer.from('<html>No ytInitialData</html>'))
          if (event === 'end') handler()
        },
      }
      cb(res)
      return { on: vi.fn(), setTimeout: vi.fn(), destroy: vi.fn() }
    })

    const result = await provider.searchFirst('Nonexistent', 'Track')
    expect(result).toBeNull()
  })

  it('should handle HTTP errors gracefully', async () => {
    mockGet.mockImplementation((_url: string, _opts: any, cb: any) => {
      const res = {
        statusCode: 403,
        on: (event: string, handler: any) => {
          if (event === 'data') handler(Buffer.from(''))
          if (event === 'end') handler()
        },
      }
      cb(res)
      return { on: vi.fn(), setTimeout: vi.fn(), destroy: vi.fn() }
    })

    const result = await provider.searchFirst('Artist', 'Song')
    expect(result).toBeNull()
  })

  it('should parse video duration correctly', async () => {
    const html = `<html><script>var ytInitialData = ${JSON.stringify({
      contents: {
        twoColumnSearchResultsRenderer: {
          primaryContents: {
            sectionListRenderer: {
              contents: [{
                itemSectionRenderer: {
                  contents: [{
                    videoRenderer: {
                      videoId: 'dur123',
                      title: { runs: [{ text: 'Long Video' }] },
                      ownerText: { runs: [{ text: 'Channel' }] },
                      lengthText: { simpleText: '1:23:45' },
                    },
                  }],
                },
              }],
            },
          },
        },
      },
    })};</script></html>`

    mockGet.mockImplementation((_url: string, _opts: any, cb: any) => {
      const res = {
        statusCode: 200,
        on: (event: string, handler: any) => {
          if (event === 'data') handler(Buffer.from(html))
          if (event === 'end') handler()
        },
      }
      cb(res)
      return { on: vi.fn(), setTimeout: vi.fn(), destroy: vi.fn() }
    })

    const result = await provider.searchFirst('Channel', 'Long Video')
    expect(result).not.toBeNull()
    expect(result!.duration).toBe(5025) // 1*3600 + 23*60 + 45 = 5025
  })
})

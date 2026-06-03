import { useState, useCallback, useEffect } from 'react'
import { Button } from './ui/button'
import { isValidUrl } from '../lib/utils'
import type { DownloadOptions, MetadataResult } from '@/types'
import '../lib/ipc'

interface DownloadFormProps {
  onAdd: (options: DownloadOptions) => void
  onAddSpotify?: (url: string) => void
  isLoading: boolean
  onMetadata?: (meta: MetadataResult) => void
}

export function DownloadForm({ onAdd, onAddSpotify, isLoading, onMetadata }: DownloadFormProps) {
  const [url, setUrl] = useState('')
  const [source, setSource] = useState<'youtube' | 'spotify'>('youtube')
  const [format, setFormat] = useState<'video' | 'audio'>('video')
  const [quality, setQuality] = useState('best')
  const [error, setError] = useState('')
  const [spotdlMissing, setSpotdlMissing] = useState(false)

  // Listen for paste events from App.tsx
  useEffect(() => {
    const handler = (e: Event) => {
      const url = (e as CustomEvent).detail as string
      setUrl(url)
      setError('')
      if (url.includes('open.spotify.com')) {
        setSource('spotify')
      } else {
        setSource('youtube')
      }
    }
    window.addEventListener('paste-url', handler)
    return () => window.removeEventListener('paste-url', handler)
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const trimmedUrl = url.trim()
    if (!trimmedUrl) {
      setError('Enter a URL')
      return
    }
    if (!isValidUrl(trimmedUrl)) {
      setError('Invalid URL format')
      return
    }

    if (source === 'spotify') {
      if (!trimmedUrl.includes('open.spotify.com')) {
        setError('Enter a valid Spotify URL')
        return
      }
      onAddSpotify?.(trimmedUrl)
      setUrl('')
      return
    }

    if (onMetadata) {
      try {
        const meta = await window.easyDownloader.fetchMetadata(trimmedUrl)
        onMetadata(meta)
      } catch {
        // Continue anyway
      }
    }

    onAdd({
      url: trimmedUrl,
      format,
      quality
    })
    setUrl('')
  }, [url, format, quality, source, onAdd, onAddSpotify, onMetadata])

  const videoQualities = ['best', '1080p', '720p', '480p']
  const audioQualities = ['320', '256', '192', '128']

  const qualities = format === 'video' ? videoQualities : audioQualities

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={url}
          onChange={e => { setUrl(e.target.value); setError('') }}
          placeholder={source === 'youtube'
            ? 'https://youtube.com/watch?v=...'
            : 'https://open.spotify.com/track/...'}
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" disabled={isLoading || !url.trim()}>
          {isLoading ? 'Adding...' : 'Download'}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {spotdlMissing && source === 'spotify' && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          spotdl no está instalado. Ejecuta: <code className="rounded bg-muted px-1">pip install spotdl</code>
        </p>
      )}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2 rounded-lg border p-1">
          <button
            type="button"
            onClick={() => { setSource('youtube'); setFormat('video'); setQuality('best') }}
            className={`rounded-md px-3 py-1 text-sm transition-colors ${
              source === 'youtube'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            YouTube
          </button>
          <button
            type="button"
            onClick={async () => {
              setSource('spotify'); setFormat('audio'); setQuality('320')
              const ok = await window.easyDownloader.checkSpotdl()
              setSpotdlMissing(!ok)
            }}
            className={`rounded-md px-3 py-1 text-sm transition-colors ${
              source === 'spotify'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Spotify
          </button>
        </div>

        {source === 'youtube' && (
          <>
            <div className="flex items-center gap-2 rounded-lg border p-1">
              <button
                type="button"
                onClick={() => { setFormat('video'); setQuality('best') }}
                className={`rounded-md px-3 py-1 text-sm transition-colors ${
                  format === 'video'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Video
              </button>
              <button
                type="button"
                onClick={() => { setFormat('audio'); setQuality('320') }}
                className={`rounded-md px-3 py-1 text-sm transition-colors ${
                  format === 'audio'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Audio
              </button>
            </div>
            <select
              value={quality}
              onChange={e => setQuality(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              {qualities.map(q => (
                <option key={q} value={q}>
                  {q}{format === 'audio' ? ' kbps' : ''}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
    </form>
  )
}

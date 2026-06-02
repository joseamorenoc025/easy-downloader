import { useState, useCallback } from 'react'
import { Button } from './ui/button'
import { isValidUrl } from '../lib/utils'
import type { DownloadOptions, MetadataResult } from '@/types'
import '../lib/ipc'

interface DownloadFormProps {
  onAdd: (options: DownloadOptions) => void
  isLoading: boolean
  onMetadata?: (meta: MetadataResult) => void
}

export function DownloadForm({ onAdd, isLoading, onMetadata }: DownloadFormProps) {
  const [url, setUrl] = useState('')
  const [format, setFormat] = useState<'video' | 'audio'>('video')
  const [quality, setQuality] = useState('best')
  const [error, setError] = useState('')

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
  }, [url, format, quality, onAdd, onMetadata])

  const videoQualities = ['best', '1080p', '720p', '480p']
  const audioQualities = ['320', '256', '192', '128']

  const qualities = format === 'video' ? videoQualities : audioQualities
  const qualityLabel = format === 'video' ? 'Resolution' : 'Bitrate'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={url}
          onChange={e => { setUrl(e.target.value); setError('') }}
          placeholder="https://youtube.com/watch?v=..."
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" disabled={isLoading || !url.trim()}>
          {isLoading ? 'Adding...' : 'Add'}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-4">
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
      </div>
    </form>
  )
}

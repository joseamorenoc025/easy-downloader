import { useState, useCallback, useEffect } from 'react'
import { Button } from './ui/button'
import { isValidUrl } from '../lib/utils'
import { useI18n } from '../i18n/context'
import { MetadataPreview } from './metadata-preview'
import type { DownloadOptions } from '@/types'
import '../lib/ipc'

interface DownloadFormProps {
  onAdd: (options: DownloadOptions) => void
  onAddSpotify?: (url: string) => void
  isLoading: boolean
}

// Human-readable labels for the video quality selector. Uses i18n keys so
// "best" becomes "Best (max quality)", "2160p" becomes "2160p (4K)", etc.
// Audio bitrates already render as "320 kbps" inline.
function qualityLabel(q: string, t: (key: string) => string): string {
  if (q === 'best') return t('form.quality.best')
  if (q === '2160p') return t('form.quality.2160p')
  if (q === '1440p') return t('form.quality.1440p')
  if (q === '1080p') return t('form.quality.1080p')
  if (q === '720p') return t('form.quality.720p')
  if (q === '480p') return t('form.quality.480p')
  return q
}

export function DownloadForm({ onAdd, onAddSpotify, isLoading }: DownloadFormProps) {
  const { t } = useI18n()
  const [url, setUrl] = useState('')
  const [source, setSource] = useState<'youtube' | 'spotify'>('youtube')
  const [format, setFormat] = useState<'video' | 'audio'>('video')
  const [quality, setQuality] = useState('best')
  const [error, setError] = useState('')

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
      setError(t('form.error.emptyUrl'))
      return
    }
    if (!isValidUrl(trimmedUrl)) {
      setError(t('form.error.invalidUrl'))
      return
    }

    if (source === 'spotify') {
      if (!trimmedUrl.includes('open.spotify.com')) {
        setError(t('form.error.invalidSpotifyUrl'))
        return
      }
      onAddSpotify?.(trimmedUrl)
      setUrl('')
      return
    }

    onAdd({
      url: trimmedUrl,
      format,
      quality
    })
    setUrl('')
  }, [url, format, quality, source, onAdd, onAddSpotify])

  const videoQualities = ['best', '2160p', '1440p', '1080p', '720p', '480p']
  const audioQualities = ['320', '256', '192', '128']

  const qualities = format === 'video' ? videoQualities : audioQualities

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      <div className="flex gap-2">
        <input
          type="text"
          value={url}
          onChange={e => { setUrl(e.target.value); setError('') }}
          aria-label={t('a11y.urlInput')}
          placeholder={source === 'youtube'
            ? t('form.placeholder.youtube')
            : t('form.placeholder.spotify')}
          className="flex-1 rounded-xl border border-input bg-background/80 px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/60 focus-visible:outline-none"
        />
        <Button type="submit" disabled={isLoading || !url.trim()} className="rounded-xl px-4">
          {isLoading ? t('form.adding') : t('form.download')}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <div role="radiogroup" aria-label={t('a11y.sourceToggle')} className="flex items-center gap-0.5 rounded-xl bg-muted p-0.5">
          <button
            type="button"
            role="radio"
            aria-checked={source === 'youtube'}
            onClick={() => { setSource('youtube'); setFormat('video'); setQuality('best') }}
            className={`rounded-lg px-3 py-1 text-sm font-medium transition-colors ${
              source === 'youtube'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('source.youtube')}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={source === 'spotify'}
            onClick={() => {
              setSource('spotify'); setFormat('audio'); setQuality('320')
            }}
            className={`rounded-lg px-3 py-1 text-sm font-medium transition-colors ${
              source === 'spotify'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('source.spotify')}
          </button>
        </div>

        {source === 'youtube' && (
          <>
            <div role="radiogroup" aria-label={t('a11y.formatToggle')} className="flex items-center gap-0.5 rounded-xl bg-muted p-0.5">
              <button
                type="button"
                role="radio"
                aria-checked={format === 'video'}
                onClick={() => { setFormat('video'); setQuality('best') }}
                className={`rounded-lg px-3 py-1 text-sm font-medium transition-colors ${
                  format === 'video'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t('form.video')}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={format === 'audio'}
                onClick={() => { setFormat('audio'); setQuality('320') }}
                className={`rounded-lg px-3 py-1 text-sm font-medium transition-colors ${
                  format === 'audio'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t('form.audio')}
              </button>
            </div>
            <select
              value={quality}
              onChange={e => setQuality(e.target.value)}
              aria-label={format === 'audio' ? t('form.bitrate') : t('form.resolution')}
              className="rounded-xl border border-input bg-background/80 px-3 py-1.5 text-sm focus:outline-none"
            >
              {qualities.map(q => (
                <option key={q} value={q}>
                  {format === 'audio' ? `${q} kbps` : qualityLabel(q, t)}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {url && isValidUrl(url) && source === 'youtube' && (
        <MetadataPreview
          url={url}
          source={source}
          onDownload={() => {
            onAdd({ url: url.trim(), format, quality, playlistFolder: true })
            setUrl('')
          }}
        />
      )}
    </form>
  )
}

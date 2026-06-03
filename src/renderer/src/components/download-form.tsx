import { useState, useCallback, useEffect } from 'react'
import { Button } from './ui/button'
import { isValidUrl } from '../lib/utils'
import { useI18n } from '../i18n/context'
import { MetadataPreview } from './metadata-preview'
import type { DownloadOptions, MetadataResult } from '@/types'
import '../lib/ipc'

interface DownloadFormProps {
  onAdd: (options: DownloadOptions) => void
  onAddSpotify?: (url: string) => void
  isLoading: boolean
  onMetadata?: (meta: MetadataResult) => void
}

export function DownloadForm({ onAdd, onAddSpotify, isLoading, onMetadata }: DownloadFormProps) {
  const { t } = useI18n()
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
            ? t('form.placeholder.youtube')
            : t('form.placeholder.spotify')}
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button type="submit" disabled={isLoading || !url.trim()}>
          {isLoading ? t('form.adding') : t('form.download')}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {spotdlMissing && source === 'spotify' && <SpotdlMissingAlert />}
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
            {t('source.youtube')}
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
            {t('source.spotify')}
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
                {t('form.video')}
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
                {t('form.audio')}
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

function SpotdlMissingAlert() {
  const { t } = useI18n()
  const [showHelp, setShowHelp] = useState(false)

  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
            {t('deps.spotdl.missing')}
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {t('deps.spotdl.what')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowHelp(!showHelp)}
          className="shrink-0 rounded px-2 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-200 dark:text-amber-400 dark:hover:bg-amber-900"
        >
          {showHelp ? t('deps.spotdl.hide') : t('deps.spotdl.help')}
        </button>
      </div>

      {showHelp && (
        <div className="mt-2 space-y-1 text-xs text-amber-800 dark:text-amber-300">
          <p>
            <strong>pip:</strong>{' '}
            <code className="rounded bg-amber-200/50 px-1 dark:bg-amber-800/50">pip install spotdl</code>
          </p>
          <p>
            <strong>pip (alt):</strong>{' '}
            <code className="rounded bg-amber-200/50 px-1 dark:bg-amber-800/50">python -m pip install spotdl</code>
          </p>
          <p>
            <strong>Scoop (Windows):</strong>{' '}
            <code className="rounded bg-amber-200/50 px-1 dark:bg-amber-800/50">scoop install spotdl</code>
          </p>
          <p>
            <a
              href="https://github.com/spotDL/spotify-downloader"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-amber-950 dark:hover:text-amber-100"
            >
              {t('deps.learnMore')}
            </a>
          </p>
        </div>
      )}
    </div>
  )
}

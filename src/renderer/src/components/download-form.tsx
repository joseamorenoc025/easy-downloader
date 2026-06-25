import { useState, useCallback, useEffect, useMemo } from 'react'
import { Button } from './ui/button'
import { isValidUrl, detectSource, type DetectedSource } from '../lib/utils'
import { useI18n } from '../i18n/context'
import { MetadataPreview } from './metadata-preview'
import { MetadataEditor, type MetadataFields } from './metadata-editor'
import { CONVERSION_PRESETS, type ConversionPreset } from '../lib/presets'
import type { DownloadOptions } from '@/types'
import '../lib/ipc'

interface DownloadFormProps {
  onAdd: (options: DownloadOptions) => void
  onAddSpotify?: (url: string, quality?: string) => void
  onAddBatch?: (urls: string[], format: 'video' | 'audio', quality: string) => void
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

export function DownloadForm({ onAdd, onAddSpotify, onAddBatch, isLoading }: DownloadFormProps) {
  const { t } = useI18n()
  const [url, setUrl] = useState('')
  const [source, setSource] = useState<DetectedSource>('youtube')
  const [format, setFormat] = useState<'video' | 'audio'>('video')
  const [quality, setQuality] = useState('best')
  const [error, setError] = useState('')
  const [metadataEditorOpen, setMetadataEditorOpen] = useState(false)
  const [pendingDownload, setPendingDownload] = useState<{
    url: string
    format: 'video' | 'audio'
    quality: string
  } | null>(null)
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)

  // Listen for paste events from App.tsx
  useEffect(() => {
    const handler = (e: Event) => {
      const url = (e as CustomEvent).detail as string
      setUrl(url)
      setError('')
      const detected = detectSource(url)
      setSource(detected)
      if (detected === 'spotify') {
        setFormat('audio')
        setQuality('320')
      }
    }
    window.addEventListener('paste-url', handler)
    return () => window.removeEventListener('paste-url', handler)
  }, [])

  // Listen for paste-and-go (right-click context menu)
  useEffect(() => {
    const handler = (e: Event) => {
      const url = (e as CustomEvent).detail as string
      setUrl(url)
      setError('')
      const detected = detectSource(url)
      setSource(detected)
      if (detected === 'spotify') {
        setFormat('audio')
        setQuality('320')
        onAddSpotify?.(url, '320')
      } else {
        onAdd({ url, format: 'video', quality: 'best' })
      }
    }
    window.addEventListener('paste-url-and-go', handler)
    return () => window.removeEventListener('paste-url-and-go', handler)
  }, [onAdd, onAddSpotify])

  const videoQualities = ['best', '2160p', '1440p', '1080p', '720p', '480p']
  const audioQualities = ['320', '256', '192', '128']

  const qualities = format === 'video' ? videoQualities : audioQualities

  // Batch URL detection — must be declared before handleSubmit which references it
  const detectedUrls = useMemo(() => {
    const lines = url
      .split(/[\n\r]+/)
      .map((l) => l.trim())
      .filter(Boolean)
    if (lines.length <= 1) return null
    const valid = lines.filter((l) => isValidUrl(l))
    return valid.length > 1 ? valid : null
  }, [url])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError('')

      const trimmedUrl = url.trim()
      if (!trimmedUrl) {
        setError(t('form.error.emptyUrl'))
        return
      }

      // Batch mode: multiple URLs
      if (detectedUrls && detectedUrls.length > 1 && onAddBatch) {
        onAddBatch(detectedUrls, format, quality)
        setUrl('')
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
        onAddSpotify?.(trimmedUrl, quality)
        setUrl('')
        return
      }

      // For audio format, show metadata editor before download
      if (format === 'audio') {
        setPendingDownload({ url: trimmedUrl, format, quality })
        setMetadataEditorOpen(true)
        return
      }

      // youtube and other both go through yt-dlp
      onAdd({
        url: trimmedUrl,
        format,
        quality
      })
      setUrl('')
    },
    [url, format, quality, source, detectedUrls, onAdd, onAddSpotify, onAddBatch, t]
  )

  const handleMetadataConfirm = useCallback(
    (metadata: MetadataFields) => {
      if (pendingDownload) {
        onAdd({
          ...pendingDownload,
          metadata
        })
        setPendingDownload(null)
        setMetadataEditorOpen(false)
        setUrl('')
      }
    },
    [pendingDownload, onAdd]
  )

  const handleMetadataSkip = useCallback(() => {
    if (pendingDownload) {
      onAdd(pendingDownload)
      setPendingDownload(null)
      setMetadataEditorOpen(false)
      setUrl('')
    }
  }, [pendingDownload, onAdd])

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      <div className="flex gap-2">
        <input
          type="text"
          value={url}
          onChange={(e) => {
            const val = e.target.value
            setUrl(val)
            setError('')
            if (val.trim()) {
              const detected = detectSource(val)
              setSource(detected)
              if (detected === 'spotify') {
                setFormat('audio')
                setQuality('320')
              }
            }
          }}
          aria-label={t('a11y.urlInput')}
          placeholder={
            source === 'spotify'
              ? t('form.placeholder.spotify')
              : source === 'other'
                ? t('form.placeholder.other')
                : t('form.placeholder.youtube')
          }
          className="flex-1 rounded-xl border border-input bg-background/80 px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/60 focus-visible:outline-none"
        />
      </div>
      {detectedUrls && (
        <p className="text-xs text-indigo-500 dark:text-indigo-400">
          {t('form.batchDetected', { count: detectedUrls.length })}
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        {/* Preset selector */}
        <select
          value={selectedPreset || ''}
          onChange={(e) => {
            const presetId = e.target.value || null
            setSelectedPreset(presetId)
            if (presetId) {
              const preset = CONVERSION_PRESETS.find((p) => p.id === presetId)
              if (preset) {
                setFormat(preset.format)
                setQuality(preset.quality)
                if (preset.format === 'audio') {
                  setSource('youtube')
                }
              }
            }
          }}
          aria-label={t('presets.label')}
          className="rounded-xl border border-input bg-background/80 px-3 py-1.5 text-sm focus:outline-none"
        >
          <option value="">{t('presets.none')}</option>
          {CONVERSION_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {t(`presets.${p.id}`)}
            </option>
          ))}
        </select>

        <div
          role="radiogroup"
          aria-label={t('a11y.sourceToggle')}
          className="flex items-center gap-0.5 rounded-xl bg-muted p-0.5"
        >
          <button
            type="button"
            role="radio"
            aria-checked={source === 'youtube'}
            onClick={() => {
              setSource('youtube')
              setFormat('video')
              setQuality('best')
            }}
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
              setSource('spotify')
              setFormat('audio')
              setQuality('320')
            }}
            className={`rounded-lg px-3 py-1 text-sm font-medium transition-colors ${
              source === 'spotify'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('source.spotify')}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={source === 'other'}
            onClick={() => {
              setSource('other')
              setFormat('video')
              setQuality('best')
            }}
            className={`rounded-lg px-3 py-1 text-sm font-medium transition-colors ${
              source === 'other'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('source.other')}
          </button>
        </div>

        {source === 'youtube' && (
          <>
            <div
              role="radiogroup"
              aria-label={t('a11y.formatToggle')}
              className="flex items-center gap-0.5 rounded-xl bg-muted p-0.5"
            >
              <button
                type="button"
                role="radio"
                aria-checked={format === 'video'}
                onClick={() => {
                  setFormat('video')
                  setQuality('best')
                }}
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
                onClick={() => {
                  setFormat('audio')
                  setQuality('320')
                }}
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
              onChange={(e) => setQuality(e.target.value)}
              aria-label={format === 'audio' ? t('form.bitrate') : t('form.resolution')}
              className="rounded-xl border border-input bg-background/80 px-3 py-1.5 text-sm focus:outline-none"
            >
              {qualities.map((q) => (
                <option key={q} value={q}>
                  {format === 'audio' ? `${q} kbps` : qualityLabel(q, t)}
                </option>
              ))}
            </select>
          </>
        )}

        {source === 'other' && (
          <>
            <div
              role="radiogroup"
              aria-label={t('a11y.formatToggle')}
              className="flex items-center gap-0.5 rounded-xl bg-muted p-0.5"
            >
              <button
                type="button"
                role="radio"
                aria-checked={format === 'video'}
                onClick={() => {
                  setFormat('video')
                  setQuality('best')
                }}
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
                onClick={() => {
                  setFormat('audio')
                  setQuality('320')
                }}
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
              onChange={(e) => setQuality(e.target.value)}
              aria-label={format === 'audio' ? t('form.bitrate') : t('form.resolution')}
              className="rounded-xl border border-input bg-background/80 px-3 py-1.5 text-sm focus:outline-none"
            >
              {qualities.map((q) => (
                <option key={q} value={q}>
                  {format === 'audio' ? `${q} kbps` : qualityLabel(q, t)}
                </option>
              ))}
            </select>
          </>
        )}

        {source === 'spotify' && (
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
            aria-label={t('form.bitrate')}
            className="rounded-xl border border-input bg-background/80 px-3 py-1.5 text-sm focus:outline-none"
          >
            {audioQualities.map((q) => (
              <option key={q} value={q}>
                {q} kbps
              </option>
            ))}
          </select>
        )}

        <Button
          type="submit"
          disabled={isLoading || !url.trim()}
          className="ml-auto rounded-xl px-4"
        >
          {isLoading ? t('form.adding') : t('form.download')}
        </Button>
      </div>

      {url && isValidUrl(url) && (source === 'youtube' || source === 'other') && (
        <MetadataPreview
          url={url}
          source={source}
          onDownload={() => {
            onAdd({ url: url.trim(), format, quality, playlistFolder: true })
            setUrl('')
          }}
        />
      )}

      <MetadataEditor
        url={pendingDownload?.url || ''}
        source={source}
        open={metadataEditorOpen}
        onClose={() => {
          setMetadataEditorOpen(false)
          setPendingDownload(null)
        }}
        onConfirm={handleMetadataConfirm}
      />
    </form>
  )
}

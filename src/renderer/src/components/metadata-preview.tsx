import { useState, useEffect, useRef } from 'react'
import { useI18n } from '../i18n/context'
import { Button } from './ui/button'
import { useSettings } from '../hooks/use-settings'
import type { MetadataResult } from '@/types'
import '../lib/ipc'

interface MetadataPreviewProps {
  url: string
  source: 'youtube' | 'spotify'
  onDownload: () => void
}

export function MetadataPreview({ url, source, onDownload }: MetadataPreviewProps) {
  const { t } = useI18n()
  const { settings } = useSettings()
  const [meta, setMeta] = useState<MetadataResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (!url) { setMeta(null); setError(''); return }
    if (source === 'spotify') { setMeta(null); setError(''); return }
    // Skip metadata fetch if disabled in settings
    if (!settings.fetchMetadata) { setMeta(null); setError(''); return }

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      setError('')
      try {
        const result = await window.easyDownloader.fetchMetadata(url)
        setMeta(result)
      } catch {
        setError(t('preview.error'))
      } finally {
        setLoading(false)
      }
    }, 500)

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [url, source, t, settings.fetchMetadata])

  if (!url) return null
  if (source === 'spotify') return null
  if (!settings.fetchMetadata) return null

  return (
    <div className="rounded-lg border bg-card p-3 transition-colors">
      {loading && (
        <p className="text-xs text-muted-foreground">{t('preview.loading')}</p>
      )}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
      {meta && !loading && (
        <div className="flex gap-3">
          {meta.thumbnail && (
            <img
              src={meta.thumbnail}
              alt={meta.title}
              className="size-16 rounded object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-card-foreground">{meta.title}</p>
            <p className="text-xs text-muted-foreground">
              {meta.uploader && `${meta.uploader} · `}
              {formatDuration(meta.duration)}
            </p>
            {meta.isPlaylist && (
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={onDownload}>
                  {t('preview.downloadAll', { count: meta.playlistCount || 0 })}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

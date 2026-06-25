import { useState, useEffect, useRef } from 'react'
import { useI18n } from '../i18n/context'
import type { DownloadItem, Settings } from '@/types'

const MAX_SAMPLES = 30

function parseSpeedToBytes(speedStr: string): number {
  if (!speedStr) return 0
  const match = speedStr.match(/([\d.]+)\s*(KiB|MiB|GiB|KB|MB|GB|B)\/s/i)
  if (match) {
    const value = parseFloat(match[1])
    const unit = match[2].toLowerCase()
    const multipliers: Record<string, number> = {
      b: 1,
      kb: 1024,
      kib: 1024,
      mb: 1024 * 1024,
      mib: 1024 * 1024,
      gb: 1024 * 1024 * 1024,
      gib: 1024 * 1024 * 1024
    }
    return value * (multipliers[unit] || 1)
  }
  const num = parseFloat(speedStr)
  if (!isNaN(num)) return num
  return 0
}

function formatSpeedLabel(bytesPerSec: number): string {
  if (bytesPerSec === 0) return '0 B/s'
  if (bytesPerSec < 1024) return `${Math.round(bytesPerSec)} B/s`
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KiB/s`
  if (bytesPerSec < 1024 * 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MiB/s`
  return `${(bytesPerSec / (1024 * 1024 * 1024)).toFixed(1)} GiB/s`
}

interface StatsCardProps {
  queue: DownloadItem[]
  settings?: Settings
  onTogglePause?: () => void
  onToggleIncognito?: () => void
  onToggleMetadata?: () => void
  onChangeConcurrent?: (value: number) => void
}

export function StatsCard({
  queue,
  settings,
  onTogglePause,
  onToggleIncognito,
  onToggleMetadata,
  onChangeConcurrent
}: StatsCardProps) {
  const { t } = useI18n()
  const [samples, setSamples] = useState<number[]>(() => new Array(MAX_SAMPLES).fill(0))
  const lastSampleRef = useRef('')
  const lastSampleTimeRef = useRef(0)

  const downloading = queue.filter((i) => i.status === 'downloading')
  const currentSpeed = downloading.length > 0 ? downloading[0].speed : ''

  useEffect(() => {
    const now = Date.now()
    if (
      currentSpeed &&
      currentSpeed !== lastSampleRef.current &&
      now - lastSampleTimeRef.current >= 500
    ) {
      lastSampleRef.current = currentSpeed
      lastSampleTimeRef.current = now
      const bytes = parseSpeedToBytes(currentSpeed)
      setSamples((prev) => [...prev.slice(1), bytes])
    }
  }, [currentSpeed])

  const maxVal = Math.max(...samples, 1)
  const width = 200
  const height = 40
  const padding = 2

  const points = samples
    .map((val, i) => {
      const x = padding + (i / (MAX_SAMPLES - 1)) * (width - 2 * padding)
      const y = height - padding - (val / maxVal) * (height - 2 * padding)
      return `${x},${y}`
    })
    .join(' ')

  const currentBytes = parseSpeedToBytes(currentSpeed)
  const peak = Math.max(...samples)

  const avgEta = downloading.length > 0 ? downloading[0].eta : ''
  const activeCount = queue.filter(
    (i) => i.status === 'downloading' || i.status === 'queued'
  ).length
  const completedCount = queue.filter((i) => i.status === 'completed').length
  const globalProgress =
    downloading.length > 0
      ? downloading.reduce((sum, i) => sum + i.progress, 0) / downloading.length
      : 0

  return (
    <div className="glass-card flex flex-col gap-3 rounded-2xl p-4">
      <p className="section-title">{t('stats.realTimeStatus')}</p>

      {/* Session controls row */}
      {settings && (
        <div className="flex items-center gap-1 flex-wrap">
          {/* Pause/Resume */}
          <button
            onClick={onTogglePause}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
              settings.globalPause
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
            title={settings.globalPause ? t('header.resumePause') : t('header.pauseResume')}
          >
            {settings.globalPause ? (
              <>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
                {t('header.pause')}
              </>
            ) : (
              <>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                {t('header.play')}
              </>
            )}
          </button>

          {/* Incognito */}
          <button
            onClick={onToggleIncognito}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
              settings.incognitoMode
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
            title={
              settings.incognitoMode ? t('header.incognitoOnDesc') : t('header.incognitoOffDesc')
            }
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
              <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
              <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
              <line x1="2" x2="22" y1="2" y2="22" />
            </svg>
            {settings.incognitoMode ? t('header.incognitoOn') : t('header.incognitoOff')}
          </button>

          {/* Metadata */}
          <button
            onClick={onToggleMetadata}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
              settings.fetchMetadata
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
            title={settings.fetchMetadata ? t('header.metadataOn') : t('header.metadataOff')}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" x2="12" y1="16" y2="12" />
              <line x1="12" x2="12.01" y1="8" y2="8" />
            </svg>
            {t('header.meta')}
          </button>

          {/* Concurrent downloads */}
          <div
            className="flex items-center gap-0.5 text-[11px] text-muted-foreground"
            title={t('concurrent.title')}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <button
              onClick={() => onChangeConcurrent?.(Math.max(1, (settings.maxConcurrent || 3) - 1))}
              className="rounded px-1 py-0.5 hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              −
            </button>
            <span className="w-3 text-center font-mono text-foreground">
              {settings.maxConcurrent || 3}
            </span>
            <button
              onClick={() => onChangeConcurrent?.(Math.min(8, (settings.maxConcurrent || 3) + 1))}
              className="rounded px-1 py-0.5 hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              +
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-2xl">⚡</span>
        <span className="font-mono text-lg font-bold text-foreground">
          {formatSpeedLabel(currentBytes)}
        </span>
      </div>

      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>{t('stats.peak')}</span>
          <span className="font-mono text-foreground">{formatSpeedLabel(peak)}</span>
        </div>
        {avgEta && (
          <div className="flex items-center justify-between">
            <span>{t('stats.eta')}</span>
            <span className="font-mono text-foreground">{avgEta}</span>
          </div>
        )}
      </div>

      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full rounded-lg bg-muted/30"
      >
        <defs>
          <linearGradient id="speedGradientStats" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`}
          fill="url(#speedGradientStats)"
        />
        <polyline
          points={points}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{MAX_SAMPLES}s</span>
        <span>
          {completedCount}/{queue.length} {t('stats.done')}
        </span>
      </div>

      {downloading.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{t('stats.globalProgress')}</span>
            <span className="font-mono text-foreground">{globalProgress.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${Math.min(100, globalProgress)}%` }}
            />
          </div>
        </div>
      )}

      {activeCount > 0 && (
        <p className="text-[10px] text-muted-foreground">
          {activeCount} {t('stats.active')}
        </p>
      )}
    </div>
  )
}

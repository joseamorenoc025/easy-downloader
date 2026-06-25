import { useState, useEffect, useRef } from 'react'
import { useI18n } from '../i18n/context'
import type { DownloadItem } from '@/types'

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
}

export function StatsCard({ queue }: StatsCardProps) {
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

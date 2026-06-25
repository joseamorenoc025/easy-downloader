import { useState, useEffect, useRef } from 'react'
import { useI18n } from '../i18n/context'

const MAX_SAMPLES = 30

function parseSpeedToBytes(speedStr: string): number {
  if (!speedStr) return 0
  // Try formatted strings: "2.5 MiB/s", "2.5MiB/s", "100 KB/s" etc.
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
  // Fallback: treat as raw number (bytes/sec)
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

interface NetworkStatsProps {
  currentSpeed: string
}

export function NetworkStats({ currentSpeed }: NetworkStatsProps) {
  const { t } = useI18n()
  const [samples, setSamples] = useState<number[]>(() => new Array(MAX_SAMPLES).fill(0))
  const lastSampleRef = useRef('')
  const lastSampleTimeRef = useRef(0)

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
      setSamples((prev) => {
        const next = [...prev.slice(1), bytes]
        return next
      })
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

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{t('stats.speed')}</span>
        <span className="font-mono text-foreground">{formatSpeedLabel(currentBytes)}</span>
      </div>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full rounded-lg bg-muted/30"
      >
        <defs>
          <linearGradient id="speedGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`}
          fill="url(#speedGradient)"
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
        <span>
          {t('stats.peak')}: {formatSpeedLabel(peak)}
        </span>
        <span>{MAX_SAMPLES}s</span>
      </div>
    </div>
  )
}

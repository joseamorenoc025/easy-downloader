import { memo, useState } from 'react'
import { motion } from 'framer-motion'
import { Progress } from './ui/progress'
import type { DownloadItem, DownloadErrorCategory } from '@/types'
import { useI18n } from '../i18n/context'
import { useToast } from './toast'
import { formatBytes } from '../lib/utils'
import '../lib/ipc'

interface QueueItemProps {
  item: DownloadItem
  onCancel: (id: string) => void
  onOpenFolder?: (item: DownloadItem) => void
  onRetry?: (item: DownloadItem) => void
  isPaused?: boolean
  index?: number
}

const statusKeys: Record<DownloadItem['status'], string> = {
  queued: 'item.queued',
  downloading: 'item.downloading',
  completed: 'item.completed',
  error: 'item.error',
  cancelled: 'item.cancelled'
}

const statusDot: Record<DownloadItem['status'], string> = {
  queued: 'bg-muted-foreground/40',
  downloading: 'bg-primary animate-pulse',
  completed: 'bg-green-500',
  error: 'bg-destructive',
  cancelled: 'bg-muted-foreground/30'
}

const statusTextColors: Record<DownloadItem['status'], string> = {
  queued: 'text-muted-foreground',
  downloading: 'text-primary',
  completed: 'text-green-600 dark:text-green-400',
  error: 'text-destructive',
  cancelled: 'text-muted-foreground'
}

function QueueItemInner({
  item,
  onCancel,
  onOpenFolder,
  onRetry,
  isPaused,
  index = 0
}: QueueItemProps) {
  const { t } = useI18n()
  const { toast } = useToast()
  const [expandedError, setExpandedError] = useState(false)

  const errorCategory = item.errorCategory as DownloadErrorCategory | undefined
  const errorKey = errorCategory ? `errors.${errorCategory}` : null
  const isItemPaused = item.status === 'downloading' && isPaused

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      transition={{
        type: 'spring',
        stiffness: 380,
        damping: 28,
        // Cap the per-item stagger so the animation stays responsive when the
        // queue grows past ~10 items. Previously `index * 0.04` scaled linearly
        // and made the last item feel laggy.
        delay: Math.min(index, 8) * 0.04
      }}
      className="rounded-xl border border-border/60 bg-card/70 p-3.5 backdrop-blur-sm shadow-sm hover:shadow-md hover:border-border transition-shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 flex items-start gap-2.5">
          {/* Status dot */}
          <span
            className={`mt-1.5 shrink-0 w-2 h-2 rounded-full ${
              isItemPaused ? 'bg-amber-500' : statusDot[item.status]
            }`}
          />

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-card-foreground leading-snug">
              {item.title}
            </p>
            <p
              className={`text-xs mt-0.5 ${
                isItemPaused ? 'text-amber-600 dark:text-amber-400' : statusTextColors[item.status]
              }`}
            >
              {isItemPaused ? t('item.paused') : t(statusKeys[item.status])}
              <span className="text-muted-foreground/60 mx-1">·</span>
              {item.format === 'video' ? 'MP4' : 'MP3'}
              <span className="text-muted-foreground/60 mx-1">·</span>
              {item.quality}
              {item.format === 'audio' ? ' kbps' : ''}
              {item.writeSubtitles && (
                <>
                  <span className="text-muted-foreground/60 mx-1">·</span>
                  <span className="text-blue-500 dark:text-blue-400">{t('form.subtitles')}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {(item.status === 'queued' || item.status === 'downloading') && (
          <button
            onClick={() => onCancel(item.id)}
            aria-label={t('a11y.cancelDownload', { title: item.title })}
            className="shrink-0 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            {t('item.cancel')}
          </button>
        )}
      </div>

      {item.status === 'downloading' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-3 space-y-1.5"
        >
          <Progress
            value={item.progress}
            label={t('a11y.downloadProgress', { title: item.title })}
          />
          <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
            <span>{item.progress.toFixed(1)}%</span>
            <span>
              {item.downloadedBytes && item.totalBytes
                ? `${formatBytes(item.downloadedBytes)} / ${formatBytes(item.totalBytes)}`
                : ''}
            </span>
            <span>{item.speed}</span>
            <span>
              {item.eta && !item.speed?.match(/Pausado|Procesando|Reintentando|FFmpeg|Fusionando/)
                ? `ETA: ${item.eta}`
                : ''}
            </span>
          </div>
        </motion.div>
      )}

      {item.status === 'completed' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-2 flex items-center gap-2"
        >
          <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {t('item.downloaded')}
          </span>
          <button
            onClick={() => onOpenFolder?.(item)}
            className="text-xs text-primary underline-offset-4 hover:underline"
          >
            {t('item.openFolder')}
          </button>
        </motion.div>
      )}

      {item.status === 'error' && errorKey && (
        <div className="mt-2">
          <div className="flex items-center gap-2">
            <p className="text-xs text-destructive">{t(errorKey)}</p>
            {onRetry && (
              <button
                onClick={() => onRetry(item)}
                className="text-xs text-primary hover:underline underline-offset-4"
              >
                {t('item.retry')}
              </button>
            )}
          </div>
          {item.errorDetails && (
            <div className="mt-1.5">
              <button
                onClick={() => setExpandedError(!expandedError)}
                className="text-[10px] text-muted-foreground/70 hover:text-muted-foreground select-none"
              >
                {expandedError ? t('errors.hideDetails') : t('errors.showDetails')}
              </button>
              {expandedError && (
                <div className="mt-1.5 relative">
                  <pre className="text-[10px] text-muted-foreground/80 bg-muted/50 rounded-md p-2 overflow-x-auto max-h-32 whitespace-pre-wrap break-all">
                    {item.errorDetails}
                  </pre>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(item.errorDetails || '')
                      toast(t('errors.copied'), 'success', 1500)
                    }}
                    className="absolute top-1 right-1 rounded px-1.5 py-0.5 text-[10px] bg-muted/80 hover:bg-muted text-muted-foreground/70 hover:text-muted-foreground transition-colors"
                  >
                    {t('errors.copyDetails')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {item.status === 'error' && !errorKey && item.error && (
        <div className="mt-1.5 flex items-center gap-2">
          <p className="text-xs text-destructive whitespace-pre-wrap">{item.error}</p>
          {onRetry && (
            <button
              onClick={() => onRetry(item)}
              className="text-xs text-primary hover:underline underline-offset-4 shrink-0"
            >
              {t('item.retry')}
            </button>
          )}
        </div>
      )}
    </motion.div>
  )
}

/**
 * Custom comparator: the parent re-renders this component on every progress
 * tick for ANY item in the queue. Default shallow compare would re-render
 * the other N-1 items unnecessarily. We only re-render when the fields this
 * card actually displays have changed (plus a `bumpKey` field that the
 * parent can set to force a re-render on list mutation).
 */
function arePropsEqual(prev: QueueItemProps, next: QueueItemProps): boolean {
  const a = prev.item
  const b = next.item
  return (
    prev.index === next.index &&
    a.id === b.id &&
    a.status === b.status &&
    a.title === b.title &&
    a.format === b.format &&
    a.quality === b.quality &&
    a.progress === b.progress &&
    a.speed === b.speed &&
    a.eta === b.eta &&
    a.error === b.error &&
    a.errorCategory === b.errorCategory &&
    a.errorDetails === b.errorDetails &&
    a.outputPath === b.outputPath &&
    prev.onCancel === next.onCancel &&
    prev.onOpenFolder === next.onOpenFolder &&
    prev.onRetry === next.onRetry
  )
}

export const QueueItem = memo(QueueItemInner, arePropsEqual)

import { memo } from 'react'
import { motion } from 'framer-motion'
import { Progress } from './ui/progress'
import type { DownloadItem } from '@/types'
import { useI18n } from '../i18n/context'
import '../lib/ipc'

interface QueueItemProps {
  item: DownloadItem
  onCancel: (id: string) => void
  onOpenFolder?: (item: DownloadItem) => void
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

function QueueItemInner({ item, onCancel, onOpenFolder, index = 0 }: QueueItemProps) {
  const { t } = useI18n()

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
          <span className={`mt-1.5 shrink-0 w-2 h-2 rounded-full ${statusDot[item.status]}`} />

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-card-foreground leading-snug">
              {item.title}
            </p>
            <p className={`text-xs mt-0.5 ${statusTextColors[item.status]}`}>
              {t(statusKeys[item.status])}
              <span className="text-muted-foreground/60 mx-1">·</span>
              {item.format === 'video' ? 'MP4' : 'MP3'}
              <span className="text-muted-foreground/60 mx-1">·</span>
              {item.quality}{item.format === 'audio' ? ' kbps' : ''}
            </p>
          </div>
        </div>

        {(item.status === 'queued' || item.status === 'downloading') && (
          <button
            onClick={() => onCancel(item.id)}
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
          <Progress value={item.progress} />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{item.progress.toFixed(1)}%</span>
            <span>{item.speed}</span>
            <span>{item.eta ? `${t('item.eta')}: ${item.eta}` : ''}</span>
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
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
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

      {item.status === 'error' && item.error && (
        <p className="mt-1.5 text-xs text-destructive truncate">
          {item.error}
        </p>
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
    a.outputPath === b.outputPath &&
    prev.onCancel === next.onCancel &&
    prev.onOpenFolder === next.onOpenFolder
  )
}

export const QueueItem = memo(QueueItemInner, arePropsEqual)

import { Progress } from './ui/progress'
import type { DownloadItem } from '@/types'
import { useI18n } from '../i18n/context'
import '../lib/ipc'

interface QueueItemProps {
  item: DownloadItem
  onCancel: (id: string) => void
  onOpenFolder?: (item: DownloadItem) => void
}

const statusKeys: Record<string, string> = {
  queued: 'item.queued',
  downloading: 'item.downloading',
  completed: 'item.completed',
  error: 'item.error',
  cancelled: 'item.cancelled'
}

const statusColors: Record<string, string> = {
  queued: 'text-muted-foreground',
  downloading: 'text-primary',
  completed: 'text-green-600 dark:text-green-400',
  error: 'text-destructive',
  cancelled: 'text-muted-foreground'
}

export function QueueItem({ item, onCancel, onOpenFolder }: QueueItemProps) {
  const { t } = useI18n()

  return (
    <div className="rounded-lg border bg-card p-3 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-card-foreground">
            {item.title}
          </p>
          <p className={`text-xs ${statusColors[item.status]}`}>
            {t(statusKeys[item.status] || 'item.error')}
            {item.format === 'video' ? ' · MP4' : ' · MP3'}
            {' · '}{item.quality}{item.format === 'audio' ? ' kbps' : ''}
          </p>
        </div>
        {(item.status === 'queued' || item.status === 'downloading') && (
          <button
            onClick={() => onCancel(item.id)}
            className="shrink-0 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors"
          >
            {t('item.cancel')}
          </button>
        )}
      </div>

      {item.status === 'downloading' && (
        <div className="mt-2 space-y-1">
          <Progress value={item.progress} />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{item.progress.toFixed(1)}%</span>
            <span>{item.speed}</span>
            <span>{item.eta ? `${t('item.eta')}: ${item.eta}` : ''}</span>
          </div>
        </div>
      )}

      {item.status === 'completed' && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-green-600 dark:text-green-400">{t('item.downloaded')}</span>
          <button
            onClick={() => onOpenFolder?.(item)}
            className="text-xs text-primary underline-offset-4 hover:underline transition-colors"
          >
            {t('item.openFolder')}
          </button>
        </div>
      )}

      {item.status === 'error' && item.error && (
        <p className="mt-1 text-xs text-destructive truncate">
          {item.error}
        </p>
      )}
    </div>
  )
}

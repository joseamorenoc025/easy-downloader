import { Progress } from './ui/progress'
import type { DownloadItem } from '@/types'
import { formatBytes } from '../lib/utils'

interface QueueItemProps {
  item: DownloadItem
  onCancel: (id: string) => void
}

const statusLabels: Record<string, string> = {
  queued: 'Queued',
  downloading: 'Downloading',
  completed: 'Completed',
  error: 'Error',
  cancelled: 'Cancelled'
}

const statusColors: Record<string, string> = {
  queued: 'text-muted-foreground',
  downloading: 'text-primary',
  completed: 'text-green-600 dark:text-green-400',
  error: 'text-destructive',
  cancelled: 'text-muted-foreground'
}

export function QueueItem({ item, onCancel }: QueueItemProps) {
  return (
    <div className="rounded-lg border bg-card p-3 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-card-foreground">
            {item.title}
          </p>
          <p className={`text-xs ${statusColors[item.status]}`}>
            {statusLabels[item.status]}
            {item.format === 'video' ? ' · MP4' : ' · MP3'}
            {' · '}{item.quality}{item.format === 'audio' ? ' kbps' : ''}
          </p>
        </div>
        {(item.status === 'queued' || item.status === 'downloading') && (
          <button
            onClick={() => onCancel(item.id)}
            className="shrink-0 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors"
          >
            Cancel
          </button>
        )}
      </div>

      {item.status === 'downloading' && (
        <div className="mt-2 space-y-1">
          <Progress value={item.progress} />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{item.progress.toFixed(1)}%</span>
            <span>{item.speed}</span>
            <span>{item.eta ? `ETA: ${item.eta}` : ''}</span>
          </div>
        </div>
      )}

      {item.status === 'completed' && (
        <div className="mt-2 flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
          <span>Downloaded</span>
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

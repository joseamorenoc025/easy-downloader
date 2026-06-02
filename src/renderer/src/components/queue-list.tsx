import type { DownloadItem } from '@/types'
import { QueueItem } from './queue-item'
import { Button } from './ui/button'

interface QueueListProps {
  items: DownloadItem[]
  onCancel: (id: string) => void
  onCancelAll: () => void
}

export function QueueList({ items, onCancel, onCancelAll }: QueueListProps) {
  const activeItems = items.filter(i => i.status !== 'cancelled')

  if (activeItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-lg text-muted-foreground">No downloads yet</p>
        <p className="text-sm text-muted-foreground/60">
          Paste a URL above and click Add
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {activeItems.some(i => i.status === 'queued' || i.status === 'downloading') && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {activeItems.filter(i => i.status === 'queued' || i.status === 'downloading').length} active
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancelAll}
            className="text-destructive hover:text-destructive"
          >
            Cancel all
          </Button>
        </div>
      )}
      {activeItems.map(item => (
        <QueueItem key={item.id} item={item} onCancel={onCancel} />
      ))}
    </div>
  )
}

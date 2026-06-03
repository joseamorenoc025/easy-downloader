import type { DownloadItem } from '@/types'
import { QueueItem } from './queue-item'
import { InfoSection } from './info-section'
import { useI18n } from '../i18n/context'
import { Button } from './ui/button'

interface QueueListProps {
  items: DownloadItem[]
  onCancel: (id: string) => void
  onCancelAll: () => void
  onOpenFolder?: (item: DownloadItem) => void
}

export function QueueList({ items, onCancel, onCancelAll, onOpenFolder }: QueueListProps) {
  const { t } = useI18n()
  const activeItems = items.filter(i => i.status !== 'cancelled')

  if (activeItems.length === 0) {
    return <InfoSection />
  }

  return (
    <div className="space-y-3">
      {activeItems.some(i => i.status === 'queued' || i.status === 'downloading') && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {activeItems.filter(i => i.status === 'queued' || i.status === 'downloading').length} {t('queue.active')}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancelAll}
            className="text-destructive hover:text-destructive"
          >
            {t('queue.cancelAll')}
          </Button>
        </div>
      )}
      {activeItems.map(item => (
        <QueueItem key={item.id} item={item} onCancel={onCancel} onOpenFolder={onOpenFolder} />
      ))}
    </div>
  )
}

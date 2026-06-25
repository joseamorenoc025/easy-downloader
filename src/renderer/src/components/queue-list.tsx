import { AnimatePresence } from 'framer-motion'
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
  onRetry?: (item: DownloadItem) => void
}

export function QueueList({ items, onCancel, onCancelAll, onOpenFolder, onRetry }: QueueListProps) {
  const { t } = useI18n()
  const activeItems = items.filter((i) => i.status !== 'cancelled')

  if (activeItems.length === 0) {
    return <InfoSection />
  }

  const pendingCount = activeItems.filter(
    (i) => i.status === 'queued' || i.status === 'downloading'
  ).length

  return (
    <div className="space-y-2.5">
      {pendingCount > 0 && (
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-medium text-muted-foreground">
            {t('queue.active', { count: pendingCount })}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancelAll}
            className="text-destructive hover:text-destructive text-xs h-7 px-2"
          >
            {t('queue.cancelAll')}
          </Button>
        </div>
      )}
      <AnimatePresence initial={false}>
        {activeItems.map((item, index) => (
          <QueueItem
            key={item.id}
            item={item}
            index={index}
            onCancel={onCancel}
            onOpenFolder={onOpenFolder}
            onRetry={onRetry}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

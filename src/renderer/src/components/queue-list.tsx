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
  onClearCompleted?: () => void
  isPaused?: boolean
}

export function QueueList({
  items,
  onCancel,
  onCancelAll,
  onOpenFolder,
  onRetry,
  onClearCompleted,
  isPaused
}: QueueListProps) {
  const { t } = useI18n()
  const activeItems = items.filter((i) => i.status !== 'cancelled')

  if (activeItems.length === 0) {
    return <InfoSection />
  }

  const pendingCount = activeItems.filter(
    (i) => i.status === 'queued' || i.status === 'downloading'
  ).length
  const completedCount = activeItems.filter((i) => i.status === 'completed').length

  return (
    <div className="space-y-2.5">
      {(pendingCount > 0 || completedCount > 0) && (
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-medium text-muted-foreground">
            {pendingCount > 0 ? t('queue.active', { count: pendingCount }) : ''}
          </p>
          <div className="flex items-center gap-2">
            {completedCount > 0 && onClearCompleted && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearCompleted}
                className="text-muted-foreground hover:text-foreground text-xs h-7 px-2"
              >
                {t('queue.clearCompleted')}
              </Button>
            )}
            {pendingCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (window.confirm(t('queue.confirmCancelAll'))) onCancelAll()
                }}
                className="text-destructive hover:text-destructive text-xs h-7 px-2"
              >
                {t('queue.cancelAll')}
              </Button>
            )}
          </div>
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
            isPaused={isPaused}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

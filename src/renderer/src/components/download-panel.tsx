import { useI18n } from '../i18n/context'
import { DownloadForm } from './download-form'
import type { DownloadOptions } from '@/types'

interface DownloadPanelProps {
  onAdd: (options: DownloadOptions) => void
  onAddSpotify?: (url: string, quality?: string) => void
  onAddBatch?: (urls: string[], format: 'video' | 'audio', quality: string) => void
  isLoading: boolean
}

export function DownloadPanel({ onAdd, onAddSpotify, onAddBatch, isLoading }: DownloadPanelProps) {
  const { t } = useI18n()

  return (
    <div className="glass-card flex flex-col gap-3 rounded-2xl p-4">
      <p className="section-title">{t('section.newDownload')}</p>
      <DownloadForm
        onAdd={onAdd}
        onAddSpotify={onAddSpotify}
        onAddBatch={onAddBatch}
        isLoading={isLoading}
      />
    </div>
  )
}

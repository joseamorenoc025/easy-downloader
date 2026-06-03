import { useState, useEffect } from 'react'
import { useI18n } from '../i18n/context'
import { Button } from './ui/button'
import type { HistoryEntry } from '@/types'
import '../lib/ipc'

interface HistoryProps {
  onOpenFolder: (path?: string) => void
  onRedownload: (entry: HistoryEntry) => void
}

export function History({ onOpenFolder, onRedownload }: HistoryProps) {
  const { t } = useI18n()
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    window.easyDownloader.getHistory().then(setEntries)
  }, [])

  const clear = async () => {
    await window.easyDownloader.clearHistory()
    setEntries([])
  }

  const filtered = search
    ? entries.filter(e => e.title.toLowerCase().includes(search.toLowerCase()))
    : entries

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-muted-foreground">{t('history.empty')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('history.search')}
          className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button variant="ghost" size="sm" onClick={clear}>
          {t('history.clear')}
        </Button>
      </div>

      {filtered.map(entry => (
        <div key={entry.id} className="rounded-lg border bg-card p-3 transition-colors">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-card-foreground">
                {entry.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {entry.format === 'video' ? 'MP4' : 'MP3'} · {entry.quality}{entry.format === 'audio' ? ' kbps' : ''}
                {' · '}{entry.source}
                {' · '}{new Date(entry.completedAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              {entry.outputPath && (
                <button
                  onClick={() => onOpenFolder(entry.outputPath)}
                  className="rounded-md px-2 py-1 text-xs text-primary underline-offset-4 hover:underline transition-colors"
                >
                  {t('history.openFolder')}
                </button>
              )}
              <button
                onClick={() => onRedownload(entry)}
                className="rounded-md px-2 py-1 text-xs text-primary underline-offset-4 hover:underline transition-colors"
              >
                {t('history.redownload')}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

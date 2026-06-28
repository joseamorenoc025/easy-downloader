import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '../i18n/context'
import type { HistoryEntry } from '@/types'
import '../lib/ipc'

interface HistoryProps {
  onShowInFolder: (path: string) => void
  onBackToQueue?: () => void
}

// ── helpers ──────────────────────────────────────────────────────────────────

function getYouTubeThumbnail(url: string): string | null {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/
  )
  return match ? `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg` : null
}

function groupByDate(entries: HistoryEntry[], t: (key: string) => string) {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart = new Date(todayStart)
  weekStart.setDate(weekStart.getDate() - 7)

  const groups: { label: string; entries: HistoryEntry[] }[] = [
    { label: t('history.today'), entries: [] },
    { label: t('history.older'), entries: [] }
  ]

  for (const e of entries) {
    const d = new Date(e.completedAt)
    if (d >= todayStart) groups[0].entries.push(e)
    else groups[1].entries.push(e)
  }

  return groups.filter((g) => g.entries.length > 0)
}

function relativeTime(iso: string, locale: string): string {
  const diffSeconds = (Date.now() - new Date(iso).getTime()) / 1000
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (diffSeconds < 60) return rtf.format(-Math.round(diffSeconds), 'second')
  if (diffSeconds < 3600) return rtf.format(-Math.round(diffSeconds / 60), 'minute')
  if (diffSeconds < 86400) return rtf.format(-Math.round(diffSeconds / 3600), 'hour')
  if (diffSeconds < 86400 * 7) return rtf.format(-Math.round(diffSeconds / 86400), 'day')
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
}

// ── List row ─────────────────────────────────────────────────────────────────

function HistoryRow({
  entry,
  onShowInFolder
}: {
  entry: HistoryEntry
  onShowInFolder: (path: string) => void
}) {
  const { t, locale } = useI18n()
  const thumb = entry.source === 'youtube' ? getYouTubeThumbnail(entry.url) : null
  const [imgError, setImgError] = useState(false)

  const isVideo = entry.format === 'video'
  const qualityLabel = isVideo ? entry.quality : `${entry.quality} kbps`

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.15 }}
      className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-accent/50 transition-colors group"
    >
      {/* Thumbnail */}
      <div className="w-16 h-10 rounded-lg overflow-hidden bg-muted shrink-0">
        {thumb && !imgError ? (
          <img
            src={thumb}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-900/40 to-slate-800">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="2"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="m10 8 6 4-6 4V8Z" />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{entry.title}</p>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
          <span>{isVideo ? 'MP4' : 'MP3'}</span>
          <span>·</span>
          <span>{qualityLabel}</span>
          <span>·</span>
          <span>{entry.source === 'spotify' ? 'Spotify' : 'YouTube'}</span>
        </div>
      </div>

      {/* Time + open */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
          {relativeTime(entry.completedAt, locale)}
        </span>
        {entry.outputPath && (
          <button
            onClick={() => onShowInFolder(entry.outputPath!)}
            className="opacity-0 group-hover:opacity-100 rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
            title={t('history.openFile')}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
              <path d="M14 2v4a2 2 0 0 0 2 2h4" />
            </svg>
          </button>
        )}
      </div>
    </motion.div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type Filter = 'all' | 'video' | 'audio'

export function History({ onShowInFolder, onBackToQueue }: HistoryProps) {
  const { t } = useI18n()
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    window.easyDownloader
      .getHistory()
      .then(setEntries)
      .catch(() => setEntries([]))
  }, [])

  // Real-time updates
  useEffect(() => {
    const handler = (item: HistoryEntry) => {
      setEntries((prev) => {
        if (prev.some((e) => e.id === item.id)) return prev
        return [item, ...prev]
      })
    }
    window.easyDownloader.onHistoryEntryAdded(handler)
    return () => {
      window.easyDownloader.removeAllListeners('history-entry-added')
    }
  }, [])

  const clear = async () => {
    if (!window.confirm(t('history.confirmClear'))) return
    await window.easyDownloader.clearHistory()
    setEntries([])
  }

  const filtered = useMemo(() => {
    let result = entries
    if (filter !== 'all') result = result.filter((e) => e.format === filter)
    if (search) result = result.filter((e) => e.title.toLowerCase().includes(search.toLowerCase()))
    return result
  }, [entries, filter, search])

  const groups = useMemo(() => groupByDate(filtered, t), [filtered, t])

  // ── Empty state ──
  if (entries.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-14 text-center gap-3"
      >
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted-foreground/50"
          >
            <path d="M12 8v4l3 3" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        </div>
        <p className="text-sm text-muted-foreground">{t('history.empty')}</p>
        {onBackToQueue && (
          <button
            onClick={onBackToQueue}
            className="mt-2 flex items-center gap-1.5 rounded-xl bg-card px-4 py-2 text-xs font-semibold text-foreground shadow-sm hover:bg-accent transition-colors"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
            {t('history.backToQueue')}
          </button>
        )}
      </motion.div>
    )
  }

  const noResults = filtered.length === 0

  return (
    <div className="space-y-3">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('history.search')}
            className="w-full rounded-xl border border-input bg-background/80 pl-8 pr-3 py-1.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none"
          />
        </div>

        {/* Format filter */}
        <div className="flex items-center gap-0.5 rounded-xl bg-muted p-0.5 shrink-0">
          {(['all', 'video', 'audio'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
                filter === f
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f === 'all'
                ? t('history.filterAll')
                : f === 'video'
                  ? t('history.filterVideo')
                  : t('history.filterAudio')}
            </button>
          ))}
        </div>

        {/* Clear session */}
        <button
          onClick={clear}
          className="text-[11px] text-muted-foreground hover:text-destructive transition-colors shrink-0"
          title={t('history.clear')}
        >
          {t('history.clearAll')}
        </button>
      </div>

      {/* ── No results ── */}
      <AnimatePresence>
        {noResults && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="py-10 text-center text-sm text-muted-foreground"
          >
            {t('history.noResults', { search })}
          </motion.p>
        )}
      </AnimatePresence>

      {/* ── Groups ── */}
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.label} className="space-y-1">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-3 py-1">
              {g.label}
              <span className="ml-2 text-muted-foreground/40 normal-case tracking-normal font-normal">
                ({g.entries.length})
              </span>
            </h2>
            <div className="space-y-0.5">
              <AnimatePresence initial={false}>
                {g.entries.map((e) => (
                  <HistoryRow key={e.id} entry={e} onShowInFolder={onShowInFolder} />
                ))}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

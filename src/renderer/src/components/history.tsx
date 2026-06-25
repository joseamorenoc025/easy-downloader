import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '../i18n/context'
import type { HistoryEntry } from '@/types'
import '../lib/ipc'

interface HistoryProps {
  onOpenFolder: (path?: string) => void
  onRedownload: (entry: HistoryEntry) => void
  onBackToQueue?: () => void
}

// ── helpers ──────────────────────────────────────────────────────────────────

function getYouTubeThumbnail(url: string): string | null {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/
  )
  return match ? `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg` : null
}

function getSpotifyColor(url: string): string {
  // deterministic colour from URL chars
  const sum = url.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const hues = [142, 200, 260, 320, 30, 80]
  return `hsl(${hues[sum % hues.length]}, 65%, 40%)`
}

function groupByDate(entries: HistoryEntry[], t: (key: string) => string) {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart = new Date(todayStart)
  weekStart.setDate(weekStart.getDate() - 7)
  const monthStart = new Date(todayStart)
  monthStart.setDate(monthStart.getDate() - 30)

  const groups: { label: string; entries: HistoryEntry[] }[] = [
    { label: t('history.today'), entries: [] },
    { label: t('history.thisWeek'), entries: [] },
    { label: t('history.thisMonth'), entries: [] },
    { label: t('history.older'), entries: [] }
  ]

  for (const e of entries) {
    const d = new Date(e.completedAt)
    if (d >= todayStart) groups[0].entries.push(e)
    else if (d >= weekStart) groups[1].entries.push(e)
    else if (d >= monthStart) groups[2].entries.push(e)
    else groups[3].entries.push(e)
  }

  return groups.filter((g) => g.entries.length > 0)
}

function formatDuration(s: number) {
  if (!s) return ''
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

/**
 * Format a past ISO timestamp as a localized relative time, e.g.
 * "hace 5 min" / "5 min ago". Falls back to a localized date for anything
 * older than a day.
 */
function relativeTime(iso: string, locale: string): string {
  const diffSeconds = (Date.now() - new Date(iso).getTime()) / 1000
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (diffSeconds < 60) return rtf.format(-Math.round(diffSeconds), 'second')
  if (diffSeconds < 3600) return rtf.format(-Math.round(diffSeconds / 60), 'minute')
  if (diffSeconds < 86400) return rtf.format(-Math.round(diffSeconds / 3600), 'hour')
  if (diffSeconds < 86400 * 7) return rtf.format(-Math.round(diffSeconds / 86400), 'day')
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
}

// ── Thumbnail card ────────────────────────────────────────────────────────────

function HistoryCard({
  entry,
  onOpenFolder,
  onRedownload
}: {
  entry: HistoryEntry
  onOpenFolder: (path?: string) => void
  onRedownload: (entry: HistoryEntry) => void
}) {
  const { t, locale } = useI18n()
  const thumb = entry.source === 'youtube' ? getYouTubeThumbnail(entry.url) : null
  const spotifyBg = entry.source === 'spotify' ? getSpotifyColor(entry.url) : ''
  const [hovered, setHovered] = useState(false)
  const [imgError, setImgError] = useState(false)

  const isVideo = entry.format === 'video'
  const badgeLabel = isVideo ? 'MP4' : 'MP3'
  const qualityLabel = isVideo ? entry.quality : `${entry.quality} kbps`

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.93, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className="relative group cursor-pointer select-none"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── Thumbnail area ── */}
      <div className="relative overflow-hidden rounded-xl aspect-video bg-muted shadow-md group-hover:shadow-xl transition-shadow duration-300">
        {/* Image / fallback */}
        {thumb && !imgError ? (
          <img
            src={thumb}
            alt={entry.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : entry.source === 'spotify' ? (
          /* Spotify gradient placeholder */
          <div
            className="w-full h-full flex flex-col items-center justify-center gap-1"
            style={{ background: `linear-gradient(135deg, ${spotifyBg}, #1a1a2e)` }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#1DB954">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
            <span className="text-white/80 text-[10px] font-medium px-2 text-center truncate w-full text-center">
              {entry.title}
            </span>
          </div>
        ) : (
          /* Generic video placeholder */
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-900/60 to-slate-900">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255,255,255,0.4)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="m10 8 6 4-6 4V8Z" />
            </svg>
          </div>
        )}

        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Format badge */}
        <span
          className={`absolute top-2 right-2 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${
            isVideo ? 'bg-indigo-600 text-white' : 'bg-indigo-400 text-white'
          }`}
        >
          {badgeLabel}
        </span>

        {/* Source badge */}
        <span className="absolute top-2 left-2 rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-black/50 text-white/80 backdrop-blur-sm">
          {entry.source === 'spotify' ? '🎵 Spotify' : '▶ YouTube'}
        </span>

        {/* Bottom info row (always visible) */}
        <div className="absolute bottom-0 inset-x-0 p-2.5">
          <p className="text-white text-xs font-semibold leading-snug line-clamp-2 drop-shadow">
            {entry.title}
          </p>
          <p className="text-white/55 text-[10px] mt-0.5">
            {qualityLabel} · {relativeTime(entry.completedAt, locale)}
          </p>
        </div>

        {/* ── Hover overlay ── */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 backdrop-blur-[2px]"
            >
              <motion.button
                initial={{ y: 6, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.05 }}
                onClick={() => onRedownload(entry)}
                className="flex items-center gap-1.5 rounded-xl bg-white text-black px-4 py-2 text-xs font-bold shadow-lg hover:bg-white/90 active:scale-95"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 16l-4-4h2.5V4h3v8H16l-4 4Z" />
                  <path d="M4 18h16" />
                </svg>
                {t('history.redownload')}
              </motion.button>

              {entry.outputPath && (
                <motion.button
                  initial={{ y: 6, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.08 }}
                  onClick={() => onOpenFolder(entry.outputPath)}
                  className="flex items-center gap-1.5 rounded-xl border border-white/30 text-white/90 px-4 py-1.5 text-xs font-medium hover:bg-white/10 active:scale-95"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
                  </svg>
                  {t('history.openFolder')}
                </motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ── Section row ───────────────────────────────────────────────────────────────

function HistorySection({
  label,
  entries,
  onOpenFolder,
  onRedownload
}: {
  label: string
  entries: HistoryEntry[]
  onOpenFolder: (path?: string) => void
  onRedownload: (entry: HistoryEntry) => void
}) {
  const { t } = useI18n()
  return (
    <div className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70 px-0.5">
        {label}
        <span className="ml-2 text-muted-foreground/40 normal-case tracking-normal font-normal">
          {t('history.filesCount', { count: entries.length })}
        </span>
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <AnimatePresence initial={false}>
          {entries.map((e, i) => (
            <HistoryCard
              key={e.id}
              entry={e}
              onOpenFolder={onOpenFolder}
              onRedownload={onRedownload}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type Filter = 'all' | 'video' | 'audio'

export function History({ onOpenFolder, onRedownload, onBackToQueue }: HistoryProps) {
  const { t } = useI18n()
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    window.easyDownloader.getHistory().then(setEntries)
  }, [])

  // Real-time updates: listen for new completions while viewing history
  useEffect(() => {
    const handler = (item: HistoryEntry) => {
      setEntries((prev) => {
        if (prev.some((e) => e.id === item.id)) return prev
        return [item, ...prev].slice(0, 200)
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
            xmlns="http://www.w3.org/2000/svg"
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
              xmlns="http://www.w3.org/2000/svg"
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

  // ── No results ──
  const noResults = filtered.length === 0

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none"
            xmlns="http://www.w3.org/2000/svg"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
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

        {/* Format filter pills */}
        <div className="flex items-center gap-0.5 rounded-xl bg-muted p-0.5 shrink-0">
          {(['all', 'video', 'audio'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
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

        {/* Clear */}
        <button
          onClick={clear}
          className="shrink-0 rounded-xl px-2.5 py-1.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title={t('history.clear')}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
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
      <div className="space-y-6">
        {groups.map((g) => (
          <HistorySection
            key={g.label}
            label={g.label}
            entries={g.entries}
            onOpenFolder={onOpenFolder}
            onRedownload={onRedownload}
          />
        ))}
      </div>
    </div>
  )
}

import { useEffect, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DownloadForm } from './components/download-form'
import { QueueList } from './components/queue-list'
import { History } from './components/history'
import { NetworkStats } from './components/network-stats'
import { ThemeToggle } from './components/theme-toggle'
import { DependencyBanner } from './components/dependency-banner'
import { ToastProvider, useToast } from './components/toast'
import { useDownloads } from './hooks/use-downloads'
import { useSettings } from './hooks/use-settings'
import { I18nProvider, useI18n } from './i18n/context'
import type { DownloadOptions, HistoryEntry, DependencyStatus } from '@/types'
import { isValidUrl } from './lib/utils'
import './lib/ipc'

function AppContent() {
  const {
    queue,
    isLoading,
    addDownload,
    addSpotifyDownload,
    cancelDownload,
    cancelAll,
    openFolder,
    retryDownload,
    clearCompleted,
    addBatchDownloads
  } = useDownloads()
  const { settings, updateTheme, setFetchMetadata, setIncognitoMode, selectDirectory } =
    useSettings()
  const { t, locale, setLocale } = useI18n()
  const { toast } = useToast()
  const [view, setView] = useState<'queue' | 'history'>('queue')
  const [deps, setDeps] = useState<DependencyStatus | null>(null)
  const [depsDismissed, setDepsDismissed] = useState(false)

  useEffect(() => {
    window.easyDownloader
      .checkDependencies()
      .then(setDeps)
      .catch((err) => {
        console.error('checkDependencies failed:', err)
      })
  }, [])

  useEffect(() => {
    window.easyDownloader.onSpotifyTrackError(({ trackTitle }) => {
      toast(`${t('toast.trackFailed')} «${trackTitle}»`, 'error')
    })
    return () => {
      window.easyDownloader.removeAllListeners('spotify-track-error')
    }
  }, [toast, t])

  const handleRetryYtdlp = useCallback(async () => {
    try {
      const result = await window.easyDownloader.checkDependencies()
      setDeps(result)
    } catch (err) {
      console.error('checkDependencies retry failed:', err)
    }
  }, [])

  const handleAdd = (options: DownloadOptions) => {
    addDownload(options)
    toast(t('toast.addedToQueue'), 'success', 2000)
  }

  const handleAddSpotify = (url: string, quality?: string) => {
    addSpotifyDownload(url, quality)
    toast(t('toast.addedToQueue'), 'success', 2000)
  }

  const handleOpenFolder = () => {
    openFolder()
  }

  // Drag & drop handler — paste URL into form instead of auto-downloading
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const text = e.dataTransfer.getData('text/plain')
    if (text && isValidUrl(text)) {
      window.dispatchEvent(new CustomEvent('paste-url', { detail: text }))
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  // Global paste handler (Ctrl+V) - only populate URL field, don't auto-download
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text/plain')
      if (text && isValidUrl(text)) {
        window.dispatchEvent(new CustomEvent('paste-url', { detail: text }))
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [])

  // Context menu paste handler (right-click → Paste / Paste and go)
  useEffect(() => {
    const handler = (data: { text: string; autoGo: boolean }) => {
      if (!data.text || !isValidUrl(data.text)) return
      if (data.autoGo) {
        window.dispatchEvent(new CustomEvent('paste-url-and-go', { detail: data.text }))
      } else {
        window.dispatchEvent(new CustomEvent('paste-url', { detail: data.text }))
      }
    }
    window.easyDownloader.onContextPaste(handler)
    return () => {
      window.easyDownloader.removeAllListeners('context-paste')
    }
  }, [])

  return (
    <div
      className="mx-auto flex h-dvh w-full max-w-4xl flex-col px-4 py-5 gap-3"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Dependency banner */}
      <AnimatePresence>
        {deps && !depsDismissed && (
          <motion.div
            key="dep-banner"
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.25 }}
          >
            <DependencyBanner
              deps={deps}
              onDismiss={() => setDepsDismissed(true)}
              onRetryYtdlp={handleRetryYtdlp}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Header ────────────────────────────────────────────────── */}
      <header className="glass shrink-0 flex items-center justify-between rounded-2xl px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Folder button */}
          <button
            onClick={handleOpenFolder}
            className="shrink-0 rounded-xl p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            title={t('app.openFolder')}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
            </svg>
          </button>

          {/* Logo + title */}
          <div className="flex items-center gap-2 min-w-0">
            {/* Gradient icon badge */}
            <div
              className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg"
              style={{ background: 'linear-gradient(135deg, hsl(250,84%,62%), hsl(195,80%,56%))' }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 16l-4-4h2.5V4h3v8H16l-4 4Z" />
                <path d="M4 18h16" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-foreground leading-tight truncate">
                {t('app.title')}
              </h1>
              <p className="text-[11px] text-muted-foreground truncate leading-tight">
                {t('app.subtitle')}
              </p>
            </div>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Global Pause/Resume Toggle */}
          <button
            onClick={() => {
              const newPause = !settings.globalPause
              window.easyDownloader.setGlobalPause(newPause)
            }}
            className={`rounded-lg px-2 py-1 text-xs font-semibold transition-colors ${
              settings.globalPause
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
            title={settings.globalPause ? t('header.pauseResume') : t('header.resumePause')}
          >
            {settings.globalPause ? (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="inline-block mr-1"
                >
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
                {t('header.pause')}
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="inline-block mr-1"
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                {t('header.play')}
              </>
            )}
          </button>

          {/* Incognito mode toggle */}
          <button
            onClick={() => setIncognitoMode(!settings.incognitoMode)}
            className={`rounded-lg px-2 py-1 text-xs font-semibold transition-colors ${
              settings.incognitoMode
                ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
            title={
              settings.incognitoMode ? t('header.incognitoOnDesc') : t('header.incognitoOffDesc')
            }
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
              className="inline-block mr-1"
            >
              <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
              <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
              <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
              <line x1="2" x2="22" y1="2" y2="22" />
            </svg>
            {settings.incognitoMode ? t('header.incognitoOn') : t('header.incognitoOff')}
          </button>

          {/* Fetch metadata toggle */}
          <button
            onClick={() => setFetchMetadata(!settings.fetchMetadata)}
            className={`rounded-lg px-2 py-1 text-xs font-semibold transition-colors ${
              settings.fetchMetadata
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
            title={settings.fetchMetadata ? t('header.metadataOn') : t('header.metadataOff')}
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
              className="inline-block mr-1"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" x2="12" y1="16" y2="12" />
              <line x1="12" x2="12.01" y1="8" y2="8" />
            </svg>
            {t('header.meta')}
          </button>

          {/* Queue / History toggle */}
          <div
            role="tablist"
            aria-label={t('a11y.viewTabs')}
            className="flex items-center gap-0.5 rounded-xl bg-muted p-0.5"
          >
            {(['queue', 'history'] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`relative rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                  view === v
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {v === 'queue' ? t('header.queue') : t('history.title')}
              </button>
            ))}
          </div>

          {/* Language toggle */}
          <button
            onClick={() => setLocale(locale === 'es' ? 'en' : 'es')}
            aria-label={locale === 'es' ? t('a11y.switchToEnglish') : t('a11y.switchToSpanish')}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            title={locale === 'es' ? t('header.switchToEn') : t('header.switchToEs')}
          >
            {locale === 'es' ? 'EN' : 'ES'}
          </button>

          {/* Download path */}
          <button
            onClick={selectDirectory}
            aria-label={t('a11y.changeDownloadFolder')}
            className="max-w-[110px] truncate text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
            title={settings.downloadPath || t('header.defaultFolder')}
          >
            {settings.downloadPath
              ? settings.downloadPath.split(/[\\/]/).pop()
              : t('header.downloads')}
          </button>

          <ThemeToggle theme={settings.themeMode} onThemeChange={updateTheme} />
        </div>
      </header>

      {/* ─── Main content ──────────────────────────────────────────── */}
      <main className="glass flex min-h-0 flex-1 flex-col gap-4 rounded-2xl px-5 py-5 overflow-hidden">
        <DownloadForm
          onAdd={handleAdd}
          onAddSpotify={handleAddSpotify}
          onAddBatch={addBatchDownloads}
          isLoading={isLoading}
        />

        <div className="h-px bg-border/60" />

        <NetworkStats currentSpeed={queue.find((i) => i.status === 'downloading')?.speed || ''} />

        <div className="h-px bg-border/60" />

        <AnimatePresence mode="wait">
          {view === 'history' ? (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
              className="min-h-0 flex-1"
            >
              <div className="queue-scroll h-full overflow-y-auto pr-1">
                <History
                  onOpenFolder={openFolder}
                  onBackToQueue={() => setView('queue')}
                  onRedownload={(entry: HistoryEntry) => {
                    if (entry.source === 'spotify') {
                      handleAddSpotify(entry.url, entry.quality)
                    } else {
                      handleAdd({ url: entry.url, format: entry.format, quality: entry.quality })
                    }
                    setView('queue')
                  }}
                />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="queue"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.2 }}
              className="min-h-0 flex-1"
            >
              <div className="queue-scroll h-full overflow-y-auto pr-1">
                <QueueList
                  items={queue}
                  onCancel={cancelDownload}
                  onCancelAll={cancelAll}
                  onOpenFolder={openFolder}
                  onRetry={retryDownload}
                  onClearCompleted={clearCompleted}
                  isPaused={settings.globalPause}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Polite live region for screen readers: announces download
          progress changes without stealing focus. Updates are throttled
          to one announcement per few seconds by callers (queue-item renders). */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {queue
          .filter((i) => i.status === 'downloading')
          .map((i) => `${i.title}: ${i.progress.toFixed(0)}%`)
          .join(' | ')}
      </div>

      {/* ─── Footer ─────────────────────────────────────────────────── */}
      <footer className="shrink-0 text-center space-y-0.5">
        <p className="text-[10px] text-muted-foreground/70">
          <a
            href="https://github.com/joseamorenoc025/easy-downloader"
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-4 hover:underline hover:text-muted-foreground"
          >
            EasyDownloader v{__APP_VERSION__}
          </a>
        </p>
        <p className="text-[10px] text-muted-foreground/50">{t('app.footer')}</p>
        <p className="text-[10px] text-muted-foreground/50">
          {t('app.starPrompt')}{' '}
          <a
            href="https://github.com/joseamorenoc025/easy-downloader"
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-4 hover:underline hover:text-muted-foreground"
          >
            GitHub
          </a>
        </p>
        <p className="text-[10px] text-muted-foreground/50">
          <a
            href="https://github.com/joseamorenoc025/easy-downloader#apoya-el-proyecto"
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-4 hover:underline hover:text-muted-foreground"
          >
            {t('app.donate')}
          </a>
        </p>
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </I18nProvider>
  )
}

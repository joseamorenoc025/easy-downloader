import { useEffect, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DownloadForm } from './components/download-form'
import { QueueList } from './components/queue-list'
import { History } from './components/history'
import { ThemeToggle } from './components/theme-toggle'
import { DependencyBanner } from './components/dependency-banner'
import { useDownloads } from './hooks/use-downloads'
import { useSettings } from './hooks/use-settings'
import { I18nProvider, useI18n } from './i18n/context'
import type { DownloadOptions, HistoryEntry, DependencyStatus } from '@/types'
import { isValidUrl } from './lib/utils'
import './lib/ipc'

function AppContent() {
  const { queue, isLoading, addDownload, addSpotifyDownload, cancelDownload, cancelAll, openFolder } = useDownloads()
  const { settings, updateTheme, selectDirectory } = useSettings()
  const { t, locale, setLocale } = useI18n()
  const [view, setView] = useState<'queue' | 'history'>('queue')
  const [deps, setDeps] = useState<DependencyStatus | null>(null)
  const [depsDismissed, setDepsDismissed] = useState(false)

  useEffect(() => {
    window.easyDownloader.checkDependencies().then(setDeps)
  }, [])

  const handleRetryYtdlp = useCallback(async () => {
    const result = await window.easyDownloader.checkDependencies()
    setDeps(result)
  }, [])

  useEffect(() => {
    const mode = settings.themeMode
    if (mode === 'dark') {
      document.documentElement.classList.add('dark')
    } else if (mode === 'light') {
      document.documentElement.classList.remove('dark')
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      document.documentElement.classList.toggle('dark', prefersDark)
    }
  }, [settings.themeMode])

  const handleAdd = (options: DownloadOptions) => {
    addDownload(options)
  }

  const handleAddSpotify = (url: string) => {
    addSpotifyDownload(url)
  }

  const handleOpenFolder = () => {
    openFolder()
  }

  // Drag & drop handler
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const text = e.dataTransfer.getData('text/plain')
    if (text && isValidUrl(text)) {
      if (text.includes('open.spotify.com')) {
        addSpotifyDownload(text)
      } else {
        addDownload({ url: text, format: 'video', quality: 'best' })
      }
    }
  }, [addDownload, addSpotifyDownload])

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

  return (
    <div
      className="mx-auto flex h-dvh w-full max-w-2xl flex-col px-4 py-5 gap-3"
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
            <DependencyBanner deps={deps} onDismiss={() => setDepsDismissed(true)} onRetryYtdlp={handleRetryYtdlp} />
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
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
            </svg>
          </button>

          {/* Logo + title */}
          <div className="flex items-center gap-2 min-w-0">
            {/* Gradient icon badge */}
            <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: 'linear-gradient(135deg, hsl(250,84%,62%), hsl(195,80%,56%))' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 16l-4-4h2.5V4h3v8H16l-4 4Z" />
                <path d="M4 18h16" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-foreground leading-tight truncate">{t('app.title')}</h1>
              <p className="text-[11px] text-muted-foreground truncate leading-tight">{t('app.subtitle')}</p>
            </div>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Queue / History toggle */}
          <div className="flex items-center gap-0.5 rounded-xl bg-muted p-0.5">
            {(['queue', 'history'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`relative rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                  view === v
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {v === 'queue' ? 'Queue' : t('history.title')}
              </button>
            ))}
          </div>

          {/* Language toggle */}
          <button
            onClick={() => setLocale(locale === 'es' ? 'en' : 'es')}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            title={locale === 'es' ? 'Switch to English' : 'Cambiar a Español'}
          >
            {locale === 'es' ? 'EN' : 'ES'}
          </button>

          {/* Download path */}
          <button
            onClick={selectDirectory}
            className="max-w-[110px] truncate text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
            title={settings.downloadPath || 'Default download folder'}
          >
            {settings.downloadPath
              ? settings.downloadPath.split(/[\\/]/).pop()
              : 'Downloads'}
          </button>

          <ThemeToggle theme={settings.themeMode} onThemeChange={updateTheme} />
        </div>
      </header>

      {/* ─── Main content ──────────────────────────────────────────── */}
      <main className="glass flex min-h-0 flex-1 flex-col gap-4 rounded-2xl px-5 py-5 overflow-hidden">
        <DownloadForm onAdd={handleAdd} onAddSpotify={handleAddSpotify} isLoading={isLoading} />

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
                  onRedownload={(entry: HistoryEntry) => {
                    if (entry.source === 'spotify') {
                      handleAddSpotify(entry.url)
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
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ─── Footer ─────────────────────────────────────────────────── */}
      <footer className="shrink-0 text-center">
        <p className="text-[10px] text-muted-foreground/70">
          <a
            href="https://github.com/joseamorenoc025/easy-downloader"
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-4 hover:underline hover:text-muted-foreground"
          >
            EasyDownloader v2.0.0
          </a>
          {' · '}{t('app.footer')}
        </p>
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  )
}

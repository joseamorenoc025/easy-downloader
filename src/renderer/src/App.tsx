import { useEffect, useCallback, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DownloadPanel } from './components/download-panel'
import { StatsCard } from './components/stats-card'
import { QueueList } from './components/queue-list'
import { ThemeToggle } from './components/theme-toggle'
import { DependencyBanner } from './components/dependency-banner'
import { ToastProvider, useToast } from './components/toast'
import { useDownloads } from './hooks/use-downloads'
import { useSettings } from './hooks/use-settings'
import { I18nProvider, useI18n } from './i18n/context'
import type { DownloadOptions, DependencyStatus } from '@/types'
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
  const {
    settings,
    updateTheme,
    setFetchMetadata,
    setIncognitoMode,
    setNotifications,
    setMaxConcurrent,
    selectDirectory,
    selectCookiesFile,
    clearCookies
  } = useSettings()
  const { t, locale, setLocale } = useI18n()
  const { toast } = useToast()
  const [deps, setDeps] = useState<DependencyStatus | null>(null)
  const [depsDismissed, setDepsDismissed] = useState(false)
  const [folderOpen, setFolderOpen] = useState(false)
  const folderRef = useRef<HTMLDivElement>(null)

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
    setFolderOpen(false)
    openFolder()
  }

  const handleChangeFolder = async () => {
    setFolderOpen(false)
    const dir = await selectDirectory()
    if (dir) {
      toast(`${t('app.changeFolderConfirm').replace('{path}', dir)}`, 'success', 3000)
    }
  }

  const handleTogglePause = () => {
    const newPause = !settings.globalPause
    window.easyDownloader.setGlobalPause(newPause)
  }

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

  useEffect(() => {
    if (!folderOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (folderRef.current && !folderRef.current.contains(e.target as Node)) {
        setFolderOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [folderOpen])

  return (
    <div
      className="mx-auto flex h-dvh w-full max-w-7xl flex-col px-4 py-4 gap-3"
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
      <header className="glass shrink-0 flex items-center justify-between rounded-2xl px-4 py-2.5">
        <div className="flex items-center gap-3 min-w-0">
          {/* Folder dropdown */}
          <div className="relative" ref={folderRef}>
            <button
              onClick={() => setFolderOpen(!folderOpen)}
              className="shrink-0 rounded-xl p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              title={t('app.openFolder')}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
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
            <AnimatePresence>
              {folderOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-1 glass rounded-xl shadow-lg border border-border/50 py-1 z-50 min-w-[180px]"
                >
                  <button
                    onClick={handleOpenFolder}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <svg
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
                    {t('app.openFolder')}
                  </button>
                  <button
                    onClick={handleChangeFolder}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="3" />
                      <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                    </svg>
                    {t('app.changeFolder')}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Logo + title */}
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg"
              style={{ background: 'linear-gradient(135deg, hsl(250,84%,62%), hsl(195,80%,56%))' }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
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
              <h1 className="text-sm font-bold text-gradient-brand leading-tight truncate">
                {t('app.title')}
              </h1>
              <p className="text-[10px] text-muted-foreground truncate leading-tight">
                {t('app.subtitle')}
              </p>
            </div>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Language toggle */}
          <button
            onClick={() => setLocale(locale === 'es' ? 'en' : 'es')}
            aria-label={locale === 'es' ? t('a11y.switchToEnglish') : t('a11y.switchToSpanish')}
            className="rounded-lg px-1.5 py-1 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            title={locale === 'es' ? t('header.switchToEn') : t('header.switchToEs')}
          >
            {locale === 'es' ? 'EN' : 'ES'}
          </button>

          {/* Cookies */}
          <button
            onClick={settings.cookiesPath ? clearCookies : selectCookiesFile}
            aria-label={t('a11y.cookies')}
            className={`shrink-0 rounded-xl p-1.5 ${
              settings.cookiesPath
                ? 'text-emerald-500 hover:bg-emerald-500/10'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
            title={
              settings.cookiesPath
                ? `${t('cookies.active')}: ${settings.cookiesPath.split(/[\\/]/).pop()}`
                : t('cookies.import')
            }
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
              <path d="M8.5 8.5v.01" />
              <path d="M16 15.5v.01" />
              <path d="M12 12v.01" />
              <path d="M11 17v.01" />
              <path d="M7 14v.01" />
              <path d="M16 8v.01" />
            </svg>
          </button>

          {/* Notifications toggle */}
          <button
            onClick={() => setNotifications(!settings.notificationsEnabled)}
            aria-label={t('a11y.notifications')}
            className={`shrink-0 rounded-xl p-1.5 ${
              settings.notificationsEnabled
                ? 'text-foreground hover:bg-accent hover:text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
            title={settings.notificationsEnabled ? t('notifications.on') : t('notifications.off')}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              {settings.notificationsEnabled ? (
                <>
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                </>
              ) : (
                <>
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                  <line x1="2" y1="2" x2="22" y2="22" />
                </>
              )}
            </svg>
          </button>

          <ThemeToggle theme={settings.themeMode} onThemeChange={updateTheme} />
        </div>
      </header>

      {/* ─── Workspace: Dual Pane ─────────────────────────────────── */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-[1fr_320px]">
        {/* Left: Download Panel */}
        <div className="min-h-0 flex flex-col">
          <DownloadPanel
            onAdd={handleAdd}
            onAddSpotify={handleAddSpotify}
            onAddBatch={addBatchDownloads}
            isLoading={isLoading}
          />
        </div>

        {/* Right: Stats Card (with session controls) */}
        <div className="min-h-0">
          <StatsCard
            queue={queue}
            settings={settings}
            onTogglePause={handleTogglePause}
            onToggleIncognito={() => setIncognitoMode(!settings.incognitoMode)}
            onToggleMetadata={() => setFetchMetadata(!settings.fetchMetadata)}
            onChangeConcurrent={setMaxConcurrent}
          />
        </div>
      </div>

      {/* ─── Queue (always visible) ──────────────── */}
      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl">
        <div className="glass h-full overflow-y-auto px-5 py-4 pr-1 transition-all duration-300">
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
      </div>

      {/* Screen reader live region */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {queue
          .filter((i) => i.status === 'downloading')
          .map((i) => `${i.title}: ${i.progress.toFixed(0)}%`)
          .join(' | ')}
      </div>

      {/* ─── Footer (compact, 1 line) ─────────────────────────────────── */}
      <footer className="shrink-0 text-center">
        <p className="text-[10px] text-muted-foreground/60 flex items-center justify-center gap-1.5">
          <span>
            <a
              href="https://github.com/joseamorenoc025/easy-downloader"
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-4 hover:underline hover:text-muted-foreground"
            >
              EasyDownloader v{__APP_VERSION__}
            </a>
          </span>
          <span className="text-muted-foreground/30">·</span>
          <span>
            <a
              href="https://github.com/joseamorenoc025/easy-downloader"
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-4 hover:underline hover:text-muted-foreground"
            >
              GitHub
            </a>
          </span>
          <span className="text-muted-foreground/30">·</span>
          <span>
            <a
              href="https://github.com/joseamorenoc025/easy-downloader#apoya-el-proyecto"
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-4 hover:underline hover:text-muted-foreground"
              title={t('app.donate')}
            >
              ☕
            </a>
          </span>
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

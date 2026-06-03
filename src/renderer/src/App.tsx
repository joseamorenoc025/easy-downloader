import { useEffect, useCallback, useState } from 'react'
import { DownloadForm } from './components/download-form'
import { QueueList } from './components/queue-list'
import { History } from './components/history'
import { ThemeToggle } from './components/theme-toggle'
import { useDownloads } from './hooks/use-downloads'
import { useSettings } from './hooks/use-settings'
import { I18nProvider, useI18n } from './i18n/context'
import type { DownloadOptions, HistoryEntry } from '@/types'
import { isValidUrl } from './lib/utils'
import './lib/ipc'

function AppContent() {
  const { queue, isLoading, addDownload, addSpotifyDownload, cancelDownload, cancelAll, openFolder } = useDownloads()
  const { settings, updateTheme, selectDirectory } = useSettings()
  const { t, locale, setLocale } = useI18n()
  const [view, setView] = useState<'queue' | 'history'>('queue')

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
        // Dispatch custom event to fill the URL input
        window.dispatchEvent(new CustomEvent('paste-url', { detail: text }))
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [])

  return (
    <div
      className="mx-auto flex h-dvh w-full max-w-2xl flex-col px-4 py-6"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <header className="shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={handleOpenFolder}
            className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title={t('app.openFolder')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
            </svg>
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground truncate">{t('app.title')}</h1>
            <p className="text-sm text-muted-foreground truncate">
              {t('app.subtitle')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 rounded-lg border p-0.5">
            <button
              onClick={() => setView('queue')}
              className={`rounded-md px-2 py-1 text-xs transition-colors ${
                view === 'queue'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Queue
            </button>
            <button
              onClick={() => setView('history')}
              className={`rounded-md px-2 py-1 text-xs transition-colors ${
                view === 'history'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('history.title')}
            </button>
          </div>
          <button
            onClick={() => setLocale(locale === 'es' ? 'en' : 'es')}
            className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title={locale === 'es' ? 'Switch to English' : 'Cambiar a Español'}
          >
            {locale === 'es' ? 'EN' : 'ES'}
          </button>
          <button
            onClick={selectDirectory}
            className="max-w-[140px] truncate text-xs text-muted-foreground underline-offset-4 hover:underline hover:text-foreground transition-colors"
            title={settings.downloadPath || 'Default download folder'}
          >
            {settings.downloadPath
              ? settings.downloadPath.split(/[\\/]/).pop()
              : 'Downloads'}
          </button>
          <ThemeToggle theme={settings.themeMode} onThemeChange={updateTheme} />
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-4 pt-4">
        <DownloadForm onAdd={handleAdd} onAddSpotify={handleAddSpotify} isLoading={isLoading} />

        {view === 'history' ? (
          <div className="min-h-0 flex-1 border-t pt-4">
            <div className="queue-scroll h-full overflow-y-auto">
              <History
                onOpenFolder={openFolder}
                onRedownload={(entry) => {
                  if (entry.source === 'spotify') {
                    handleAddSpotify(entry.url)
                  } else {
                    handleAdd({ url: entry.url, format: entry.format, quality: entry.quality })
                  }
                  setView('queue')
                }}
              />
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 border-t pt-4">
            <div className="queue-scroll h-full overflow-y-auto">
              <QueueList
                items={queue}
                onCancel={cancelDownload}
                onCancelAll={cancelAll}
                onOpenFolder={openFolder}
              />
            </div>
          </div>
        )}
      </main>

      <footer className="shrink-0 border-t pt-3 text-center">
        <p className="text-xs text-muted-foreground">
          <a
            href="https://github.com/joseamorenoc025/easy-downloader"
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-4 hover:underline hover:text-foreground transition-colors"
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

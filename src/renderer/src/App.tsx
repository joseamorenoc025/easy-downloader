import { useEffect } from 'react'
import { DownloadForm } from './components/download-form'
import { QueueList } from './components/queue-list'
import { ThemeToggle } from './components/theme-toggle'
import { useDownloads } from './hooks/use-downloads'
import { useSettings } from './hooks/use-settings'
import type { DownloadOptions } from '@/types'

export default function App() {
  const { queue, isLoading, addDownload, cancelDownload, cancelAll } = useDownloads()
  const { settings, updateTheme, selectDirectory } = useSettings()

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

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">EasyDownloader</h1>
          <p className="text-sm text-muted-foreground">
            Download videos and audio from YouTube
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={selectDirectory}
            className="text-xs text-muted-foreground underline-offset-4 hover:underline hover:text-foreground transition-colors"
            title={settings.downloadPath || 'Default download folder'}
          >
            {settings.downloadPath
              ? settings.downloadPath.split(/[\\/]/).pop()
              : 'Downloads'}
          </button>
          <ThemeToggle theme={settings.themeMode} onThemeChange={updateTheme} />
        </div>
      </header>

      <main className="flex-1 space-y-6">
        <DownloadForm onAdd={handleAdd} isLoading={isLoading} />

        <div className="border-t pt-6">
          <QueueList
            items={queue}
            onCancel={cancelDownload}
            onCancelAll={cancelAll}
          />
        </div>
      </main>

      <footer className="mt-8 border-t pt-4 text-center">
        <p className="text-xs text-muted-foreground">
          <a
            href="https://github.com/joseamorenoc025/easy-downloader"
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-4 hover:underline hover:text-foreground transition-colors"
          >
            EasyDownloader v2.0.0
          </a>
          {' · '}Built with Electron + React
        </p>
      </footer>
    </div>
  )
}

import { useI18n } from '../i18n/context'
import type { Settings } from '@/types'

interface SessionToolbarProps {
  settings: Settings
  onTogglePause: () => void
  onToggleIncognito: () => void
  onToggleMetadata: () => void
  onChangeConcurrent: (value: number) => void
}

export function SessionToolbar({
  settings,
  onTogglePause,
  onToggleIncognito,
  onToggleMetadata,
  onChangeConcurrent
}: SessionToolbarProps) {
  const { t } = useI18n()

  return (
    <div className="glass flex flex-wrap items-center gap-2 rounded-2xl px-4 py-2">
      <p className="section-title mr-1">{t('session.title')}</p>

      {/* Global Pause/Resume */}
      <button
        onClick={onTogglePause}
        className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
          settings.globalPause
            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        }`}
        title={settings.globalPause ? t('header.resumePause') : t('header.pauseResume')}
      >
        {settings.globalPause ? (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
            {t('header.pause')}
          </>
        ) : (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            {t('header.play')}
          </>
        )}
      </button>

      {/* Incognito */}
      <button
        onClick={onToggleIncognito}
        className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
          settings.incognitoMode
            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        }`}
        title={settings.incognitoMode ? t('header.incognitoOnDesc') : t('header.incognitoOffDesc')}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
          <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
          <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
          <line x1="2" x2="22" y1="2" y2="22" />
        </svg>
        {settings.incognitoMode ? t('header.incognitoOn') : t('header.incognitoOff')}
      </button>

      {/* Metadata */}
      <button
        onClick={onToggleMetadata}
        className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
          settings.fetchMetadata
            ? 'bg-card text-foreground shadow-sm'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        }`}
        title={settings.fetchMetadata ? t('header.metadataOn') : t('header.metadataOff')}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" x2="12" y1="16" y2="12" />
          <line x1="12" x2="12.01" y1="8" y2="8" />
        </svg>
        {t('header.meta')}
      </button>

      {/* Concurrent downloads */}
      <div
        className="flex items-center gap-1 text-xs text-muted-foreground"
        title={t('concurrent.title')}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <button
          onClick={() => onChangeConcurrent(Math.max(1, (settings.maxConcurrent || 3) - 1))}
          className="rounded px-1 py-0.5 hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          −
        </button>
        <span className="w-4 text-center font-mono text-foreground">
          {settings.maxConcurrent || 3}
        </span>
        <button
          onClick={() => onChangeConcurrent(Math.min(8, (settings.maxConcurrent || 3) + 1))}
          className="rounded px-1 py-0.5 hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          +
        </button>
      </div>
    </div>
  )
}

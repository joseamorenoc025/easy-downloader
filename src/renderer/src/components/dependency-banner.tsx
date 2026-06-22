import { useState } from 'react'
import { useI18n } from '../i18n/context'
import type { DependencyStatus } from '@/types'

interface DepBannerProps {
  deps: DependencyStatus
  onDismiss: () => void
  onRetryYtdlp: () => void
}

function DepItem({ missing, label, what, children }: { missing: boolean; label: string; what: string; children: React.ReactNode }) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)

  if (!missing) return null

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">{label}</p>
          <p className="text-xs text-amber-700 dark:text-amber-400">{what}</p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="shrink-0 rounded px-2 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-200 dark:text-amber-400 dark:hover:bg-amber-900"
        >
          {expanded ? t('deps.hide') : t('deps.help')}
        </button>
      </div>
      {expanded && (
        <div className="mt-2 text-xs text-amber-800 dark:text-amber-300 whitespace-pre-line">
          {children}
        </div>
      )}
    </div>
  )
}

export function DependencyBanner({ deps, onDismiss, onRetryYtdlp }: DepBannerProps) {
  const { t } = useI18n()
  const missing = !deps.ffmpeg || !deps.ytdlp

  if (!missing) return null

  return (
    <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-100 p-4 dark:border-amber-700 dark:bg-amber-900/50">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            {t('deps.banner.title')}
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {t('deps.banner.text')}
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="rounded-md px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200 dark:text-amber-400 dark:hover:bg-amber-800"
        >
          {t('deps.banner.dismiss')}
        </button>
      </div>

      <div className="space-y-2">
        {!deps.ffmpeg && (
          <DepItem
            missing={deps.ffmpeg}
            label={t('deps.ffmpeg.missing')}
            what={t('deps.ffmpeg.what')}
          >
            <p><strong>Windows:</strong> {t('deps.ffmpeg.installWin')}</p>
            <p className="mt-1"><strong>Linux:</strong> <code className="rounded bg-amber-200/50 px-1 dark:bg-amber-800/50">sudo apt install ffmpeg</code></p>
            <p className="mt-1"><strong>Fedora:</strong> <code className="rounded bg-amber-200/50 px-1 dark:bg-amber-800/50">sudo dnf install ffmpeg</code></p>
            <p className="mt-1"><strong>Mac:</strong> <code className="rounded bg-amber-200/50 px-1 dark:bg-amber-800/50">brew install ffmpeg</code></p>
          </DepItem>
        )}

        {!deps.ytdlp && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-200">{t('deps.ytdlp.missing')}</p>
                <p className="text-xs text-amber-700 dark:text-amber-400">{t('deps.ytdlp.what')}</p>
              </div>
              <button
                onClick={onRetryYtdlp}
                className="shrink-0 rounded px-2 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-200 dark:text-amber-400 dark:hover:bg-amber-900"
              >
                {t('deps.ytdlp.retry')}
              </button>
            </div>
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{t('deps.ytdlp.install')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
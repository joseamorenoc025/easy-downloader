import { useI18n } from '../i18n/context'

export function InfoSection() {
  const { t } = useI18n()

  return (
    <div className="flex items-center gap-3 py-6 px-4 text-center">
      <div className="text-2xl shrink-0">🎵</div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{t('info.welcome')}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{t('info.shortDescription')}</p>
      </div>
    </div>
  )
}

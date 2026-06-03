import { useI18n } from '../i18n/context'

export function InfoSection() {
  const { t } = useI18n()

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 text-4xl">🎵</div>
      <h2 className="mb-2 text-lg font-semibold text-foreground">
        {t('info.welcome')}
      </h2>
      <p className="mb-6 max-w-md text-sm text-muted-foreground">
        {t('info.description')}
      </p>
      <div className="flex gap-6 text-left text-sm text-muted-foreground">
        <div>
          <h3 className="mb-1 font-medium text-foreground">{t('info.youtubeTitle')}</h3>
          <ul className="list-inside list-disc space-y-0.5">
            <li>{t('info.youtubeVideos')}</li>
            <li>{t('info.youtubeAudio')}</li>
            <li>{t('info.youtubePlaylists')}</li>
          </ul>
        </div>
        <div>
          <h3 className="mb-1 font-medium text-foreground">{t('info.spotifyTitle')}</h3>
          <ul className="list-inside list-disc space-y-0.5">
            <li>{t('info.spotifyTracks')}</li>
            <li>{t('info.spotifyAlbums')}</li>
            <li>{t('info.spotifyRequires')}</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

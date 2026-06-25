import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '../i18n/context'
import '../lib/ipc'

export interface MetadataFields {
  title: string
  artist: string
  album: string
  year: string
  genre: string
  track: string
}

interface MetadataEditorProps {
  url: string
  source: 'youtube' | 'spotify'
  open: boolean
  onClose: () => void
  onConfirm: (metadata: MetadataFields) => void
}

export function MetadataEditor({ url, source, open, onClose, onConfirm }: MetadataEditorProps) {
  const { t } = useI18n()
  const [loading, setLoading] = useState(false)
  const [metadata, setMetadata] = useState<MetadataFields>({
    title: '',
    artist: '',
    album: '',
    year: '',
    genre: '',
    track: ''
  })

  useEffect(() => {
    if (!open || source === 'spotify') return

    let cancelled = false
    setLoading(true)
    window.easyDownloader
      .extractMetadata(url)
      .then((result) => {
        if (cancelled) return
        setMetadata({
          title: result.title || '',
          artist: result.artist || '',
          album: result.album || '',
          year: result.year || '',
          genre: result.genre || '',
          track: result.track || ''
        })
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, url, source])

  const update = (field: keyof MetadataFields, value: string) => {
    setMetadata((prev) => ({ ...prev, [field]: value }))
  }

  const fields: { key: keyof MetadataFields; label: string; placeholder: string }[] = [
    { key: 'title', label: t('metadata.title'), placeholder: t('metadata.titlePh') },
    { key: 'artist', label: t('metadata.artist'), placeholder: t('metadata.artistPh') },
    { key: 'album', label: t('metadata.album'), placeholder: t('metadata.albumPh') },
    { key: 'year', label: t('metadata.year'), placeholder: t('metadata.yearPh') },
    { key: 'genre', label: t('metadata.genre'), placeholder: t('metadata.genrePh') },
    { key: 'track', label: t('metadata.track'), placeholder: t('metadata.trackPh') }
  ]

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className="fixed inset-0 bg-black/50" onClick={onClose} />
          <div className="relative z-10 w-full max-w-md rounded-xl border bg-card p-4 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-card-foreground">{t('metadata.title')}</h3>
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                ✕
              </button>
            </div>

            {loading && (
              <p className="text-xs text-muted-foreground py-4">{t('metadata.loading')}</p>
            )}

            {!loading && (
              <div className="space-y-2">
                {fields.map((f) => (
                  <div key={f.key}>
                    <label className="block text-xs text-muted-foreground mb-0.5">{f.label}</label>
                    <input
                      type="text"
                      value={metadata[f.key]}
                      onChange={(e) => update(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className="w-full rounded-md border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={onClose}
                className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                {t('metadata.skip')}
              </button>
              <button
                onClick={() => onConfirm(metadata)}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
              >
                {t('metadata.confirm')}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

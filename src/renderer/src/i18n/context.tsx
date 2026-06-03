import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import es from './es.json'
import en from './en.json'

type TranslationMap = Record<string, string>
const locales: Record<string, TranslationMap> = { es, en }

const detectLocale = (): string => {
  const stored = localStorage.getItem('locale')
  if (stored === 'es' || stored === 'en') return stored
  return navigator.language.startsWith('es') ? 'es' : 'en'
}

interface I18nContextType {
  locale: string
  t: (key: string, params?: Record<string, string | number>) => string
  setLocale: (locale: string) => void
}

const I18nContext = createContext<I18nContextType>({
  locale: 'en',
  t: (key) => key,
  setLocale: () => {}
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState(detectLocale)

  const setLocale = useCallback((newLocale: string) => {
    setLocaleState(newLocale)
    localStorage.setItem('locale', newLocale)
  }, [])

  const t = useCallback((key: string, params?: Record<string, string | number>) => {
    const map = locales[locale] || en
    let text = map[key] ?? key
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, String(v))
      }
    }
    return text
  }, [locale])

  return (
    <I18nContext.Provider value={{ locale, t, setLocale }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}

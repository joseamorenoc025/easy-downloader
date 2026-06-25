import { useState, useEffect, useCallback } from 'react'
import type { Settings, ThemeMode } from '@/types'
import '../lib/ipc'

/**
 * Centralized theme application. This is the single source of truth for
 * which CSS classes land on <html>. Both the initial bootstrap and runtime
 * `updateTheme` calls flow through here, so we never have two effects
 * fighting over `documentElement.classList` (which produced a visible
 * flash of wrong theme at app start).
 */
function applyTheme(mode: ThemeMode) {
  const root = document.documentElement
  root.classList.remove('dark', 'theme-dracula', 'theme-nord', 'theme-cyberpunk')

  if (mode === 'dark') {
    root.classList.add('dark')
  } else if (mode === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.toggle('dark', prefersDark)
  }
  // 'light' -> no class
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>({
    downloadPath: '',
    themeMode: 'system',
    fetchMetadata: true,
    incognitoMode: false,
    maxConcurrent: 3
  })

  useEffect(() => {
    let cancelled = false
    window.easyDownloader.getSettings().then((s) => {
      if (cancelled) return
      // Defensive narrowing: persisted values from older versions may still
      // contain the removed dracula/nord/cyberpunk literals.
      const mode: ThemeMode = isThemeMode(s.themeMode) ? s.themeMode : 'system'
      setSettings({ ...s, themeMode: mode })
      applyTheme(mode)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const updateTheme = useCallback(async (mode: ThemeMode) => {
    await window.easyDownloader.setTheme(mode)
    setSettings((prev) => ({ ...prev, themeMode: mode }))
    applyTheme(mode)
  }, [])

  const setFetchMetadata = useCallback(async (enabled: boolean) => {
    await window.easyDownloader.setFetchMetadata(enabled)
    setSettings((prev) => ({ ...prev, fetchMetadata: enabled }))
  }, [])

  const setIncognitoMode = useCallback(async (enabled: boolean) => {
    await window.easyDownloader.setIncognitoMode(enabled)
    setSettings((prev) => ({ ...prev, incognitoMode: enabled }))
  }, [])

  const setMaxConcurrent = useCallback(async (value: number) => {
    await window.easyDownloader.setMaxConcurrent(value)
    setSettings((prev) => ({ ...prev, maxConcurrent: value }))
  }, [])

  const selectDirectory = useCallback(async () => {
    const dir = await window.easyDownloader.selectDirectory()
    if (dir) {
      setSettings((prev) => ({ ...prev, downloadPath: dir }))
    }
    return dir
  }, [])

  return {
    settings,
    updateTheme,
    setFetchMetadata,
    setIncognitoMode,
    setMaxConcurrent,
    selectDirectory
  }
}

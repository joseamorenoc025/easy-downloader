import { useState, useEffect } from 'react'
import type { Settings, ThemeMode } from '@/types'
import '../lib/ipc'

const CUSTOM_THEMES = ['dracula', 'nord', 'cyberpunk'] as const

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement

  // Remove all theme classes
  root.classList.remove('dark', 'theme-dracula', 'theme-nord', 'theme-cyberpunk')

  if (mode === 'dark') {
    root.classList.add('dark')
  } else if (mode === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.toggle('dark', prefersDark)
  } else if (CUSTOM_THEMES.includes(mode as any)) {
    root.classList.add('dark', `theme-${mode}`)
  }
  // 'light' → no classes needed
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>({
    downloadPath: '',
    themeMode: 'system'
  })

  useEffect(() => {
    window.easyDownloader.getSettings().then((s) => {
      setSettings(s)
      applyTheme(s.themeMode)
    })
  }, [])

  const updateTheme = async (mode: ThemeMode) => {
    await window.easyDownloader.setTheme(mode as any)
    setSettings(prev => ({ ...prev, themeMode: mode }))
    applyTheme(mode)
  }

  const selectDirectory = async () => {
    const dir = await window.easyDownloader.selectDirectory()
    if (dir) {
      setSettings(prev => ({ ...prev, downloadPath: dir }))
    }
    return dir
  }

  return { settings, updateTheme, selectDirectory }
}

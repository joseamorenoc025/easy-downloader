import { useState, useEffect } from 'react'
import type { Settings } from '@/types'
import '../lib/ipc'

export function useSettings() {
  const [settings, setSettings] = useState<Settings>({
    downloadPath: '',
    themeMode: 'system'
  })

  useEffect(() => {
    window.easyDownloader.getSettings().then(setSettings)
  }, [])

  const updateTheme = async (mode: 'light' | 'dark' | 'system') => {
    await window.easyDownloader.setTheme(mode)
    setSettings(prev => ({ ...prev, themeMode: mode }))

    if (mode === 'dark') {
      document.documentElement.classList.add('dark')
    } else if (mode === 'light') {
      document.documentElement.classList.remove('dark')
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      document.documentElement.classList.toggle('dark', prefersDark)
    }
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

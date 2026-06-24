import { BrowserWindow, Notification } from 'electron'
import { app } from 'electron'

const { autoUpdater } = require('electron-updater')

interface UpdaterDeps {
  getMainWindow: () => BrowserWindow | null
  getIsUpdateDownloaded: () => boolean
  setIsUpdateDownloaded: (v: boolean) => void
}

export function setupAutoUpdater(deps: UpdaterDeps): void {
  const { getMainWindow, getIsUpdateDownloaded, setIsUpdateDownloaded } = deps
  const isPackaged = app.isPackaged

  autoUpdater.autoDownload = isPackaged
  autoUpdater.autoInstallOnAppQuit = isPackaged

  autoUpdater.on('update-available', () => {
    const win = getMainWindow()
    if (win && Notification.isSupported()) {
      const notif = new Notification({
        title: 'Update Available',
        body: 'A new version is being downloaded...',
        silent: true
      })
      notif.show()
    }
  })

  autoUpdater.on('update-not-available', () => {
    // Quiet by design
  })

  autoUpdater.on('update-downloaded', () => {
    setIsUpdateDownloaded(true)
    const win = getMainWindow()
    if (win && Notification.isSupported()) {
      const notif = new Notification({
        title: 'Update Ready',
        body: 'A new version is ready. Restart to apply.',
        silent: false
      })
      notif.show()
      notif.on('click', () => {
        if (getIsUpdateDownloaded()) {
          setIsUpdateDownloaded(false)
          autoUpdater.quitAndInstall()
        }
      })
    }
  })

  autoUpdater.on('update-cancelled', () => {
    setIsUpdateDownloaded(false)
  })

  autoUpdater.on('error', (err: Error) => {
    if (!isPackaged) return
    console.error('Auto-updater error:', err)
  })

  if (isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err: Error) => {
        console.error('checkForUpdates failed:', err)
      })
    }, 3000)
  }
}

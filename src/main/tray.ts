import { app, BrowserWindow, Tray, Menu } from 'electron'
import { join } from 'path'

export function setupTray(getMainWindow: () => BrowserWindow | null): Tray | null {
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(__dirname, '../../resources/icon.png')

  try {
    const tray = new Tray(iconPath)
    tray.setToolTip('EasyDownloader')

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show EasyDownloader',
        click: () => {
          const win = getMainWindow()
          win?.show()
          win?.focus()
        }
      },
      { type: 'separator' },
      {
        label: 'Exit',
        click: () => {
          tray.destroy()
          app.quit()
        }
      }
    ])

    tray.setContextMenu(contextMenu)

    tray.on('double-click', () => {
      const win = getMainWindow()
      if (win?.isVisible()) {
        win.hide()
      } else {
        win?.show()
        win?.focus()
      }
    })

    return tray
  } catch {
    // Tray not supported (Linux without libappindicator)
    return null
  }
}

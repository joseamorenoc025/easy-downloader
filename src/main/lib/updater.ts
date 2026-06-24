import type { AppUpdater } from 'electron-updater'

const { autoUpdater } = require('electron-updater') as { autoUpdater: AppUpdater }

export { autoUpdater }

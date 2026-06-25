import { app } from 'electron'
import { join, dirname } from 'path'

const { default: Store } = require('electron-store')

// Detect portable mode: if the executable is in a "portable" directory
// or if --portable flag is passed, store data next to the executable.
const isPortable =
  process.argv.includes('--portable') ||
  process.env.EASYDOWNLOADER_PORTABLE === '1' ||
  dirname(app.getPath('exe')).toLowerCase().includes('portable')

if (isPortable) {
  app.setPath('userData', join(dirname(app.getPath('exe')), 'data'))
}

export const store = new Store({
  defaults: {
    downloadPath: app.getPath('downloads'),
    themeMode: 'system' as 'light' | 'dark' | 'system',
    downloadQueue: [] as Array<{ url: string; format: string; quality: string; source: string }>,
    fetchMetadata: true,
    incognitoMode: false,
    globalPause: false,
    maxConcurrent: 3,
    cookiesPath: '',
    notificationsEnabled: true,
    historyMaxAge: 90
  }
})

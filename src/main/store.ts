import { app } from 'electron'

const { default: Store } = require('electron-store')

export const store = new Store({
  defaults: {
    downloadPath: app.getPath('downloads'),
    themeMode: 'system' as 'light' | 'dark' | 'system',
    downloadQueue: [] as Array<{ url: string; format: string; quality: string; source: string }>,
    fetchMetadata: true,
    incognitoMode: false,
    globalPause: false,
    maxConcurrent: 3
  }
})

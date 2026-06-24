import { contextBridge, ipcRenderer } from 'electron'
import type { EasyDownloaderAPI } from '../types'

export type { EasyDownloaderAPI }

const api: EasyDownloaderAPI = {
  fetchMetadata: (url) => ipcRenderer.invoke('fetch-metadata', url),
  addDownload: (options) => ipcRenderer.invoke('add-download', options),
  addSpotifyDownload: (url, quality) => ipcRenderer.invoke('add-spotify-download', url, quality),
  cancelDownload: (itemId) => ipcRenderer.invoke('cancel-download', itemId),
  cancelAll: () => ipcRenderer.invoke('cancel-all'),
  pauseAll: () => ipcRenderer.invoke('pause-all'),
  resumeAll: () => ipcRenderer.invoke('resume-all'),
  getQueue: () => ipcRenderer.invoke('get-queue'),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setTheme: (mode) => ipcRenderer.invoke('set-theme', mode),
  setFetchMetadata: (enabled) => ipcRenderer.invoke('set-fetch-metadata', enabled),
  setIncognitoMode: (enabled) => ipcRenderer.invoke('set-incognito-mode', enabled),
  setGlobalPause: (enabled) => ipcRenderer.invoke('set-global-pause', enabled),
  checkFfmpeg: () => ipcRenderer.invoke('check-ffmpeg'),
  checkSpotdl: () => ipcRenderer.invoke('check-spotdl'),
  checkYtdlp: () => ipcRenderer.invoke('check-ytdlp'),
  checkDependencies: () => ipcRenderer.invoke('check-dependencies'),
  saveQueue: (queue) => ipcRenderer.invoke('save-queue', queue),
  getSavedQueue: () => ipcRenderer.invoke('get-saved-queue'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
  getHistory: () => ipcRenderer.invoke('get-history'),
  addHistoryEntry: (entry) => ipcRenderer.invoke('add-history-entry', entry),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (_event, data) => callback(data))
  },
  onDownloadComplete: (callback) => {
    ipcRenderer.on('download-complete', (_event, data) => callback(data))
  },
  onDownloadError: (callback) => {
    ipcRenderer.on('download-error', (_event, data) => callback(data))
  },
  onSpotifyTrackError: (callback) => {
    ipcRenderer.on('spotify-track-error', (_event, data) => callback(data))
  },
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel)
  }
}

contextBridge.exposeInMainWorld('easyDownloader', api)

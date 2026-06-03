import { contextBridge, ipcRenderer } from 'electron'
import type { EasyDownloaderAPI, DownloadItem, DownloadProgress } from '../types'

export type { EasyDownloaderAPI }

const api: EasyDownloaderAPI = {
  fetchMetadata: (url) => ipcRenderer.invoke('fetch-metadata', url),
  addDownload: (options) => ipcRenderer.invoke('add-download', options),
  addSpotifyDownload: (url) => ipcRenderer.invoke('add-spotify-download', url),
  cancelDownload: (itemId) => ipcRenderer.invoke('cancel-download', itemId),
  cancelAll: () => ipcRenderer.invoke('cancel-all'),
  getQueue: () => ipcRenderer.invoke('get-queue'),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setTheme: (mode) => ipcRenderer.invoke('set-theme', mode),
  checkFfmpeg: () => ipcRenderer.invoke('check-ffmpeg'),
  checkSpotdl: () => ipcRenderer.invoke('check-spotdl'),
  saveQueue: (queue) => ipcRenderer.invoke('save-queue', queue),
  getSavedQueue: () => ipcRenderer.invoke('get-saved-queue'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (_event, data) => callback(data))
  },
  onDownloadComplete: (callback) => {
    ipcRenderer.on('download-complete', (_event, data) => callback(data))
  },
  onDownloadError: (callback) => {
    ipcRenderer.on('download-error', (_event, data) => callback(data))
  },
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel)
  }
}

contextBridge.exposeInMainWorld('easyDownloader', api)

import { contextBridge, ipcRenderer } from 'electron'
import type { EasyDownloaderAPI, DownloadItem, DownloadProgress } from '../types'

export type { EasyDownloaderAPI }

const api: EasyDownloaderAPI = {
  fetchMetadata: (url) => ipcRenderer.invoke('fetch-metadata', url),
  addDownload: (options) => ipcRenderer.invoke('add-download', options),
  cancelDownload: (itemId) => ipcRenderer.invoke('cancel-download', itemId),
  cancelAll: () => ipcRenderer.invoke('cancel-all'),
  getQueue: () => ipcRenderer.invoke('get-queue'),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setTheme: (mode) => ipcRenderer.invoke('set-theme', mode),
  checkFfmpeg: () => ipcRenderer.invoke('check-ffmpeg'),
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

"use strict";
const electron = require("electron");
const api = {
  fetchMetadata: (url) => electron.ipcRenderer.invoke("fetch-metadata", url),
  addDownload: (options) => electron.ipcRenderer.invoke("add-download", options),
  addSpotifyDownload: (url) => electron.ipcRenderer.invoke("add-spotify-download", url),
  cancelDownload: (itemId) => electron.ipcRenderer.invoke("cancel-download", itemId),
  cancelAll: () => electron.ipcRenderer.invoke("cancel-all"),
  pauseAll: () => electron.ipcRenderer.invoke("pause-all"),
  resumeAll: () => electron.ipcRenderer.invoke("resume-all"),
  getQueue: () => electron.ipcRenderer.invoke("get-queue"),
  selectDirectory: () => electron.ipcRenderer.invoke("select-directory"),
  openFolder: (folderPath) => electron.ipcRenderer.invoke("open-folder", folderPath),
  getSettings: () => electron.ipcRenderer.invoke("get-settings"),
  setTheme: (mode) => electron.ipcRenderer.invoke("set-theme", mode),
  setFetchMetadata: (enabled) => electron.ipcRenderer.invoke("set-fetch-metadata", enabled),
  setIncognitoMode: (enabled) => electron.ipcRenderer.invoke("set-incognito-mode", enabled),
  setGlobalPause: (enabled) => electron.ipcRenderer.invoke("set-global-pause", enabled),
  checkFfmpeg: () => electron.ipcRenderer.invoke("check-ffmpeg"),
  checkSpotdl: () => electron.ipcRenderer.invoke("check-spotdl"),
  checkYtdlp: () => electron.ipcRenderer.invoke("check-ytdlp"),
  checkDependencies: () => electron.ipcRenderer.invoke("check-dependencies"),
  saveQueue: (queue) => electron.ipcRenderer.invoke("save-queue", queue),
  getSavedQueue: () => electron.ipcRenderer.invoke("get-saved-queue"),
  checkForUpdates: () => electron.ipcRenderer.invoke("check-for-updates"),
  quitAndInstall: () => electron.ipcRenderer.invoke("quit-and-install"),
  getHistory: () => electron.ipcRenderer.invoke("get-history"),
  addHistoryEntry: (entry) => electron.ipcRenderer.invoke("add-history-entry", entry),
  clearHistory: () => electron.ipcRenderer.invoke("clear-history"),
  onDownloadProgress: (callback) => {
    electron.ipcRenderer.on("download-progress", (_event, data) => callback(data));
  },
  onDownloadComplete: (callback) => {
    electron.ipcRenderer.on("download-complete", (_event, data) => callback(data));
  },
  onDownloadError: (callback) => {
    electron.ipcRenderer.on("download-error", (_event, data) => callback(data));
  },
  removeAllListeners: (channel) => {
    electron.ipcRenderer.removeAllListeners(channel);
  }
};
electron.contextBridge.exposeInMainWorld("easyDownloader", api);

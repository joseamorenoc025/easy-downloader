export interface DownloadItem {
  id: string
  url: string
  title: string
  status: 'queued' | 'downloading' | 'completed' | 'error' | 'cancelled'
  progress: number
  speed: string
  eta: string
  totalBytes: number
  downloadedBytes: number
  format: 'video' | 'audio'
  quality: string
  source: 'youtube' | 'spotify'
  outputPath?: string
  error?: string
  incognito?: boolean
}

export interface FormatInfo {
  id: string
  ext: string
  resolution?: string
  filesize?: number
  format_note?: string
  vcodec?: string
  acodec?: string
  tbr?: number
}

export interface MetadataResult {
  title: string
  duration: number
  uploader?: string
  isPlaylist: boolean
  playlistCount?: number
  thumbnail?: string
  formats?: FormatInfo[]
}

export interface DownloadOptions {
  url: string
  format: 'video' | 'audio'
  quality: string
  outputDir?: string
  playlistFolder?: boolean
}

export interface DownloadProgress {
  id: string
  percentage: string
  speed: string
  eta: string
  downloaded: string
  total: string
}

export interface HistoryEntry {
  id: string
  url: string
  title: string
  format: 'video' | 'audio'
  quality: string
  source: 'youtube' | 'spotify'
  outputPath?: string
  completedAt: string
  fileSize?: number
}

export type ThemeMode = 'light' | 'dark' | 'system'

export interface Settings {
  downloadPath: string
  themeMode: ThemeMode
  fetchMetadata: boolean
  incognitoMode: boolean
  globalPause: boolean // Nuevo: toggle para pausar/reanudar todas las descargas
}

export interface DependencyStatus {
  ffmpeg: boolean
  spotdl: boolean
  ytdlp: boolean
}

export interface EasyDownloaderAPI {
  fetchMetadata: (url: string) => Promise<MetadataResult>
  addDownload: (options: DownloadOptions) => Promise<DownloadItem | null>
  addSpotifyDownload: (url: string) => Promise<DownloadItem[]>
  cancelDownload: (itemId: string) => Promise<void>
  cancelAll: () => Promise<void>
  pauseAll: () => Promise<void> // Nuevo: pausar todas las descargas
  resumeAll: () => Promise<void> // Nuevo: reanudar todas las descargas
  getQueue: () => Promise<DownloadItem[]>
  selectDirectory: () => Promise<string | null>
  openFolder: (folderPath?: string) => Promise<void>
  getSettings: () => Promise<Settings>
  setTheme: (mode: ThemeMode) => Promise<void>
  setFetchMetadata: (enabled: boolean) => Promise<void>
  setIncognitoMode: (enabled: boolean) => Promise<void>
  setGlobalPause: (enabled: boolean) => Promise<void> // Nuevo: toggle global pause
  checkFfmpeg: () => Promise<boolean>
  checkSpotdl: () => Promise<boolean>
  checkYtdlp: () => Promise<boolean>
  checkDependencies: () => Promise<DependencyStatus>
  saveQueue: (queue: Array<{ url: string; format: string; quality: string; source: string }>) => Promise<void>
  getSavedQueue: () => Promise<Array<{ url: string; format: string; quality: string; source: string }>>
  checkForUpdates: () => Promise<{ updateInfo: { version: string } } | null>
  quitAndInstall: () => Promise<void>
  getHistory: () => Promise<HistoryEntry[]>
  addHistoryEntry: (entry: HistoryEntry) => Promise<void>
  clearHistory: () => Promise<void>
  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => void
  onDownloadComplete: (callback: (item: DownloadItem) => void) => void
  onDownloadError: (callback: (data: { itemId: string; error: string }) => void) => void
  onSpotifyTrackError: (callback: (data: { itemId: string; trackTitle: string }) => void) => void
  removeAllListeners: (channel: string) => void
}

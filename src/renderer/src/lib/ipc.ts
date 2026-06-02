import type { EasyDownloaderAPI } from '@/types'

declare global {
  interface Window {
    easyDownloader: EasyDownloaderAPI
  }
}

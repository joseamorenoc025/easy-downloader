import { useState, useEffect, useCallback, useRef } from 'react'
import type { DownloadItem, DownloadOptions } from '@/types'
import { parseBytes } from '../lib/utils'
import '../lib/ipc'

function saveToStorage(queue: DownloadItem[]): void {
  const pending = queue
    .filter((i) => i.status === 'queued' || i.status === 'downloading')
    .map((i) => ({ url: i.url, format: i.format, quality: i.quality, source: i.source }))
  window.easyDownloader.saveQueue(pending)
}

export function useDownloads() {
  const [queue, setQueue] = useState<DownloadItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const queueRef = useRef(queue)

  useEffect(() => {
    queueRef.current = queue
  }, [queue])

  useEffect(() => {
    // Track liveness so async work after the component unmounts doesn't
    // touch state (avoids React 18 dev warnings on fast HMR / tests).
    let isMounted = true

    window.easyDownloader.getQueue().then((q) => {
      if (isMounted) setQueue(q)
    })

    // Restore saved queue on startup. Run sequentially so addDownload / addSpotifyDownload
    // resolve in a stable order; clear the saved queue at the end so we don't
    // re-add the same items on every mount.
    window.easyDownloader.getSavedQueue().then(async (saved) => {
      if (!isMounted || !saved || saved.length === 0) return
      // Clear saved queue first to prevent re-adding on next mount
      try {
        await window.easyDownloader.saveQueue([])
      } catch {
        // ignore
      }
      try {
        for (const item of saved) {
          if (!isMounted) return
          try {
            if (item.source === 'spotify') {
              await window.easyDownloader.addSpotifyDownload(item.url)
            } else {
              await window.easyDownloader.addDownload({
                url: item.url,
                format: item.format as 'video' | 'audio',
                quality: item.quality
              })
            }
          } catch (err) {
            console.error('Failed to restore queue item:', item.url, err)
          }
        }
      } catch (err) {
        console.error('Saved queue restore failed:', err)
      }
    })

    window.easyDownloader.onDownloadProgress((progress) => {
      setQueue((prev) =>
        prev.map((item) =>
          item.id === progress.id
            ? {
                ...item,
                progress: parseFloat(progress.percentage),
                speed: progress.speed,
                eta: progress.eta,
                downloadedBytes: parseBytes(progress.downloaded),
                totalBytes: parseBytes(progress.total)
              }
            : item
        )
      )
    })

    window.easyDownloader.onDownloadComplete((item) => {
      setQueue((prev) => {
        const exists = prev.find((i) => i.id === item.id)
        if (!exists) return prev
        const updated = prev.map((i) => (i.id === item.id ? item : i))
        saveToStorage(updated)
        return updated
      })
    })

    window.easyDownloader.onDownloadError(({ itemId, error, category, details }) => {
      setQueue((prev) => {
        const updated = prev.map((item) =>
          item.id === itemId
            ? { ...item, status: 'error', error, errorCategory: category, errorDetails: details }
            : item
        )
        saveToStorage(updated)
        return updated
      })
    })

    return () => {
      isMounted = false
      window.easyDownloader.removeAllListeners('download-progress')
      window.easyDownloader.removeAllListeners('download-complete')
      window.easyDownloader.removeAllListeners('download-error')
    }
  }, [])

  const addDownload = useCallback(async (options: DownloadOptions) => {
    setIsLoading(true)
    try {
      const item = await window.easyDownloader.addDownload(options)
      if (item) {
        setQueue((prev) => [...prev, item])
      }
      return item
    } finally {
      setIsLoading(false)
    }
  }, [])

  const addSpotifyDownload = useCallback(async (url: string, quality?: string) => {
    setIsLoading(true)
    try {
      const items = await window.easyDownloader.addSpotifyDownload(url, quality)
      if (items && items.length > 0) {
        setQueue((prev) => [...prev, ...items])
      }
      return items
    } finally {
      setIsLoading(false)
    }
  }, [])

  const cancelDownload = useCallback(async (itemId: string) => {
    await window.easyDownloader.cancelDownload(itemId)
    setQueue((prev) => prev.filter((i) => i.id !== itemId))
  }, [])

  const cancelAll = useCallback(async () => {
    await window.easyDownloader.cancelAll()
    setQueue([])
  }, [])

  const openFolder = useCallback(async (item?: DownloadItem) => {
    await window.easyDownloader.openFolder(item?.outputPath)
  }, [])

  return {
    queue,
    isLoading,
    addDownload,
    addSpotifyDownload,
    cancelDownload,
    cancelAll,
    openFolder
  }
}

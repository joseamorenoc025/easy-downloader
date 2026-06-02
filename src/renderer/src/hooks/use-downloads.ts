import { useState, useEffect, useCallback, useRef } from 'react'
import type { DownloadItem, DownloadOptions } from '@/types'
import '../lib/ipc'

export function useDownloads() {
  const [queue, setQueue] = useState<DownloadItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const queueRef = useRef(queue)

  useEffect(() => {
    queueRef.current = queue
  }, [queue])

  useEffect(() => {
    window.easyDownloader.getQueue().then(setQueue)

    window.easyDownloader.onDownloadProgress((progress) => {
      setQueue(prev =>
        prev.map(item =>
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
      setQueue(prev => {
        const exists = prev.find(i => i.id === item.id)
        if (!exists) return prev
        return prev.map(i => (i.id === item.id ? item : i))
      })
    })

    window.easyDownloader.onDownloadError(({ itemId, error }) => {
      setQueue(prev =>
        prev.map(item =>
          item.id === itemId ? { ...item, status: 'error', error } : item
        )
      )
    })

    return () => {
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
        setQueue(prev => [...prev, item])
      }
      return item
    } finally {
      setIsLoading(false)
    }
  }, [])

  const cancelDownload = useCallback(async (itemId: string) => {
    await window.easyDownloader.cancelDownload(itemId)
    setQueue(prev => prev.filter(i => i.id !== itemId))
  }, [])

  const cancelAll = useCallback(async () => {
    await window.easyDownloader.cancelAll()
    setQueue([])
  }, [])

  return { queue, isLoading, addDownload, cancelDownload, cancelAll }
}

function parseBytes(str: string): number {
  const match = str.match(/^([\d.]+)\s*(B|KB|MB|GB|TB)/)
  if (!match) return 0
  const val = parseFloat(match[1])
  const unit = match[2]
  switch (unit) {
    case 'TB': return val * 1024 * 1024 * 1024 * 1024
    case 'GB': return val * 1024 * 1024 * 1024
    case 'MB': return val * 1024 * 1024
    case 'KB': return val * 1024
    default: return val
  }
}

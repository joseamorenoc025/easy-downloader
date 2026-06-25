import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Parses yt-dlp-style byte strings like "2.4 MB", "15.30MiB", "~1.2 GB" into a raw byte count.
 * Returns 0 for unparseable input. Handles both SI (KB/MB/GB) and binary (KiB/MiB/GiB) prefixes.
 */
export function parseBytes(str: string): number {
  const match = str.match(/([\d.]+)\s*(B|KB|MB|GB|TB|KiB|MiB|GiB|TiB)/i)
  if (!match) return 0
  const val = parseFloat(match[1])
  const unit = match[2].toLowerCase()
  switch (unit) {
    case 'tb':
    case 'tib':
      return val * 1024 * 1024 * 1024 * 1024
    case 'gb':
    case 'gib':
      return val * 1024 * 1024 * 1024
    case 'mb':
    case 'mib':
      return val * 1024 * 1024
    case 'kb':
    case 'kib':
      return val * 1024
    case 'b':
      return val
    default:
      return 0
  }
}

export type DetectedSource = 'youtube' | 'spotify' | 'other'

const SPOTIFY_DOMAINS = ['open.spotify.com', 'spotify.com']
const YOUTUBE_DOMAINS = ['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com']

export function detectSource(url: string): DetectedSource {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    if (SPOTIFY_DOMAINS.some((d) => hostname === d || hostname.endsWith('.' + d))) return 'spotify'
    if (YOUTUBE_DOMAINS.some((d) => hostname === d || hostname.endsWith('.' + d))) return 'youtube'
    return 'other'
  } catch {
    return 'youtube'
  }
}

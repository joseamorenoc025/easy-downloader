import { execSync } from 'child_process'
import { join } from 'path'
import { app } from 'electron'
import { existsSync } from 'fs'

let cachedFfmpegPath: string | null = null

function findBundledFfmpeg(): string | null {
  if (cachedFfmpegPath) return cachedFfmpegPath

  if (app.isPackaged) {
    const ext = process.platform === 'win32' ? '.exe' : ''
    const resourcePath = join(process.resourcesPath, 'ffmpeg', `ffmpeg${ext}`)
    if (existsSync(resourcePath)) {
      cachedFfmpegPath = resourcePath
      return resourcePath
    }
  } else {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
      if (ffmpegPath && existsSync(ffmpegPath)) {
        cachedFfmpegPath = ffmpegPath
        return ffmpegPath
      }
    } catch {
      // Package not available
    }
  }

  return null
}

export function getFfmpegPath(): string {
  return findBundledFfmpeg() || 'ffmpeg'
}

export function checkFfmpegInstalled(): boolean {
  const ffmpegPath = findBundledFfmpeg()
  if (ffmpegPath) return true

  try {
    execSync('ffmpeg -version', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}
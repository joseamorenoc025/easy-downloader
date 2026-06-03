import { execSync } from 'child_process'
import { join } from 'path'
import { app } from 'electron'
import { existsSync } from 'fs'

let bundledFfmpegPath: string | null = null

function getBundledFfmpegPath(): string | null {
  if (bundledFfmpegPath) return bundledFfmpegPath

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
    if (ffmpegPath && existsSync(ffmpegPath)) {
      bundledFfmpegPath = ffmpegPath
      return ffmpegPath
    }
  } catch {
    // Package not available
  }

  // Check in app resources
  const resourcePath = app.isPackaged
    ? join(process.resourcesPath, 'ffmpeg')
    : join(__dirname, '../../../resources/ffmpeg')

  const ext = process.platform === 'win32' ? '.exe' : ''
  const fullPath = resourcePath + ext

  if (existsSync(fullPath)) {
    bundledFfmpegPath = fullPath
    return fullPath
  }

  return null
}

export function getFfmpegPath(): string {
  return getBundledFfmpegPath() || 'ffmpeg'
}

export function checkFfmpegInstalled(): boolean {
  const ffmpegPath = getBundledFfmpegPath()
  if (ffmpegPath) return true

  try {
    execSync('ffmpeg -version', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

import { execSync } from 'child_process'

export function checkFfmpegInstalled(): boolean {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

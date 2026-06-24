const { default: YtDlpWrap } = require('yt-dlp-wrap')
import { join } from 'path'
import { app } from 'electron'
import { execSync } from 'child_process'

export class YtDlpUpdater {
  private lastCheck: number = 0
  private isUpdating = false

  async checkAndUpdate(): Promise<void> {
    const now = Date.now()
    if (now - this.lastCheck < 24 * 60 * 60 * 1000) return
    if (this.isUpdating) return
    this.isUpdating = true
    this.lastCheck = now

    try {
      const currentVersion = this.getVersion()
      if (!currentVersion) {
        console.log('[yt-dlp] No binary found, downloading...')
        await this.downloadStandalone()
        return
      }

      const latestVersion = await this.getLatestVersion()
      if (!latestVersion) {
        console.log('[yt-dlp] Could not fetch latest version')
        return
      }

      if (currentVersion === latestVersion) {
        console.log(`[yt-dlp] Already up to date (${currentVersion})`)
        return
      }

      console.log(`[yt-dlp] Updating ${currentVersion} -> ${latestVersion}...`)

      if (this.isPipInstalled()) {
        await this.updateViaPip()
      } else {
        await this.downloadStandalone()
      }

      const newVersion = this.getVersion()
      console.log(`[yt-dlp] Updated to ${newVersion}`)
    } catch (err) {
      console.error('[yt-dlp] Update failed:', err)
    } finally {
      this.isUpdating = false
    }
  }

  private getVersion(): string | null {
    try {
      const isWin = process.platform === 'win32'
      const binaryName = isWin ? 'yt-dlp.exe' : 'yt-dlp'
      const binaryPath = join(app.getPath('userData'), binaryName)
      return execSync(`"${binaryPath}" --version`, { stdio: 'pipe', timeout: 10000 })
        .toString()
        .trim()
    } catch {
      return null
    }
  }

  private async getLatestVersion(): Promise<string | null> {
    try {
      const releases = await YtDlpWrap.getGithubReleases('yt-dlp', 'yt-dlp', 1)
      if (releases && releases.length > 0) {
        return releases[0].tag_name?.replace(/^v/, '') || null
      }
    } catch {
      // fallback
    }

    try {
      const pipOutput = execSync('pip index versions yt-dlp', {
        stdio: 'pipe',
        timeout: 15000
      }).toString()
      const match = pipOutput.match(/yt-dlp\s+\(([^)]+)\)/)
      if (match) return match[1]
    } catch {
      // fallback
    }

    return null
  }

  private isPipInstalled(): boolean {
    try {
      execSync('pip show yt-dlp', { stdio: 'ignore', timeout: 5000 })
      return true
    } catch {
      return false
    }
  }

  private async updateViaPip(): Promise<void> {
    console.log('[yt-dlp] Updating via pip...')
    execSync('pip install -U yt-dlp', { stdio: 'pipe', timeout: 120000 })
  }

  private async downloadStandalone(): Promise<void> {
    const isWin = process.platform === 'win32'
    const binaryName = isWin ? 'yt-dlp.exe' : 'yt-dlp'
    const binaryPath = join(app.getPath('userData'), binaryName)
    await YtDlpWrap.downloadFromGithub(binaryPath)
  }
}

/**
 * Shared URL validation helper.
 *
 * Used by IPC handlers in `src/main/index.ts` and by `DownloadManager`
 * (`src/main/downloader/manager.ts`) to defend against SSRF / command injection
 * by ensuring only `http:` and `https:` URLs reach yt-dlp / spotdl / fetchMetadata.
 *
 * Defense-in-depth: even when the renderer passes a string that looks safe,
 * we re-validate here. A future XSS in the renderer must not be able to push
 * `file://`, `javascript:`, `ms-settings:`, `data:` etc. into the downloaders.
 */

export function isValidHttpUrl(url: unknown): url is string {
  if (typeof url !== 'string' || url.length === 0) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

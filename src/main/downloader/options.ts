import type { DownloadOptions } from '../../src/types'

const VIDEO_FORMAT_MAP: Record<string, string> = {
  'best': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
  '1080p': 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best',
  '720p': 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best',
  '480p': 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best'
}

const AUDIO_FORMAT_MAP: Record<string, string> = {
  '320': 'bestaudio[abr<=320]/bestaudio',
  '256': 'bestaudio[abr<=256]/bestaudio',
  '192': 'bestaudio[abr<=192]/bestaudio',
  '128': 'bestaudio[abr<=128]/bestaudio'
}

export function buildDownloadOptions(
  options: DownloadOptions
): Record<string, unknown> {
  const isAudio = options.format === 'audio'
  const formatMap = isAudio ? AUDIO_FORMAT_MAP : VIDEO_FORMAT_MAP
  const formatStr = formatMap[options.quality] || formatMap['best']

  const ytDlpOptions: Record<string, unknown> = {
    format: formatStr,
    outtmpl: `${options.outputDir || 'downloads'}/%(title)s.%(ext)s`,
    progress_hooks: [],
    quiet: true,
    no_warnings: true,
    embed_thumbnail: isAudio,
    embed_metadata: true
  }

  if (isAudio) {
    ytDlpOptions.postprocessors = [
      {
        key: 'FFmpegExtractAudio',
        preferredcodec: 'mp3',
        preferredquality: options.quality
      }
    ]
  }

  return ytDlpOptions
}

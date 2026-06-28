export interface ConversionPreset {
  id: string
  name: string
  description: string
  format: 'video' | 'audio'
  quality: string
  containerFormat?: 'mp4' | 'mkv' | 'webm'
  audioFormat?: 'mp3' | 'aac' | 'flac' | 'opus' | 'wav' | 'm4a'
  extraArgs: string[]
}

export const CONVERSION_PRESETS: ConversionPreset[] = [
  {
    id: 'music',
    name: 'Music',
    description: 'Balanced quality for music (256 kbps)',
    format: 'audio',
    quality: '256',
    extraArgs: ['--embed-thumbnail', '--add-metadata']
  },
  {
    id: 'podcast',
    name: 'Podcast',
    description: 'Optimized for speech (192 kbps, mono)',
    format: 'audio',
    quality: '192',
    extraArgs: ['--embed-thumbnail', '--add-metadata', '--audio-channels', '1']
  },
  {
    id: 'archival',
    name: 'Archival',
    description: 'Lossless quality for archiving (FLAC)',
    format: 'audio',
    quality: '320',
    audioFormat: 'flac',
    extraArgs: ['--embed-thumbnail', '--add-metadata']
  },
  {
    id: 'social',
    name: 'Social Media',
    description: 'Small file size for sharing (128 kbps)',
    format: 'audio',
    quality: '128',
    extraArgs: ['--embed-thumbnail', '--add-metadata']
  },
  {
    id: 'video-hd',
    name: 'Video HD',
    description: 'Full HD video (1080p)',
    format: 'video',
    quality: '1080p',
    extraArgs: ['--write-subs', '--sub-langs', 'en,es', '--embed-subs']
  },
  {
    id: 'video-sd',
    name: 'Video SD',
    description: 'Standard definition for small screens (480p)',
    format: 'video',
    quality: '480p',
    extraArgs: ['--write-subs', '--sub-langs', 'en,es', '--embed-subs']
  }
]

export function getPresetById(id: string): ConversionPreset | undefined {
  return CONVERSION_PRESETS.find((p) => p.id === id)
}

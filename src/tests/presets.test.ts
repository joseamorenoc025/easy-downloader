import { describe, it, expect } from 'vitest'
import { CONVERSION_PRESETS, getPresetById } from '../renderer/src/lib/presets'

describe('Conversion presets', () => {
  it('should have 6 presets', () => {
    expect(CONVERSION_PRESETS).toHaveLength(6)
  })

  it('all presets should have required fields', () => {
    for (const p of CONVERSION_PRESETS) {
      expect(p.id).toBeTruthy()
      expect(p.name).toBeTruthy()
      expect(p.description).toBeTruthy()
      expect(['video', 'audio']).toContain(p.format)
      expect(p.quality).toBeTruthy()
      expect(Array.isArray(p.extraArgs)).toBe(true)
    }
  })

  it('audio presets should include metadata flags', () => {
    const audioPresets = CONVERSION_PRESETS.filter((p) => p.format === 'audio')
    for (const p of audioPresets) {
      expect(p.extraArgs).toContain('--embed-thumbnail')
      expect(p.extraArgs).toContain('--add-metadata')
    }
  })

  it('video presets should include subtitle flags', () => {
    const videoPresets = CONVERSION_PRESETS.filter((p) => p.format === 'video')
    for (const p of videoPresets) {
      expect(p.extraArgs).toContain('--write-subs')
      expect(p.extraArgs).toContain('--embed-subs')
    }
  })

  it('getPresetById returns correct preset', () => {
    expect(getPresetById('music')).toBeDefined()
    expect(getPresetById('music')!.format).toBe('audio')
    expect(getPresetById('music')!.quality).toBe('256')
    expect(getPresetById('podcast')!.quality).toBe('192')
    expect(getPresetById('archival')!.quality).toBe('320')
    expect(getPresetById('social')!.quality).toBe('128')
    expect(getPresetById('video-hd')!.quality).toBe('1080p')
    expect(getPresetById('video-sd')!.quality).toBe('480p')
  })

  it('getPresetById returns undefined for unknown id', () => {
    expect(getPresetById('nonexistent')).toBeUndefined()
  })

  it('preset ids are unique', () => {
    const ids = CONVERSION_PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

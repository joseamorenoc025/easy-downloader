import { describe, it, expect } from 'vitest'
import { classifyYtDlpError } from '../main/downloader/error-parser'

describe('classifyYtDlpError', () => {
  describe('sign-in / age verification', () => {
    it('detects sign-in confirmation', () => {
      expect(classifyYtDlpError("Sign in to confirm you're not a bot").category).toBe('signIn')
    })

    it('detects age confirmation', () => {
      expect(classifyYtDlpError('Please confirm your age to continue').category).toBe('signIn')
    })

    it('detects bot check', () => {
      expect(classifyYtDlpError('not a bot verification required').category).toBe('signIn')
    })
  })

  describe('unavailable videos', () => {
    it('detects video unavailable', () => {
      expect(classifyYtDlpError('ERROR: Video unavailable').category).toBe('unavailable')
    })

    it('detects private video', () => {
      expect(classifyYtDlpError('Private video').category).toBe('unavailable')
    })

    it('detects region-locked via 403', () => {
      expect(classifyYtDlpError('HTTP Error 403: Forbidden').category).toBe('unavailable')
    })

    it('detects removed video', () => {
      expect(classifyYtDlpError('This video has been removed by the uploader').category).toBe(
        'unavailable'
      )
    })
  })

  describe('network errors', () => {
    it('detects DNS failure', () => {
      expect(classifyYtDlpError('getaddrinfo ENOTFOUND youtube.com').category).toBe('network')
    })

    it('detects connection reset', () => {
      expect(classifyYtDlpError('read ECONNRESET').category).toBe('network')
    })

    it('detects socket timeout', () => {
      expect(classifyYtDlpError('socket timeout').category).toBe('network')
    })

    it('detects read timeout', () => {
      expect(classifyYtDlpError('read timed out').category).toBe('network')
    })

    it('detects unreachable network', () => {
      expect(classifyYtDlpError('Network is unreachable').category).toBe('network')
    })

    it('detects connection refused', () => {
      expect(classifyYtDlpError('Connection refused').category).toBe('network')
    })
  })

  describe('disk full', () => {
    it('detects no space left', () => {
      expect(classifyYtDlpError('No space left on device').category).toBe('diskFull')
    })

    it('detects ENOSPC', () => {
      expect(classifyYtDlpError('ENOSPC: no space left on device').category).toBe('diskFull')
    })
  })

  describe('permission denied', () => {
    it('detects permission denied', () => {
      expect(classifyYtDlpError('Permission denied').category).toBe('permission')
    })

    it('detects EACCES', () => {
      expect(classifyYtDlpError('EACCES: permission denied, open /tmp/foo.mp4').category).toBe(
        'permission'
      )
    })
  })

  describe('format not available', () => {
    it('detects requested format not available', () => {
      expect(classifyYtDlpError('Requested format not available').category).toBe('format')
    })

    it('detects no video formats', () => {
      expect(classifyYtDlpError('No video formats found').category).toBe('format')
    })
  })

  describe('unsupported URLs', () => {
    it('detects unsupported URL', () => {
      expect(classifyYtDlpError('Unsupported URL: https://example.com/foo').category).toBe(
        'unsupported'
      )
    })

    it('detects no extractor', () => {
      expect(classifyYtDlpError('No extractor for this URL').category).toBe('unsupported')
    })
  })

  describe('binary issues', () => {
    it('detects missing yt-dlp binary', () => {
      expect(classifyYtDlpError('No such file or directory: yt-dlp').category).toBe('binary')
    })
  })

  describe('fallback', () => {
    it('returns unknown for unrecognized errors', () => {
      expect(classifyYtDlpError('Some weird new error we have not seen').category).toBe('unknown')
    })

    it('handles empty stderr', () => {
      expect(classifyYtDlpError('').category).toBe('unknown')
    })

    it('is case-insensitive', () => {
      expect(classifyYtDlpError('SIGN IN TO CONFIRM').category).toBe('signIn')
      expect(classifyYtDlpError('VIDEO UNAVAILABLE').category).toBe('unavailable')
      expect(classifyYtDlpError('GETADDRINFO ENOTFOUND').category).toBe('network')
    })
  })

  describe('preserves raw and exitCode', () => {
    it('keeps the original stderr untouched', () => {
      const r = classifyYtDlpError('Sign in to confirm your age', 1)
      expect(r.raw).toBe('Sign in to confirm your age')
      expect(r.exitCode).toBe(1)
    })

    it('handles missing exitCode', () => {
      const r = classifyYtDlpError('Video unavailable')
      expect(r.exitCode).toBeUndefined()
    })
  })

  describe('ordering specificity', () => {
    it('sign-in wins over generic unavailable wording', () => {
      // "not available" alone would be unavailable, but sign-in markers take precedence
      expect(classifyYtDlpError('Video not available, please sign in to confirm').category).toBe(
        'signIn'
      )
    })
  })
})

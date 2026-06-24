import { test, expect } from './fixtures/electron-fixture'

test.describe('IPC Communication', () => {
  test('app version is accessible from main process', async ({ electronApp }) => {
    const version = await electronApp.evaluate(async ({ app }) => {
      return app.getVersion()
    })

    expect(version).toBeTruthy()
    expect(typeof version).toBe('string')
  })

  test('dependency check responds', async ({ window }) => {
    const result = await window.evaluate(async () => {
      return await window.easyDownloader.checkDependencies()
    })

    expect(result).toHaveProperty('ffmpeg')
    expect(result).toHaveProperty('ytdlp')
    expect(typeof result.ffmpeg).toBe('boolean')
    expect(typeof result.ytdlp).toBe('boolean')
  })

  test('get settings returns valid object', async ({ window }) => {
    const settings = await window.evaluate(async () => {
      return await window.easyDownloader.getSettings()
    })

    expect(settings).toHaveProperty('downloadPath')
    expect(settings).toHaveProperty('themeMode')
    expect(settings).toHaveProperty('fetchMetadata')
    expect(settings).toHaveProperty('incognitoMode')
  })

  test('get history returns array', async ({ window }) => {
    const history = await window.evaluate(async () => {
      return await window.easyDownloader.getHistory()
    })

    expect(Array.isArray(history)).toBe(true)
  })

  test('get queue returns array', async ({ window }) => {
    const queue = await window.evaluate(async () => {
      return await window.easyDownloader.getQueue()
    })

    expect(Array.isArray(queue)).toBe(true)
  })

  test('set theme persists', async ({ window }) => {
    await window.evaluate(async () => {
      await window.easyDownloader.setTheme('dark')
    })

    const settings = await window.evaluate(async () => {
      return await window.easyDownloader.getSettings()
    })

    expect(settings.themeMode).toBe('dark')
  })

  test('set incognito mode persists', async ({ window }) => {
    await window.evaluate(async () => {
      await window.easyDownloader.setIncognitoMode(true)
    })

    const settings = await window.evaluate(async () => {
      return await window.easyDownloader.getSettings()
    })

    expect(settings.incognitoMode).toBe(true)
  })
})

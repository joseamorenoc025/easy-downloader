import { test, expect } from './fixtures/electron-fixture'

test.describe('App Launch', () => {
  test('window opens and is visible', async ({ window }) => {
    const title = await window.title()
    expect(title).toContain('EasyDownloader')
  })

  test('main UI elements are rendered', async ({ window }) => {
    const header = window.locator('header')
    await expect(header).toBeVisible()

    const footer = window.locator('footer')
    await expect(footer).toBeVisible()

    const urlInput = window.getByRole('textbox')
    await expect(urlInput).toBeVisible()
  })

  test('version is displayed in footer', async ({ window }) => {
    const versionText = window.locator('footer').getByText(/v\d+\.\d+\.\d+/)
    await expect(versionText).toBeVisible()
  })

  test('download form has source toggles', async ({ window }) => {
    const youtubeBtn = window.getByRole('radio', { name: /youtube/i })
    const spotifyBtn = window.getByRole('radio', { name: /spotify/i })

    await expect(youtubeBtn).toBeVisible()
    await expect(spotifyBtn).toBeVisible()
    await expect(youtubeBtn).toHaveAttribute('aria-checked', 'true')
  })

  test('queue/history tabs are present', async ({ window }) => {
    const queueTab = window.locator('button[role="tab"]').filter({ hasText: /queue|cola/i })
    const historyTab = window
      .locator('button[role="tab"]')
      .filter({ hasText: /history|historial/i })

    await expect(queueTab).toBeVisible()
    await expect(historyTab).toBeVisible()
    await expect(queueTab).toHaveAttribute('aria-selected', 'true')
  })

  test('app version in footer matches package.json', async ({ electronApp, window }) => {
    const appVersion = await electronApp.evaluate(async ({ app }) => {
      return app.getVersion()
    })

    const versionText = window.locator('footer').getByText(`v${appVersion}`)
    await expect(versionText).toBeVisible()
  })
})

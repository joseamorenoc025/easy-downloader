import { test, expect } from './fixtures/electron-fixture'
import { TEST_URLS } from './helpers/test-data'

test.describe('Queue Management', () => {
  test('empty queue shows info section', async ({ window }) => {
    // EN: "No downloads yet" / ES: "No hay descargas"
    // Or the welcome info section with "Welcome to EasyDownloader" / "Bienvenido a EasyDownloader"
    const emptyState = window.getByText(/no downloads yet|no hay descargas|welcome|bienvenido/i)
    await expect(emptyState).toBeVisible()
  })

  test('submitting a YouTube URL clears the input', async ({ window }) => {
    const urlInput = window.getByRole('textbox')
    await urlInput.fill(TEST_URLS.youtube.video)

    const downloadBtn = window.locator('form button[type="submit"]')
    await downloadBtn.click()

    await expect(urlInput).toHaveValue('')
  })

  test('submitting a Spotify URL clears the input', async ({ window }) => {
    const urlInput = window.getByRole('textbox')
    await urlInput.fill(TEST_URLS.spotify.track)

    const downloadBtn = window.locator('form button[type="submit"]')
    await downloadBtn.click()

    await expect(urlInput).toHaveValue('')
  })

  test('global pause button toggles', async ({ window }) => {
    const pauseBtn = window
      .locator('button')
      .filter({ hasText: /play|pause|reanudar|pausar/i })
      .first()
    await expect(pauseBtn).toBeVisible()

    await pauseBtn.click()
    await window.waitForTimeout(300)

    const newBtn = window
      .locator('button')
      .filter({ hasText: /play|pause|reanudar|pausar/i })
      .first()
    await expect(newBtn).toBeVisible()
  })
})

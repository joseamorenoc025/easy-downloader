import { test, expect } from './fixtures/electron-fixture'
import { TEST_URLS } from './helpers/test-data'

test.describe('Download Form', () => {
  test('URL input accepts text', async ({ window }) => {
    const urlInput = window.getByRole('textbox')
    await urlInput.fill(TEST_URLS.youtube.video)
    await expect(urlInput).toHaveValue(TEST_URLS.youtube.video)
  })

  test('URL input shows placeholder for YouTube', async ({ window }) => {
    const urlInput = window.getByRole('textbox')
    await expect(urlInput).toHaveAttribute('placeholder', /youtube/i)
  })

  test('source toggle switches between YouTube and Spotify', async ({ window }) => {
    const youtubeBtn = window.locator('button[role="radio"]').filter({ hasText: /youtube/i })
    const spotifyBtn = window.locator('button[role="radio"]').filter({ hasText: /spotify/i })

    await expect(youtubeBtn).toHaveAttribute('aria-checked', 'true')
    await expect(spotifyBtn).toHaveAttribute('aria-checked', 'false')

    await spotifyBtn.click()

    await expect(spotifyBtn).toHaveAttribute('aria-checked', 'true')
    await expect(youtubeBtn).toHaveAttribute('aria-checked', 'false')
  })

  test('format toggle shows for YouTube only', async ({ window }) => {
    const videoBtn = window.locator('button[role="radio"]').filter({ hasText: /^video$/i })
    const audioBtn = window.locator('button[role="radio"]').filter({ hasText: /^audio$/i })

    await expect(videoBtn).toBeVisible()
    await expect(audioBtn).toBeVisible()

    const spotifyBtn = window.locator('button[role="radio"]').filter({ hasText: /spotify/i })
    await spotifyBtn.click()

    await expect(videoBtn).not.toBeVisible()
    await expect(audioBtn).not.toBeVisible()
  })

  test('quality selector changes with format', async ({ window }) => {
    // Default is YouTube video mode - the select has aria-label for resolution
    // Works in both EN ("Resolution") and ES ("Resolución")
    const videoSelect = window.locator('select').first()
    await expect(videoSelect).toBeVisible()

    // Switch to audio format
    const audioBtn = window.locator('button[role="radio"]').filter({ hasText: /^audio$/i })
    await audioBtn.click()

    // Now should still have a select visible (bitrate)
    const bitrateSelect = window.locator('select').first()
    await expect(bitrateSelect).toBeVisible()
  })

  test('invalid URL shows error when submitted', async ({ window }) => {
    const urlInput = window.getByRole('textbox')
    await urlInput.fill('not-a-valid-url')

    // The download button should be enabled since URL field is non-empty
    const submitBtn = window.locator('form button[type="submit"]')
    await expect(submitBtn).toBeEnabled()

    await submitBtn.click()

    // Error message: "Invalid URL format" (EN) or "Formato de URL inválido" (ES)
    const error = window.getByText(/invalid.*url|formato.*url/i)
    await expect(error).toBeVisible()
  })

  test('download button is disabled when URL is empty', async ({ window }) => {
    const submitBtn = window.locator('form button[type="submit"]')
    await expect(submitBtn).toBeDisabled()
  })

  test('download button is enabled when URL is entered', async ({ window }) => {
    const urlInput = window.getByRole('textbox')
    await urlInput.fill(TEST_URLS.youtube.video)

    const submitBtn = window.locator('form button[type="submit"]')
    await expect(submitBtn).toBeEnabled()
  })

  test('form clears after successful submission', async ({ window }) => {
    const urlInput = window.getByRole('textbox')
    await urlInput.fill(TEST_URLS.youtube.video)

    const submitBtn = window.locator('form button[type="submit"]')
    await submitBtn.click()

    await expect(urlInput).toHaveValue('')
  })
})

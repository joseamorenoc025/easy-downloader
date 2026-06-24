import { test, expect } from './fixtures/electron-fixture'

test.describe('Settings', () => {
  test('theme toggle has three buttons', async ({ window }) => {
    const themeContainer = window.locator('.flex.items-center.gap-1.rounded-lg.border')
    const buttons = themeContainer.locator('button')
    await expect(buttons).toHaveCount(3)
  })

  test('theme toggle buttons are clickable', async ({ window }) => {
    const darkBtn = window.locator('button').filter({ hasText: '🌙' })
    await expect(darkBtn).toBeVisible()

    await darkBtn.click()
    await window.waitForTimeout(300)

    // Dark mode should add 'dark' class to html
    const htmlClass = await window.locator('html').getAttribute('class')
    expect(htmlClass).toContain('dark')
  })

  test('language toggle switches between EN and ES', async ({ window }) => {
    // The language button shows "EN" when locale is 'es', and "ES" when locale is 'en'
    const langBtn = window.locator('header button').filter({ hasText: /^(EN|ES)$/ })
    await expect(langBtn).toBeVisible()

    const initialText = await langBtn.textContent()
    await langBtn.click()

    const newText = await langBtn.textContent()
    expect(newText).not.toBe(initialText)
  })

  test('incognito toggle changes state on click', async ({ window }) => {
    const incognitoBtn = window
      .locator('header button')
      .filter({ hasText: /incognito/i })
      .first()
    await expect(incognitoBtn).toBeVisible()

    const initialClass = await incognitoBtn.getAttribute('class')
    await incognitoBtn.click()
    await window.waitForTimeout(300)

    const newClass = await incognitoBtn.getAttribute('class')
    // Class should change after clicking (toggles between active/inactive states)
    expect(newClass).not.toBe(initialClass)
  })

  test('metadata toggle changes state on click', async ({ window }) => {
    const metadataBtn = window.locator('header button').filter({ hasText: /meta/i }).first()
    await expect(metadataBtn).toBeVisible()

    const initialClass = await metadataBtn.getAttribute('class')
    await metadataBtn.click()
    await window.waitForTimeout(300)

    const newClass = await metadataBtn.getAttribute('class')
    // Class should change after clicking (toggles between active/inactive states)
    expect(newClass).not.toBe(initialClass)
  })
})

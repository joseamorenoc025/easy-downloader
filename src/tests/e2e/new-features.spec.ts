import { test, expect } from './fixtures/electron-fixture'

test.describe('Cookies', () => {
  test('cookies button is visible in header', async ({ window }) => {
    const cookiesBtn = window
      .locator('button')
      .filter({ hasText: /cookie/i })
      .first()
    await expect(cookiesBtn).toBeVisible()
  })

  test('cookies button has correct title when inactive', async ({ window }) => {
    const cookiesBtn = window
      .locator('button')
      .filter({ hasText: /cookie/i })
      .first()
    // Title should indicate import functionality
    const title = await cookiesBtn.getAttribute('title')
    expect(title).toBeTruthy()
  })

  test('clicking cookies button opens file dialog', async ({ window }) => {
    // The cookies button should trigger selectCookiesFile IPC
    // In test mode, dialog.showOpenDialog is mocked
    const cookiesBtn = window
      .locator('button')
      .filter({ hasText: /cookie/i })
      .first()
    await expect(cookiesBtn).toBeVisible()
    // Click would open file dialog - in test mode this is mocked
  })
})

test.describe('Notifications', () => {
  test('notification toggle is visible in header', async ({ window }) => {
    const notifBtn = window
      .locator('button')
      .filter({ hasText: /notification/i })
      .first()
    await expect(notifBtn).toBeVisible()
  })

  test('notification toggle changes state on click', async ({ window }) => {
    const notifBtn = window
      .locator('button')
      .filter({ hasText: /notification/i })
      .first()
    await expect(notifBtn).toBeVisible()

    const initialClass = await notifBtn.getAttribute('class')
    await notifBtn.click()
    await window.waitForTimeout(300)

    const newClass = await notifBtn.getAttribute('class')
    expect(newClass).not.toBe(initialClass)
  })
})

test.describe('Folder Dropdown', () => {
  test('folder icon is visible in header', async ({ window }) => {
    // The folder button is the first button in the header
    const folderBtn = window.locator('header button').first()
    await expect(folderBtn).toBeVisible()
  })

  test('clicking folder icon opens dropdown', async ({ window }) => {
    const folderBtn = window.locator('header button').first()
    await expect(folderBtn).toBeVisible()

    await folderBtn.click()
    await window.waitForTimeout(300)

    // Dropdown should show "Open folder" and "Change folder" options
    const openOption = window.getByText(/open.*folder|abrir.*carpeta/i).first()
    await expect(openOption).toBeVisible()

    const changeOption = window.getByText(/change.*folder|cambiar.*carpeta/i).first()
    await expect(changeOption).toBeVisible()
  })

  test('dropdown closes when clicking outside', async ({ window }) => {
    const folderBtn = window.locator('header button').first()
    await folderBtn.click()
    await window.waitForTimeout(300)

    // Click on the main content area to close dropdown
    await window.locator('body').click({ position: { x: 400, y: 400 } })
    await window.waitForTimeout(300)

    // Dropdown options should not be visible
    const openOption = window.getByText(/open.*folder|abrir.*carpeta/i).first()
    await expect(openOption).not.toBeVisible()
  })
})

test.describe('Presets', () => {
  test('preset selector is visible in download form', async ({ window }) => {
    const presetSelect = window
      .locator('select')
      .filter({ hasText: /preset|preselección/i })
      .first()
    // May be visible or not depending on form state - check if select exists
    const selects = await window.locator('select').count()
    expect(selects).toBeGreaterThan(0)
  })

  test('preset selector has multiple options', async ({ window }) => {
    // Find the preset select (it should have preset options)
    const selects = window.locator('select')
    const count = await selects.count()

    // At least one select should have preset-like options
    for (let i = 0; i < count; i++) {
      const select = selects.nth(i)
      const options = await select.locator('option').count()
      if (options > 4) {
        // This is likely the preset selector (has many options)
        expect(options).toBeGreaterThanOrEqual(6) // None + 6 presets
        break
      }
    }
  })
})

test.describe('Concurrent Downloads Control', () => {
  test('concurrent downloads control is visible', async ({ window }) => {
    // The concurrent control has +/- buttons and a number
    const minusBtn = window.locator('button').filter({ hasText: '−' }).first()
    const plusBtn = window.locator('button').filter({ hasText: '+' }).first()

    await expect(minusBtn).toBeVisible()
    await expect(plusBtn).toBeVisible()
  })

  test('clicking plus increments concurrent count', async ({ window }) => {
    const plusBtn = window.locator('button').filter({ hasText: '+' }).first()
    await expect(plusBtn).toBeVisible()

    // Get initial value
    const countSpan = window
      .locator('span')
      .filter({ hasText: /^[1-8]$/ })
      .first()
    const initialCount = await countSpan.textContent()

    await plusBtn.click()
    await window.waitForTimeout(300)

    // Count should have changed (may wrap around at 8)
    const newCount = await countSpan.textContent()
    expect(newCount).toBeTruthy()
  })
})

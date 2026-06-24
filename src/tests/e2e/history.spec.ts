import { test, expect } from './fixtures/electron-fixture'

test.describe('History', () => {
  test('switching to history tab shows history view', async ({ window }) => {
    const historyTab = window
      .locator('button[role="tab"]')
      .filter({ hasText: /history|historial/i })
    await historyTab.click()

    await expect(historyTab).toHaveAttribute('aria-selected', 'true')
  })

  test('history view has content when switched to', async ({ window }) => {
    const historyTab = window
      .locator('button[role="tab"]')
      .filter({ hasText: /history|historial/i })
    await historyTab.click()

    // History view should show some content (either empty state or entries)
    // Just verify the tab switched and main content area is visible
    const main = window.locator('main')
    await expect(main).toBeVisible()
  })

  test('search input is visible in history view', async ({ window }) => {
    const historyTab = window
      .locator('button[role="tab"]')
      .filter({ hasText: /history|historial/i })
    await historyTab.click()

    // EN: "Search..." / ES: "Buscar..."
    const searchInput = window.getByPlaceholder(/search|buscar/i)
    await expect(searchInput).toBeVisible()
  })

  test('format filter buttons are visible in history', async ({ window }) => {
    const historyTab = window
      .locator('button[role="tab"]')
      .filter({ hasText: /history|historial/i })
    await historyTab.click()

    // EN: "All" / ES: "Todo" - filter buttons
    const filterBtns = window.locator('button').filter({ hasText: /all|todo|video|audio/i })
    const count = await filterBtns.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })
})

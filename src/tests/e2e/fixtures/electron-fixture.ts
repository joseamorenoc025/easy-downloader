import { test as base, _electron as electron, ElectronApplication, Page } from '@playwright/test'
import path from 'path'

export interface ElectronFixtures {
  electronApp: ElectronApplication
  window: Page
}

export const test = base.extend<ElectronFixtures>({
  // eslint-disable-next-line no-empty-pattern
  electronApp: async ({}, use) => {
    const rootDir = path.join(__dirname, '..', '..', '..', '..')

    const app = await electron.launch({
      args: ['.'],
      cwd: rootDir,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        EASYDOWNLOADER_TEST: '1'
      },
      timeout: 30000
    })

    await use(app)

    try {
      await app.evaluate(async ({ app }) => {
        app.exit(0)
      })
      await app.close()
    } catch {
      try {
        await app.close()
      } catch {
        // Process may already be dead
      }
    }
  },

  window: async ({ electronApp }, use) => {
    const window = await electronApp.firstWindow({ timeout: 30000 })
    await window.waitForLoadState('domcontentloaded')
    await use(window)
  }
})

export { expect } from '@playwright/test'

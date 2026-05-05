import { defineConfig } from '@playwright/test'
import path from 'path'

const distPath = path.resolve(__dirname, 'dist')

export default defineConfig({
  testDir: './src/__tests__/e2e',
  timeout: 30_000,
  retries: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    // Extensions only work in headed Chromium (or new headless mode)
    headless: false,
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chrome-extension',
      use: {
        // Each test gets its own extension context via the helper
        // These are passed as launch args in extension.ts
        launchOptions: {
          args: [
            `--disable-extensions-except=${distPath}`,
            `--load-extension=${distPath}`,
            '--no-sandbox',
            '--disable-dev-shm-usage',
          ],
        },
      },
    },
  ],
  // Run build before E2E tests (already handled by "test:e2e" script)
  webServer: undefined,
})

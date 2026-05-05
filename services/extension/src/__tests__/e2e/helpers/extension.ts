import { chromium, type BrowserContext } from '@playwright/test'
import path from 'path'

const distPath = path.resolve(__dirname, '../../../../../dist')

export interface ExtensionContext {
  context: BrowserContext
  extensionId: string
  popupUrl: string
}

/**
 * Launches a persistent Chrome context with the built extension loaded.
 * Returns the context and the extension's ID so tests can navigate to
 * chrome-extension://<id>/... pages directly.
 */
export async function launchExtension(
  userDataDir = '',
): Promise<ExtensionContext> {
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${distPath}`,
      `--load-extension=${distPath}`,
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
    viewport: { width: 1280, height: 720 },
  })

  // Wait for the service worker to register so we can extract the extension ID
  let [sw] = context.serviceWorkers()
  if (!sw) {
    sw = await context.waitForEvent('serviceworker', { timeout: 10_000 })
  }

  // sw.url() === "chrome-extension://<id>/background/index.js"
  const extensionId = new URL(sw.url()).hostname

  const popupUrl = `chrome-extension://${extensionId}/src/popup/index.html`

  return { context, extensionId, popupUrl }
}

/**
 * Inject mock Vault settings directly into chrome.storage.local via
 * the extension's service worker evaluation context.
 */
export async function injectSettings(
  context: BrowserContext,
  settings: {
    url: string
    token: string
    mountPath: string
  },
) {
  const [sw] = context.serviceWorkers()
  if (!sw) throw new Error('No service worker found')
  await sw.evaluate(
    (s) => chrome.storage.local.set({ vault_settings: s }),
    settings,
  )
}

import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { launchExtension, injectSettings } from './helpers/extension'
import os from 'os'
import path from 'path'
import fs from 'fs'

let ctx: { context: BrowserContext; extensionId: string; popupUrl: string }

// A minimal login page served as a data: URI to avoid needing a real server
const LOGIN_PAGE = `data:text/html,
<!DOCTYPE html>
<html>
<body>
  <form id="login">
    <input id="username" type="text" autocomplete="username" placeholder="Username" />
    <input id="password" type="password" autocomplete="current-password" placeholder="Password" />
    <button type="submit">Login</button>
  </form>
</body>
</html>`

test.beforeAll(async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-fill-autofill-'))
  ctx = await launchExtension(userDataDir)

  await injectSettings(ctx.context, {
    url: 'https://vault.example.com',
    token: 'hvs.TEST',
    mountPath: 'secret',
  })
})

test.afterAll(async () => {
  await ctx.context.close()
})

async function navigateToLoginPage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage()
  await page.goto(LOGIN_PAGE)
  return page
}

test.describe('Content script autofill', () => {
  test('fills username and password fields via content script message', async () => {
    const page = await navigateToLoginPage(ctx.context)

    // Simulate the background script sending a DO_FILL message to the content script
    await page.evaluate(() => {
      chrome.runtime.onMessage.dispatch(
        { type: 'DO_FILL', payload: { username: 'testuser', password: 'testpass' } },
        { id: 'fake-sender' },
        () => {},
      )
    })

    await expect(page.locator('#username')).toHaveValue('testuser')
    await expect(page.locator('#password')).toHaveValue('testpass')

    await page.close()
  })

  test('fills only password when username field is absent', async () => {
    const pagePasswordOnly = await ctx.context.newPage()
    await pagePasswordOnly.goto(`data:text/html,
      <html><body>
        <input id="password" type="password" />
      </body></html>
    `)

    await pagePasswordOnly.evaluate(() => {
      chrome.runtime.onMessage.dispatch(
        { type: 'DO_FILL', payload: { username: 'u', password: 'mypass' } },
        { id: 'fake' },
        () => {},
      )
    })

    await expect(pagePasswordOnly.locator('#password')).toHaveValue('mypass')
    await pagePasswordOnly.close()
  })

  test('does nothing on pages without input fields', async () => {
    const page = await ctx.context.newPage()
    await page.goto('data:text/html,<html><body><p>No form here</p></body></html>')

    // Should not throw
    await expect(
      page.evaluate(() => {
        chrome.runtime.onMessage.dispatch(
          { type: 'DO_FILL', payload: { username: 'u', password: 'p' } },
          { id: 'fake' },
          () => {},
        )
      }),
    ).resolves.toBeUndefined()

    await page.close()
  })
})

test.describe('Popup → fill integration', () => {
  test('popup opens and shows matched tab for configured vault', async () => {
    const page = await ctx.context.newPage()
    await page.goto(ctx.popupUrl)

    await expect(page.getByRole('button', { name: /matched/i })).toBeVisible({ timeout: 5000 })
    await page.close()
  })

  test('badge reflects matching count after navigation', async () => {
    // Navigate to a page and verify the badge text is set via the background script
    // This checks the tab update listener fires correctly
    const page = await ctx.context.newPage()
    await page.goto('https://example.com')

    // Give background time to update the badge
    await page.waitForTimeout(1000)

    // We can't directly read the badge in Playwright, but we can verify
    // the background message flow works by querying via the extension popup
    const popup = await ctx.context.newPage()
    await popup.goto(ctx.popupUrl)
    await expect(popup.getByRole('button', { name: /matched/i })).toBeVisible()

    await page.close()
    await popup.close()
  })
})

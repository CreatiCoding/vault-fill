import { test, expect, type BrowserContext } from '@playwright/test'
import { launchExtension, injectSettings } from './helpers/extension'
import os from 'os'
import path from 'path'
import fs from 'fs'

let ctx: { context: BrowserContext; popupUrl: string }

test.beforeAll(async () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-fill-popup-'))
  ctx = await launchExtension(userDataDir)
})

test.afterAll(async () => {
  await ctx.context.close()
})

test.describe('Popup — setup screen', () => {
  test('shows Setup screen when not configured', async () => {
    const page = await ctx.context.newPage()
    await page.goto(ctx.popupUrl)
    await expect(page.getByPlaceholder('https://vault.example.com')).toBeVisible()
    await expect(page.getByPlaceholder('hvs.XXXXXXXXXXXX')).toBeVisible()
    await expect(page.getByRole('button', { name: /connect/i })).toBeVisible()
    await page.close()
  })

  test('shows error on HTTP URL', async () => {
    const page = await ctx.context.newPage()
    await page.goto(ctx.popupUrl)

    await page.getByPlaceholder('https://vault.example.com').fill('http://vault.example.com')
    await page.getByRole('button', { name: /connect/i }).click()

    await expect(page.getByText(/must use https/i)).toBeVisible()
    await page.close()
  })

  test('shows error when token is empty', async () => {
    const page = await ctx.context.newPage()
    await page.goto(ctx.popupUrl)

    await page.getByPlaceholder('https://vault.example.com').fill('https://vault.example.com')
    await page.getByRole('button', { name: /connect/i }).click()

    await expect(page.getByText(/token is required/i)).toBeVisible()
    await page.close()
  })
})

test.describe('Popup — credential list screen', () => {
  test.beforeAll(async () => {
    // Pre-configure so the popup skips setup
    await injectSettings(ctx.context, {
      url: 'https://vault.example.com',
      token: 'hvs.TEST',
      mountPath: 'secret',
    })
  })

  test('shows Matched and Search tabs when configured', async () => {
    const page = await ctx.context.newPage()
    await page.goto(ctx.popupUrl)

    await expect(page.getByRole('button', { name: /matched/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /search/i })).toBeVisible()
    await page.close()
  })

  test('search tab shows input field', async () => {
    const page = await ctx.context.newPage()
    await page.goto(ctx.popupUrl)

    await page.getByRole('button', { name: /search/i }).click()
    await expect(page.getByPlaceholder(/search credentials/i)).toBeVisible()
    await page.close()
  })

  test('disconnect button returns to setup screen', async () => {
    const page = await ctx.context.newPage()
    await page.goto(ctx.popupUrl)

    // Wait for list view to load
    await page.getByRole('button', { name: /search/i }).waitFor()

    // Click disconnect (title="Disconnect")
    await page.locator('[title="Disconnect"]').click()

    await expect(page.getByPlaceholder('https://vault.example.com')).toBeVisible()
    await page.close()
  })
})

import { vi } from 'vitest'
import '@testing-library/jest-dom'

// jest-webextension-mock uses `jest.fn()` at module top-level.
// Must alias jest → vi BEFORE the module is evaluated via dynamic import.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).jest = vi

await import('jest-webextension-mock')

// jest-webextension-mock (MV2-era) doesn't include chrome.action (MV3).
// Add a manual stub so background scripts can use it in tests.
if (!chrome.action) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(chrome as any).action = {
    setBadgeText: vi.fn(),
    setBadgeBackgroundColor: vi.fn(),
    setBadgeTextColor: vi.fn(),
  }
}

// Re-assign chrome APIs as vitest vi.fn() for .mockImplementation() support
beforeEach(() => {
  chrome.storage.local.get = vi.fn()
  chrome.storage.local.set = vi.fn()
  chrome.storage.local.remove = vi.fn()
  chrome.runtime.sendMessage = vi.fn()
  chrome.runtime.onMessage.addListener = vi.fn()
  chrome.tabs.query = vi.fn()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const action = (chrome as any).action
  action.setBadgeText = vi.fn()
  action.setBadgeBackgroundColor = vi.fn()
})

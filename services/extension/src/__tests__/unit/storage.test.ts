import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getSettings, saveSettings, clearSettings } from '../../lib/storage'
import type { VaultSettings } from '../../lib/types'

const mockSettings: VaultSettings = {
  url: 'https://vault.example.com',
  token: 'hvs.TEST123',
  mountPath: 'secret',
}

describe('storage', () => {
  beforeEach(() => {
    vi.mocked(chrome.storage.local.get).mockReset()
    vi.mocked(chrome.storage.local.set).mockReset()
    vi.mocked(chrome.storage.local.remove).mockReset()
  })

  describe('getSettings', () => {
    it('returns null when storage is empty', async () => {
      // storage.ts uses Promise-based API (no callback)
      vi.mocked(chrome.storage.local.get).mockResolvedValue({})
      const result = await getSettings()
      expect(result).toBeNull()
    })

    it('returns settings when present', async () => {
      vi.mocked(chrome.storage.local.get).mockResolvedValue({ vault_settings: mockSettings })
      const result = await getSettings()
      expect(result).toEqual(mockSettings)
    })

    it('calls storage with correct key', async () => {
      vi.mocked(chrome.storage.local.get).mockResolvedValue({})
      await getSettings()
      expect(chrome.storage.local.get).toHaveBeenCalledWith('vault_settings')
    })
  })

  describe('saveSettings', () => {
    it('stores settings under vault_settings key', async () => {
      vi.mocked(chrome.storage.local.set).mockResolvedValue(undefined)
      await saveSettings(mockSettings)
      expect(chrome.storage.local.set).toHaveBeenCalledWith({ vault_settings: mockSettings })
    })
  })

  describe('clearSettings', () => {
    it('removes vault_settings key', async () => {
      vi.mocked(chrome.storage.local.remove).mockResolvedValue(undefined)
      await clearSettings()
      expect(chrome.storage.local.remove).toHaveBeenCalledWith('vault_settings')
    })
  })
})

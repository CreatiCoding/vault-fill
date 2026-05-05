import type { VaultSettings } from './types'

const SETTINGS_KEY = 'vault_settings'

export async function getSettings(): Promise<VaultSettings | null> {
  const result = await chrome.storage.local.get(SETTINGS_KEY)
  return (result[SETTINGS_KEY] as VaultSettings | undefined) ?? null
}

export async function saveSettings(settings: VaultSettings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings })
}

export async function clearSettings(): Promise<void> {
  await chrome.storage.local.remove(SETTINGS_KEY)
}

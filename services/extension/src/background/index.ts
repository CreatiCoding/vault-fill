import { getSettings, saveSettings } from '../lib/storage'
import {
  searchCredentials,
  getMatchingCredentials,
  listAllCredentials,
  writeCredential,
  deleteCredential,
} from '../lib/vault'
import type { Message, MessageResponse, Credential, VaultSettings } from '../lib/types'

async function updateBadge(tabId: number, url: string) {
  const settings = await getSettings()
  if (!settings) {
    chrome.action.setBadgeText({ text: '', tabId })
    return
  }
  try {
    const matches = await getMatchingCredentials(settings, url)
    if (matches.length > 0) {
      chrome.action.setBadgeText({ text: String(matches.length), tabId })
      chrome.action.setBadgeBackgroundColor({ color: '#f0b429', tabId })
    } else {
      chrome.action.setBadgeText({ text: '', tabId })
    }
  } catch {
    chrome.action.setBadgeText({ text: '', tabId })
  }
}

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId)
  if (tab.url) await updateBadge(tabId, tab.url)
})

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    await updateBadge(tabId, tab.url)
  }
})

chrome.runtime.onMessage.addListener(
  (
    message: Message,
    _sender,
    sendResponse: (r: MessageResponse) => void,
  ) => {
    handleMessage(message)
      .then(sendResponse)
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        sendResponse({ ok: false, error: msg })
      })
    return true
  },
)

async function handleMessage(msg: Message): Promise<MessageResponse> {
  switch (msg.type) {
    case 'GET_SETTINGS': {
      const settings = await getSettings()
      return { ok: true, data: settings }
    }

    case 'SAVE_SETTINGS': {
      if (msg.payload) {
        await saveSettings(msg.payload)
      } else {
        const { clearSettings } = await import('../lib/storage')
        await clearSettings()
      }
      return { ok: true, data: null }
    }

    case 'SEARCH_CREDENTIALS': {
      const settings = await getSettings()
      if (!settings) return { ok: false, error: 'Vault not configured' }
      const results = await searchCredentials(settings, msg.payload.query)
      // Strip passwords from search results
      const safe = results.map(({ password: _pw, fields: _f, ...rest }) => rest)
      return { ok: true, data: safe }
    }

    case 'GET_MATCHING_CREDENTIALS': {
      const settings = await getSettings()
      if (!settings) return { ok: false, error: 'Vault not configured' }
      const results = await getMatchingCredentials(settings, msg.payload.tabUrl)
      const safe = results.map(({ password: _pw, fields: _f, ...rest }) => rest)
      return { ok: true, data: safe }
    }

    case 'FILL_CREDENTIALS': {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab?.id) return { ok: false, error: 'No active tab' }
      await chrome.tabs.sendMessage(tab.id, {
        type: 'DO_FILL',
        payload: msg.payload,
      })
      return { ok: true, data: null }
    }

    case 'GET_BADGE_COUNT': {
      const settings = await getSettings()
      if (!settings) return { ok: true, data: 0 }
      const results = await getMatchingCredentials(settings, msg.payload.tabUrl)
      return { ok: true, data: results.length }
    }

    case 'WRITE_CREDENTIAL': {
      const settings = await getSettings()
      if (!settings) return { ok: false, error: 'Vault not configured' }
      await writeCredential(settings, msg.payload.path, msg.payload.fields)
      return { ok: true, data: null }
    }

    case 'DELETE_CREDENTIAL': {
      const settings = await getSettings()
      if (!settings) return { ok: false, error: 'Vault not configured' }
      await deleteCredential(settings, msg.payload.relativePath)
      return { ok: true, data: null }
    }

    case 'GET_FULL_CREDENTIAL': {
      const settings = await getSettings()
      if (!settings) return { ok: false, error: 'Vault not configured' }
      const all = await listAllCredentials(settings)
      const cred = all.find((c) => c.path === msg.path) ?? null
      return { ok: true, data: cred }
    }

    default:
      return { ok: false, error: 'Unknown message type' }
  }
}

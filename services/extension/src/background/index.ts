import { getSettings, saveSettings } from '../lib/storage'
import {
  searchCredentials,
  getMatchingCredentials,
  testConnection,
} from '../lib/vault'
import type { Message, MessageResponse, Credential, VaultSettings } from '../lib/types'

// Update badge when active tab changes
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
      chrome.action.setBadgeBackgroundColor({ color: '#4f46e5', tabId })
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

// Central message handler — secrets never leave the background script
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
    return true // keep channel open for async response
  },
)

async function handleMessage(msg: Message): Promise<MessageResponse> {
  switch (msg.type) {
    case 'GET_SETTINGS': {
      const settings = await getSettings()
      return { ok: true, data: settings }
    }

    case 'SAVE_SETTINGS': {
      await saveSettings(msg.payload)
      return { ok: true, data: null }
    }

    case 'SEARCH_CREDENTIALS': {
      const settings = await getSettings()
      if (!settings) return { ok: false, error: 'Vault not configured' }
      const results = await searchCredentials(settings, msg.payload.query)
      // Strip passwords from search results — only send on explicit fill
      const safe = results.map(({ password: _pw, ...rest }) => rest)
      return { ok: true, data: safe }
    }

    case 'GET_MATCHING_CREDENTIALS': {
      const settings = await getSettings()
      if (!settings) return { ok: false, error: 'Vault not configured' }
      const results = await getMatchingCredentials(settings, msg.payload.tabUrl)
      const safe = results.map(({ password: _pw, ...rest }) => rest)
      return { ok: true, data: safe }
    }

    case 'FILL_CREDENTIALS': {
      // Forward fill request to the active tab's content script
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

    default:
      return { ok: false, error: 'Unknown message type' }
  }
}

// Expose getFullCredential only to content scripts via a separate channel
// so passwords are never exposed to the popup directly
chrome.runtime.onMessage.addListener(
  (
    message: { type: 'GET_FULL_CREDENTIAL'; path: string },
    sender,
    sendResponse: (r: MessageResponse<Credential | null>) => void,
  ) => {
    if (message.type !== 'GET_FULL_CREDENTIAL') return false
    // Only content scripts can request this (they have a tab sender)
    if (!sender.tab) {
      sendResponse({ ok: false, error: 'Not authorized' })
      return false
    }
    getSettings()
      .then(async (settings: VaultSettings | null) => {
        if (!settings) {
          sendResponse({ ok: false, error: 'Not configured' })
          return
        }
        const { listAllCredentials } = await import('../lib/vault')
        const all = await listAllCredentials(settings)
        const cred = all.find((c) => c.path === message.path) ?? null
        sendResponse({ ok: true, data: cred })
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        sendResponse({ ok: false, error: msg })
      })
    return true
  },
)

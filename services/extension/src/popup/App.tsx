import { useEffect, useState } from 'preact/hooks'
import type { VaultSettings } from '../lib/types'
import { Setup } from './components/Setup'
import { CredentialList } from './components/CredentialList'

type View = 'loading' | 'setup' | 'list'

export function App() {
  const [view, setView] = useState<View>('loading')
  const [settings, setSettings] = useState<VaultSettings | null>(null)
  const [tabUrl, setTabUrl] = useState('')

  useEffect(() => {
    // Get current tab URL
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      setTabUrl(tabs[0]?.url ?? '')
    })

    // Load settings from background
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (res) => {
      if (res?.ok && res.data) {
        setSettings(res.data as VaultSettings)
        setView('list')
      } else {
        setView('setup')
      }
    })
  }, [])

  function handleSaved(s: VaultSettings) {
    setSettings(s)
    setView('list')
  }

  function handleLogout() {
    chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', payload: null })
    setSettings(null)
    setView('setup')
  }

  if (view === 'loading') {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>
        Loading…
      </div>
    )
  }

  if (view === 'setup' || !settings) {
    return <Setup onSaved={handleSaved} />
  }

  return (
    <CredentialList
      tabUrl={tabUrl}
      onLogout={handleLogout}
    />
  )
}

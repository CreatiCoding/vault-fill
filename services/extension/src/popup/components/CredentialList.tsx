import { useEffect, useRef, useState } from 'preact/hooks'
import type { Credential } from '../../lib/types'

interface SafeCredential extends Omit<Credential, 'password'> {}

interface Props {
  tabUrl: string
  onLogout: () => void
}

type Tab = 'matched' | 'search'

export function CredentialList({ tabUrl, onLogout }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('matched')
  const [matched, setMatched] = useState<SafeCredential[]>([])
  const [searchResults, setSearchResults] = useState<SafeCredential[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!tabUrl) return
    chrome.runtime.sendMessage(
      { type: 'GET_MATCHING_CREDENTIALS', payload: { tabUrl } },
      (res) => {
        setLoading(false)
        if (res?.ok) {
          setMatched(res.data as SafeCredential[])
        } else {
          setError(res?.error ?? 'Failed to load credentials')
        }
      },
    )
  }, [tabUrl])

  useEffect(() => {
    if (activeTab === 'search') {
      setTimeout(() => searchRef.current?.focus(), 50)
    }
  }, [activeTab])

  function handleSearch(q: string) {
    setQuery(q)
    if (!q.trim()) {
      setSearchResults([])
      return
    }
    chrome.runtime.sendMessage(
      { type: 'SEARCH_CREDENTIALS', payload: { query: q } },
      (res) => {
        if (res?.ok) setSearchResults(res.data as SafeCredential[])
      },
    )
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  function handleFill(cred: SafeCredential) {
    // Request fill via background — background holds the full credential with password
    chrome.runtime.sendMessage(
      {
        type: 'FILL_CREDENTIALS',
        payload: { username: cred.username, password: '__FETCH__' },
      },
    )
    // Actually we need the password. Use GET_FULL_CREDENTIAL flow:
    chrome.runtime.sendMessage(
      { type: 'GET_FULL_CREDENTIAL', path: cred.path },
      (res) => {
        if (!res?.ok || !res.data) {
          showToast('Failed to fetch credential')
          return
        }
        const full = res.data as Credential
        chrome.runtime.sendMessage({
          type: 'FILL_CREDENTIALS',
          payload: { username: full.username, password: full.password },
        })
        showToast(`Filled: ${full.username}`)
        window.close()
      },
    )
  }

  function handleCopyUsername(cred: SafeCredential) {
    navigator.clipboard.writeText(cred.username).then(() => showToast('Username copied'))
  }

  function handleCopyPassword(cred: SafeCredential) {
    chrome.runtime.sendMessage(
      { type: 'GET_FULL_CREDENTIAL', path: cred.path },
      (res) => {
        if (!res?.ok || !res.data) {
          showToast('Failed to fetch credential')
          return
        }
        const full = res.data as Credential
        navigator.clipboard.writeText(full.password).then(() => showToast('Password copied'))
      },
    )
  }

  const displayList = activeTab === 'matched' ? matched : searchResults

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <LockIcon />
        <span style={styles.title}>Vault Fill</span>
        <button style={styles.logoutBtn} onClick={onLogout} title="Disconnect">
          <LogoutIcon />
        </button>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(activeTab === 'matched' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('matched')}
        >
          Matched {matched.length > 0 && <span style={styles.badge}>{matched.length}</span>}
        </button>
        <button
          style={{ ...styles.tab, ...(activeTab === 'search' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('search')}
        >
          Search
        </button>
      </div>

      {/* Search input */}
      {activeTab === 'search' && (
        <div style={styles.searchWrap}>
          <input
            ref={searchRef}
            style={styles.searchInput}
            type="text"
            placeholder="Search credentials…"
            value={query}
            onInput={(e) => handleSearch((e.target as HTMLInputElement).value)}
          />
        </div>
      )}

      {/* List */}
      <div style={styles.list}>
        {loading && activeTab === 'matched' && (
          <p style={styles.empty}>Loading…</p>
        )}
        {error && <p style={styles.errorMsg}>{error}</p>}
        {!loading && displayList.length === 0 && !error && (
          <p style={styles.empty}>
            {activeTab === 'matched'
              ? 'No credentials found for this site'
              : query
              ? 'No results'
              : 'Type to search'}
          </p>
        )}
        {displayList.map((cred) => (
          <CredentialItem
            key={cred.path}
            cred={cred}
            onFill={handleFill}
            onCopyUsername={handleCopyUsername}
            onCopyPassword={handleCopyPassword}
          />
        ))}
      </div>

      {/* Toast */}
      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  )
}

interface ItemProps {
  cred: SafeCredential
  onFill: (c: SafeCredential) => void
  onCopyUsername: (c: SafeCredential) => void
  onCopyPassword: (c: SafeCredential) => void
}

function CredentialItem({ cred, onFill, onCopyUsername, onCopyPassword }: ItemProps) {
  return (
    <div style={styles.item}>
      <div style={styles.itemInfo} onClick={() => onFill(cred)}>
        <span style={styles.itemName}>{cred.name}</span>
        <span style={styles.itemUser}>{cred.username}</span>
      </div>
      <div style={styles.itemActions}>
        <button
          style={styles.iconBtn}
          title="Copy username"
          onClick={() => onCopyUsername(cred)}
        >
          <UserIcon />
        </button>
        <button
          style={styles.iconBtn}
          title="Copy password"
          onClick={() => onCopyPassword(cred)}
        >
          <KeyIcon />
        </button>
        <button
          style={{ ...styles.iconBtn, ...styles.fillBtn }}
          title="Autofill"
          onClick={() => onFill(cred)}
        >
          <FillIcon />
        </button>
      </div>
    </div>
  )
}

// Icons (inline SVG)
function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}
function LogoutIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}
function UserIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  )
}
function KeyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  )
}
function FillIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  )
}

const styles: Record<string, preact.JSX.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 14px 10px', borderBottom: '1px solid var(--border)' },
  title: { flex: 1, fontWeight: '600', fontSize: '15px' },
  logoutBtn: { background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center' },
  tabs: { display: 'flex', borderBottom: '1px solid var(--border)' },
  tab: { flex: 1, padding: '8px', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '13px', fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' },
  tabActive: { color: 'var(--accent)', borderBottom: '2px solid var(--accent)' },
  badge: { background: 'var(--accent)', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '11px' },
  searchWrap: { padding: '10px 12px 0' },
  searchInput: { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', padding: '8px 10px', fontSize: '13px', outline: 'none' },
  list: { flex: 1, overflowY: 'auto', padding: '6px 0' },
  empty: { padding: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' },
  errorMsg: { padding: '12px', color: 'var(--danger)', fontSize: '12px' },
  item: { display: 'flex', alignItems: 'center', padding: '8px 12px', gap: '8px', cursor: 'pointer', borderRadius: '6px', margin: '2px 6px' },
  itemInfo: { flex: 1, overflow: 'hidden' },
  itemName: { display: 'block', fontWeight: '500', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  itemUser: { display: 'block', color: 'var(--muted)', fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  itemActions: { display: 'flex', gap: '4px', flexShrink: 0 },
  iconBtn: { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: '6px', padding: '5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  fillBtn: { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' },
  toast: { position: 'fixed', bottom: '12px', left: '50%', transform: 'translateX(-50%)', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', whiteSpace: 'nowrap', zIndex: 100 },
}

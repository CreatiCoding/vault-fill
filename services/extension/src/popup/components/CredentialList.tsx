import { useEffect, useRef, useState } from 'preact/hooks'
import type { Credential } from '../../lib/types'
import { NewCredential } from './NewCredential'

// Safe credential — password and full fields stripped before leaving background
interface SafeCredential extends Omit<Credential, 'password' | 'fields'> {}

interface Props {
  tabUrl: string
  onLogout: () => void
}

type Tab = 'matched' | 'search'

function hostnameFromUrl(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

export function CredentialList({ tabUrl, onLogout }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('matched')
  const [matched, setMatched] = useState<SafeCredential[]>([])
  const [searchResults, setSearchResults] = useState<SafeCredential[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [editCred, setEditCred] = useState<{ path: string; fields: Record<string, string> } | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!tabUrl) return
    chrome.runtime.sendMessage(
      { type: 'GET_MATCHING_CREDENTIALS', payload: { tabUrl } },
      (res) => {
        setLoading(false)
        if (res?.ok) setMatched(res.data as SafeCredential[])
        else setError(res?.error ?? 'Failed to load credentials')
      },
    )
  }, [tabUrl])

  useEffect(() => {
    if (activeTab === 'search') setTimeout(() => searchRef.current?.focus(), 50)
  }, [activeTab])

  function handleSearch(q: string) {
    setQuery(q)
    chrome.runtime.sendMessage(
      { type: 'SEARCH_CREDENTIALS', payload: { query: q } },
      (res) => { if (res?.ok) setSearchResults(res.data as SafeCredential[]) },
    )
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  function handleFill(cred: SafeCredential) {
    chrome.runtime.sendMessage(
      { type: 'GET_FULL_CREDENTIAL', path: cred.path },
      (res) => {
        if (!res?.ok || !res.data) { showToast('Failed to fetch credential'); return }
        const full = res.data as Credential
        chrome.runtime.sendMessage({
          type: 'FILL_CREDENTIALS',
          payload: { username: full.username ?? '', password: full.password ?? '' },
        })
        const label = full.username ?? full.url ?? full.name
        showToast(`Filled: ${label}`)
        window.close()
      },
    )
  }

  function handleCopyField(cred: SafeCredential, fieldKey: 'username' | 'password' | string) {
    chrome.runtime.sendMessage(
      { type: 'GET_FULL_CREDENTIAL', path: cred.path },
      (res) => {
        if (!res?.ok || !res.data) { showToast('Failed to fetch'); return }
        const full = res.data as Credential
        const val = full.fields[fieldKey] ?? ''
        if (!val) { showToast(`No "${fieldKey}" field`); return }
        navigator.clipboard.writeText(val).then(() => showToast(`Copied: ${fieldKey}`))
      },
    )
  }

  function handleEdit(cred: SafeCredential) {
    chrome.runtime.sendMessage(
      { type: 'GET_FULL_CREDENTIAL', path: cred.path },
      (res) => {
        if (!res?.ok || !res.data) { showToast('Failed to fetch credential'); return }
        const full = res.data as Credential
        setEditCred({ path: full.relativePath, fields: full.fields })
      },
    )
  }

  function handleEditSaved() {
    setEditCred(null)
    showToast('Updated in Vault!')
    setLoading(true)
    chrome.runtime.sendMessage(
      { type: 'GET_MATCHING_CREDENTIALS', payload: { tabUrl } },
      (res) => {
        setLoading(false)
        if (res?.ok) setMatched(res.data as SafeCredential[])
      },
    )
  }

  function handleNewSaved() {
    setShowNew(false)
    showToast('Saved to Vault!')
    // Refresh matched list
    setLoading(true)
    chrome.runtime.sendMessage(
      { type: 'GET_MATCHING_CREDENTIALS', payload: { tabUrl } },
      (res) => {
        setLoading(false)
        if (res?.ok) setMatched(res.data as SafeCredential[])
      },
    )
  }

  if (editCred) {
    return (
      <NewCredential
        defaultPath={editCred.path}
        initialFields={editCred.fields}
        isEdit
        onSaved={handleEditSaved}
        onCancel={() => setEditCred(null)}
      />
    )
  }

  if (showNew) {
    return (
      <NewCredential
        defaultPath={hostnameFromUrl(tabUrl)}
        onSaved={handleNewSaved}
        onCancel={() => setShowNew(false)}
      />
    )
  }

  const displayList = activeTab === 'matched' ? matched : searchResults

  return (
    <div style={s.container}>
      {/* Header */}
      <div style={s.header}>
        <LockIcon />
        <span style={s.title}>Vault Fill</span>
        <button style={s.iconHeaderBtn} onClick={() => setShowNew(true)} title="New secret">
          <PlusIcon />
        </button>
        <button style={s.iconHeaderBtn} onClick={onLogout} title="Disconnect">
          <LogoutIcon />
        </button>
      </div>

      {/* Tabs */}
      <div style={s.tabs}>
        <button
          style={{ ...s.tab, ...(activeTab === 'matched' ? s.tabActive : {}) }}
          onClick={() => setActiveTab('matched')}
        >
          Matched {matched.length > 0 && <span style={s.badge}>{matched.length}</span>}
        </button>
        <button
          style={{ ...s.tab, ...(activeTab === 'search' ? s.tabActive : {}) }}
          onClick={() => setActiveTab('search')}
        >
          Search
        </button>
      </div>

      {/* Search input */}
      {activeTab === 'search' && (
        <div style={s.searchWrap}>
          <input
            ref={searchRef}
            style={s.searchInput}
            type="text"
            placeholder="Search credentials…"
            value={query}
            onInput={(e) => handleSearch((e.target as HTMLInputElement).value)}
          />
        </div>
      )}

      {/* List */}
      <div style={s.list}>
        {loading && activeTab === 'matched' && <p style={s.empty}>Loading…</p>}
        {error && <p style={s.errorMsg}>{error}</p>}
        {!loading && displayList.length === 0 && !error && (
          <div style={s.emptyWrap}>
            <p style={s.empty}>
              {activeTab === 'matched'
                ? 'No credentials found for this site'
                : query ? 'No results' : 'Type to search'}
            </p>
            {activeTab === 'matched' && (
              <button style={s.newInlineBtn} onClick={() => setShowNew(true)}>
                + Add secret for this site
              </button>
            )}
          </div>
        )}
        {displayList.map((cred) => (
          <CredentialItem
            key={cred.path}
            cred={cred}
            onFill={handleFill}
            onCopyField={handleCopyField}
            onEdit={handleEdit}
          />
        ))}
      </div>

      {toast && <div style={s.toast}>{toast}</div>}
    </div>
  )
}

interface ItemProps {
  cred: SafeCredential
  onFill: (c: SafeCredential) => void
  onCopyField: (c: SafeCredential, key: string) => void
  onEdit: (c: SafeCredential) => void
}

function CredentialItem({ cred, onFill, onCopyField, onEdit }: ItemProps) {
  const subtitle = cred.username ?? cred.url ?? cred.path
  return (
    <div style={s.item}>
      <div style={s.itemInfo} onClick={() => onFill(cred)}>
        <span style={s.itemName}>{cred.name}</span>
        <span style={s.itemUser}>{subtitle}</span>
      </div>
      <div style={s.itemActions}>
        {cred.username && (
          <button style={s.iconBtn} title="Copy username" onClick={() => onCopyField(cred, 'username')}>
            <UserIcon />
          </button>
        )}
        <button style={s.iconBtn} title="Copy password" onClick={() => onCopyField(cred, 'password')}>
          <KeyIcon />
        </button>
        <button style={s.iconBtn} title="Edit" onClick={() => onEdit(cred)}>
          <EditIcon />
        </button>
        <button style={{ ...s.iconBtn, ...s.fillBtn }} title="Autofill" onClick={() => onFill(cred)}>
          <FillIcon />
        </button>
      </div>
    </div>
  )
}

function LockIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
}
function PlusIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
}
function LogoutIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
}
function UserIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
}
function KeyIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
}
function EditIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
}
function FillIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
}

const s: Record<string, preact.JSX.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'center', gap: '6px', padding: '12px 12px 8px', borderBottom: '1px solid var(--border)' },
  title: { flex: 1, fontWeight: '600', fontSize: '15px' },
  iconHeaderBtn: { background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center' },
  tabs: { display: 'flex', borderBottom: '1px solid var(--border)' },
  tab: { flex: 1, padding: '8px', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '13px', fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' },
  tabActive: { color: 'var(--accent)', borderBottom: '2px solid var(--accent)' },
  badge: { background: 'var(--accent)', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '11px' },
  searchWrap: { padding: '10px 12px 0' },
  searchInput: { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', padding: '8px 10px', fontSize: '13px', outline: 'none' },
  list: { flex: 1, overflowY: 'auto', padding: '6px 0' },
  emptyWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' },
  empty: { padding: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' },
  newInlineBtn: { background: 'none', border: '1px dashed var(--border)', borderRadius: 'var(--radius)', color: 'var(--accent)', cursor: 'pointer', fontSize: '12px', padding: '6px 14px' },
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

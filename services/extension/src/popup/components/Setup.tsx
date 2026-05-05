import { useState } from 'preact/hooks'
import type { VaultSettings } from '../../lib/types'

interface Props {
  onSaved: (settings: VaultSettings) => void
}

export function Setup({ onSaved }: Props) {
  const [url, setUrl] = useState('https://')
  const [token, setToken] = useState('')
  const [mountPath, setMountPath] = useState('secret')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: Event) {
    e.preventDefault()
    setError('')

    if (!url.startsWith('https://')) {
      setError('Vault URL must use HTTPS')
      return
    }
    if (!token.trim()) {
      setError('Token is required')
      return
    }

    setLoading(true)
    const settings: VaultSettings = {
      url: url.replace(/\/$/, ''),
      token: token.trim(),
      mountPath: mountPath.replace(/^\/|\/$/g, '') || 'secret',
    }

    chrome.runtime.sendMessage(
      { type: 'SAVE_SETTINGS', payload: settings },
      (res) => {
        setLoading(false)
        if (res?.ok) {
          onSaved(settings)
        } else {
          setError(res?.error ?? 'Failed to save settings')
        }
      },
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <VaultIcon />
        <span style={styles.title}>Vault Fill</span>
      </div>

      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>
          Vault URL
          <input
            style={styles.input}
            type="url"
            value={url}
            onInput={(e) => setUrl((e.target as HTMLInputElement).value)}
            placeholder="https://vault.example.com"
            required
          />
        </label>

        <label style={styles.label}>
          Token
          <input
            style={styles.input}
            type="password"
            value={token}
            onInput={(e) => setToken((e.target as HTMLInputElement).value)}
            placeholder="hvs.XXXXXXXXXXXX"
            required
          />
        </label>

        <label style={styles.label}>
          KV Mount Path
          <input
            style={styles.input}
            type="text"
            value={mountPath}
            onInput={(e) => setMountPath((e.target as HTMLInputElement).value)}
            placeholder="secret"
          />
        </label>

        {error && <p style={styles.error}>{error}</p>}

        <button style={styles.button} type="submit" disabled={loading}>
          {loading ? 'Connecting…' : 'Connect'}
        </button>
      </form>
    </div>
  )
}

function VaultIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

const styles: Record<string, preact.JSX.CSSProperties> = {
  container: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  title: {
    fontSize: '18px',
    fontWeight: '600',
    color: 'var(--text)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    fontSize: '12px',
    color: 'var(--muted)',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  input: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text)',
    padding: '8px 10px',
    fontSize: '14px',
    outline: 'none',
    width: '100%',
  },
  error: {
    color: 'var(--danger)',
    fontSize: '12px',
  },
  button: {
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    padding: '10px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '4px',
  },
}

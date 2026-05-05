import { useState } from 'preact/hooks'

interface Props {
  defaultPath: string  // pre-filled from current tab URL
  onSaved: () => void
  onCancel: () => void
}

interface Field {
  key: string
  value: string
}

export function NewCredential({ defaultPath, onSaved, onCancel }: Props) {
  const [path, setPath] = useState(defaultPath)
  const [fields, setFields] = useState<Field[]>([
    { key: 'username', value: '' },
    { key: 'password', value: '' },
    { key: 'url', value: '' },
  ])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function updateField(index: number, part: 'key' | 'value', val: string) {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, [part]: val } : f)))
  }

  function addField() {
    setFields((prev) => [...prev, { key: '', value: '' }])
  }

  function removeField(index: number) {
    setFields((prev) => prev.filter((_, i) => i !== index))
  }

  function handleSubmit(e: Event) {
    e.preventDefault()
    setError('')

    if (!path.trim()) {
      setError('Path is required')
      return
    }

    const data: Record<string, string> = {}
    for (const f of fields) {
      if (f.key.trim()) data[f.key.trim()] = f.value
    }
    if (Object.keys(data).length === 0) {
      setError('At least one field is required')
      return
    }

    setLoading(true)
    chrome.runtime.sendMessage(
      { type: 'WRITE_CREDENTIAL', payload: { path: path.trim(), fields: data } },
      (res) => {
        setLoading(false)
        if (res?.ok) {
          onSaved()
        } else {
          setError(res?.error ?? 'Failed to save')
        }
      },
    )
  }

  return (
    <div style={s.container}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={onCancel} title="Back">
          <BackIcon />
        </button>
        <span style={s.title}>New Secret</span>
      </div>

      <form onSubmit={handleSubmit} style={s.form}>
        <label style={s.label}>
          Path
          <input
            style={s.input}
            type="text"
            value={path}
            onInput={(e) => setPath((e.target as HTMLInputElement).value)}
            placeholder="e.g. web/github.com"
          />
        </label>

        <div style={s.fieldsHeader}>
          <span style={s.label}>Fields</span>
          <button type="button" style={s.addFieldBtn} onClick={addField}>+ Add field</button>
        </div>

        {fields.map((f, i) => (
          <div key={i} style={s.fieldRow}>
            <input
              style={{ ...s.input, ...s.fieldKey }}
              type="text"
              value={f.key}
              onInput={(e) => updateField(i, 'key', (e.target as HTMLInputElement).value)}
              placeholder="key"
            />
            <input
              style={{ ...s.input, ...s.fieldVal }}
              type={f.key === 'password' || f.key === 'pass' || f.key === 'secret' ? 'password' : 'text'}
              value={f.value}
              onInput={(e) => updateField(i, 'value', (e.target as HTMLInputElement).value)}
              placeholder="value"
            />
            <button
              type="button"
              style={s.removeBtn}
              onClick={() => removeField(i)}
              title="Remove"
            >×</button>
          </div>
        ))}

        {error && <p style={s.error}>{error}</p>}

        <button style={s.submitBtn} type="submit" disabled={loading}>
          {loading ? 'Saving…' : 'Save to Vault'}
        </button>
      </form>
    </div>
  )
}

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

const s: Record<string, preact.JSX.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 14px 10px', borderBottom: '1px solid var(--border)' },
  backBtn: { background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' },
  title: { fontWeight: '600', fontSize: '15px' },
  form: { display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px', overflowY: 'auto', flex: 1 },
  label: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: 'var(--muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', padding: '7px 9px', fontSize: '13px', outline: 'none', width: '100%' },
  fieldsHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  addFieldBtn: { background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '12px', fontWeight: '600', padding: '2px 0' },
  fieldRow: { display: 'flex', gap: '6px', alignItems: 'center' },
  fieldKey: { width: '38%', flexShrink: 0 },
  fieldVal: { flex: 1 },
  removeBtn: { background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '16px', padding: '0 4px', lineHeight: 1 },
  error: { color: 'var(--danger)', fontSize: '12px' },
  submitBtn: { background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', padding: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', marginTop: '4px' },
}

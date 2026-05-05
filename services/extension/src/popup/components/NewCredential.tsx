import { useState, useCallback } from 'preact/hooks'

interface Props {
  defaultPath: string  // pre-filled from current tab URL
  initialFields?: Record<string, string>  // pre-filled for edit mode
  isEdit?: boolean
  onSaved: () => void
  onCancel: () => void
}

interface Field {
  key: string
  value: string
}

function defaultFieldsFromRecord(record: Record<string, string>): Field[] {
  return Object.entries(record).map(([key, value]) => ({ key, value }))
}

export function NewCredential({ defaultPath, initialFields, isEdit, onSaved, onCancel }: Props) {
  const [path, setPath] = useState(defaultPath)
  const [fields, setFields] = useState<Field[]>(
    initialFields && Object.keys(initialFields).length > 0
      ? defaultFieldsFromRecord(initialFields)
      : [
          { key: 'username', value: '' },
          { key: 'password', value: '' },
          { key: 'url', value: '' },
        ],
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [revealed, setRevealed] = useState<Set<number>>(new Set())

  const toggleReveal = useCallback((i: number) => {
    setRevealed((prev) => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }, [])

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
        <span style={s.title}>{isEdit ? 'Edit Secret' : 'New Secret'}</span>
      </div>

      <form onSubmit={handleSubmit} style={s.form}>
        <label style={s.label}>
          Path
          <input
            style={{ ...s.input, ...(isEdit ? s.inputDisabled : {}) }}
            type="text"
            value={path}
            readOnly={isEdit}
            onInput={(e) => !isEdit && setPath((e.target as HTMLInputElement).value)}
            placeholder="e.g. web/github.com"
          />
        </label>

        <div style={s.fieldsHeader}>
          <span style={s.label}>Fields</span>
          <button type="button" style={s.addFieldBtn} onClick={addField}>+ Add field</button>
        </div>

        {fields.map((f, i) => {
          const isSecret = f.key === 'password' || f.key === 'pass' || f.key === 'secret'
          const show = revealed.has(i)
          return (
            <div key={i} style={s.fieldRow}>
              <input
                style={{ ...s.input, ...s.fieldKey }}
                type="text"
                value={f.key}
                onInput={(e) => updateField(i, 'key', (e.target as HTMLInputElement).value)}
                placeholder="key"
              />
              <div style={s.fieldValWrap}>
                <input
                  style={{ ...s.input, ...s.fieldVal }}
                  type={isSecret && !show ? 'password' : 'text'}
                  value={f.value}
                  onInput={(e) => updateField(i, 'value', (e.target as HTMLInputElement).value)}
                  placeholder="value"
                />
                {isSecret && (
                  <button type="button" style={s.eyeBtn} onClick={() => toggleReveal(i)} title={show ? 'Hide' : 'Show'}>
                    {show ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                )}
              </div>
              <button
                type="button"
                style={s.removeBtn}
                onClick={() => removeField(i)}
                title="Remove"
              >×</button>
            </div>
          )
        })}

        {error && <p style={s.error}>{error}</p>}

        <button style={s.submitBtn} type="submit" disabled={loading}>
          {loading ? 'Saving…' : isEdit ? 'Update Secret' : 'Save to Vault'}
        </button>
      </form>
    </div>
  )
}

function BackIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
}
function EyeIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
}
function EyeOffIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
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
  inputDisabled: { opacity: 0.6, cursor: 'default' },
  fieldKey: { width: '38%', flexShrink: 0 },
  fieldValWrap: { flex: 1, position: 'relative', display: 'flex', alignItems: 'center' },
  fieldVal: { flex: 1, paddingRight: '26px' },
  eyeBtn: { position: 'absolute', right: '6px', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '0', display: 'flex', alignItems: 'center' },
  removeBtn: { background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '16px', padding: '0 4px', lineHeight: 1 },
  error: { color: 'var(--danger)', fontSize: '12px' },
  submitBtn: { background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', padding: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', marginTop: '4px' },
}

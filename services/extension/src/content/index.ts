interface FillPayload { username: string; password: string }
interface DoFillMessage { type: 'DO_FILL'; payload: FillPayload }

interface SafeCredential {
  path: string
  relativePath: string
  name: string
  username?: string
  url?: string
}

interface FullCredential extends SafeCredential {
  password?: string
  fields: Record<string, string>
}

// ── Native input value setter (React/Vue/Angular compatible) ──────────────────

function nativeInputValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
  setter?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

// ── Field detection ───────────────────────────────────────────────────────────

function findUsernameField(): HTMLInputElement | null {
  return (
    (document.querySelector(
      'input[autocomplete="username"], input[autocomplete="email"], ' +
      'input[type="email"], input[name="username"], input[name="email"], ' +
      'input[name="login"], input[id*="user"], input[id*="email"]',
    ) as HTMLInputElement | null) ??
    (document.querySelector('input[type="text"]') as HTMLInputElement | null)
  )
}

function findPasswordField(): HTMLInputElement | null {
  return document.querySelector('input[type="password"]') as HTMLInputElement | null
}

// ── Fill ──────────────────────────────────────────────────────────────────────

function doFill(payload: FillPayload) {
  const usernameEl = findUsernameField()
  const passwordEl = findPasswordField()
  if (usernameEl && payload.username) nativeInputValue(usernameEl, payload.username)
  if (passwordEl && payload.password) nativeInputValue(passwordEl, payload.password)
}

function fillFromCredential(cred: SafeCredential) {
  chrome.runtime.sendMessage(
    { type: 'GET_FULL_CREDENTIAL', path: cred.path },
    (res) => {
      if (!res?.ok || !res.data) return
      const full = res.data as FullCredential
      doFill({ username: full.username ?? '', password: full.password ?? '' })
    },
  )
}

// ── Inline lock icon + floating picker ───────────────────────────────────────

const INJECTED_ATTR = 'data-vaultfill'
const PICKER_ID = 'vaultfill-picker'

const LOCK_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f0b429" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`

function injectIcon(input: HTMLInputElement, creds: SafeCredential[]) {
  if (input.getAttribute(INJECTED_ATTR)) return
  input.setAttribute(INJECTED_ATTR, '1')

  // Extra right padding so text doesn't underlap the icon
  const currentPad = parseFloat(window.getComputedStyle(input).paddingRight) || 0
  input.style.paddingRight = `${currentPad + 26}px`

  const btn = document.createElement('button')
  btn.type = 'button'
  btn.title = creds.length === 1 ? `Fill: ${creds[0].name}` : 'Fill from Vault'
  btn.setAttribute(INJECTED_ATTR, '1')
  btn.innerHTML = LOCK_SVG

  Object.assign(btn.style, {
    position: 'fixed',
    zIndex: '2147483647',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '0',
    width: '20px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '3px',
    opacity: '0.7',
    transition: 'opacity 0.15s',
  })

  const place = () => {
    const r = input.getBoundingClientRect()
    if (!r.width) return
    btn.style.top = `${r.top + (r.height - 20) / 2}px`
    btn.style.left = `${r.right - 26}px`
  }
  place()
  document.body.appendChild(btn)

  btn.addEventListener('mouseenter', () => { btn.style.opacity = '1' })
  btn.addEventListener('mouseleave', () => { btn.style.opacity = '0.7' })
  window.addEventListener('scroll', place, { passive: true, capture: true })
  window.addEventListener('resize', place, { passive: true })

  btn.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (creds.length === 1) {
      fillFromCredential(creds[0])
      removePicker()
    } else {
      togglePicker(input, creds)
    }
  })
}

function removePicker() {
  document.getElementById(PICKER_ID)?.remove()
}

function togglePicker(anchor: HTMLInputElement, creds: SafeCredential[]) {
  if (document.getElementById(PICKER_ID)) { removePicker(); return }

  const rect = anchor.getBoundingClientRect()
  const picker = document.createElement('div')
  picker.id = PICKER_ID

  Object.assign(picker.style, {
    position: 'fixed',
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
    minWidth: `${Math.max(rect.width, 200)}px`,
    maxWidth: '320px',
    background: '#1a1f2e',
    border: '1px solid #2d3453',
    borderRadius: '8px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    zIndex: '2147483647',
    overflow: 'hidden',
    fontFamily: 'system-ui,-apple-system,sans-serif',
  })

  const header = document.createElement('div')
  header.textContent = 'Vault Fill'
  Object.assign(header.style, {
    padding: '7px 12px',
    fontSize: '11px',
    color: '#f0b429',
    fontWeight: '600',
    borderBottom: '1px solid #2d3453',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  })
  picker.appendChild(header)

  for (const cred of creds) {
    const row = document.createElement('div')
    Object.assign(row.style, {
      padding: '9px 12px',
      cursor: 'pointer',
      borderBottom: '1px solid #2d3453',
    })

    const name = document.createElement('div')
    name.textContent = cred.name
    Object.assign(name.style, { color: '#e8eaf6', fontSize: '13px', fontWeight: '500', marginBottom: '2px' })

    const sub = document.createElement('div')
    sub.textContent = cred.username ?? cred.url ?? cred.path
    Object.assign(sub.style, { color: '#888', fontSize: '11px' })

    row.appendChild(name)
    row.appendChild(sub)
    row.addEventListener('mouseenter', () => { row.style.background = '#262d42' })
    row.addEventListener('mouseleave', () => { row.style.background = 'transparent' })
    row.addEventListener('mousedown', (e) => {
      e.preventDefault()
      fillFromCredential(cred)
      removePicker()
    })
    picker.appendChild(row)
  }

  document.body.appendChild(picker)
  setTimeout(() => {
    document.addEventListener('click', removePicker, { once: true, capture: true })
  }, 0)
}

// ── Auto-fill + icon injection ────────────────────────────────────────────────

let autoFilled = false

function run() {
  const passEl = findPasswordField()
  const userEl = findUsernameField()
  if (!passEl && !userEl) return

  // Skip if already injected
  const alreadyInjected =
    (userEl?.getAttribute(INJECTED_ATTR) ?? null) !== null ||
    (passEl?.getAttribute(INJECTED_ATTR) ?? null) !== null
  if (alreadyInjected && autoFilled) return

  chrome.runtime.sendMessage(
    { type: 'GET_MATCHING_CREDENTIALS', payload: { tabUrl: window.location.href } },
    (res) => {
      if (!res?.ok || !res.data?.length) return
      const creds = res.data as SafeCredential[]

      if (userEl) injectIcon(userEl, creds)
      if (passEl) injectIcon(passEl, creds)

      // Auto-fill once if single match and both fields are empty
      if (!autoFilled && creds.length === 1 && !userEl?.value && !passEl?.value) {
        autoFilled = true
        fillFromCredential(creds[0])
      }
    },
  )
}

// Debounced observer for SPAs (forms appear after JS renders)
let debounce: ReturnType<typeof setTimeout> | null = null
const observer = new MutationObserver(() => {
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(run, 400)
})
observer.observe(document.documentElement, { childList: true, subtree: true })

// Initial run
run()

// ── Message listener ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message: DoFillMessage) => {
  if (message.type === 'DO_FILL') doFill(message.payload)
})

interface FillPayload { username: string; password: string }
interface DoFillMessage { type: 'DO_FILL'; payload: FillPayload }

interface SafeCredential {
  path: string
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

// ── Auto-fill on page load ────────────────────────────────────────────────────

let autoFilled = false

function tryAutoFill() {
  if (autoFilled) return
  const passEl = findPasswordField()
  const userEl = findUsernameField()
  if (!passEl && !userEl) return
  if (userEl?.value || passEl?.value) return  // already has content

  chrome.runtime.sendMessage(
    { type: 'GET_MATCHING_CREDENTIALS', payload: { tabUrl: window.location.href } },
    (res) => {
      if (!res?.ok || res.data?.length !== 1) return
      const cred = res.data[0] as SafeCredential
      autoFilled = true
      chrome.runtime.sendMessage(
        { type: 'GET_FULL_CREDENTIAL', path: cred.path },
        (fullRes) => {
          if (!fullRes?.ok || !fullRes.data) return
          const full = fullRes.data as FullCredential
          doFill({ username: full.username ?? '', password: full.password ?? '' })
        },
      )
    },
  )
}

// Debounced observer for SPAs (forms render after JS hydration)
let debounce: ReturnType<typeof setTimeout> | null = null
const observer = new MutationObserver(() => {
  if (autoFilled) { observer.disconnect(); return }
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(tryAutoFill, 400)
})
observer.observe(document.documentElement, { childList: true, subtree: true })

tryAutoFill()

// ── Message listener (fill triggered from popup) ──────────────────────────────

chrome.runtime.onMessage.addListener((message: DoFillMessage) => {
  if (message.type === 'DO_FILL') doFill(message.payload)
})

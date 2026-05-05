interface FillPayload {
  username: string
  password: string
}

interface DoFillMessage {
  type: 'DO_FILL'
  payload: FillPayload
}

/** Simulate native input events so React/Vue/Angular forms detect the change */
function nativeInputValue(el: HTMLInputElement, value: string) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )?.set
  nativeInputValueSetter?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

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
  return document.querySelector(
    'input[type="password"]',
  ) as HTMLInputElement | null
}

function doFill(payload: FillPayload) {
  const usernameEl = findUsernameField()
  const passwordEl = findPasswordField()

  // Only fill a field if the corresponding value is non-empty
  if (usernameEl && payload.username) {
    usernameEl.focus()
    nativeInputValue(usernameEl, payload.username)
  }
  if (passwordEl && payload.password) {
    passwordEl.focus()
    nativeInputValue(passwordEl, payload.password)
  }

  usernameEl?.focus()
}

chrome.runtime.onMessage.addListener((message: DoFillMessage) => {
  if (message.type === 'DO_FILL') {
    doFill(message.payload)
  }
})

import type { Credential } from './types'

/** Extract the hostname + optional port from a URL string */
function parseHost(raw: string): string {
  try {
    const u = new URL(raw)
    return u.hostname.replace(/^www\./, '')
  } catch {
    return raw.toLowerCase().replace(/^www\./, '')
  }
}

/**
 * Score how well a credential matches a tab URL.
 * Higher = better match.
 *  3 — exact origin match
 *  2 — hostname match
 *  1 — credential name (path leaf) matches hostname
 *  0 — no match
 */
function score(cred: Credential, tabUrl: string): number {
  const tabHost = parseHost(tabUrl)

  if (cred.url) {
    try {
      const credUrl = new URL(cred.url)
      const tabParsed = new URL(tabUrl)
      if (credUrl.origin === tabParsed.origin) return 3
      if (parseHost(cred.url) === tabHost) return 2
    } catch {
      if (parseHost(cred.url) === tabHost) return 2
    }
  }

  // Fall back to matching credential name against tab hostname
  const credName = cred.name.toLowerCase().replace(/^www\./, '')
  if (credName === tabHost) return 1
  if (tabHost.includes(credName) || credName.includes(tabHost)) return 1

  return 0
}

export function matchCredentials(
  credentials: Credential[],
  tabUrl: string,
): Credential[] {
  return credentials
    .map((c) => ({ cred: c, score: score(c, tabUrl) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.cred)
}

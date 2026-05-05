import type { Credential, VaultSettings } from './types'

interface KVSecret {
  data: {
    data: Record<string, string>
  }
}

interface KVList {
  data: {
    keys: string[]
  }
}

async function vaultFetch<T>(
  settings: VaultSettings,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const base = settings.url.replace(/\/$/, '')
  const res = await fetch(`${base}/v1/${path}`, {
    ...options,
    headers: {
      'X-Vault-Token': settings.token,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Vault ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

/** Recursively list all secret paths under a prefix */
async function listPaths(
  settings: VaultSettings,
  prefix: string,
): Promise<string[]> {
  const mount = settings.mountPath
  try {
    const result = await vaultFetch<KVList>(
      settings,
      `${mount}/metadata/${prefix}`,
      { method: 'LIST' },
    )
    const paths: string[] = []
    for (const key of result.data.keys) {
      if (key.endsWith('/')) {
        const sub = await listPaths(
          settings,
          [prefix, key.slice(0, -1)].filter(Boolean).join('/'),
        )
        paths.push(...sub)
      } else {
        paths.push([prefix, key].filter(Boolean).join('/'))
      }
    }
    return paths
  } catch {
    return []
  }
}

/** Read a single KV v2 secret and convert to Credential.
 *  Shows any secret that has at least one field — not limited to username/password. */
async function readCredential(
  settings: VaultSettings,
  path: string,
): Promise<Credential | null> {
  const mount = settings.mountPath
  try {
    const result = await vaultFetch<KVSecret>(settings, `${mount}/data/${path}`)
    const d = result.data.data
    if (!d || Object.keys(d).length === 0) return null
    return {
      path: `${mount}/data/${path}`,
      name: path.split('/').pop() ?? path,
      username: d['username'] ?? d['user'] ?? d['email'] ?? undefined,
      password: d['password'] ?? d['pass'] ?? d['secret'] ?? undefined,
      url: d['url'] ?? undefined,
      fields: d,
    }
  } catch {
    return null
  }
}

/** List all credentials from the Vault */
export async function listAllCredentials(
  settings: VaultSettings,
): Promise<Credential[]> {
  const paths = await listPaths(settings, '')
  const results = await Promise.all(
    paths.map((p) => readCredential(settings, p)),
  )
  return results.filter((c): c is Credential => c !== null)
}

/** Search credentials by query string */
export async function searchCredentials(
  settings: VaultSettings,
  query: string,
): Promise<Credential[]> {
  const all = await listAllCredentials(settings)
  if (!query.trim()) return all
  const q = query.toLowerCase()
  return all.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      (c.username?.toLowerCase().includes(q) ?? false) ||
      (c.url?.toLowerCase().includes(q) ?? false) ||
      Object.values(c.fields).some((v) => v.toLowerCase().includes(q)),
  )
}

/** Get credentials matching the given tab URL */
export async function getMatchingCredentials(
  settings: VaultSettings,
  tabUrl: string,
): Promise<Credential[]> {
  const all = await listAllCredentials(settings)
  const { matchCredentials } = await import('./matcher')
  return matchCredentials(all, tabUrl)
}

/** Write (create or update) a secret in Vault KV v2 */
export async function writeCredential(
  settings: VaultSettings,
  path: string,
  fields: Record<string, string>,
): Promise<void> {
  const mount = settings.mountPath
  await vaultFetch(settings, `${mount}/data/${path}`, {
    method: 'POST',
    body: JSON.stringify({ data: fields }),
  })
}

/** Verify connection by checking token capabilities */
export async function testConnection(settings: VaultSettings): Promise<void> {
  await vaultFetch(settings, 'auth/token/lookup-self')
}

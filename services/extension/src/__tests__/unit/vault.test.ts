import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VaultSettings } from '../../lib/types'

const settings: VaultSettings = {
  url: 'https://vault.example.com',
  token: 'hvs.TEST123',
  mountPath: 'secret',
}

// vault.ts LIST-recurses from empty prefix → paths like '/web/github.com'
// readCredential strips leading slash → 'web/github.com'
// Final URL: 'secret/data/web/github.com'
// LIST requests hit: 'secret/metadata/', 'secret/metadata//web'
function mockFetch(responses: Record<string, unknown>) {
  return vi.fn((url: string, init?: RequestInit) => {
    const path = url.replace('https://vault.example.com/v1/', '')
    const body = responses[path]
    if (body === undefined) {
      return Promise.resolve({
        ok: false,
        status: 404,
        text: () => Promise.resolve('not found'),
      })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
  }) as typeof fetch
}

describe('vault', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  describe('listAllCredentials', () => {
    it('returns credentials from a nested path', async () => {
      globalThis.fetch = mockFetch({
        // LIST root
        'secret/metadata/': { data: { keys: ['web/'] } },
        // LIST web  → no double-slash after fix
        'secret/metadata/web': { data: { keys: ['github.com'] } },
        // READ web/github.com
        'secret/data/web/github.com': {
          data: {
            data: { username: 'myuser', password: 'mypass', url: 'https://github.com' },
          },
        },
      })

      const { listAllCredentials } = await import('../../lib/vault')
      const creds = await listAllCredentials(settings)
      expect(creds).toHaveLength(1)
      expect(creds[0]).toMatchObject({
        username: 'myuser',
        password: 'mypass',
        url: 'https://github.com',
        name: 'github.com',
      })
    })

    it('returns credentials from a flat path (no subdirs)', async () => {
      globalThis.fetch = mockFetch({
        'secret/metadata/': { data: { keys: ['mysite'] } },
        'secret/data/mysite': {
          data: { data: { username: 'u', password: 'p' } },
        },
      })

      const { listAllCredentials } = await import('../../lib/vault')
      const creds = await listAllCredentials(settings)
      expect(creds).toHaveLength(1)
      expect(creds[0]?.name).toBe('mysite')
    })

    it('skips secrets without username and password', async () => {
      globalThis.fetch = mockFetch({
        'secret/metadata/': { data: { keys: ['no-creds'] } },
        'secret/data/no-creds': {
          data: { data: { notes: 'just a note' } },
        },
      })

      const { listAllCredentials } = await import('../../lib/vault')
      const creds = await listAllCredentials(settings)
      expect(creds).toHaveLength(0)
    })

    it('handles list errors gracefully', async () => {
      globalThis.fetch = vi.fn(() =>
        Promise.resolve({ ok: false, status: 403, text: () => Promise.resolve('forbidden') }),
      ) as typeof fetch

      const { listAllCredentials } = await import('../../lib/vault')
      const creds = await listAllCredentials(settings)
      expect(creds).toEqual([])
    })
  })

  describe('searchCredentials', () => {
    it('filters by name', async () => {
      globalThis.fetch = mockFetch({
        'secret/metadata/': { data: { keys: ['github.com', 'gitlab.com'] } },
        'secret/data/github.com': {
          data: { data: { username: 'u1', password: 'p1', url: 'https://github.com' } },
        },
        'secret/data/gitlab.com': {
          data: { data: { username: 'u2', password: 'p2', url: 'https://gitlab.com' } },
        },
      })

      const { searchCredentials } = await import('../../lib/vault')
      const results = await searchCredentials(settings, 'github')
      expect(results).toHaveLength(1)
      expect(results[0]?.name).toBe('github.com')
    })

    it('returns all on empty query', async () => {
      globalThis.fetch = mockFetch({
        'secret/metadata/': { data: { keys: ['site-a', 'site-b'] } },
        'secret/data/site-a': {
          data: { data: { username: 'ua', password: 'pa' } },
        },
        'secret/data/site-b': {
          data: { data: { username: 'ub', password: 'pb' } },
        },
      })

      const { searchCredentials } = await import('../../lib/vault')
      const results = await searchCredentials(settings, '')
      expect(results).toHaveLength(2)
    })
  })

  describe('testConnection', () => {
    it('resolves on 200', async () => {
      globalThis.fetch = vi.fn(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
      ) as typeof fetch

      const { testConnection } = await import('../../lib/vault')
      await expect(testConnection(settings)).resolves.toBeUndefined()
    })

    it('throws on non-200', async () => {
      globalThis.fetch = vi.fn(() =>
        Promise.resolve({ ok: false, status: 403, text: () => Promise.resolve('forbidden') }),
      ) as typeof fetch

      const { testConnection } = await import('../../lib/vault')
      await expect(testConnection(settings)).rejects.toThrow('403')
    })
  })
})

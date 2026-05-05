import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VaultSettings } from '../../lib/types'

const settings: VaultSettings = {
  url: 'https://vault.example.com',
  token: 'hvs.TEST123',
  mountPath: 'secret',
}

function mockFetch(responses: Record<string, unknown>) {
  return vi.fn((url: string) => {
    const path = url.replace('https://vault.example.com/v1/', '')
    const body = responses[path]
    if (body === undefined) {
      return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('not found') })
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
        'secret/metadata/': { data: { keys: ['web/'] } },
        'secret/metadata/web': { data: { keys: ['github.com'] } },
        'secret/data/web/github.com': {
          data: { data: { username: 'myuser', password: 'mypass', url: 'https://github.com' } },
        },
      })
      const { listAllCredentials } = await import('../../lib/vault')
      const creds = await listAllCredentials(settings)
      expect(creds).toHaveLength(1)
      expect(creds[0]).toMatchObject({ username: 'myuser', password: 'mypass', url: 'https://github.com', name: 'github.com' })
    })

    it('returns credentials from a flat path', async () => {
      globalThis.fetch = mockFetch({
        'secret/metadata/': { data: { keys: ['mysite'] } },
        'secret/data/mysite': { data: { data: { username: 'u', password: 'p' } } },
      })
      const { listAllCredentials } = await import('../../lib/vault')
      const creds = await listAllCredentials(settings)
      expect(creds).toHaveLength(1)
      expect(creds[0]?.name).toBe('mysite')
    })

    it('returns secrets that have no username/password (any field)', async () => {
      globalThis.fetch = mockFetch({
        'secret/metadata/': { data: { keys: ['token-only'] } },
        'secret/data/token-only': { data: { data: { token: 'abc123', url: 'https://api.example.com' } } },
      })
      const { listAllCredentials } = await import('../../lib/vault')
      const creds = await listAllCredentials(settings)
      expect(creds).toHaveLength(1)
      expect(creds[0]?.fields).toEqual({ token: 'abc123', url: 'https://api.example.com' })
    })

    it('skips secrets with empty data', async () => {
      globalThis.fetch = mockFetch({
        'secret/metadata/': { data: { keys: ['empty'] } },
        'secret/data/empty': { data: { data: {} } },
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
      expect(await listAllCredentials(settings)).toEqual([])
    })
  })

  describe('searchCredentials', () => {
    it('filters by name', async () => {
      globalThis.fetch = mockFetch({
        'secret/metadata/': { data: { keys: ['github.com', 'gitlab.com'] } },
        'secret/data/github.com': { data: { data: { username: 'u1', password: 'p1', url: 'https://github.com' } } },
        'secret/data/gitlab.com': { data: { data: { username: 'u2', password: 'p2', url: 'https://gitlab.com' } } },
      })
      const { searchCredentials } = await import('../../lib/vault')
      const results = await searchCredentials(settings, 'github')
      expect(results).toHaveLength(1)
      expect(results[0]?.name).toBe('github.com')
    })

    it('returns all on empty query', async () => {
      globalThis.fetch = mockFetch({
        'secret/metadata/': { data: { keys: ['site-a', 'site-b'] } },
        'secret/data/site-a': { data: { data: { username: 'ua', password: 'pa' } } },
        'secret/data/site-b': { data: { data: { username: 'ub', password: 'pb' } } },
      })
      const { searchCredentials } = await import('../../lib/vault')
      expect(await searchCredentials(settings, '')).toHaveLength(2)
    })

    it('searches across arbitrary fields', async () => {
      globalThis.fetch = mockFetch({
        'secret/metadata/': { data: { keys: ['api-key'] } },
        'secret/data/api-key': { data: { data: { token: 'abc123', service: 'stripe' } } },
      })
      const { searchCredentials } = await import('../../lib/vault')
      const results = await searchCredentials(settings, 'stripe')
      expect(results).toHaveLength(1)
    })
  })

  describe('writeCredential', () => {
    it('POSTs to the correct Vault path', async () => {
      const mockPost = vi.fn(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
      ) as typeof fetch
      globalThis.fetch = mockPost

      const { writeCredential } = await import('../../lib/vault')
      await writeCredential(settings, 'web/newsite.com', { username: 'u', password: 'p' })

      expect(mockPost).toHaveBeenCalledWith(
        'https://vault.example.com/v1/secret/data/web/newsite.com',
        expect.objectContaining({ method: 'POST' }),
      )
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

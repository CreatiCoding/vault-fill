import { describe, it, expect } from 'vitest'
import { matchCredentials } from '../../lib/matcher'
import type { Credential } from '../../lib/types'

const make = (overrides: Partial<Credential>): Credential => ({
  path: 'secret/data/web/example.com',
  name: 'example.com',
  username: 'user',
  password: 'pass',
  ...overrides,
})

describe('matchCredentials', () => {
  it('returns empty when no credentials', () => {
    expect(matchCredentials([], 'https://example.com')).toEqual([])
  })

  it('matches by exact origin', () => {
    const cred = make({ url: 'https://example.com', name: 'example.com' })
    const results = matchCredentials([cred], 'https://example.com/login')
    expect(results).toHaveLength(1)
    expect(results[0]).toBe(cred)
  })

  it('matches by hostname when origin differs (http vs https)', () => {
    const cred = make({ url: 'http://example.com', name: 'example.com' })
    const results = matchCredentials([cred], 'https://example.com/login')
    expect(results).toHaveLength(1)
  })

  it('matches by credential name when no url field', () => {
    const cred = make({ url: undefined, name: 'example.com' })
    const results = matchCredentials([cred], 'https://example.com/login')
    expect(results).toHaveLength(1)
  })

  it('ignores www prefix when matching by name', () => {
    const cred = make({ url: undefined, name: 'example.com' })
    const results = matchCredentials([cred], 'https://www.example.com/')
    expect(results).toHaveLength(1)
  })

  it('does not match unrelated domain', () => {
    const cred = make({ url: 'https://other.com', name: 'other.com' })
    const results = matchCredentials([cred], 'https://example.com')
    expect(results).toHaveLength(0)
  })

  it('sorts exact origin match before hostname-only match', () => {
    const exact = make({ url: 'https://example.com', name: 'example-exact' })
    const hostname = make({ url: 'http://example.com', name: 'example-hostname' })
    const results = matchCredentials([hostname, exact], 'https://example.com')
    expect(results[0]).toBe(exact)
  })

  it('matches multiple credentials for the same domain', () => {
    const a = make({ path: 'a', url: 'https://example.com', name: 'example-a' })
    const b = make({ path: 'b', url: 'https://example.com', name: 'example-b' })
    const c = make({ path: 'c', url: 'https://other.com', name: 'other.com' })
    const results = matchCredentials([a, b, c], 'https://example.com')
    expect(results).toHaveLength(2)
  })

  it('handles malformed tab URL gracefully', () => {
    const cred = make({ name: 'example.com' })
    expect(() => matchCredentials([cred], 'not-a-url')).not.toThrow()
  })

  it('handles malformed credential URL gracefully', () => {
    const cred = make({ url: 'not-a-url', name: 'example.com' })
    expect(() => matchCredentials([cred], 'https://example.com')).not.toThrow()
  })

  it('partial name match works (subdomain)', () => {
    const cred = make({ url: undefined, name: 'github.com' })
    const results = matchCredentials([cred], 'https://gist.github.com')
    expect(results).toHaveLength(1)
  })
})

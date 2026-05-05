import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/preact'
import { CredentialList } from '../../../popup/components/CredentialList'

const mockMatched = [
  { path: 'secret/data/web/github.com', name: 'github.com', username: 'alice', url: 'https://github.com' },
  { path: 'secret/data/web/gitlab.com', name: 'gitlab.com', username: 'alice', url: 'https://gitlab.com' },
]

const mockSearchResults = [
  { path: 'secret/data/web/github.com', name: 'github.com', username: 'alice', url: 'https://github.com' },
]

function setupChromeMocks() {
  vi.mocked(chrome.tabs.query).mockImplementation((_q, cb) =>
    cb([{ id: 1, url: 'https://github.com' } as chrome.tabs.Tab]),
  )
  vi.mocked(chrome.runtime.sendMessage).mockImplementation((msg, cb) => {
    const m = msg as { type: string }
    const callback = cb as (r: unknown) => void
    if (m.type === 'GET_MATCHING_CREDENTIALS') {
      callback({ ok: true, data: mockMatched })
    } else if (m.type === 'SEARCH_CREDENTIALS') {
      callback({ ok: true, data: mockSearchResults })
    } else if (m.type === 'GET_FULL_CREDENTIAL') {
      callback({ ok: true, data: { ...mockMatched[0], password: 's3cret' } })
    } else {
      callback({ ok: true, data: null })
    }
  })
}

describe('CredentialList component', () => {
  beforeEach(() => {
    setupChromeMocks()
  })

  it('shows matched credentials on load', async () => {
    render(<CredentialList tabUrl="https://github.com" onLogout={vi.fn()} />)
    expect(await screen.findByText('github.com')).toBeInTheDocument()
    expect(await screen.findByText('gitlab.com')).toBeInTheDocument()
  })

  it('shows badge count on matched tab', async () => {
    render(<CredentialList tabUrl="https://github.com" onLogout={vi.fn()} />)
    await screen.findByText('github.com')
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('shows empty state when no matches', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockImplementation((msg, cb) => {
      const m = msg as { type: string }
      const callback = cb as (r: unknown) => void
      if (m.type === 'GET_MATCHING_CREDENTIALS') callback({ ok: true, data: [] })
      else callback({ ok: true, data: null })
    })
    render(<CredentialList tabUrl="https://unknown-site.com" onLogout={vi.fn()} />)
    expect(await screen.findByText(/no credentials found/i)).toBeInTheDocument()
  })

  it('switches to search tab and shows input', async () => {
    render(<CredentialList tabUrl="https://github.com" onLogout={vi.fn()} />)
    await screen.findByText('github.com')
    fireEvent.click(screen.getByRole('button', { name: /search/i }))
    expect(screen.getByPlaceholderText(/search credentials/i)).toBeInTheDocument()
  })

  it('searches and dispatches message when typing', async () => {
    render(<CredentialList tabUrl="https://github.com" onLogout={vi.fn()} />)
    await screen.findByText('github.com')

    fireEvent.click(screen.getByRole('button', { name: /search/i }))
    const input = screen.getByPlaceholderText(/search credentials/i)
    fireEvent.input(input, { target: { value: 'github' } })

    await waitFor(() =>
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'SEARCH_CREDENTIALS', payload: { query: 'github' } }),
        expect.any(Function),
      ),
    )
  })

  it('shows "type to search" hint when query is empty', async () => {
    render(<CredentialList tabUrl="https://github.com" onLogout={vi.fn()} />)
    await screen.findByText('github.com')
    fireEvent.click(screen.getByRole('button', { name: /search/i }))
    expect(screen.getByText(/type to search/i)).toBeInTheDocument()
  })

  it('calls onLogout when disconnect button is clicked', async () => {
    const onLogout = vi.fn()
    render(<CredentialList tabUrl="https://github.com" onLogout={onLogout} />)
    await screen.findByText('github.com')
    fireEvent.click(screen.getByTitle(/disconnect/i))
    expect(onLogout).toHaveBeenCalledOnce()
  })

  it('shows error message on fetch failure', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockImplementation((msg, cb) => {
      const m = msg as { type: string }
      const callback = cb as (r: unknown) => void
      if (m.type === 'GET_MATCHING_CREDENTIALS')
        callback({ ok: false, error: 'Vault not configured' })
      else callback({ ok: true, data: null })
    })
    render(<CredentialList tabUrl="https://github.com" onLogout={vi.fn()} />)
    expect(await screen.findByText(/vault not configured/i)).toBeInTheDocument()
  })
})

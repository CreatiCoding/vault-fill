import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/preact'
import userEvent from '@testing-library/user-event'
import { Setup } from '../../../popup/components/Setup'

describe('Setup component', () => {
  beforeEach(() => {
    vi.mocked(chrome.runtime.sendMessage).mockReset()
  })

  it('renders all fields', () => {
    render(<Setup onSaved={vi.fn()} />)
    expect(screen.getByPlaceholderText('https://vault.example.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('hvs.XXXXXXXXXXXX')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('secret')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument()
  })

  it('shows error when URL is not HTTPS', async () => {
    render(<Setup onSaved={vi.fn()} />)
    const urlInput = screen.getByPlaceholderText('https://vault.example.com')
    await userEvent.clear(urlInput)
    await userEvent.type(urlInput, 'http://vault.example.com')
    fireEvent.submit(urlInput.closest('form')!)
    expect(await screen.findByText(/must use https/i)).toBeInTheDocument()
  })

  it('shows error when token is empty', async () => {
    render(<Setup onSaved={vi.fn()} />)
    const urlInput = screen.getByPlaceholderText('https://vault.example.com')
    await userEvent.clear(urlInput)
    await userEvent.type(urlInput, 'https://vault.example.com')
    fireEvent.submit(urlInput.closest('form')!)
    expect(await screen.findByText(/token is required/i)).toBeInTheDocument()
  })

  it('calls onSaved with settings on success', async () => {
    const onSaved = vi.fn()
    vi.mocked(chrome.runtime.sendMessage).mockImplementation((_msg, cb) =>
      (cb as (r: unknown) => void)({ ok: true }),
    )

    render(<Setup onSaved={onSaved} />)

    await userEvent.clear(screen.getByPlaceholderText('https://vault.example.com'))
    await userEvent.type(
      screen.getByPlaceholderText('https://vault.example.com'),
      'https://vault.example.com',
    )
    await userEvent.type(screen.getByPlaceholderText('hvs.XXXXXXXXXXXX'), 'hvs.TOKEN')

    fireEvent.submit(screen.getByRole('button', { name: /connect/i }).closest('form')!)

    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce())
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://vault.example.com',
        token: 'hvs.TOKEN',
        mountPath: 'secret',
      }),
    )
  })

  it('shows error message on failed save', async () => {
    vi.mocked(chrome.runtime.sendMessage).mockImplementation((_msg, cb) =>
      (cb as (r: unknown) => void)({ ok: false, error: 'Connection refused' }),
    )

    render(<Setup onSaved={vi.fn()} />)

    await userEvent.clear(screen.getByPlaceholderText('https://vault.example.com'))
    await userEvent.type(
      screen.getByPlaceholderText('https://vault.example.com'),
      'https://vault.example.com',
    )
    await userEvent.type(screen.getByPlaceholderText('hvs.XXXXXXXXXXXX'), 'hvs.BAD')

    fireEvent.submit(screen.getByRole('button', { name: /connect/i }).closest('form')!)

    expect(await screen.findByText(/connection refused/i)).toBeInTheDocument()
  })

  it('strips trailing slash from Vault URL before saving', async () => {
    const onSaved = vi.fn()
    vi.mocked(chrome.runtime.sendMessage).mockImplementation((_msg, cb) =>
      (cb as (r: unknown) => void)({ ok: true }),
    )

    render(<Setup onSaved={onSaved} />)

    await userEvent.clear(screen.getByPlaceholderText('https://vault.example.com'))
    await userEvent.type(
      screen.getByPlaceholderText('https://vault.example.com'),
      'https://vault.example.com/',
    )
    await userEvent.type(screen.getByPlaceholderText('hvs.XXXXXXXXXXXX'), 'hvs.TOKEN')

    fireEvent.submit(screen.getByRole('button', { name: /connect/i }).closest('form')!)

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect((onSaved.mock.calls[0] as [{ url: string }][])[0]?.url).toBe(
      'https://vault.example.com',
    )
  })
})

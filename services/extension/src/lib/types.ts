export interface VaultSettings {
  url: string
  token: string
  mountPath: string // e.g. "secret"
}

export interface Credential {
  path: string      // full secret path, e.g. "secret/data/web/github.com"
  name: string      // display name derived from path
  username: string
  password: string
  url?: string
}

export interface FillRequest {
  username: string
  password: string
}

// Messages between popup/background/content
export type Message =
  | { type: 'GET_SETTINGS' }
  | { type: 'SAVE_SETTINGS'; payload: VaultSettings }
  | { type: 'SEARCH_CREDENTIALS'; payload: { query: string } }
  | { type: 'GET_MATCHING_CREDENTIALS'; payload: { tabUrl: string } }
  | { type: 'FILL_CREDENTIALS'; payload: FillRequest }
  | { type: 'COPY_TO_CLIPBOARD'; payload: { text: string } }
  | { type: 'GET_BADGE_COUNT'; payload: { tabUrl: string } }

export type MessageResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string }

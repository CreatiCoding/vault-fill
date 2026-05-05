export interface VaultSettings {
  url: string
  token: string
  mountPath: string
}

export interface Credential {
  path: string       // full secret path, e.g. "secret/data/web/github.com"
  name: string       // display name derived from path leaf
  username?: string  // value of "username" field if present
  password?: string  // value of "password" field if present
  url?: string       // value of "url" field if present
  fields: Record<string, string>  // all fields in the secret
}

export interface FillRequest {
  username: string
  password: string
}

// Messages between popup/background/content
export type Message =
  | { type: 'GET_SETTINGS' }
  | { type: 'SAVE_SETTINGS'; payload: VaultSettings | null }
  | { type: 'SEARCH_CREDENTIALS'; payload: { query: string } }
  | { type: 'GET_MATCHING_CREDENTIALS'; payload: { tabUrl: string } }
  | { type: 'FILL_CREDENTIALS'; payload: FillRequest }
  | { type: 'GET_BADGE_COUNT'; payload: { tabUrl: string } }
  | { type: 'WRITE_CREDENTIAL'; payload: { path: string; fields: Record<string, string> } }
  | { type: 'GET_FULL_CREDENTIAL'; path: string }

export type MessageResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string }

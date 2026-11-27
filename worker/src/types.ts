/**
 * Minimal subset of Cloudflare Workers KVNamespace used by this worker.
 * Kept self-contained so tests and local Node dev servers need no runtime deps.
 */
export interface KVNamespaceLike {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
}

export interface Env {
  KV: KVNamespaceLike
  /** Comma-separated frontend origins allowed for CORS & OAuth redirects. */
  ALLOWED_ORIGINS?: string
  /** Public base URL of this worker, e.g. https://api.ohmwork.linjiejim.com */
  PUBLIC_BASE_URL?: string
  GITHUB_CLIENT_ID?: string
  GITHUB_CLIENT_SECRET?: string
  /** Test / local mock overrides for GitHub endpoints. */
  GITHUB_OAUTH_BASE?: string
  GITHUB_API_BASE?: string
}

export interface GitHubIdentity {
  id: string
  login: string
  name: string | null
  avatarUrl: string | null
}

export interface StoredUser {
  id: string
  username: string | null
  passwordHash: string | null
  github: GitHubIdentity | null
  createdAt: number
  updatedAt: number
}

export interface PublicUser {
  id: string
  username: string | null
  hasPassword: boolean
  github: GitHubIdentity | null
  createdAt: number
}

export interface SessionRecord {
  userId: string
  createdAt: number
}

export interface ProgressDoc {
  done: Record<string, number>
  updatedAt: number
}

export interface OAuthState {
  mode: "login" | "link"
  userId?: string
  returnTo: string
  origin: string
}

export interface ExchangeTicket {
  token: string
  event: "github_login"
}

export function toPublicUser(user: StoredUser): PublicUser {
  return {
    id: user.id,
    username: user.username,
    hasPassword: Boolean(user.passwordHash),
    github: user.github,
    createdAt: user.createdAt,
  }
}

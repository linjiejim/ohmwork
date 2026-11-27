/**
 * Minimal subset of Cloudflare D1Database used by this worker.
 * Kept self-contained so tests and local Node SQLite servers need no runtime deps.
 */
export interface D1Meta {
  changes?: number
}

export interface D1Result<T = Record<string, unknown>> {
  results: T[]
  success: boolean
  meta: D1Meta
}

export interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>
  run(): Promise<D1Result<never>>
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike
  batch<T = Record<string, unknown>>(statements: D1PreparedStatementLike[]): Promise<D1Result<T>[]>
}

export interface Env {
  DB: D1DatabaseLike
  /** Comma-separated frontend origins allowed for CORS & OAuth redirects. */
  ALLOWED_ORIGINS?: string
  /** Public base URL of this worker, e.g. https://ohmwork-api.jimlin.me */
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

export interface UserRow {
  id: string
  username: string | null
  password_hash: string | null
  github_id: string | null
  github_login: string | null
  github_name: string | null
  github_avatar_url: string | null
  created_at: number
  updated_at: number
}

export interface PublicUser {
  id: string
  username: string | null
  hasPassword: boolean
  github: GitHubIdentity | null
  createdAt: number
}

export interface ProgressDoc {
  done: Record<string, number>
  updatedAt: number
}

export function rowToUser(row: UserRow): StoredUser {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    github:
      row.github_id && row.github_login
        ? {
            id: row.github_id,
            login: row.github_login,
            name: row.github_name,
            avatarUrl: row.github_avatar_url,
          }
        : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
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

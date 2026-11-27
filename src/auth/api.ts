import type { DoneMap, PendingChanges } from "@/curriculum/progress"

export interface GitHubIdentity {
  id: string
  login: string
  name: string | null
  avatarUrl: string | null
}

export interface PublicUser {
  id: string
  username: string | null
  hasPassword: boolean
  github: GitHubIdentity | null
  createdAt: number
}

export interface ProgressPayload {
  done: DoneMap
  updatedAt: number
}

export interface AuthResponse {
  token: string
  user: PublicUser
  progress: ProgressPayload
}

export interface MeResponse {
  user: PublicUser
  progress: ProgressPayload
}

export interface AuthConfigResponse {
  ok: boolean
  githubEnabled: boolean
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

let apiBaseOverride: string | null = null

/** Tests can point the auth client at a mock or local worker URL (pass "" to disable). */
export function setApiBaseForTest(url: string | null) {
  apiBaseOverride = url
}

export function getApiBase(): string {
  if (apiBaseOverride !== null) return apiBaseOverride.replace(/\/+$/, "")
  const configured = (import.meta.env.VITE_API_BASE as string | undefined)?.trim()
  if (configured) return configured.replace(/\/+$/, "")
  // In Vite dev, /api proxies to http://127.0.0.1:8787 (vite.config.ts) so local full-stack dev needs no .env.
  // In tests or production without VITE_API_BASE, cloud sync stays off and the site stays pure-local.
  if (import.meta.env.DEV && import.meta.env.MODE !== "test") return "/api"
  return ""
}

export function isSyncEnabled(): boolean {
  return getApiBase().length > 0
}

async function requestJson<T>(
  path: string,
  opts: { method?: string; token?: string; body?: unknown } = {},
): Promise<T> {
  const base = getApiBase()
  if (!base) throw new ApiError(0, "云同步服务未配置")
  const headers: Record<string, string> = {}
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`
  if (opts.body !== undefined) headers["Content-Type"] = "application/json"

  let res: Response
  try {
    res = await fetch(`${base}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    })
  } catch {
    throw new ApiError(0, "无法连接到同步服务，请检查网络后重试")
  }

  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : `请求失败（${res.status}）`
    throw new ApiError(res.status, msg)
  }
  return data as T
}

export function fetchConfig(): Promise<AuthConfigResponse> {
  return requestJson<AuthConfigResponse>("/auth/config")
}

export function fetchMe(token: string): Promise<MeResponse> {
  return requestJson<MeResponse>("/auth/me", { token })
}

export function register(username: string, password: string): Promise<AuthResponse> {
  return requestJson<AuthResponse>("/auth/register", { method: "POST", body: { username, password } })
}

export function login(username: string, password: string): Promise<AuthResponse> {
  return requestJson<AuthResponse>("/auth/login", { method: "POST", body: { username, password } })
}

export function logout(token: string): Promise<{ ok: boolean }> {
  return requestJson<{ ok: boolean }>("/auth/logout", { method: "POST", token })
}

export function exchangeCode(code: string): Promise<AuthResponse> {
  return requestJson<AuthResponse>("/auth/exchange", { method: "POST", body: { code } })
}

export function githubLoginUrl(returnTo: string, origin: string): string {
  const base = getApiBase()
  const params = new URLSearchParams({ returnTo, origin })
  return `${base}/auth/github/start?${params.toString()}`
}

export function startGithubLink(token: string, returnTo: string, origin: string): Promise<{ url: string }> {
  return requestJson<{ url: string }>("/auth/github/link-start", {
    method: "POST",
    token,
    body: { returnTo, origin },
  })
}

/** Completes a GitHub binding with the session that started it (see worker /account/github/link-confirm). */
export function confirmGithubLink(token: string, code: string): Promise<{ user: PublicUser }> {
  return requestJson<{ user: PublicUser }>("/account/github/link-confirm", { method: "POST", token, body: { code } })
}

export function bindPassword(token: string, username: string, password: string): Promise<{ user: PublicUser }> {
  return requestJson<{ user: PublicUser }>("/account/bind-password", {
    method: "POST",
    token,
    body: { username, password },
  })
}

export function changePassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: boolean }> {
  return requestJson<{ ok: boolean }>("/account/password", {
    method: "POST",
    token,
    body: { currentPassword, newPassword },
  })
}

export function unbindGithub(token: string): Promise<{ user: PublicUser }> {
  return requestJson<{ user: PublicUser }>("/account/unbind-github", { method: "POST", token })
}

export function mergeProgress(token: string, done: DoneMap): Promise<ProgressPayload> {
  return requestJson<ProgressPayload>("/progress/merge", { method: "POST", token, body: { done } })
}

export function patchProgress(token: string, changes: PendingChanges): Promise<ProgressPayload> {
  return requestJson<ProgressPayload>("/progress", { method: "PATCH", token, body: { changes } })
}

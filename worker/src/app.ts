import { DUMMY_PASSWORD_HASH, hashPassword, randomHex, sha256Hex, verifyPassword } from "./crypto.ts"
import {
  toPublicUser,
  type Env,
  type ExchangeTicket,
  type GitHubIdentity,
  type OAuthState,
  type ProgressDoc,
  type SessionRecord,
  type StoredUser,
} from "./types.ts"
import {
  sanitizeAvatarUrl,
  sanitizeDoneMap,
  sanitizeProgressChanges,
  sanitizeReturnTo,
  validatePassword,
  validateUsername,
} from "./validation.ts"

const DEFAULT_ORIGINS = [
  "https://ohmwork.linjiejim.com",
  "http://localhost:5273",
  "http://127.0.0.1:5273",
]

const SESSION_TTL_SEC = 60 * 60 * 24 * 30 // 30 days
const OAUTH_STATE_TTL_SEC = 60 * 10 // 10 minutes
const TICKET_TTL_SEC = 60 // 1 minute
const MAX_BODY_BYTES = 16 * 1024
const MAX_PROGRESS_KEYS = 200

export interface RequestOptions {
  fetchImpl?: typeof fetch
  now?: () => number
}

function parseAllowedOrigins(env: Env): string[] {
  if (!env.ALLOWED_ORIGINS) return DEFAULT_ORIGINS
  const list = env.ALLOWED_ORIGINS.split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean)
  return list.length > 0 ? list : DEFAULT_ORIGINS
}

function resolveAllowedOrigin(candidate: string | null | undefined, allowed: string[]): string | null {
  if (!candidate) return null
  try {
    const origin = new URL(candidate).origin
    return allowed.includes(origin) ? origin : null
  } catch {
    return null
  }
}

function pickFrontendOrigin(explicit: string | null | undefined, request: Request, allowed: string[]): string {
  return (
    resolveAllowedOrigin(explicit, allowed) ??
    resolveAllowedOrigin(request.headers.get("Origin"), allowed) ??
    resolveAllowedOrigin(request.headers.get("Referer"), allowed) ??
    allowed[0]
  )
}

function corsHeaders(request: Request, allowed: string[]): Record<string, string> {
  const reqOrigin = request.headers.get("Origin")
  const headers: Record<string, string> = {
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
  }
  if (reqOrigin && allowed.includes(reqOrigin)) {
    headers["Access-Control-Allow-Origin"] = reqOrigin
  }
  return headers
}

function jsonResponse(data: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...cors,
    },
  })
}

function redirectResponse(location: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      "Cache-Control": "no-store",
    },
  })
}

function clientIp(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ??
    "local"
  )
}

async function readJsonBody(request: Request): Promise<{ ok: true; value: Record<string, unknown> } | { ok: false; status: number; error: string }> {
  const len = Number(request.headers.get("Content-Length") ?? "0")
  if (Number.isFinite(len) && len > MAX_BODY_BYTES) {
    return { ok: false, status: 413, error: "请求体过大" }
  }
  const text = await request.text()
  if (text.length > MAX_BODY_BYTES) {
    return { ok: false, status: 413, error: "请求体过大" }
  }
  if (!text) return { ok: true, value: {} }
  try {
    const parsed = JSON.parse(text) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, status: 400, error: "请求格式不正确" }
    }
    return { ok: true, value: parsed as Record<string, unknown> }
  } catch {
    return { ok: false, status: 400, error: "请求 JSON 无法解析" }
  }
}

async function getJson<T>(env: Env, key: string): Promise<T | null> {
  const raw = await env.KV.get(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

async function putJson(env: Env, key: string, value: unknown, ttl?: number): Promise<void> {
  await env.KV.put(key, JSON.stringify(value), ttl ? { expirationTtl: ttl } : undefined)
}

async function checkRateLimit(env: Env, bucket: string, limit: number, ttlSec: number, now: number): Promise<boolean> {
  const key = `rl:${bucket}`
  const existing = await getJson<{ count: number; resetAt: number }>(env, key)
  if (!existing || existing.resetAt <= now) {
    await putJson(env, key, { count: 1, resetAt: now + ttlSec * 1000 }, ttlSec)
    return true
  }
  if (existing.count >= limit) return false
  const remaining = Math.max(60, Math.ceil((existing.resetAt - now) / 1000))
  await putJson(env, key, { count: existing.count + 1, resetAt: existing.resetAt }, remaining)
  return true
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization")
  if (!header) return null
  const match = header.match(/^Bearer\s+([a-zA-Z0-9._-]{16,256})$/)
  return match ? match[1] : null
}

async function createSession(env: Env, userId: string, now: number): Promise<string> {
  const rawToken = randomHex(32)
  const hash = await sha256Hex(rawToken)
  const record: SessionRecord = { userId, createdAt: now }
  await putJson(env, `session:${hash}`, record, SESSION_TTL_SEC)
  return rawToken
}

async function authenticate(request: Request, env: Env): Promise<{ tokenHash: string; user: StoredUser } | null> {
  const raw = bearerToken(request)
  if (!raw) return null
  const tokenHash = await sha256Hex(raw)
  const session = await getJson<SessionRecord>(env, `session:${tokenHash}`)
  if (!session) return null
  const user = await getJson<StoredUser>(env, `user:${session.userId}`)
  if (!user) return null
  return { tokenHash, user }
}

async function readProgress(env: Env, userId: string): Promise<ProgressDoc> {
  const doc = await getJson<ProgressDoc>(env, `progress:${userId}`)
  return doc ?? { done: {}, updatedAt: 0 }
}

function githubConfigured(env: Env): boolean {
  return Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET)
}

function workerBaseUrl(request: Request, env: Env): string {
  if (env.PUBLIC_BASE_URL) return env.PUBLIC_BASE_URL.replace(/\/+$/, "")
  return new URL(request.url).origin
}

function buildGithubAuthorizeUrl(env: Env, request: Request, state: string): string {
  const oauthBase = (env.GITHUB_OAUTH_BASE ?? "https://github.com").replace(/\/+$/, "")
  const redirectUri = `${workerBaseUrl(request, env)}/auth/github/callback`
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    scope: "read:user",
    state,
  })
  return `${oauthBase}/login/oauth/authorize?${params.toString()}`
}

async function fetchGithubIdentity(
  code: string,
  request: Request,
  env: Env,
  fetchImpl: typeof fetch,
): Promise<GitHubIdentity | null> {
  const oauthBase = (env.GITHUB_OAUTH_BASE ?? "https://github.com").replace(/\/+$/, "")
  const apiBase = (env.GITHUB_API_BASE ?? "https://api.github.com").replace(/\/+$/, "")
  const redirectUri = `${workerBaseUrl(request, env)}/auth/github/callback`

  const tokenRes = await fetchImpl(`${oauthBase}/login/oauth/access_token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "ohmwork-worker",
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  })
  if (!tokenRes.ok) return null
  const tokenJson = (await tokenRes.json()) as { access_token?: string }
  if (!tokenJson.access_token) return null

  const userRes = await fetchImpl(`${apiBase}/user`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${tokenJson.access_token}`,
      "User-Agent": "ohmwork-worker",
    },
  })
  if (!userRes.ok) return null
  const profile = (await userRes.json()) as {
    id?: number | string
    login?: string
    name?: string | null
    avatar_url?: string | null
  }
  if (!profile.id || !profile.login) return null

  return {
    id: String(profile.id),
    login: String(profile.login),
    name: typeof profile.name === "string" && profile.name.trim() ? profile.name.trim() : null,
    avatarUrl: sanitizeAvatarUrl(profile.avatar_url),
  }
}

function redirectWithHash(origin: string, returnTo: string, params: Record<string, string>): Response {
  const hash = new URLSearchParams(params).toString()
  return redirectResponse(`${origin}${returnTo}#${hash}`)
}

export async function handleRequest(request: Request, env: Env, opts: RequestOptions = {}): Promise<Response> {
  const fetchImpl = opts.fetchImpl ?? fetch
  const now = opts.now ?? (() => Date.now())
  const allowed = parseAllowedOrigins(env)
  const cors = corsHeaders(request, allowed)
  const url = new URL(request.url)
  const path = url.pathname.replace(/\/+$/, "") || "/"

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors })
  }

  // ---------- health & config ----------
  if (request.method === "GET" && (path === "/health" || path === "/auth/config")) {
    return jsonResponse({ ok: true, githubEnabled: githubConfigured(env) }, 200, cors)
  }

  // ---------- register with username & password ----------
  if (request.method === "POST" && path === "/auth/register") {
    const okRate = await checkRateLimit(env, `reg:${clientIp(request)}`, 10, 600, now())
    if (!okRate) return jsonResponse({ error: "操作过于频繁，请稍后再试" }, 429, cors)

    const body = await readJsonBody(request)
    if (!body.ok) return jsonResponse({ error: body.error }, body.status, cors)

    const u = validateUsername(body.value.username)
    if (!u.ok) return jsonResponse({ error: u.error }, 400, cors)
    const p = validatePassword(body.value.password)
    if (!p.ok) return jsonResponse({ error: p.error }, 400, cors)

    const existing = await env.KV.get(`uname:${u.key}`)
    if (existing) return jsonResponse({ error: "这个用户名已经被注册了" }, 409, cors)

    const ts = now()
    const user: StoredUser = {
      id: crypto.randomUUID(),
      username: u.display,
      passwordHash: await hashPassword(p.value),
      github: null,
      createdAt: ts,
      updatedAt: ts,
    }
    // Write user record before index so index never points to a missing user.
    await putJson(env, `user:${user.id}`, user)
    await env.KV.put(`uname:${u.key}`, user.id)

    const token = await createSession(env, user.id, ts)
    return jsonResponse({ token, user: toPublicUser(user), progress: { done: {}, updatedAt: 0 } }, 201, cors)
  }

  // ---------- login with username & password ----------
  if (request.method === "POST" && path === "/auth/login") {
    const body = await readJsonBody(request)
    if (!body.ok) return jsonResponse({ error: body.error }, body.status, cors)

    const rawUser = typeof body.value.username === "string" ? body.value.username.trim() : ""
    const rawPass = typeof body.value.password === "string" ? body.value.password : ""
    if (!rawUser || !rawPass) {
      return jsonResponse({ error: "请输入用户名和密码" }, 400, cors)
    }

    const unameKey = rawUser.toLowerCase()
    const okRate = await checkRateLimit(env, `login:${clientIp(request)}:${unameKey}`, 10, 300, now())
    if (!okRate) return jsonResponse({ error: "登录尝试过于频繁，请稍后再试" }, 429, cors)

    const userId = await env.KV.get(`uname:${unameKey}`)
    const user = userId ? await getJson<StoredUser>(env, `user:${userId}`) : null

    if (!user || !user.passwordHash) {
      // Uniform PBKDF2 work so missing usernames do not stand out by latency.
      await verifyPassword(rawPass, DUMMY_PASSWORD_HASH)
      return jsonResponse({ error: "用户名或密码不正确" }, 401, cors)
    }

    const matched = await verifyPassword(rawPass, user.passwordHash)
    if (!matched) {
      return jsonResponse({ error: "用户名或密码不正确" }, 401, cors)
    }

    const token = await createSession(env, user.id, now())
    const progress = await readProgress(env, user.id)
    return jsonResponse({ token, user: toPublicUser(user), progress }, 200, cors)
  }

  // ---------- logout ----------
  if (request.method === "POST" && path === "/auth/logout") {
    const raw = bearerToken(request)
    if (raw) {
      const hash = await sha256Hex(raw)
      await env.KV.delete(`session:${hash}`)
    }
    return jsonResponse({ ok: true }, 200, cors)
  }

  // ---------- current session + progress ----------
  if (request.method === "GET" && path === "/auth/me") {
    const auth = await authenticate(request, env)
    if (!auth) return jsonResponse({ error: "未登录或登录已过期" }, 401, cors)
    const progress = await readProgress(env, auth.user.id)
    return jsonResponse({ user: toPublicUser(auth.user), progress }, 200, cors)
  }

  // ---------- exchange one-time OAuth ticket for session token ----------
  if (request.method === "POST" && path === "/auth/exchange") {
    const body = await readJsonBody(request)
    if (!body.ok) return jsonResponse({ error: body.error }, body.status, cors)
    const code = typeof body.value.code === "string" ? body.value.code.trim() : ""
    if (!/^[a-f0-9]{32,128}$/.test(code)) {
      return jsonResponse({ error: "无效的登录凭证" }, 400, cors)
    }

    const ticket = await getJson<ExchangeTicket>(env, `ticket:${code}`)
    if (!ticket) return jsonResponse({ error: "登录凭证已过期，请重新登录" }, 401, cors)
    await env.KV.delete(`ticket:${code}`)

    const tokenHash = await sha256Hex(ticket.token)
    const session = await getJson<SessionRecord>(env, `session:${tokenHash}`)
    const user = session ? await getJson<StoredUser>(env, `user:${session.userId}`) : null
    if (!user) return jsonResponse({ error: "账号状态异常，请重新登录" }, 401, cors)

    const progress = await readProgress(env, user.id)
    return jsonResponse({ token: ticket.token, user: toPublicUser(user), progress }, 200, cors)
  }

  // ---------- GitHub OAuth start (login) ----------
  if (request.method === "GET" && path === "/auth/github/start") {
    const origin = pickFrontendOrigin(url.searchParams.get("origin"), request, allowed)
    const returnTo = sanitizeReturnTo(url.searchParams.get("returnTo"))
    if (!githubConfigured(env)) {
      return redirectWithHash(origin, returnTo, { auth_error: "github_unconfigured" })
    }
    const state = randomHex(24)
    const record: OAuthState = { mode: "login", returnTo, origin }
    await putJson(env, `oauth_state:${state}`, record, OAUTH_STATE_TTL_SEC)
    return redirectResponse(buildGithubAuthorizeUrl(env, request, state))
  }

  // ---------- GitHub OAuth start (link to existing account) ----------
  if (request.method === "POST" && path === "/auth/github/link-start") {
    const auth = await authenticate(request, env)
    if (!auth) return jsonResponse({ error: "请先登录" }, 401, cors)
    if (!githubConfigured(env)) {
      return jsonResponse({ error: "服务未配置 GitHub OAuth" }, 503, cors)
    }
    if (auth.user.github) {
      return jsonResponse({ error: "当前账号已经绑定了 GitHub" }, 409, cors)
    }

    const body = await readJsonBody(request)
    if (!body.ok) return jsonResponse({ error: body.error }, body.status, cors)
    const returnTo = sanitizeReturnTo(typeof body.value.returnTo === "string" ? body.value.returnTo : "/")
    const origin = pickFrontendOrigin(
      typeof body.value.origin === "string" ? body.value.origin : null,
      request,
      allowed,
    )

    const state = randomHex(24)
    const record: OAuthState = { mode: "link", userId: auth.user.id, returnTo, origin }
    await putJson(env, `oauth_state:${state}`, record, OAUTH_STATE_TTL_SEC)
    return jsonResponse({ url: buildGithubAuthorizeUrl(env, request, state) }, 200, cors)
  }

  // ---------- GitHub OAuth callback ----------
  if (request.method === "GET" && path === "/auth/github/callback") {
    const stateParam = url.searchParams.get("state") ?? ""
    const state = /^[a-f0-9]{16,128}$/.test(stateParam)
      ? await getJson<OAuthState>(env, `oauth_state:${stateParam}`)
      : null
    if (state) {
      await env.KV.delete(`oauth_state:${stateParam}`)
    }

    const fallbackOrigin = allowed[0]
    if (!state) {
      return redirectWithHash(fallbackOrigin, "/", { auth_error: "invalid_state" })
    }

    const ghError = url.searchParams.get("error")
    if (ghError) {
      return redirectWithHash(state.origin, state.returnTo, {
        auth_error: ghError === "access_denied" ? "github_cancelled" : "github_failed",
      })
    }

    const code = url.searchParams.get("code")
    if (!code || !githubConfigured(env)) {
      return redirectWithHash(state.origin, state.returnTo, { auth_error: "github_failed" })
    }

    let ghUser: GitHubIdentity | null = null
    try {
      ghUser = await fetchGithubIdentity(code, request, env, fetchImpl)
    } catch {
      ghUser = null
    }
    if (!ghUser) {
      return redirectWithHash(state.origin, state.returnTo, { auth_error: "github_failed" })
    }

    const ts = now()

    if (state.mode === "link") {
      const targetUser = state.userId ? await getJson<StoredUser>(env, `user:${state.userId}`) : null
      if (!targetUser) {
        return redirectWithHash(state.origin, state.returnTo, { auth_error: "invalid_state" })
      }
      if (targetUser.github && targetUser.github.id !== ghUser.id) {
        return redirectWithHash(state.origin, state.returnTo, { auth_error: "github_already_linked" })
      }
      const existingOwner = await env.KV.get(`gh:${ghUser.id}`)
      if (existingOwner && existingOwner !== targetUser.id) {
        return redirectWithHash(state.origin, state.returnTo, { auth_error: "github_already_bound" })
      }
      const updated: StoredUser = { ...targetUser, github: ghUser, updatedAt: ts }
      await putJson(env, `user:${updated.id}`, updated)
      await env.KV.put(`gh:${ghUser.id}`, updated.id)
      return redirectWithHash(state.origin, state.returnTo, { auth_event: "github_linked" })
    }

    // mode === "login"
    const existingId = await env.KV.get(`gh:${ghUser.id}`)
    let user = existingId ? await getJson<StoredUser>(env, `user:${existingId}`) : null
    if (user) {
      // Keep display handle / avatar fresh when changed on GitHub
      if (
        user.github?.login !== ghUser.login ||
        user.github?.name !== ghUser.name ||
        user.github?.avatarUrl !== ghUser.avatarUrl
      ) {
        user = { ...user, github: ghUser, updatedAt: ts }
        await putJson(env, `user:${user.id}`, user)
      }
    } else {
      user = {
        id: crypto.randomUUID(),
        username: null,
        passwordHash: null,
        github: ghUser,
        createdAt: ts,
        updatedAt: ts,
      }
      await putJson(env, `user:${user.id}`, user)
      await env.KV.put(`gh:${ghUser.id}`, user.id)
    }

    const token = await createSession(env, user.id, ts)
    const ticket = randomHex(24)
    const ticketData: ExchangeTicket = { token, event: "github_login" }
    await putJson(env, `ticket:${ticket}`, ticketData, TICKET_TTL_SEC)
    return redirectWithHash(state.origin, state.returnTo, { auth_code: ticket })
  }

  // ---------- bind username + password to an existing (e.g. GitHub) account ----------
  if (request.method === "POST" && path === "/account/bind-password") {
    const auth = await authenticate(request, env)
    if (!auth) return jsonResponse({ error: "请先登录" }, 401, cors)

    if (auth.user.username || auth.user.passwordHash) {
      return jsonResponse({ error: "当前账号已经设置过用户名和密码" }, 409, cors)
    }

    const body = await readJsonBody(request)
    if (!body.ok) return jsonResponse({ error: body.error }, body.status, cors)

    const u = validateUsername(body.value.username)
    if (!u.ok) return jsonResponse({ error: u.error }, 400, cors)
    const p = validatePassword(body.value.password)
    if (!p.ok) return jsonResponse({ error: p.error }, 400, cors)

    const taken = await env.KV.get(`uname:${u.key}`)
    if (taken) return jsonResponse({ error: "这个用户名已经被注册了" }, 409, cors)

    const updated: StoredUser = {
      ...auth.user,
      username: u.display,
      passwordHash: await hashPassword(p.value),
      updatedAt: now(),
    }
    await putJson(env, `user:${updated.id}`, updated)
    await env.KV.put(`uname:${u.key}`, updated.id)
    return jsonResponse({ user: toPublicUser(updated) }, 200, cors)
  }

  // ---------- change password ----------
  if (request.method === "POST" && path === "/account/password") {
    const auth = await authenticate(request, env)
    if (!auth) return jsonResponse({ error: "请先登录" }, 401, cors)
    if (!auth.user.passwordHash) {
      return jsonResponse({ error: "当前账号尚未设置密码" }, 400, cors)
    }

    const body = await readJsonBody(request)
    if (!body.ok) return jsonResponse({ error: body.error }, body.status, cors)

    const current = typeof body.value.currentPassword === "string" ? body.value.currentPassword : ""
    const next = validatePassword(body.value.newPassword)
    if (!current) return jsonResponse({ error: "请输入当前密码" }, 400, cors)
    if (!next.ok) return jsonResponse({ error: next.error }, 400, cors)

    const ok = await verifyPassword(current, auth.user.passwordHash)
    if (!ok) return jsonResponse({ error: "当前密码不正确" }, 401, cors)

    const updated: StoredUser = {
      ...auth.user,
      passwordHash: await hashPassword(next.value),
      updatedAt: now(),
    }
    await putJson(env, `user:${updated.id}`, updated)
    return jsonResponse({ ok: true }, 200, cors)
  }

  // ---------- unbind GitHub (only if password login is already configured) ----------
  if (request.method === "POST" && path === "/account/unbind-github") {
    const auth = await authenticate(request, env)
    if (!auth) return jsonResponse({ error: "请先登录" }, 401, cors)
    if (!auth.user.github) {
      return jsonResponse({ error: "当前账号未绑定 GitHub" }, 400, cors)
    }
    if (!auth.user.username || !auth.user.passwordHash) {
      return jsonResponse({ error: "请先绑定用户名和密码，再解绑 GitHub，以免无法登录" }, 400, cors)
    }

    const oldGithubId = auth.user.github.id
    const updated: StoredUser = {
      ...auth.user,
      github: null,
      updatedAt: now(),
    }
    await putJson(env, `user:${updated.id}`, updated)
    await env.KV.delete(`gh:${oldGithubId}`)
    return jsonResponse({ user: toPublicUser(updated) }, 200, cors)
  }

  // ---------- progress: get ----------
  if (request.method === "GET" && path === "/progress") {
    const auth = await authenticate(request, env)
    if (!auth) return jsonResponse({ error: "请先登录" }, 401, cors)
    const progress = await readProgress(env, auth.user.id)
    return jsonResponse(progress, 200, cors)
  }

  // ---------- progress: union merge (used on first login from local device) ----------
  if (request.method === "POST" && path === "/progress/merge") {
    const auth = await authenticate(request, env)
    if (!auth) return jsonResponse({ error: "请先登录" }, 401, cors)
    const body = await readJsonBody(request)
    if (!body.ok) return jsonResponse({ error: body.error }, body.status, cors)

    const ts = now()
    const incoming = sanitizeDoneMap(body.value.done, ts)
    const current = await readProgress(env, auth.user.id)
    const merged: Record<string, number> = { ...current.done }
    let changed = false

    for (const [k, v] of Object.entries(incoming)) {
      if (!(k in merged)) {
        if (Object.keys(merged).length >= MAX_PROGRESS_KEYS) break
        merged[k] = v
        changed = true
      } else if (v < merged[k]) {
        merged[k] = v
        changed = true
      }
    }

    if (changed) {
      const next: ProgressDoc = { done: merged, updatedAt: ts }
      await putJson(env, `progress:${auth.user.id}`, next)
      return jsonResponse(next, 200, cors)
    }
    return jsonResponse(current, 200, cors)
  }

  // ---------- progress: explicit delta patch (set / remove individual lessons) ----------
  if (request.method === "PATCH" && path === "/progress") {
    const auth = await authenticate(request, env)
    if (!auth) return jsonResponse({ error: "请先登录" }, 401, cors)
    const body = await readJsonBody(request)
    if (!body.ok) return jsonResponse({ error: body.error }, body.status, cors)

    const ts = now()
    const changes = sanitizeProgressChanges(body.value.changes, ts)
    if (!changes) return jsonResponse({ error: "缺少有效的进度变更" }, 400, cors)

    const current = await readProgress(env, auth.user.id)
    const nextDone: Record<string, number> = { ...current.done }
    let changed = false

    for (const [k, v] of Object.entries(changes)) {
      if (v === null) {
        if (k in nextDone) {
          delete nextDone[k]
          changed = true
        }
      } else if (nextDone[k] !== v) {
        if (!(k in nextDone) && Object.keys(nextDone).length >= MAX_PROGRESS_KEYS) continue
        nextDone[k] = v
        changed = true
      }
    }

    if (changed) {
      const next: ProgressDoc = { done: nextDone, updatedAt: ts }
      await putJson(env, `progress:${auth.user.id}`, next)
      return jsonResponse(next, 200, cors)
    }
    return jsonResponse(current, 200, cors)
  }

  return jsonResponse({ error: "Not Found" }, 404, cors)
}

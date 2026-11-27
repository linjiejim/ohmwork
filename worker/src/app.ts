import { DUMMY_PASSWORD_HASH, hashPassword, randomHex, sha256Hex, verifyPassword } from "./crypto.ts"
import {
  rowToUser,
  toPublicUser,
  type D1DatabaseLike,
  type D1PreparedStatementLike,
  type Env,
  type GitHubIdentity,
  type ProgressDoc,
  type StoredUser,
  type UserRow,
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

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30 // 30 days
const OAUTH_STATE_TTL_MS = 1000 * 60 * 10 // 10 minutes
const TICKET_TTL_MS = 1000 * 60 // 1 minute
const MAX_BODY_BYTES = 16 * 1024
const MAX_PROGRESS_KEYS = 200

const USER_COLUMNS =
  "id, username, password_hash, github_id, github_login, github_name, github_avatar_url, created_at, updated_at"

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

function isUniqueConstraintError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /UNIQUE constraint failed|SQLITE_CONSTRAINT/i.test(msg)
}

async function readJsonBody(
  request: Request,
): Promise<{ ok: true; value: Record<string, unknown> } | { ok: false; status: number; error: string }> {
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

async function checkRateLimit(
  db: D1DatabaseLike,
  bucket: string,
  limit: number,
  ttlSec: number,
  now: number,
): Promise<boolean> {
  const resetAt = now + ttlSec * 1000
  // expired buckets are dropped as we go, so one row per IP + username does not pile up forever
  const [, upsert] = await db.batch<{ count: number }>([
    db.prepare("DELETE FROM rate_limits WHERE reset_at <= ?").bind(now),
    db
      .prepare(
        `INSERT INTO rate_limits (bucket, count, reset_at)
         VALUES (?, 1, ?)
         ON CONFLICT(bucket) DO UPDATE SET
           count = CASE WHEN reset_at <= ? THEN 1 ELSE count + 1 END,
           reset_at = CASE WHEN reset_at <= ? THEN excluded.reset_at ELSE reset_at END
         RETURNING count`,
      )
      .bind(bucket, resetAt, now, now),
  ])
  return (upsert?.results[0]?.count ?? 1) <= limit
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("Authorization")
  if (!header) return null
  const match = header.match(/^Bearer\s+([a-zA-Z0-9._-]{16,256})$/)
  return match ? match[1] : null
}

async function createSession(db: D1DatabaseLike, userId: string, now: number): Promise<string> {
  const rawToken = randomHex(32)
  const hash = await sha256Hex(rawToken)
  const expiresAt = now + SESSION_TTL_MS
  await db.batch([
    db.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now),
    db
      .prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
      .bind(hash, userId, now, expiresAt),
  ])
  return rawToken
}

async function authenticate(
  request: Request,
  db: D1DatabaseLike,
  now: number,
): Promise<{ tokenHash: string; user: StoredUser } | null> {
  const raw = bearerToken(request)
  if (!raw) return null
  const tokenHash = await sha256Hex(raw)
  const row = await db
    .prepare(
      `SELECT u.id, u.username, u.password_hash, u.github_id, u.github_login,
              u.github_name, u.github_avatar_url, u.created_at, u.updated_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .bind(tokenHash, now)
    .first<UserRow>()
  if (!row) return null
  return { tokenHash, user: rowToUser(row) }
}

async function findUserById(db: D1DatabaseLike, id: string): Promise<StoredUser | null> {
  const row = await db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).bind(id).first<UserRow>()
  return row ? rowToUser(row) : null
}

async function readProgress(db: D1DatabaseLike, userId: string): Promise<ProgressDoc> {
  const res = await db
    .prepare("SELECT lesson_key, completed_at FROM progress WHERE user_id = ?")
    .bind(userId)
    .all<{ lesson_key: string; completed_at: number }>()
  const done: Record<string, number> = {}
  let updatedAt = 0
  for (const r of res.results) {
    done[r.lesson_key] = r.completed_at
    if (r.completed_at > updatedAt) updatedAt = r.completed_at
  }
  return { done, updatedAt }
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
  const db = env.DB
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
    const ts = now()
    const okRate = await checkRateLimit(db, `reg:${clientIp(request)}`, 10, 600, ts)
    if (!okRate) return jsonResponse({ error: "操作过于频繁，请稍后再试" }, 429, cors)

    const body = await readJsonBody(request)
    if (!body.ok) return jsonResponse({ error: body.error }, body.status, cors)

    const u = validateUsername(body.value.username)
    if (!u.ok) return jsonResponse({ error: u.error }, 400, cors)
    const p = validatePassword(body.value.password)
    if (!p.ok) return jsonResponse({ error: p.error }, 400, cors)

    const user: StoredUser = {
      id: crypto.randomUUID(),
      username: u.display,
      passwordHash: await hashPassword(p.value),
      github: null,
      createdAt: ts,
      updatedAt: ts,
    }

    try {
      await db
        .prepare(
          `INSERT INTO users (id, username, username_lower, password_hash, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(user.id, user.username, u.key, user.passwordHash, ts, ts)
        .run()
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        return jsonResponse({ error: "这个用户名已经被注册了" }, 409, cors)
      }
      throw err
    }

    const token = await createSession(db, user.id, ts)
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

    const ts = now()
    const unameKey = rawUser.toLowerCase()
    const okRate = await checkRateLimit(db, `login:${clientIp(request)}:${unameKey}`, 10, 300, ts)
    if (!okRate) return jsonResponse({ error: "登录尝试过于频繁，请稍后再试" }, 429, cors)

    const row = await db
      .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE username_lower = ?`)
      .bind(unameKey)
      .first<UserRow>()
    const user = row ? rowToUser(row) : null

    if (!user || !user.passwordHash) {
      // Uniform PBKDF2 work so missing usernames do not stand out by latency.
      await verifyPassword(rawPass, DUMMY_PASSWORD_HASH)
      return jsonResponse({ error: "用户名或密码不正确" }, 401, cors)
    }

    const matched = await verifyPassword(rawPass, user.passwordHash)
    if (!matched) {
      return jsonResponse({ error: "用户名或密码不正确" }, 401, cors)
    }

    const token = await createSession(db, user.id, ts)
    const progress = await readProgress(db, user.id)
    return jsonResponse({ token, user: toPublicUser(user), progress }, 200, cors)
  }

  // ---------- logout ----------
  if (request.method === "POST" && path === "/auth/logout") {
    const raw = bearerToken(request)
    if (raw) {
      const hash = await sha256Hex(raw)
      await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(hash).run()
    }
    return jsonResponse({ ok: true }, 200, cors)
  }

  // ---------- current session + progress ----------
  if (request.method === "GET" && path === "/auth/me") {
    const ts = now()
    const auth = await authenticate(request, db, ts)
    if (!auth) return jsonResponse({ error: "未登录或登录已过期" }, 401, cors)
    // Every page load calls /auth/me: once half the lifetime is used, start a fresh 30 days, so an
    // active learner is never logged out. At most one write per session per 15 days.
    await db
      .prepare("UPDATE sessions SET expires_at = ? WHERE token_hash = ? AND expires_at < ?")
      .bind(ts + SESSION_TTL_MS, auth.tokenHash, ts + SESSION_TTL_MS / 2)
      .run()
    const progress = await readProgress(db, auth.user.id)
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

    const ts = now()
    const ticket = await db
      .prepare("DELETE FROM exchange_tickets WHERE code = ? AND expires_at > ? RETURNING token, event")
      .bind(code, ts)
      .first<{ token: string; event: string }>()
    if (!ticket) return jsonResponse({ error: "登录凭证已过期，请重新登录" }, 401, cors)

    const tokenHash = await sha256Hex(ticket.token)
    const row = await db
      .prepare(
        `SELECT u.id, u.username, u.password_hash, u.github_id, u.github_login,
                u.github_name, u.github_avatar_url, u.created_at, u.updated_at
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > ?`,
      )
      .bind(tokenHash, ts)
      .first<UserRow>()
    if (!row) return jsonResponse({ error: "账号状态异常，请重新登录" }, 401, cors)

    const user = rowToUser(row)
    const progress = await readProgress(db, user.id)
    return jsonResponse({ token: ticket.token, user: toPublicUser(user), progress }, 200, cors)
  }

  // ---------- GitHub OAuth start (login) ----------
  if (request.method === "GET" && path === "/auth/github/start") {
    const origin = pickFrontendOrigin(url.searchParams.get("origin"), request, allowed)
    const returnTo = sanitizeReturnTo(url.searchParams.get("returnTo"))
    if (!githubConfigured(env)) {
      return redirectWithHash(origin, returnTo, { auth_error: "github_unconfigured" })
    }
    const ts = now()
    const state = randomHex(24)
    await db.batch([
      db.prepare("DELETE FROM oauth_states WHERE expires_at <= ?").bind(ts),
      db
        .prepare(
          "INSERT INTO oauth_states (state, mode, user_id, return_to, origin, expires_at) VALUES (?, 'login', NULL, ?, ?, ?)",
        )
        .bind(state, returnTo, origin, ts + OAUTH_STATE_TTL_MS),
    ])
    return redirectResponse(buildGithubAuthorizeUrl(env, request, state))
  }

  // ---------- GitHub OAuth start (link to existing account) ----------
  if (request.method === "POST" && path === "/auth/github/link-start") {
    const ts = now()
    const auth = await authenticate(request, db, ts)
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
    await db.batch([
      db.prepare("DELETE FROM oauth_states WHERE expires_at <= ?").bind(ts),
      db
        .prepare(
          "INSERT INTO oauth_states (state, mode, user_id, return_to, origin, expires_at) VALUES (?, 'link', ?, ?, ?, ?)",
        )
        .bind(state, auth.user.id, returnTo, origin, ts + OAUTH_STATE_TTL_MS),
    ])
    return jsonResponse({ url: buildGithubAuthorizeUrl(env, request, state) }, 200, cors)
  }

  // ---------- GitHub OAuth callback ----------
  if (request.method === "GET" && path === "/auth/github/callback") {
    const ts = now()
    const stateParam = url.searchParams.get("state") ?? ""
    const state = /^[a-f0-9]{16,128}$/.test(stateParam)
      ? await db
          .prepare(
            "DELETE FROM oauth_states WHERE state = ? AND expires_at > ? RETURNING mode, user_id, return_to, origin",
          )
          .bind(stateParam, ts)
          .first<{ mode: "login" | "link"; user_id: string | null; return_to: string; origin: string }>()
      : null

    const fallbackOrigin = allowed[0]
    if (!state) {
      return redirectWithHash(fallbackOrigin, "/", { auth_error: "invalid_state" })
    }

    const ghError = url.searchParams.get("error")
    if (ghError) {
      return redirectWithHash(state.origin, state.return_to, {
        auth_error: ghError === "access_denied" ? "github_cancelled" : "github_failed",
      })
    }

    const code = url.searchParams.get("code")
    if (!code || !githubConfigured(env)) {
      return redirectWithHash(state.origin, state.return_to, { auth_error: "github_failed" })
    }

    let ghUser: GitHubIdentity | null = null
    try {
      ghUser = await fetchGithubIdentity(code, request, env, fetchImpl)
    } catch {
      ghUser = null
    }
    if (!ghUser) {
      return redirectWithHash(state.origin, state.return_to, { auth_error: "github_failed" })
    }

    if (state.mode === "link") {
      if (!state.user_id) {
        return redirectWithHash(state.origin, state.return_to, { auth_error: "invalid_state" })
      }
      // Do not bind here. Whoever opens the GitHub authorize URL lands on this callback, so binding now
      // would let anyone who forwards their own binding link attach the recipient's GitHub to their
      // account. Park the identity under a one-time code; /account/github/link-confirm binds it, and only
      // for the session of the account that started the flow.
      const code = randomHex(24)
      await db.batch([
        db.prepare("DELETE FROM github_link_tickets WHERE expires_at <= ?").bind(ts),
        db
          .prepare(
            `INSERT INTO github_link_tickets
               (code, user_id, github_id, github_login, github_name, github_avatar_url, expires_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(code, state.user_id, ghUser.id, ghUser.login, ghUser.name, ghUser.avatarUrl, ts + TICKET_TTL_MS),
      ])
      return redirectWithHash(state.origin, state.return_to, { link_code: code })
    }

    // mode === "login"
    const existingRow = await db
      .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE github_id = ?`)
      .bind(ghUser.id)
      .first<UserRow>()

    let userId: string
    if (existingRow) {
      userId = existingRow.id
      if (
        existingRow.github_login !== ghUser.login ||
        existingRow.github_name !== ghUser.name ||
        existingRow.github_avatar_url !== ghUser.avatarUrl
      ) {
        await db
          .prepare(
            `UPDATE users
             SET github_login = ?, github_name = ?, github_avatar_url = ?, updated_at = ?
             WHERE id = ?`,
          )
          .bind(ghUser.login, ghUser.name, ghUser.avatarUrl, ts, userId)
          .run()
      }
    } else {
      userId = crypto.randomUUID()
      await db
        .prepare(
          `INSERT INTO users (id, github_id, github_login, github_name, github_avatar_url, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(userId, ghUser.id, ghUser.login, ghUser.name, ghUser.avatarUrl, ts, ts)
        .run()
    }

    const token = await createSession(db, userId, ts)
    const ticket = randomHex(24)
    await db.batch([
      db.prepare("DELETE FROM exchange_tickets WHERE expires_at <= ?").bind(ts),
      db
        .prepare("INSERT INTO exchange_tickets (code, token, event, expires_at) VALUES (?, ?, 'github_login', ?)")
        .bind(ticket, token, ts + TICKET_TTL_MS),
    ])
    return redirectWithHash(state.origin, state.return_to, { auth_code: ticket })
  }

  // ---------- GitHub binding: confirm with the session that started it ----------
  if (request.method === "POST" && path === "/account/github/link-confirm") {
    const ts = now()
    const auth = await authenticate(request, db, ts)
    if (!auth) return jsonResponse({ error: "请先登录" }, 401, cors)
    const body = await readJsonBody(request)
    if (!body.ok) return jsonResponse({ error: body.error }, body.status, cors)
    const code = typeof body.value.code === "string" ? body.value.code.trim() : ""
    if (!/^[a-f0-9]{32,128}$/.test(code)) {
      return jsonResponse({ error: "无效的绑定凭证" }, 400, cors)
    }

    // consumed whatever happens next, so a code that reached the wrong browser cannot be retried
    const ticket = await db
      .prepare(
        `DELETE FROM github_link_tickets WHERE code = ? AND expires_at > ?
         RETURNING user_id, github_id, github_login, github_name, github_avatar_url`,
      )
      .bind(code, ts)
      .first<{
        user_id: string
        github_id: string
        github_login: string
        github_name: string | null
        github_avatar_url: string | null
      }>()
    if (!ticket) return jsonResponse({ error: "绑定已过期，请重新绑定 GitHub" }, 400, cors)
    if (ticket.user_id !== auth.user.id) {
      return jsonResponse({ error: "这次绑定不是从当前账号发起的，已取消" }, 403, cors)
    }
    if (auth.user.github) {
      if (auth.user.github.id === ticket.github_id) {
        return jsonResponse({ user: toPublicUser(auth.user) }, 200, cors)
      }
      return jsonResponse({ error: "当前账号已经绑定了其他 GitHub 账号，请先解绑" }, 409, cors)
    }

    try {
      await db
        .prepare(
          `UPDATE users
           SET github_id = ?, github_login = ?, github_name = ?, github_avatar_url = ?, updated_at = ?
           WHERE id = ? AND github_id IS NULL`,
        )
        .bind(ticket.github_id, ticket.github_login, ticket.github_name, ticket.github_avatar_url, ts, auth.user.id)
        .run()
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        return jsonResponse({ error: "这个 GitHub 账号已经绑定到其他账户了" }, 409, cors)
      }
      throw err
    }
    const updated = await findUserById(db, auth.user.id)
    return jsonResponse({ user: toPublicUser(updated!) }, 200, cors)
  }

  // ---------- bind username + password to an existing (e.g. GitHub) account ----------
  if (request.method === "POST" && path === "/account/bind-password") {
    const ts = now()
    const auth = await authenticate(request, db, ts)
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

    const passwordHash = await hashPassword(p.value)
    try {
      const res = await db
        .prepare(
          `UPDATE users
           SET username = ?, username_lower = ?, password_hash = ?, updated_at = ?
           WHERE id = ? AND username_lower IS NULL AND password_hash IS NULL`,
        )
        .bind(u.display, u.key, passwordHash, ts, auth.user.id)
        .run()
      if ((res.meta.changes ?? 0) === 0) {
        return jsonResponse({ error: "当前账号已经设置过用户名和密码" }, 409, cors)
      }
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        return jsonResponse({ error: "这个用户名已经被注册了" }, 409, cors)
      }
      throw err
    }

    const updated = await findUserById(db, auth.user.id)
    return jsonResponse({ user: toPublicUser(updated!) }, 200, cors)
  }

  // ---------- change password ----------
  if (request.method === "POST" && path === "/account/password") {
    const ts = now()
    const auth = await authenticate(request, db, ts)
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

    // other devices are signed out: a changed password is often a reaction to a leaked one
    await db.batch([
      db
        .prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?")
        .bind(await hashPassword(next.value), ts, auth.user.id),
      db.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?").bind(auth.user.id, auth.tokenHash),
    ])
    return jsonResponse({ ok: true }, 200, cors)
  }

  // ---------- unbind GitHub (only if password login is already configured) ----------
  if (request.method === "POST" && path === "/account/unbind-github") {
    const ts = now()
    const auth = await authenticate(request, db, ts)
    if (!auth) return jsonResponse({ error: "请先登录" }, 401, cors)
    if (!auth.user.github) {
      return jsonResponse({ error: "当前账号未绑定 GitHub" }, 400, cors)
    }
    if (!auth.user.username || !auth.user.passwordHash) {
      return jsonResponse({ error: "请先绑定用户名和密码，再解绑 GitHub，以免无法登录" }, 400, cors)
    }

    await db
      .prepare(
        `UPDATE users
         SET github_id = NULL, github_login = NULL, github_name = NULL, github_avatar_url = NULL, updated_at = ?
         WHERE id = ?`,
      )
      .bind(ts, auth.user.id)
      .run()
    const updated = await findUserById(db, auth.user.id)
    return jsonResponse({ user: toPublicUser(updated!) }, 200, cors)
  }

  // ---------- progress: get ----------
  if (request.method === "GET" && path === "/progress") {
    const auth = await authenticate(request, db, now())
    if (!auth) return jsonResponse({ error: "请先登录" }, 401, cors)
    const progress = await readProgress(db, auth.user.id)
    return jsonResponse(progress, 200, cors)
  }

  // ---------- progress: union merge (used on first login from local device) ----------
  if (request.method === "POST" && path === "/progress/merge") {
    const ts = now()
    const auth = await authenticate(request, db, ts)
    if (!auth) return jsonResponse({ error: "请先登录" }, 401, cors)
    const body = await readJsonBody(request)
    if (!body.ok) return jsonResponse({ error: body.error }, body.status, cors)

    const incoming = sanitizeDoneMap(body.value.done, ts)
    const current = await readProgress(db, auth.user.id)
    let count = Object.keys(current.done).length
    const stmts: D1PreparedStatementLike[] = []

    for (const [k, v] of Object.entries(incoming)) {
      if (!(k in current.done)) {
        if (count >= MAX_PROGRESS_KEYS) break
        count++
        stmts.push(
          db
            .prepare(
              `INSERT INTO progress (user_id, lesson_key, completed_at) VALUES (?, ?, ?)
               ON CONFLICT(user_id, lesson_key) DO UPDATE SET completed_at = MIN(completed_at, excluded.completed_at)`,
            )
            .bind(auth.user.id, k, v),
        )
      } else if (v < current.done[k]) {
        stmts.push(
          db
            .prepare("UPDATE progress SET completed_at = ? WHERE user_id = ? AND lesson_key = ? AND completed_at > ?")
            .bind(v, auth.user.id, k, v),
        )
      }
    }

    if (stmts.length > 0) {
      await db.batch(stmts)
      return jsonResponse(await readProgress(db, auth.user.id), 200, cors)
    }
    return jsonResponse(current, 200, cors)
  }

  // ---------- progress: explicit delta patch (set / remove individual lessons) ----------
  if (request.method === "PATCH" && path === "/progress") {
    const ts = now()
    const auth = await authenticate(request, db, ts)
    if (!auth) return jsonResponse({ error: "请先登录" }, 401, cors)
    const body = await readJsonBody(request)
    if (!body.ok) return jsonResponse({ error: body.error }, body.status, cors)

    const changes = sanitizeProgressChanges(body.value.changes, ts)
    if (!changes) return jsonResponse({ error: "缺少有效的进度变更" }, 400, cors)

    const current = await readProgress(db, auth.user.id)
    let count = Object.keys(current.done).length
    const stmts: D1PreparedStatementLike[] = []

    for (const [k, v] of Object.entries(changes)) {
      if (v === null) {
        if (k in current.done) {
          count--
          stmts.push(db.prepare("DELETE FROM progress WHERE user_id = ? AND lesson_key = ?").bind(auth.user.id, k))
        }
      } else if (current.done[k] !== v) {
        if (!(k in current.done)) {
          if (count >= MAX_PROGRESS_KEYS) continue
          count++
        }
        stmts.push(
          db
            .prepare(
              `INSERT INTO progress (user_id, lesson_key, completed_at) VALUES (?, ?, ?)
               ON CONFLICT(user_id, lesson_key) DO UPDATE SET completed_at = excluded.completed_at`,
            )
            .bind(auth.user.id, k, v),
        )
      }
    }

    if (stmts.length > 0) {
      await db.batch(stmts)
      return jsonResponse(await readProgress(db, auth.user.id), 200, cors)
    }
    return jsonResponse(current, 200, cors)
  }

  return jsonResponse({ error: "Not Found" }, 404, cors)
}

/**
 * Cloudflare Worker + KV backend tests: password auth, GitHub OAuth,
 * bidirectional binding, progress merge/patch, rate limits and security invariants.
 */
import { describe, expect, it } from "vitest"
import { handleRequest } from "../../worker/src/app"
import type { Env, KVNamespaceLike } from "../../worker/src/types"

class MemoryKV implements KVNamespaceLike {
  map = new Map<string, { value: string; expiresAt: number | null }>()
  constructor(private clock: () => number) {}
  async get(key: string): Promise<string | null> {
    const entry = this.map.get(key)
    if (!entry) return null
    if (entry.expiresAt !== null && entry.expiresAt <= this.clock()) {
      this.map.delete(key)
      return null
    }
    return entry.value
  }
  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    this.map.set(key, {
      value,
      expiresAt: options?.expirationTtl ? this.clock() + options.expirationTtl * 1000 : null,
    })
  }
  async delete(key: string): Promise<void> {
    this.map.delete(key)
  }
}

interface MockGitHubUser {
  id: number
  login: string
  name: string | null
  avatar_url: string | null
}

function createHarness(opts: { withGithub?: boolean; githubUsers?: Record<string, MockGitHubUser> } = {}) {
  let now = 1_760_000_000_000
  const clock = () => now
  const kv = new MemoryKV(clock)
  const ghUsers = opts.githubUsers ?? {
    "code-alice": { id: 101, login: "alice-gh", name: "Alice", avatar_url: "https://avatars.githubusercontent.com/u/101" },
    "code-bob": { id: 202, login: "bob-gh", name: "Bob", avatar_url: "https://avatars.githubusercontent.com/u/202" },
  }

  const env: Env = {
    KV: kv,
    ALLOWED_ORIGINS: "https://ohmwork.linjiejim.com,http://localhost:5273",
    PUBLIC_BASE_URL: "https://api.ohmwork.linjiejim.com",
    GITHUB_CLIENT_ID: opts.withGithub === false ? "" : "gh-client-id",
    GITHUB_CLIENT_SECRET: opts.withGithub === false ? "" : "gh-client-secret",
  }

  const mockFetch: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
    if (url === "https://github.com/login/oauth/access_token") {
      const body = JSON.parse(String(init?.body ?? "{}")) as { code?: string }
      if (!body.code || !(body.code in ghUsers)) {
        return new Response(JSON.stringify({ error: "bad_verification_code" }), { status: 400 })
      }
      return new Response(JSON.stringify({ access_token: `tok:${body.code}` }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }
    if (url === "https://api.github.com/user") {
      const auth = new Headers(init?.headers).get("Authorization") ?? ""
      const code = auth.replace(/^Bearer\s+tok:/, "")
      const user = ghUsers[code]
      if (!user) return new Response("Unauthorized", { status: 401 })
      return new Response(JSON.stringify(user), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }
    throw new Error(`Unexpected fetch: ${url}`)
  }

  const call = (
    path: string,
    init: { method?: string; body?: unknown; token?: string; origin?: string; ip?: string } = {},
  ) => {
    const headers: Record<string, string> = {}
    if (init.body !== undefined) headers["Content-Type"] = "application/json"
    if (init.token) headers.Authorization = `Bearer ${init.token}`
    if (init.origin) headers.Origin = init.origin
    if (init.ip) headers["CF-Connecting-IP"] = init.ip
    const req = new Request(`https://api.ohmwork.linjiejim.com${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    })
    return handleRequest(req, env, { fetchImpl: mockFetch, now: clock })
  }

  const advanceMs = (ms: number) => {
    now += ms
  }

  return { kv, env, call, advanceMs, ghUsers }
}

describe("worker auth and sync", () => {
  it("reports config and enforces CORS allowlist", async () => {
    const h1 = createHarness({ withGithub: false })
    const r1 = await h1.call("/auth/config", { origin: "https://ohmwork.linjiejim.com" })
    expect(r1.status).toBe(200)
    expect(r1.headers.get("Access-Control-Allow-Origin")).toBe("https://ohmwork.linjiejim.com")
    expect(await r1.json()).toEqual({ ok: true, githubEnabled: false })

    const rEvil = await h1.call("/auth/config", { origin: "https://evil.example" })
    expect(rEvil.headers.get("Access-Control-Allow-Origin")).toBeNull()

    const h2 = createHarness({ withGithub: true })
    const r2 = await h2.call("/health")
    expect(await r2.json()).toEqual({ ok: true, githubEnabled: true })
  })

  it("registers, logs in, hashes passwords and sessions, and logs out", async () => {
    const { call, kv } = createHarness()

    // Invalid username / short password rejected
    expect((await call("/auth/register", { method: "POST", body: { username: "ab", password: "password123" } })).status).toBe(400)
    expect((await call("/auth/register", { method: "POST", body: { username: "alice_1", password: "short" } })).status).toBe(400)

    const reg = await call("/auth/register", {
      method: "POST",
      body: { username: "Alice_01", password: "correct-horse-battery" },
    })
    expect(reg.status).toBe(201)
    const regData = (await reg.json()) as { token: string; user: { id: string; username: string; hasPassword: boolean } }
    expect(regData.user.username).toBe("Alice_01")
    expect(regData.user.hasPassword).toBe(true)

    // Raw password and raw session token must never appear in KV
    const dumped = JSON.stringify([...kv.map.entries()])
    expect(dumped).not.toContain("correct-horse-battery")
    expect(dumped).not.toContain(regData.token)
    expect(dumped).toContain("pbkdf2_sha256$100000$")

    // Case-insensitive duplicate rejected
    const dup = await call("/auth/register", {
      method: "POST",
      body: { username: "alice_01", password: "another-password" },
    })
    expect(dup.status).toBe(409)

    // Login works case-insensitively
    const loginOk = await call("/auth/login", {
      method: "POST",
      body: { username: "alice_01", password: "correct-horse-battery" },
    })
    expect(loginOk.status).toBe(200)
    const loginData = (await loginOk.json()) as { token: string; user: { id: string } }
    expect(loginData.user.id).toBe(regData.user.id)

    // Wrong password and unknown user both return 401
    expect((await call("/auth/login", { method: "POST", body: { username: "alice_01", password: "wrong-password" } })).status).toBe(401)
    expect((await call("/auth/login", { method: "POST", body: { username: "nobody", password: "wrong-password" } })).status).toBe(401)

    // Logout revokes token
    expect((await call("/auth/me", { token: loginData.token })).status).toBe(200)
    expect((await call("/auth/logout", { method: "POST", token: loginData.token })).status).toBe(200)
    expect((await call("/auth/me", { token: loginData.token })).status).toBe(401)
  })

  it("merges initial local progress and patches additions and removals", async () => {
    const { call } = createHarness()
    const reg = await call("/auth/register", {
      method: "POST",
      body: { username: "learner", password: "password1234" },
    })
    const { token } = (await reg.json()) as { token: string }

    // Initial merge ignores invalid keys and keeps earliest timestamp
    const m1 = await call("/progress/merge", {
      method: "POST",
      token,
      body: {
        done: {
          "basics/ohms-law": 1_750_000_000_000,
          "basics/power-energy": 1_750_000_010_000,
          "../evil/key": 1_750_000_000_000,
        },
      },
    })
    expect(m1.status).toBe(200)
    const d1 = (await m1.json()) as { done: Record<string, number> }
    expect(Object.keys(d1.done).sort()).toEqual(["basics/ohms-law", "basics/power-energy"])

    // Patch adds one lesson and explicitly unmarks another
    const p1 = await call("/progress", {
      method: "PATCH",
      token,
      body: {
        changes: {
          "basics/ohms-law": null,
          "components/resistors": 1_755_000_000_000,
        },
      },
    })
    expect(p1.status).toBe(200)
    const d2 = (await p1.json()) as { done: Record<string, number> }
    expect(Object.keys(d2.done).sort()).toEqual(["basics/power-energy", "components/resistors"])

    // GET /auth/me reflects the updated progress
    const me = await call("/auth/me", { token })
    const meJson = (await me.json()) as { progress: { done: Record<string, number> } }
    expect(Object.keys(meJson.progress.done).sort()).toEqual(["basics/power-energy", "components/resistors"])
  })

  it("supports GitHub OAuth login, one-time ticket exchange, and binding username/password afterwards", async () => {
    const { call } = createHarness()

    // Start OAuth with a malicious returnTo & untrusted origin: worker falls back safely
    const start = await call("/auth/github/start?returnTo=//evil.com&origin=https://evil.com")
    expect(start.status).toBe(302)
    const ghUrl = new URL(start.headers.get("Location")!)
    expect(ghUrl.origin).toBe("https://github.com")
    expect(ghUrl.searchParams.get("scope")).toBe("read:user")
    const state = ghUrl.searchParams.get("state")!

    // Callback creates GitHub user and redirects with one-time #auth_code
    const cb = await call(`/auth/github/callback?code=code-alice&state=${state}`)
    expect(cb.status).toBe(302)
    const dest = new URL(cb.headers.get("Location")!)
    expect(dest.origin).toBe("https://ohmwork.linjiejim.com")
    expect(dest.pathname).toBe("/")
    const ticket = new URLSearchParams(dest.hash.slice(1)).get("auth_code")!
    expect(ticket).toBeTruthy()

    // State cannot be replayed
    const replayCb = await call(`/auth/github/callback?code=code-alice&state=${state}`)
    expect(replayCb.headers.get("Location")).toContain("#auth_error=invalid_state")

    // Exchange ticket once
    const ex = await call("/auth/exchange", { method: "POST", body: { code: ticket } })
    expect(ex.status).toBe(200)
    const exData = (await ex.json()) as { token: string; user: { id: string; username: string | null; hasPassword: boolean; github: { login: string } } }
    expect(exData.user.github.login).toBe("alice-gh")
    expect(exData.user.username).toBeNull()
    expect(exData.user.hasPassword).toBe(false)

    // Ticket cannot be replayed
    expect((await call("/auth/exchange", { method: "POST", body: { code: ticket } })).status).toBe(401)

    // Save progress on GitHub account
    await call("/progress", { method: "PATCH", token: exData.token, body: { changes: { "basics/ohms-law": 1_750_000_000_000 } } })

    // Cannot unbind GitHub before binding username + password
    expect((await call("/account/unbind-github", { method: "POST", token: exData.token })).status).toBe(400)

    // Bind username + password to this GitHub account
    const bind = await call("/account/bind-password", {
      method: "POST",
      token: exData.token,
      body: { username: "alice_local", password: "my-secret-password" },
    })
    expect(bind.status).toBe(200)
    const bound = (await bind.json()) as { user: { username: string; hasPassword: boolean; github: { login: string } } }
    expect(bound.user.username).toBe("alice_local")
    expect(bound.user.hasPassword).toBe(true)
    expect(bound.user.github.login).toBe("alice-gh")

    // Logging in with the newly bound username/password reaches the SAME user and progress
    const pwLogin = await call("/auth/login", {
      method: "POST",
      body: { username: "alice_local", password: "my-secret-password" },
    })
    expect(pwLogin.status).toBe(200)
    const pwData = (await pwLogin.json()) as { token: string; user: { id: string }; progress: { done: Record<string, number> } }
    expect(pwData.user.id).toBe(exData.user.id)
    expect(Object.keys(pwData.progress.done)).toEqual(["basics/ohms-law"])

    // Now unbinding GitHub is allowed because password login exists
    const unbind = await call("/account/unbind-github", { method: "POST", token: pwData.token })
    expect(unbind.status).toBe(200)
    const afterUnbind = (await unbind.json()) as { user: { github: null; username: string } }
    expect(afterUnbind.user.github).toBeNull()
    expect(afterUnbind.user.username).toBe("alice_local")
  })

  it("allows password users to bind GitHub, prevents hijacking another user's GitHub, and changes passwords", async () => {
    const { call } = createHarness()

    // Register User A with password
    const regA = await call("/auth/register", { method: "POST", body: { username: "user_a", password: "password-aaaa" } })
    const a = (await regA.json()) as { token: string; user: { id: string } }
    await call("/progress", { method: "PATCH", token: a.token, body: { changes: { "digital/pwm": 1_750_000_000_000 } } })

    // User A initiates GitHub binding
    const linkStart = await call("/auth/github/link-start", {
      method: "POST",
      token: a.token,
      origin: "http://localhost:5273",
      body: { returnTo: "/learn/digital/pwm" },
    })
    expect(linkStart.status).toBe(200)
    const { url } = (await linkStart.json()) as { url: string }
    const stateA = new URL(url).searchParams.get("state")!

    // Callback binds bob-gh to User A
    const cbA = await call(`/auth/github/callback?code=code-bob&state=${stateA}`)
    expect(cbA.status).toBe(302)
    expect(cbA.headers.get("Location")).toBe("http://localhost:5273/learn/digital/pwm#auth_event=github_linked")

    // Logging in with bob-gh now lands on User A with User A's progress
    const ghStart = await call("/auth/github/start?returnTo=/")
    const ghState = new URL(ghStart.headers.get("Location")!).searchParams.get("state")!
    const ghCb = await call(`/auth/github/callback?code=code-bob&state=${ghState}`)
    const ticket = new URLSearchParams(new URL(ghCb.headers.get("Location")!).hash.slice(1)).get("auth_code")!
    const ex = await call("/auth/exchange", { method: "POST", body: { code: ticket } })
    const exData = (await ex.json()) as { user: { id: string; username: string }; progress: { done: Record<string, number> } }
    expect(exData.user.id).toBe(a.user.id)
    expect(exData.user.username).toBe("user_a")
    expect(Object.keys(exData.progress.done)).toEqual(["digital/pwm"])

    // User B tries to bind the same GitHub (bob-gh) → rejected cleanly without overwriting
    const regB = await call("/auth/register", { method: "POST", body: { username: "user_b", password: "password-bbbb" } })
    const b = (await regB.json()) as { token: string }
    const linkB = await call("/auth/github/link-start", {
      method: "POST",
      token: b.token,
      origin: "http://localhost:5273",
      body: { returnTo: "/" },
    })
    const stateB = new URL(((await linkB.json()) as { url: string }).url).searchParams.get("state")!
    const cbB = await call(`/auth/github/callback?code=code-bob&state=${stateB}`)
    expect(cbB.headers.get("Location")).toBe("http://localhost:5273/#auth_error=github_already_bound")

    // Password change verifies old password
    expect(
      (await call("/account/password", { method: "POST", token: a.token, body: { currentPassword: "wrong", newPassword: "new-password-1" } })).status,
    ).toBe(401)
    expect(
      (await call("/account/password", { method: "POST", token: a.token, body: { currentPassword: "password-aaaa", newPassword: "new-password-1" } })).status,
    ).toBe(200)
    expect((await call("/auth/login", { method: "POST", body: { username: "user_a", password: "password-aaaa" } })).status).toBe(401)
    expect((await call("/auth/login", { method: "POST", body: { username: "user_a", password: "new-password-1" } })).status).toBe(200)
  })

  it("rate limits repeated failed logins", async () => {
    const { call } = createHarness()
    await call("/auth/register", { method: "POST", body: { username: "victim", password: "real-password-1" } })

    for (let i = 0; i < 10; i++) {
      const r = await call("/auth/login", {
        method: "POST",
        ip: "203.0.113.10",
        body: { username: "victim", password: "wrong-password" },
      })
      expect(r.status).toBe(401)
    }
    const blocked = await call("/auth/login", {
      method: "POST",
      ip: "203.0.113.10",
      body: { username: "victim", password: "real-password-1" },
    })
    expect(blocked.status).toBe(429)
  })
})

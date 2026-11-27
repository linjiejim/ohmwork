/**
 * Cloudflare Worker + D1 (SQLite) backend tests: password auth, GitHub OAuth,
 * bidirectional binding, progress merge/patch, expiry, rate limits and security invariants.
 */
import { describe, expect, it } from "vitest"
import { createSqliteD1 } from "../../worker/sqlite-d1.mjs"
import { handleRequest } from "../../worker/src/app"
import type { Env } from "../../worker/src/types"

interface MockGitHubUser {
  id: number
  login: string
  name: string | null
  avatar_url: string | null
}

function createHarness(opts: { withGithub?: boolean; githubUsers?: Record<string, MockGitHubUser> } = {}) {
  let now = 1_760_000_000_000
  const clock = () => now
  const { db, close } = createSqliteD1(":memory:")
  const ghUsers = opts.githubUsers ?? {
    "code-alice": { id: 101, login: "alice-gh", name: "Alice", avatar_url: "https://avatars.githubusercontent.com/u/101" },
    "code-bob": { id: 202, login: "bob-gh", name: "Bob", avatar_url: "https://avatars.githubusercontent.com/u/202" },
  }

  const env: Env = {
    DB: db,
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

  return { db, close, env, call, advanceMs, ghUsers }
}

describe("worker auth and sync (D1)", () => {
  it("reports config and enforces CORS allowlist", async () => {
    const h1 = createHarness({ withGithub: false })
    try {
      const r1 = await h1.call("/auth/config", { origin: "https://ohmwork.linjiejim.com" })
      expect(r1.status).toBe(200)
      expect(r1.headers.get("Access-Control-Allow-Origin")).toBe("https://ohmwork.linjiejim.com")
      expect(await r1.json()).toEqual({ ok: true, githubEnabled: false })

      const rEvil = await h1.call("/auth/config", { origin: "https://evil.example" })
      expect(rEvil.headers.get("Access-Control-Allow-Origin")).toBeNull()
    } finally {
      h1.close()
    }

    const h2 = createHarness({ withGithub: true })
    try {
      const r2 = await h2.call("/health")
      expect(await r2.json()).toEqual({ ok: true, githubEnabled: true })
    } finally {
      h2.close()
    }
  })

  it("registers, logs in, hashes passwords and sessions, expires old sessions, and logs out", async () => {
    const { call, db, advanceMs, close } = createHarness()
    try {
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

      // Raw password and raw session token must never appear in D1 tables
      const userRow = await db.prepare("SELECT password_hash FROM users WHERE id = ?").bind(regData.user.id).first<{ password_hash: string }>()
      expect(userRow?.password_hash).toMatch(/^pbkdf2_sha256\$100000\$/)
      expect(userRow?.password_hash).not.toContain("correct-horse-battery")
      const sessRows = await db.prepare("SELECT token_hash FROM sessions").all<{ token_hash: string }>()
      expect(sessRows.results).toHaveLength(1)
      expect(sessRows.results[0].token_hash).not.toBe(regData.token)

      // Case-insensitive duplicate rejected by UNIQUE constraint
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

      // Registration session expires after 30 days
      expect((await call("/auth/me", { token: regData.token })).status).toBe(200)
      advanceMs(1000 * 60 * 60 * 24 * 31)
      expect((await call("/auth/me", { token: regData.token })).status).toBe(401)
    } finally {
      close()
    }
  })

  it("merges initial local progress and patches additions and removals", async () => {
    const { call, close } = createHarness()
    try {
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
    } finally {
      close()
    }
  })

  it("supports GitHub OAuth login, one-time ticket exchange, and binding username/password afterwards", async () => {
    const { call, close } = createHarness()
    try {
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
      const exData = (await ex.json()) as {
        token: string
        user: { id: string; username: string | null; hasPassword: boolean; github: { login: string } }
      }
      expect(exData.user.github.login).toBe("alice-gh")
      expect(exData.user.username).toBeNull()
      expect(exData.user.hasPassword).toBe(false)

      // Ticket cannot be replayed
      expect((await call("/auth/exchange", { method: "POST", body: { code: ticket } })).status).toBe(401)

      // Save progress on GitHub account
      await call("/progress", {
        method: "PATCH",
        token: exData.token,
        body: { changes: { "basics/ohms-law": 1_750_000_000_000 } },
      })

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
      const pwData = (await pwLogin.json()) as {
        token: string
        user: { id: string }
        progress: { done: Record<string, number> }
      }
      expect(pwData.user.id).toBe(exData.user.id)
      expect(Object.keys(pwData.progress.done)).toEqual(["basics/ohms-law"])

      // Now unbinding GitHub is allowed because password login exists
      const unbind = await call("/account/unbind-github", { method: "POST", token: pwData.token })
      expect(unbind.status).toBe(200)
      const afterUnbind = (await unbind.json()) as { user: { github: null; username: string } }
      expect(afterUnbind.user.github).toBeNull()
      expect(afterUnbind.user.username).toBe("alice_local")
    } finally {
      close()
    }
  })

  it("allows password users to bind GitHub, prevents hijacking another user's GitHub, and changes passwords", async () => {
    const { call, close } = createHarness()
    try {
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

      // Callback does not bind yet: it hands back a one-time link code
      const cbA = await call(`/auth/github/callback?code=code-bob&state=${stateA}`)
      expect(cbA.status).toBe(302)
      const destA = new URL(cbA.headers.get("Location")!)
      expect(`${destA.origin}${destA.pathname}`).toBe("http://localhost:5273/learn/digital/pwm")
      const linkCodeA = new URLSearchParams(destA.hash.slice(1)).get("link_code")!
      expect(linkCodeA).toMatch(/^[a-f0-9]{48}$/)
      const notYet = (await (await call("/auth/me", { token: a.token })).json()) as { user: { github: unknown } }
      expect(notYet.user.github).toBeNull()

      // User A confirms with its own session → bob-gh bound to User A; the code is single-use
      const confirmA = await call("/account/github/link-confirm", { method: "POST", token: a.token, body: { code: linkCodeA } })
      expect(confirmA.status).toBe(200)
      expect(((await confirmA.json()) as { user: { github: { login: string } } }).user.github.login).toBe("bob-gh")
      expect(
        (await call("/account/github/link-confirm", { method: "POST", token: a.token, body: { code: linkCodeA } })).status,
      ).toBe(400)

      // Logging in with bob-gh now lands on User A with User A's progress
      const ghStart = await call("/auth/github/start?returnTo=/")
      const ghState = new URL(ghStart.headers.get("Location")!).searchParams.get("state")!
      const ghCb = await call(`/auth/github/callback?code=code-bob&state=${ghState}`)
      const ticket = new URLSearchParams(new URL(ghCb.headers.get("Location")!).hash.slice(1)).get("auth_code")!
      const ex = await call("/auth/exchange", { method: "POST", body: { code: ticket } })
      const exData = (await ex.json()) as {
        token: string
        user: { id: string; username: string }
        progress: { done: Record<string, number> }
      }
      expect(exData.user.id).toBe(a.user.id)
      expect(exData.user.username).toBe("user_a")
      expect(Object.keys(exData.progress.done)).toEqual(["digital/pwm"])

      // User B tries to bind the same GitHub (bob-gh) → rejected cleanly by UNIQUE constraint without overwriting
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
      const linkCodeB = new URLSearchParams(new URL(cbB.headers.get("Location")!).hash.slice(1)).get("link_code")!
      const confirmB = await call("/account/github/link-confirm", { method: "POST", token: b.token, body: { code: linkCodeB } })
      expect(confirmB.status).toBe(409)

      // Password change verifies old password
      expect(
        (
          await call("/account/password", {
            method: "POST",
            token: a.token,
            body: { currentPassword: "wrong", newPassword: "new-password-1" },
          })
        ).status,
      ).toBe(401)
      expect(
        (
          await call("/account/password", {
            method: "POST",
            token: a.token,
            body: { currentPassword: "password-aaaa", newPassword: "new-password-1" },
          })
        ).status,
      ).toBe(200)
      expect((await call("/auth/login", { method: "POST", body: { username: "user_a", password: "password-aaaa" } })).status).toBe(401)
      expect((await call("/auth/login", { method: "POST", body: { username: "user_a", password: "new-password-1" } })).status).toBe(200)

      // Changing the password signs out User A's other sessions (the GitHub login above), not this one
      expect((await call("/auth/me", { token: a.token })).status).toBe(200)
      expect((await call("/auth/me", { token: exData.token })).status).toBe(401)
    } finally {
      close()
    }
  })

  it("binds GitHub only for the session that started it, so a forwarded binding link cannot attach someone else's GitHub", async () => {
    const { call, db, advanceMs, close } = createHarness()
    try {
      const reg = async (username: string) =>
        (await (await call("/auth/register", { method: "POST", body: { username, password: "password-1234" } })).json()) as {
          token: string
          user: { id: string }
        }
      const attacker = await reg("attacker")
      const victim = await reg("victim_1")

      const startLink = async (token: string) => {
        const r = await call("/auth/github/link-start", { method: "POST", token, origin: "http://localhost:5273", body: {} })
        return new URL(((await r.json()) as { url: string }).url).searchParams.get("state")!
      }
      const linkCodeFor = async (state: string, ghCode: string) => {
        const cb = await call(`/auth/github/callback?code=${ghCode}&state=${state}`)
        return new URLSearchParams(new URL(cb.headers.get("Location")!).hash.slice(1)).get("link_code")!
      }
      const githubOf = async (userId: string) =>
        (await db.prepare("SELECT github_login FROM users WHERE id = ?").bind(userId).first<{ github_login: string | null }>())
          ?.github_login ?? null

      // The attacker starts a binding and gets the victim to authorize it: the code lands in the victim's browser
      const forwarded = await linkCodeFor(await startLink(attacker.token), "code-alice")

      // Without a session nothing happens; the code stays unconsumed for the right session
      expect((await call("/account/github/link-confirm", { method: "POST", body: { code: forwarded } })).status).toBe(401)
      // The victim's session is refused and the code is burnt
      const refused = await call("/account/github/link-confirm", { method: "POST", token: victim.token, body: { code: forwarded } })
      expect(refused.status).toBe(403)
      expect(await githubOf(attacker.user.id)).toBeNull()
      expect(await githubOf(victim.user.id)).toBeNull()
      expect(
        (await call("/account/github/link-confirm", { method: "POST", token: attacker.token, body: { code: forwarded } })).status,
      ).toBe(400)

      // Link codes expire after a minute
      const late = await linkCodeFor(await startLink(victim.token), "code-alice")
      advanceMs(61_000)
      expect((await call("/account/github/link-confirm", { method: "POST", token: victim.token, body: { code: late } })).status).toBe(400)
      expect(await githubOf(victim.user.id)).toBeNull()

      // Malformed codes are rejected before touching the database
      expect((await call("/account/github/link-confirm", { method: "POST", token: victim.token, body: { code: "nope" } })).status).toBe(400)
    } finally {
      close()
    }
  })

  it("keeps an active session alive: /auth/me renews it once half of its 30 days are used", async () => {
    const { call, advanceMs, close } = createHarness()
    const DAY = 1000 * 60 * 60 * 24
    try {
      const { token } = (await (
        await call("/auth/register", { method: "POST", body: { username: "regular", password: "password-1234" } })
      ).json()) as { token: string }

      advanceMs(20 * DAY)
      expect((await call("/auth/me", { token })).status).toBe(200) // renewed: expires at day 50
      advanceMs(20 * DAY)
      expect((await call("/auth/me", { token })).status).toBe(200) // day 40, renewed again: day 70
      advanceMs(31 * DAY)
      expect((await call("/auth/me", { token })).status).toBe(401) // day 71: a month without visits
    } finally {
      close()
    }
  })

  it("rate limits repeated failed logins and resets after the window expires", async () => {
    const { call, db, advanceMs, close } = createHarness()
    try {
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

      // After 5-minute window expires, login works again
      advanceMs(1000 * 301)
      const unblocked = await call("/auth/login", {
        method: "POST",
        ip: "203.0.113.10",
        body: { username: "victim", password: "real-password-1" },
      })
      expect(unblocked.status).toBe(200)

      // Expired buckets are cleaned up instead of piling up: after another window only the newest one is left
      advanceMs(1000 * 601)
      await call("/auth/login", { method: "POST", ip: "198.51.100.7", body: { username: "victim", password: "x" } })
      const buckets = await db.prepare("SELECT bucket FROM rate_limits").all<{ bucket: string }>()
      expect(buckets.results.map((r) => r.bucket)).toEqual(["login:198.51.100.7:victim"])
    } finally {
      close()
    }
  })
})

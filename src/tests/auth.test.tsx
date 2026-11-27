/**
 * End-to-end frontend + D1 worker integration tests:
 * optional login button, lesson completion prompt with "不再提示",
 * register/login, progress merge & unmark sync, account binding, and account switch isolation.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/toast"
import { setApiBaseForTest } from "@/auth/api"
import { resetAuthForTest, setExternalNavigatorForTest } from "@/auth/store"
import { setLessonDone } from "@/curriculum/progress"
import { LessonPage } from "@/site/LessonPage"
import { Shell } from "@/site/Shell"
import { createSqliteD1 } from "../../worker/sqlite-d1.mjs"
import { handleRequest } from "../../worker/src/app"
import type { Env } from "../../worker/src/types"

const API_ORIGIN = "https://api.ohmwork.test"
const closers: (() => void)[] = []

function installWorkerFetch(opts: { withGithub?: boolean; patchDelayMs?: number } = {}) {
  const { db, close } = createSqliteD1(":memory:")
  closers.push(close)
  const env: Env = {
    DB: db,
    ALLOWED_ORIGINS: "http://localhost:3000,http://localhost:5273,https://ohmwork.linjiejim.com",
    PUBLIC_BASE_URL: API_ORIGIN,
    GITHUB_CLIENT_ID: opts.withGithub === false ? "" : "test-client",
    GITHUB_CLIENT_SECRET: opts.withGithub === false ? "" : "test-secret",
  }

  const ghFetch: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
    if (url === "https://github.com/login/oauth/access_token") {
      return new Response(JSON.stringify({ access_token: "gh-tok-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }
    if (url === "https://api.github.com/user") {
      return new Response(JSON.stringify({ id: 9001, login: "octo-ee", name: "Octo", avatar_url: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }
    throw new Error(`Unexpected upstream fetch: ${url} (${init?.method ?? "GET"})`)
  }

  // paths listed here fail like a dropped connection; PATCH /progress can be slowed down to overlap requests
  const offline = new Set<string>()
  const patches = { inFlight: 0, maxInFlight: 0, count: 0 }
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(input, init)
    if (offline.has(new URL(req.url).pathname)) throw new TypeError("Failed to fetch")
    if (req.method === "PATCH") {
      patches.count++
      patches.inFlight++
      patches.maxInFlight = Math.max(patches.maxInFlight, patches.inFlight)
      try {
        if (opts.patchDelayMs) await new Promise((r) => setTimeout(r, opts.patchDelayMs))
        return await handleRequest(req, env, { fetchImpl: ghFetch })
      } finally {
        patches.inFlight--
      }
    }
    return handleRequest(req, env, { fetchImpl: ghFetch })
  })
  vi.stubGlobal("fetch", fetchMock)
  setApiBaseForTest(API_ORIGIN)

  return { db, env, ghFetch, fetchMock, offline, patches }
}

async function apiCall(env: Env, path: string, init: { method?: string; token?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = {}
  if (init.token) headers.Authorization = `Bearer ${init.token}`
  if (init.body !== undefined) headers["Content-Type"] = "application/json"
  return handleRequest(
    new Request(`${API_ORIGIN}${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    }),
    env,
  )
}

const localDoneKeys = () => Object.keys(JSON.parse(localStorage.getItem("ohmwork:done") ?? "{}")).sort()

async function serverDoneKeys(db: ReturnType<typeof createSqliteD1>["db"], username: string) {
  const r = await db
    .prepare(
      `SELECT p.lesson_key FROM progress p JOIN users u ON u.id = p.user_id
       WHERE u.username_lower = ? ORDER BY p.lesson_key`,
    )
    .bind(username)
    .all<{ lesson_key: string }>()
  return r.results.map((x) => x.lesson_key)
}

/** A page reload: same localStorage, fresh app state. */
function reload(initialUrl = "/learn/basics/ohms-law") {
  cleanup()
  resetAuthForTest()
  return renderApp(initialUrl)
}

function renderApp(initialUrl = "/learn/basics/ohms-law") {
  return render(
    <TooltipProvider>
      <MemoryRouter initialEntries={[initialUrl]}>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<div>home</div>} />
            <Route path="learn/:chapterId/:lessonSlug" element={<LessonPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
      <Toaster />
    </TooltipProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState(null, "", "/")
  setApiBaseForTest(null)
  setExternalNavigatorForTest(null)
  resetAuthForTest()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  setApiBaseForTest(null)
  setExternalNavigatorForTest(null)
  resetAuthForTest()
  while (closers.length > 0) closers.pop()?.()
})

describe("optional login & cloud sync", () => {
  it("stays completely hidden when cloud sync API is unconfigured", async () => {
    renderApp("/learn/basics/ohms-law")
    expect(screen.queryByRole("button", { name: "登录同步进度" })).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "完成本课" }))
    expect(screen.queryByRole("region", { name: "登录同步提示" })).toBeNull()
  })

  it("prompts gently once on lesson completion and respects 不再提示", async () => {
    installWorkerFetch()
    renderApp("/learn/basics/ohms-law")

    await waitFor(() => expect(screen.getByRole("button", { name: "登录同步进度" })).toBeTruthy())

    fireEvent.click(screen.getByRole("button", { name: "完成本课" }))
    const banner = await screen.findByRole("region", { name: "登录同步提示" })
    expect(banner.textContent).toContain("进度已保存在本地")

    fireEvent.click(within(banner).getByRole("button", { name: "不再提示" }))
    expect(screen.queryByRole("region", { name: "登录同步提示" })).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "标记为未学" }))
    fireEvent.click(screen.getByRole("button", { name: "完成本课" }))
    expect(screen.queryByRole("region", { name: "登录同步提示" })).toBeNull()
  })

  it("registers with username/password, merges local progress, syncs toggles, and isolates accounts on switch", async () => {
    const { db } = installWorkerFetch({ withGithub: true })
    setLessonDone("basics/voltage-current-resistance", true)

    renderApp("/learn/basics/ohms-law")
    const loginTrigger = await screen.findByRole("button", { name: "登录同步进度" })
    fireEvent.click(loginTrigger)

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByRole("button", { name: /使用 GitHub 登录/ })).toBeTruthy()

    fireEvent.click(within(dialog).getByRole("radio", { name: "注册" }))
    fireEvent.change(within(dialog).getByLabelText("用户名"), { target: { value: "alice_ee" } })
    fireEvent.change(within(dialog).getByLabelText("密码"), { target: { value: "pass123456" } })
    fireEvent.change(within(dialog).getByLabelText("确认密码"), { target: { value: "pass123456" } })
    fireEvent.click(within(dialog).getByRole("button", { name: "创建账号" }))

    await waitFor(() => expect(screen.getByRole("button", { name: "alice_ee" })).toBeTruthy())
    const alice = await db
      .prepare("SELECT id FROM users WHERE username_lower = ?")
      .bind("alice_ee")
      .first<{ id: string }>()
    expect(alice?.id).toBeTruthy()

    const listKeys = async (userId: string) => {
      const r = await db
        .prepare("SELECT lesson_key FROM progress WHERE user_id = ? ORDER BY lesson_key")
        .bind(userId)
        .all<{ lesson_key: string }>()
      return r.results.map((x) => x.lesson_key)
    }

    await waitFor(async () => {
      expect(await listKeys(alice!.id)).toContain("basics/voltage-current-resistance")
    })

    fireEvent.click(screen.getByRole("button", { name: "完成本课" }))
    await waitFor(async () => {
      expect(await listKeys(alice!.id)).toContain("basics/ohms-law")
    })

    fireEvent.click(screen.getByRole("button", { name: "标记为未学" }))
    await waitFor(async () => {
      expect(await listKeys(alice!.id)).not.toContain("basics/ohms-law")
    })

    // Open Account dialog → initiate GitHub binding
    const navSpy = vi.fn()
    setExternalNavigatorForTest(navSpy)
    fireEvent.click(screen.getByRole("button", { name: "alice_ee" }))
    const accountDialog = await screen.findByRole("dialog")
    fireEvent.click(within(accountDialog).getByRole("button", { name: "绑定 GitHub" }))
    await waitFor(() => expect(navSpy).toHaveBeenCalledTimes(1))
    expect(navSpy.mock.calls[0][0]).toContain("https://github.com/login/oauth/authorize")

    // Sign out (keeps local progress on screen)
    fireEvent.click(within(accountDialog).getByRole("button", { name: "退出登录" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "登录同步进度" })).toBeTruthy())

    // Register a DIFFERENT user (bob_ee) on the same browser: must NOT inherit alice_ee's cached progress
    fireEvent.click(screen.getByRole("button", { name: "登录同步进度" }))
    const dialogB = await screen.findByRole("dialog")
    fireEvent.click(within(dialogB).getByRole("radio", { name: "注册" }))
    fireEvent.change(within(dialogB).getByLabelText("用户名"), { target: { value: "bob_ee" } })
    fireEvent.change(within(dialogB).getByLabelText("密码"), { target: { value: "bobpass123" } })
    fireEvent.change(within(dialogB).getByLabelText("确认密码"), { target: { value: "bobpass123" } })
    fireEvent.click(within(dialogB).getByRole("button", { name: "创建账号" }))

    await waitFor(() => expect(screen.getByRole("button", { name: "bob_ee" })).toBeTruthy())
    const bob = await db
      .prepare("SELECT id FROM users WHERE username_lower = ?")
      .bind("bob_ee")
      .first<{ id: string }>()
    expect(await listKeys(bob!.id)).toEqual([])
  })

  it("keeps guest progress when the first merge fails, and uploads it on the next load", async () => {
    const { db, offline } = installWorkerFetch()
    setLessonDone("basics/voltage-current-resistance", true)
    setLessonDone("basics/power-energy", true)

    renderApp("/learn/basics/ohms-law")
    fireEvent.click(await screen.findByRole("button", { name: "登录同步进度" }))
    const dialog = await screen.findByRole("dialog")
    fireEvent.click(within(dialog).getByRole("radio", { name: "注册" }))
    fireEvent.change(within(dialog).getByLabelText("用户名"), { target: { value: "flaky_net" } })
    fireEvent.change(within(dialog).getByLabelText("密码"), { target: { value: "pass123456" } })
    fireEvent.change(within(dialog).getByLabelText("确认密码"), { target: { value: "pass123456" } })

    // the account is created, then the connection drops before the local progress is merged
    offline.add("/progress/merge")
    fireEvent.click(within(dialog).getByRole("button", { name: "创建账号" }))
    await waitFor(() => expect(screen.getByRole("button", { name: /flaky_net/ })).toBeTruthy())
    expect(await serverDoneKeys(db, "flaky_net")).toEqual([])
    expect(localDoneKeys()).toEqual(["basics/power-energy", "basics/voltage-current-resistance"])

    // next visit, connection back: the queued lessons go up instead of being overwritten by the empty server copy
    offline.clear()
    reload()
    await waitFor(async () =>
      expect(await serverDoneKeys(db, "flaky_net")).toEqual(["basics/power-energy", "basics/voltage-current-resistance"]),
    )
    expect(localDoneKeys()).toEqual(["basics/power-energy", "basics/voltage-current-resistance"])
    expect(localStorage.getItem("ohmwork:progress-pending")).toBeNull()
  })

  it("sends one progress update at a time and ends with the server matching the last click", async () => {
    const { db, env, patches } = installWorkerFetch({ patchDelayMs: 40 })
    const reg = (await (
      await apiCall(env, "/auth/register", { method: "POST", body: { username: "fast_clicker", password: "pass123456" } })
    ).json()) as { token: string; user: unknown }
    localStorage.setItem("ohmwork:token", reg.token)
    localStorage.setItem("ohmwork:user", JSON.stringify(reg.user))

    renderApp("/learn/basics/ohms-law")
    await waitFor(() => expect(screen.getByRole("button", { name: "fast_clicker" })).toBeTruthy())

    // done, undone, done, undone, done: each click lands while the previous update is still on the wire
    for (let i = 0; i < 5; i++) {
      act(() => setLessonDone("basics/ohms-law", i % 2 === 0))
      await new Promise((r) => setTimeout(r, 15))
    }
    await waitFor(() => expect(localStorage.getItem("ohmwork:progress-pending")).toBeNull(), { timeout: 2000 })
    expect(patches.maxInFlight).toBe(1)
    expect(await serverDoneKeys(db, "fast_clicker")).toEqual(["basics/ohms-law"])
    expect(localDoneKeys()).toEqual(["basics/ohms-law"])
  })

  it("binds GitHub from the return link only for the account that started it", async () => {
    const { db, env, ghFetch } = installWorkerFetch()
    const register = async (username: string) =>
      (await (
        await apiCall(env, "/auth/register", { method: "POST", body: { username, password: "pass123456" } })
      ).json()) as { token: string; user: unknown }
    const linkReturnHash = async (token: string) => {
      const r = await apiCall(env, "/auth/github/link-start", { method: "POST", token, body: { origin: "http://localhost:3000" } })
      const state = new URL(((await r.json()) as { url: string }).url).searchParams.get("state")!
      const cb = await handleRequest(new Request(`${API_ORIGIN}/auth/github/callback?code=c1&state=${state}`), env, {
        fetchImpl: ghFetch,
      })
      return new URL(cb.headers.get("Location")!).hash
    }
    const githubOf = async (username: string) =>
      (
        await db
          .prepare("SELECT github_login FROM users WHERE username_lower = ?")
          .bind(username)
          .first<{ github_login: string | null }>()
      )?.github_login ?? null
    const signInBrowserAs = (acc: { token: string; user: unknown }) => {
      localStorage.setItem("ohmwork:token", acc.token)
      localStorage.setItem("ohmwork:user", JSON.stringify(acc.user))
    }

    const owner = await register("link_owner")
    const other = await register("someone_else")

    // A binding link started by someone_else reaches link_owner's browser: refused, nothing bound
    signInBrowserAs(owner)
    window.history.replaceState(null, "", `/${await linkReturnHash(other.token)}`)
    renderApp("/")
    await screen.findByText("这次绑定不是从当前账号发起的，已取消")
    expect(window.location.hash).toBe("")
    expect(await githubOf("link_owner")).toBeNull()
    expect(await githubOf("someone_else")).toBeNull()

    // link_owner's own binding completes on return and opens the account dialog
    window.history.replaceState(null, "", `/${await linkReturnHash(owner.token)}`)
    reload("/")
    const dlg = await screen.findByRole("dialog")
    await waitFor(() => expect(dlg.textContent).toContain("@octo-ee"))
    expect(await githubOf("link_owner")).toBe("octo-ee")
  })

  it("completes GitHub OAuth return hash, binds username/password, and preserves normal section anchors", async () => {
    const { env, ghFetch } = installWorkerFetch({ withGithub: true })

    const start = await handleRequest(
      new Request(`${API_ORIGIN}/auth/github/start?returnTo=/&origin=http://localhost:3000`),
      env,
      { fetchImpl: ghFetch },
    )
    const state = new URL(start.headers.get("Location")!).searchParams.get("state")!
    const cb = await handleRequest(
      new Request(`${API_ORIGIN}/auth/github/callback?code=c1&state=${state}`),
      env,
      { fetchImpl: ghFetch },
    )
    const hash = new URL(cb.headers.get("Location")!).hash

    window.history.replaceState(null, "", `/${hash}`)
    renderApp("/")

    await waitFor(() => expect(screen.getByRole("button", { name: "Octo" })).toBeTruthy())
    expect(window.location.hash).toBe("")

    fireEvent.click(screen.getByRole("button", { name: "Octo" }))
    const dlg = await screen.findByRole("dialog")
    expect(dlg.textContent).toContain("@octo-ee")
    expect(dlg.textContent).toContain("绑定密码后可解绑")

    fireEvent.click(within(dlg).getByRole("button", { name: "绑定用户名和密码" }))
    fireEvent.change(within(dlg).getByLabelText("用户名"), { target: { value: "octo_local" } })
    fireEvent.change(within(dlg).getByLabelText("密码"), { target: { value: "octopass123" } })
    fireEvent.change(within(dlg).getByLabelText("确认密码"), { target: { value: "octopass123" } })
    fireEvent.click(within(dlg).getByRole("button", { name: "保存绑定" }))

    await waitFor(() => expect(within(dlg).getByText("用户名：octo_local")).toBeTruthy())
    expect(within(dlg).getByRole("button", { name: "解绑 GitHub" })).toBeTruthy()

    // Normal section hash must stay untouched on startup
    cleanup()
    resetAuthForTest()
    localStorage.clear()
    window.history.replaceState(null, "", "/#section-ohm")
    act(() => {
      renderApp("/")
    })
    await waitFor(() => expect(screen.getByRole("button", { name: "登录同步进度" })).toBeTruthy())
    expect(window.location.hash).toBe("#section-ohm")
  })
})

/**
 * End-to-end frontend + worker integration tests:
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
import { handleRequest } from "../../worker/src/app"
import type { Env, KVNamespaceLike } from "../../worker/src/types"

class MemoryKV implements KVNamespaceLike {
  map = new Map<string, string>()
  async get(key: string) {
    return this.map.get(key) ?? null
  }
  async put(key: string, value: string) {
    this.map.set(key, value)
  }
  async delete(key: string) {
    this.map.delete(key)
  }
}

const API_ORIGIN = "https://api.ohmwork.test"

function installWorkerFetch(opts: { withGithub?: boolean } = {}) {
  const kv = new MemoryKV()
  const env: Env = {
    KV: kv,
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

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(input, init)
    return handleRequest(req, env, { fetchImpl: ghFetch })
  })
  vi.stubGlobal("fetch", fetchMock)
  setApiBaseForTest(API_ORIGIN)

  return { kv, env, ghFetch, fetchMock }
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

    // Dismiss permanently
    fireEvent.click(within(banner).getByRole("button", { name: "不再提示" }))
    expect(screen.queryByRole("region", { name: "登录同步提示" })).toBeNull()

    // Marking undone and completing again must not prompt again
    fireEvent.click(screen.getByRole("button", { name: "标记为未学" }))
    fireEvent.click(screen.getByRole("button", { name: "完成本课" }))
    expect(screen.queryByRole("region", { name: "登录同步提示" })).toBeNull()
  })

  it("registers with username/password, merges local progress, syncs toggles, and isolates accounts on switch", async () => {
    const { kv } = installWorkerFetch({ withGithub: true })
    // Complete one lesson locally before signing up
    setLessonDone("basics/voltage-current-resistance", true)

    renderApp("/learn/basics/ohms-law")
    const loginTrigger = await screen.findByRole("button", { name: "登录同步进度" })
    fireEvent.click(loginTrigger)

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByRole("button", { name: /使用 GitHub 登录/ })).toBeTruthy()

    // Switch to 注册
    fireEvent.click(within(dialog).getByRole("radio", { name: "注册" }))
    fireEvent.change(within(dialog).getByLabelText("用户名"), { target: { value: "alice_ee" } })
    fireEvent.change(within(dialog).getByLabelText("密码"), { target: { value: "pass123456" } })
    fireEvent.change(within(dialog).getByLabelText("确认密码"), { target: { value: "pass123456" } })
    fireEvent.click(within(dialog).getByRole("button", { name: "创建账号" }))

    // Signed in: sidebar shows username, local progress merged into KV
    await waitFor(() => expect(screen.getByRole("button", { name: "alice_ee" })).toBeTruthy())
    const aliceId = await kv.get("uname:alice_ee")
    expect(aliceId).toBeTruthy()
    await waitFor(async () => {
      const saved = JSON.parse((await kv.get(`progress:${aliceId}`)) ?? "{}") as { done?: Record<string, number> }
      expect(saved.done).toHaveProperty("basics/voltage-current-resistance")
    })

    // Complete another lesson while signed in → synced to KV
    fireEvent.click(screen.getByRole("button", { name: "完成本课" }))
    await waitFor(async () => {
      const saved = JSON.parse((await kv.get(`progress:${aliceId}`)) ?? "{}") as { done?: Record<string, number> }
      expect(saved.done).toHaveProperty("basics/ohms-law")
    })

    // Unmark it → removed from KV
    fireEvent.click(screen.getByRole("button", { name: "标记为未学" }))
    await waitFor(async () => {
      const saved = JSON.parse((await kv.get(`progress:${aliceId}`)) ?? "{}") as { done?: Record<string, number> }
      expect(saved.done).not.toHaveProperty("basics/ohms-law")
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
    const bobId = await kv.get("uname:bob_ee")
    expect(await kv.get(`progress:${bobId}`)).toBeNull()
  })

  it("completes GitHub OAuth return hash, binds username/password, and preserves normal section anchors", async () => {
    const { env, ghFetch } = installWorkerFetch({ withGithub: true })

    // Simulate worker OAuth callback issuing an auth_code
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

    // Put #auth_code=... on window.location before mounting Shell
    window.history.replaceState(null, "", `/${hash}`)
    renderApp("/")

    await waitFor(() => expect(screen.getByRole("button", { name: "Octo" })).toBeTruthy())
    // Auth hash must be stripped cleanly from the URL
    expect(window.location.hash).toBe("")

    // GitHub user binds a username + password in AccountDialog
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

    // Now test normal hash preservation on fresh mount
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

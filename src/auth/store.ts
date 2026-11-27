import * as React from "react"
import { notify } from "@/components/ui/toast"
import {
  onLocalProgressChange,
  readDoneSnapshot,
  readPendingChanges,
  readProgressOwner,
  replaceProgress,
  writePendingChanges,
  type PendingChanges,
} from "@/curriculum/progress"
import {
  ApiError,
  bindPassword,
  changePassword,
  confirmGithubLink,
  exchangeCode,
  fetchConfig,
  fetchMe,
  githubLoginUrl,
  isSyncEnabled,
  login,
  logout,
  mergeProgress,
  patchProgress,
  register,
  startGithubLink,
  unbindGithub,
  type ProgressPayload,
  type PublicUser,
} from "./api"

const TOKEN_KEY = "ohmwork:token"
const USER_KEY = "ohmwork:user"
const PROMPT_DISMISSED_KEY = "ohmwork:login-prompt-dismissed"

export type AuthStatus = "disabled" | "loading" | "guest" | "authenticated"
export type SyncState = "idle" | "syncing" | "synced" | "offline"

export interface AuthState {
  status: AuthStatus
  user: PublicUser | null
  githubEnabled: boolean
  syncState: SyncState
  dialog: "none" | "auth" | "account"
  authTab: "login" | "register"
}

const initialState = (): AuthState => ({
  status: isSyncEnabled() ? "loading" : "disabled",
  user: null,
  githubEnabled: false,
  syncState: "idle",
  dialog: "none",
  authTab: "login",
})

let state: AuthState = initialState()
const listeners = new Set<() => void>()
let initialized = false
let teardownListeners: (() => void) | null = null

function emit(patch: Partial<AuthState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function writeSession(token: string | null, user: PublicUser | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
    else localStorage.removeItem(USER_KEY)
  } catch {
    // ignore storage errors
  }
}

function readCachedUser(): PublicUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as PublicUser) : null
  } catch {
    return null
  }
}

export function isLoginPromptDismissed(): boolean {
  try {
    return localStorage.getItem(PROMPT_DISMISSED_KEY) === "1"
  } catch {
    return false
  }
}

export function dismissLoginPrompt() {
  try {
    localStorage.setItem(PROMPT_DISMISSED_KEY, "1")
  } catch {
    // ignore
  }
}

export function displayName(user: PublicUser): string {
  if (user.username) return user.username
  if (user.github) return user.github.name || `@${user.github.login}`
  return "学习者"
}

/** Parse only OAuth callback hashes so regular section anchors (#heading) stay untouched. */
function parseAuthHash(hash: string): { code?: string; linkCode?: string; error?: string } | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash
  if (!raw || (!raw.includes("auth_code=") && !raw.includes("link_code=") && !raw.includes("auth_error="))) {
    return null
  }
  const params = new URLSearchParams(raw)
  const code = params.get("auth_code") ?? undefined
  const linkCode = params.get("link_code") ?? undefined
  const error = params.get("auth_error") ?? undefined
  if (!code && !linkCode && !error) return null
  return { code, linkCode, error }
}

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  github_cancelled: "已取消 GitHub 授权",
  invalid_state: "登录状态已过期，请重试",
  github_unconfigured: "当前服务尚未开启 GitHub 登录",
  github_failed: "GitHub 授权失败，请稍后重试",
}

/** Returns false when local progress could not be merged yet and is queued for the next flush. */
async function applySignedIn(token: string, user: PublicUser, serverProgress: ProgressPayload): Promise<boolean> {
  writeSession(token, user)
  const localDone = readDoneSnapshot()
  const owner = readProgressOwner()
  const shouldMergeLocal =
    Object.keys(localDone).length > 0 && (owner === null || owner === "guest" || owner === user.id)

  let finalProgress = serverProgress
  const unsynced: PendingChanges = {}
  if (shouldMergeLocal) {
    try {
      finalProgress = await mergeProgress(token, localDone)
    } catch {
      // Keep the union locally and queue what the server lacks. Without the queue the next
      // /auth/me would replace local progress with the server's and the lessons would be gone.
      for (const [k, v] of Object.entries(localDone)) {
        if (!(k in serverProgress.done)) unsynced[k] = v
      }
      finalProgress = {
        done: { ...serverProgress.done, ...localDone },
        updatedAt: Date.now(),
      }
    }
  }
  writePendingChanges(unsynced)
  replaceProgress(finalProgress.done, user.id)
  const synced = Object.keys(unsynced).length === 0
  emit({ status: "authenticated", user, syncState: synced ? "synced" : "offline", dialog: "none" })
  return synced
}

function signedInMessage(synced: boolean, done = "已登录") {
  return synced ? `${done}，学习进度已同步` : `${done}，本地进度稍后自动上传`
}

let flushPromise: Promise<boolean> | null = null

/** One flush at a time: callers during a flush share it, and its loop picks up changes made meanwhile. */
function flushPending(): Promise<boolean> {
  flushPromise ??= runFlush().finally(() => {
    flushPromise = null
  })
  return flushPromise
}

async function runFlush(): Promise<boolean> {
  const token = readToken()
  if (!token || state.status !== "authenticated") return false
  try {
    for (;;) {
      const pending = readPendingChanges()
      const keys = Object.keys(pending)
      if (keys.length === 0) return true

      emit({ syncState: "syncing" })
      const res = await patchProgress(token, pending)
      // signed out or switched account while the request was in flight: its result is not ours to apply
      if (readToken() !== token) return false

      // Remove only keys whose values didn't change again while the request was in flight
      const latest = readPendingChanges()
      for (const k of keys) {
        if (latest[k] === pending[k]) delete latest[k]
      }
      writePendingChanges(latest)
      if (Object.keys(latest).length === 0) {
        if (state.user) replaceProgress(res.done, state.user.id)
        emit({ syncState: "synced" })
        return true
      }
    }
  } catch (err) {
    if (readToken() !== token) return false
    if (err instanceof ApiError && err.status === 401) {
      writeSession(null, null)
      writePendingChanges({})
      emit({ status: "guest", user: null, syncState: "idle" })
      notify.warning("登录状态已过期，进度已保存在本地")
      return false
    }
    emit({ syncState: "offline" })
    return false
  }
}

function attachRuntimeListeners() {
  if (teardownListeners) return
  const offLocal = onLocalProgressChange((key, value) => {
    if (state.status !== "authenticated" || !readToken()) return
    const pending = readPendingChanges()
    pending[key] = value
    writePendingChanges(pending)
    void flushPending()
  })
  const onOnline = () => {
    if (state.status === "authenticated") void flushPending()
  }
  window.addEventListener("online", onOnline)
  teardownListeners = () => {
    offLocal()
    window.removeEventListener("online", onOnline)
  }
}

export async function initAuth() {
  if (initialized) return
  initialized = true

  if (!isSyncEnabled()) {
    emit({ status: "disabled", user: null, githubEnabled: false, syncState: "idle" })
    return
  }

  attachRuntimeListeners()

  const configPromise = fetchConfig()
    .then((c) => emit({ githubEnabled: Boolean(c.githubEnabled) }))
    .catch(() => {
      // Service offline or unreachable; keep local experience working quietly
    })

  const hashAction = parseAuthHash(window.location.hash)
  if (hashAction) {
    window.history.replaceState(null, "", window.location.pathname + window.location.search)
    if (hashAction.error) {
      const msg = AUTH_ERROR_MESSAGES[hashAction.error] ?? "登录失败，请稍后重试"
      if (hashAction.error === "github_cancelled") notify.info(msg)
      else notify.error(msg)
    } else if (hashAction.code) {
      try {
        const res = await exchangeCode(hashAction.code)
        notify.success(signedInMessage(await applySignedIn(res.token, res.user, res.progress)))
        await configPromise
        return
      } catch (err) {
        notify.error(err instanceof Error ? err.message : "登录凭证已过期，请重新登录")
      }
    }
  }

  const token = readToken()
  if (!token) {
    if (hashAction?.linkCode) notify.error("登录已失效，请登录后重新绑定 GitHub")
    emit({ status: "guest", user: null, syncState: "idle" })
    await configPromise
    return
  }

  const cached = readCachedUser()
  if (cached) {
    emit({ status: "authenticated", user: cached, syncState: "syncing" })
  }

  try {
    const me = await fetchMe(token)
    writeSession(token, me.user)
    emit({ status: "authenticated", user: me.user, syncState: "syncing" })

    const pending = readPendingChanges()
    if (Object.keys(pending).length > 0 && readProgressOwner() === me.user.id) {
      await flushPending()
    } else {
      replaceProgress(me.progress.done, me.user.id)
      emit({ syncState: "synced" })
    }

    if (hashAction?.linkCode) await finishGithubLink(token, hashAction.linkCode)
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      writeSession(null, null)
      writePendingChanges({})
      emit({ status: "guest", user: null, syncState: "idle" })
    } else if (cached) {
      emit({ status: "authenticated", user: cached, syncState: "offline" })
    } else {
      emit({ status: "guest", user: null, syncState: "offline" })
    }
  }

  await configPromise
}

/**
 * The OAuth callback only hands back a one-time link code; binding happens here, with the session that
 * started it. A link code that reaches someone else's browser (a forwarded GitHub link) is refused.
 */
async function finishGithubLink(token: string, code: string) {
  try {
    const { user } = await confirmGithubLink(token, code)
    writeSession(token, user)
    emit({ user, dialog: "account" })
    notify.success("已绑定 GitHub 账号")
  } catch (err) {
    notify.error(err instanceof Error ? err.message : "绑定 GitHub 失败，请重试")
  }
}

export function openAuthDialog(tab: "login" | "register" = "login") {
  emit({ dialog: "auth", authTab: tab })
}

export function openAccountDialog() {
  emit({ dialog: "account" })
}

export function closeAuthDialogs() {
  emit({ dialog: "none" })
}

export function setAuthTab(tab: "login" | "register") {
  emit({ authTab: tab })
}

export async function loginWithPassword(username: string, password: string) {
  const res = await login(username, password)
  notify.success(signedInMessage(await applySignedIn(res.token, res.user, res.progress)))
}

export async function registerWithPassword(username: string, password: string) {
  const res = await register(username, password)
  notify.success(signedInMessage(await applySignedIn(res.token, res.user, res.progress), "账号已创建"))
}

let navigateExternal: (url: string) => void = (url) => {
  window.location.assign(url)
}

/** Tests can observe full-page OAuth redirects without triggering jsdom navigation errors. */
export function setExternalNavigatorForTest(fn: ((url: string) => void) | null) {
  navigateExternal = fn ?? ((url) => window.location.assign(url))
}

export function startGithubLogin(returnTo?: string) {
  const target = returnTo ?? window.location.pathname + window.location.search
  navigateExternal(githubLoginUrl(target, window.location.origin))
}

export async function startGithubBind(returnTo?: string) {
  const token = readToken()
  if (!token) throw new ApiError(401, "请先登录")
  const target = returnTo ?? window.location.pathname + window.location.search
  const { url } = await startGithubLink(token, target, window.location.origin)
  navigateExternal(url)
}

export async function bindUsernamePassword(username: string, password: string) {
  const token = readToken()
  if (!token) throw new ApiError(401, "请先登录")
  const { user } = await bindPassword(token, username, password)
  writeSession(token, user)
  emit({ user })
  notify.success("已绑定用户名和密码")
}

export async function updatePassword(currentPassword: string, newPassword: string) {
  const token = readToken()
  if (!token) throw new ApiError(401, "请先登录")
  await changePassword(token, currentPassword, newPassword)
  notify.success("密码已更新，其他设备需要重新登录")
}

export async function unlinkGithubAccount() {
  const token = readToken()
  if (!token) throw new ApiError(401, "请先登录")
  const { user } = await unbindGithub(token)
  writeSession(token, user)
  emit({ user })
  notify.success("已解绑 GitHub 账号")
}

export async function syncNow() {
  const token = readToken()
  if (!token || state.status !== "authenticated") return
  emit({ syncState: "syncing" })
  try {
    if (Object.keys(readPendingChanges()).length > 0) {
      const ok = await flushPending()
      if (!ok) return
    }
    const me = await fetchMe(token)
    writeSession(token, me.user)
    replaceProgress(me.progress.done, me.user.id)
    emit({ user: me.user, syncState: "synced" })
    notify.success("学习进度已同步")
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      writeSession(null, null)
      writePendingChanges({})
      emit({ status: "guest", user: null, syncState: "idle", dialog: "none" })
      notify.warning("登录状态已过期，请重新登录")
    } else {
      emit({ syncState: "offline" })
      notify.error("同步失败，请检查网络后重试")
    }
  }
}

export async function signOut() {
  const token = readToken()
  writeSession(null, null)
  writePendingChanges({})
  emit({ status: "guest", user: null, syncState: "idle", dialog: "none" })
  notify.info("已退出登录，本地进度仍保留")
  if (token) {
    void logout(token).catch(() => {})
  }
}

export function resetAuthForTest() {
  teardownListeners?.()
  teardownListeners = null
  initialized = false
  flushPromise = null
  state = initialState()
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

function getSnapshot() {
  return state
}

export function useAuth(): AuthState {
  return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

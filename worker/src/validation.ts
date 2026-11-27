export const USERNAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,23}$/
export const LESSON_KEY_RE = /^[a-z0-9-]{1,40}\/[a-z0-9-]{1,60}$/
const MAX_LESSONS = 200

export function validateUsername(raw: unknown): { ok: true; display: string; key: string } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: "请输入用户名" }
  const display = raw.trim()
  if (!display) return { ok: false, error: "请输入用户名" }
  if (!USERNAME_RE.test(display)) {
    return { ok: false, error: "用户名需为 3–24 位字母、数字、下划线或连字符，且以字母或数字开头" }
  }
  return { ok: true, display, key: display.toLowerCase() }
}

export function validatePassword(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof raw !== "string" || raw.length === 0) return { ok: false, error: "请输入密码" }
  if (raw.length < 8) return { ok: false, error: "密码至少需要 8 位" }
  if (raw.length > 128) return { ok: false, error: "密码不能超过 128 位" }
  return { ok: true, value: raw }
}

export function sanitizeTimestamp(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return fallback
  const n = Math.trunc(value)
  // Keep timestamps in a sane range (2020-01-01 to now + 1 day)
  const min = 1577836800000
  const max = fallback + 86_400_000
  if (n < min || n > max) return fallback
  return n
}

export function sanitizeDoneMap(input: unknown, now = Date.now()): Record<string, number> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {}
  const out: Record<string, number> = {}
  let count = 0
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (count >= MAX_LESSONS) break
    if (!LESSON_KEY_RE.test(k)) continue
    out[k] = sanitizeTimestamp(v, now)
    count++
  }
  return out
}

export function sanitizeProgressChanges(input: unknown, now = Date.now()): Record<string, number | null> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null
  const out: Record<string, number | null> = {}
  let count = 0
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (count >= MAX_LESSONS) break
    if (!LESSON_KEY_RE.test(k)) continue
    if (v === null) {
      out[k] = null
      count++
    } else if (typeof v === "number" || v === true) {
      out[k] = sanitizeTimestamp(typeof v === "number" ? v : now, now)
      count++
    }
  }
  return out
}

/** Only allow same-origin relative paths so OAuth redirects cannot be abused as open redirects. */
export function sanitizeReturnTo(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return "/"
  const trimmed = raw.trim()
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || /[\r\n\\]/.test(trimmed)) return "/"
  return trimmed.slice(0, 200)
}

export function sanitizeAvatarUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  try {
    const u = new URL(raw)
    return u.protocol === "https:" ? u.toString() : null
  } catch {
    return null
  }
}

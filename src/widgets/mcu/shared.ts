/** Small helpers shared by the widgets of the 单片机与通信接口 chapter. */

/** A repeatable pseudo-random number in [0, 1) for an integer. Widgets use it instead of Math.random so a render never changes the picture. */
export function hash01(i: number): number {
  let x = (Math.imul(i | 0, 0x9e3779b1) ^ 0x85ebca6b) >>> 0
  x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d) >>> 0
  x = Math.imul(x ^ (x >>> 12), 0x297a2d39) >>> 0
  return ((x ^ (x >>> 15)) >>> 0) / 4294967296
}

/** Smooth noise in [−1, 1]: random values at the integers of `t`, eased in between. A different `seed` gives a different curve. */
export function smoothNoise(t: number, seed = 0): number {
  const k = Math.floor(t)
  const f = t - k
  const u = f * f * (3 - 2 * f)
  const a = hash01(k + seed * 7919)
  const b = hash01(k + 1 + seed * 7919)
  return (a + (b - a) * u) * 2 - 1
}

/** Parse "48", "0x48" or "4a" as an integer from 0 to `max`; null when the text is not one. */
export function parseHex(text: string, max = 0xff): number | null {
  const t = text.trim().replace(/^0x/i, "")
  if (!/^[0-9a-f]{1,2}$/i.test(t)) return null
  const v = Number.parseInt(t, 16)
  return v <= max ? v : null
}

/** 0x41 style, always two digits. */
export function hex(v: number): string {
  return `0x${v.toString(16).toUpperCase().padStart(2, "0")}`
}

/** Binary digits, most significant first, padded to `width`. */
export function bin(v: number, width = 8): string {
  return v.toString(2).padStart(width, "0")
}

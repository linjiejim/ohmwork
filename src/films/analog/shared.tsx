import { clamp01 } from "../kit"

/** Helpers the analog films share: waves computed from the clock, never from state. */

const r2 = (n: number) => Math.round(n * 100) / 100

/** A polyline path through points. */
export const poly = (pts: ReadonlyArray<readonly [number, number]>) => "M" + pts.map(([x, y]) => `${r2(x)} ${r2(y)}`).join("L")

/** A path y = f(x) sampled at n+1 points from x0 to x1. */
export function sample(f: (x: number) => number, x0: number, x1: number, n = 160) {
  const pts: [number, number][] = []
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n
    pts.push([x, f(x)])
  }
  return poly(pts)
}

/** Deterministic noise in 0–1. */
export const rnd = (i: number, k = 0) => {
  const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453
  return s - Math.floor(s)
}

export const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x)

/** A pop: 0 → 1 with a little overshoot, for dots and markers that land. */
export const pop = (t: number, at: number, dur = 0.4) => {
  const p = clamp01((t - at) / dur)
  return p <= 0 ? 0 : p >= 1 ? 1 : 1 - (1 - p) ** 3 + Math.sin(p * Math.PI) * 0.2
}

/** Pin positions of <OpAmp> drawn at (cx, cy) with Sym scale s. */
export const oaPins = (cx: number, cy: number, s: number) => ({
  minus: [cx - 40 * s, cy - 14 * s] as const,
  plus: [cx - 40 * s, cy + 14 * s] as const,
  out: [cx + 44 * s, cy] as const,
  top: [cx - 0, cy - 15.1 * s] as const,
  bottom: [cx - 0, cy + 15.1 * s] as const,
})

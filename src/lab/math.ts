/** Small numeric helpers for simulations. */

export const TAU = Math.PI * 2

export function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

/** Where `v` sits between a and b, as 0–1 (unclamped). */
export function unlerp(a: number, b: number, v: number) {
  return (v - a) / (b - a)
}

/** n evenly spaced values from a to b, both included. */
export function linspace(a: number, b: number, n: number): number[] {
  if (n <= 1) return [a]
  return Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1))
}

/** n values from a to b spaced evenly on a log axis (a, b > 0). */
export function logspace(a: number, b: number, n: number): number[] {
  const la = Math.log10(a)
  const lb = Math.log10(b)
  return linspace(la, lb, n).map((e) => 10 ** e)
}

/** Decibels from a voltage (amplitude) ratio. */
export function dbV(ratio: number) {
  return 20 * Math.log10(Math.max(ratio, 1e-12))
}

/** Decibels from a power ratio. */
export function dbP(ratio: number) {
  return 10 * Math.log10(Math.max(ratio, 1e-18))
}

/** Two resistances (or impedances) in parallel. */
export function parallel(...r: number[]) {
  const g = r.reduce((sum, x) => sum + 1 / x, 0)
  return g === 0 ? Infinity : 1 / g
}

/** The nearest standard value from an E-series (E12 by default), any decade. */
const E12 = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2]
const E24 = [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1]
export function nearestE(value: number, series: "E12" | "E24" = "E12"): number {
  if (!(value > 0)) return 0
  const base = series === "E24" ? E24 : E12
  const decade = 10 ** Math.floor(Math.log10(value))
  let best = base[0] * decade
  for (const d of [decade / 10, decade, decade * 10]) {
    for (const b of base) {
      const c = b * d
      if (Math.abs(Math.log(c / value)) < Math.abs(Math.log(best / value))) best = c
    }
  }
  return Number(best.toPrecision(3))
}

/**
 * Fixed-step RK4 for a small ODE system dy/dt = f(t, y).
 * Returns the state after one step of size h.
 */
export function rk4(f: (t: number, y: number[]) => number[], t: number, y: number[], h: number): number[] {
  const add = (a: number[], b: number[], s: number) => a.map((v, i) => v + b[i] * s)
  const k1 = f(t, y)
  const k2 = f(t + h / 2, add(y, k1, h / 2))
  const k3 = f(t + h / 2, add(y, k2, h / 2))
  const k4 = f(t + h, add(y, k3, h))
  return y.map((v, i) => v + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]))
}

/** Shockley diode current. Is ≈ 1e-12 A and n·Vt ≈ 0.05 V suit a small silicon diode. */
export function diodeCurrent(v: number, is = 1e-12, nVt = 0.05) {
  return is * (Math.exp(clamp(v / nVt, -60, 60)) - 1)
}

/**
 * Solve "a source behind a resistor feeds a diode" for the operating point:
 * find Vd where (vs − Vd) / r = Id(Vd). Bisection, always converges.
 */
export function solveDiodeLoop(vs: number, r: number, is = 1e-12, nVt = 0.05): { vd: number; id: number } {
  if (vs <= 0) return { vd: vs, id: diodeCurrent(vs, is, nVt) }
  let lo = 0
  let hi = vs
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if ((vs - mid) / r > diodeCurrent(mid, is, nVt)) lo = mid
    else hi = mid
  }
  const vd = (lo + hi) / 2
  return { vd, id: (vs - vd) / r }
}

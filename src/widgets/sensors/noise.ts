/*
 * Repeatable "noise" for the sensor widgets. A seeded generator, run once when
 * the module loads, so a widget shows the same jitter on every render and no
 * random number is ever drawn while React is rendering.
 */

/** mulberry32: a tiny seeded generator of uniform numbers in [0, 1). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * `n` samples of Gaussian noise with standard deviation 1 (Box–Muller),
 * clipped to ±3 so a single outlier never leaves a plot. Same seed, same record.
 */
export function gaussianNoise(seed: number, n: number): number[] {
  const rand = seededRandom(seed)
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const u1 = Math.max(rand(), 1e-12)
    const u2 = rand()
    const g = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
    out.push(Math.max(-3, Math.min(3, g)))
  }
  return out
}

/** Standard deviation of a record. */
export function stdDev(values: readonly number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length)
}

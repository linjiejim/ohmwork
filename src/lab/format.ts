/** Numbers and engineering units, shared by every widget and calculator. */

const PREFIXES: [number, string][] = [
  [1e12, "T"],
  [1e9, "G"],
  [1e6, "M"],
  [1e3, "k"],
  [1, ""],
  [1e-3, "m"],
  [1e-6, "μ"],
  [1e-9, "n"],
  [1e-12, "p"],
  [1e-15, "f"],
]

/** Trim a number to `digits` significant figures without trailing zeros: 4.70 → "4.7". */
export function sig(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return value > 0 ? "∞" : value < 0 ? "−∞" : "—"
  if (value === 0) return "0"
  const s = Number(value.toPrecision(digits)).toString()
  return s.replace("-", "−")
}

/**
 * Engineering notation with an SI prefix: formatSI(0.0047, "A") → "4.7 mA",
 * formatSI(4700, "Ω") → "4.7 kΩ". Zero and tiny values read as "0 A".
 */
export function formatSI(value: number, unit = "", digits = 3): string {
  if (!Number.isFinite(value)) return `${sig(value)}${unit ? " " + unit : ""}`
  const abs = Math.abs(value)
  if (abs < 1e-16) return `0${unit ? " " + unit : ""}`
  const [factor, prefix] = PREFIXES.find(([f]) => abs >= f * 0.9995) ?? PREFIXES[PREFIXES.length - 1]
  return `${sig(value / factor, digits)} ${prefix}${unit}`.trim()
}

/** Fixed decimals with a real minus sign: fixed(-1.5, 2) → "−1.50". */
export function fixed(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return sig(value)
  return value.toFixed(decimals).replace("-", "−")
}

/** Percent from a 0–1 fraction: percent(0.256) → "25.6%". */
export function percent(fraction: number, decimals = 0): string {
  return `${fixed(fraction * 100, decimals)}%`
}

/** Parse "4.7k", "100n", "2M2", "330", "0.1u" into a number (NaN when it can't). */
export function parseSI(text: string): number {
  const t = text.trim().replace(/[ΩΩ\s]|ohm|[FHVAWs]$|Hz$/gi, "")
  const map: Record<string, number> = { T: 1e12, G: 1e9, M: 1e6, k: 1e3, K: 1e3, R: 1, m: 1e-3, u: 1e-6, "μ": 1e-6, "µ": 1e-6, n: 1e-9, p: 1e-12, f: 1e-15 }
  // "4k7" style: the prefix sits where the decimal point would
  const infix = /^(\d+)([TGMkKRmuμµnpf])(\d+)$/.exec(t)
  if (infix) return Number(`${infix[1]}.${infix[3]}`) * map[infix[2]]
  const m = /^(-?\d*\.?\d+(?:e-?\d+)?)([TGMkKRmuμµnpf]?)$/i.exec(t)
  if (!m) return Number.NaN
  return Number(m[1]) * (m[2] ? (map[m[2]] ?? 1) : 1)
}

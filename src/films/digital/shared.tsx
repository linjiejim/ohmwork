import { trace } from "@/lab/colors"
import { Gate, type GateType } from "@/lab/schematic"
import { Sym, easeInOut, enter, lerp } from "../kit"

/* Helpers the digital chapter's films share: colours, a hash for pseudo-random noise, square waves, gate symbols. */

export const HI = trace.voltage
export const CUR = trace.current
export const MUTED = "var(--muted-foreground)"
export const LINE = "var(--border)"
export const FG = "var(--foreground)"

/** Deterministic noise in [0, 1). */
export const hash = (i: number, k = 0) => {
  const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453
  return s - Math.floor(s)
}

/** A rise-in offset for entrances (none under reduced motion). */
export const makeRise = (t: number, still: boolean) => (at: number, d = 1.6) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)
export const makeLift = (t: number, still: boolean) => (at: number) => (still ? 0 : -easeInOut((t - at) / 0.45) * 2)

/** Piecewise-linear value through [time, value] keys. */
export function keys(t: number, pts: [number, number][]) {
  if (t <= pts[0][0]) return pts[0][1]
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i][0]) return lerp(pts[i - 1][1], pts[i][1], (t - pts[i - 1][0]) / Math.max(1e-6, pts[i][0] - pts[i - 1][0]))
  }
  return pts[pts.length - 1][1]
}

/** Path of a square wave: one level (0 / 1) per slot of width dx starting at x0. */
export function sq(levels: readonly number[], x0: number, dx: number, yHi: number, yLo: number) {
  let d = ""
  let prev: number | null = null
  levels.forEach((v, i) => {
    const y = v ? yHi : yLo
    d += prev == null ? `M${x0} ${y}` : prev === y ? "" : `V${y}`
    d += `H${x0 + (i + 1) * dx}`
    prev = y
  })
  return d
}

export const gateFn = (type: GateType, a: number, b = 0) => {
  switch (type) {
    case "and": return a & b
    case "or": return a | b
    case "not": return 1 - a
    case "nand": return 1 - (a & b)
    case "nor": return 1 - (a | b)
    case "xor": return a ^ b
    case "xnor": return 1 - (a ^ b)
    default: return a
  }
}

/** A gate symbol (src/lab/schematic.tsx) on the stage, `scale` × its 60-unit width. Leads that are high turn orange. */
export function GateAt({ x, y, scale, type, a, b, out, o = 1 }: { x: number; y: number; scale: number; type: GateType; a?: boolean; b?: boolean; out?: boolean; o?: number }) {
  if (o <= 0.001) return null
  return (
    <Sym x={x} y={y} scale={scale} opacity={o}>
      <Gate type={type} x={0} y={0} a={a} b={b} out={out} />
    </Sym>
  )
}

/** A short vertical arrow bobbing down, pointing at the widgets under the film. */
export function DownArrow({ t, at, still, x = 50, y = 44 }: { t: number; at: number; still: boolean; x?: number; y?: number }) {
  return (
    <g opacity={enter(t, at, 0.5)} transform={`translate(0 ${still ? 0 : Math.sin(t * 3.2) * 0.6})`} strokeWidth={0.45}>
      <path d={`M${x} ${y} V${y + 7} M${x - 2.4} ${y + 4.6} L${x} ${y + 7} L${x + 2.4} ${y + 4.6}`} />
    </g>
  )
}

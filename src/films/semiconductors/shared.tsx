import * as React from "react"
import { trace } from "@/lab/colors"
import { clamp01, lerp } from "../kit"

/** Helpers the four semiconductor films share. All pure functions of time. */

export const VOLT = trace.voltage
export const AMP = trace.current
export const HEAT = trace.power
export const MUTED = "var(--muted-foreground)"
export const LINE = "var(--border)"

/** A repeatable pseudo-random number in [0, 1). */
export const rnd = (i: number, k = 0) => {
  const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453
  return s - Math.floor(s)
}

export type Pt = readonly [number, number]

export function polyLength(pts: readonly Pt[]) {
  let n = 0
  for (let i = 1; i < pts.length; i++) n += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
  return n
}

/** The point `d` units along a polyline (clamped to its ends). */
export function polyAt(pts: readonly Pt[], d: number): Pt {
  let left = Math.max(0, d)
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
    if (left <= seg) {
      const p = seg === 0 ? 0 : left / seg
      return [lerp(pts[i - 1][0], pts[i][0], p), lerp(pts[i - 1][1], pts[i][1], p)]
    }
    left -= seg
  }
  return pts[pts.length - 1]
}

export function polyD(pts: readonly Pt[]) {
  return pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ")
}

/**
 * Dots drifting along a path. `phase` is how far they have travelled (units); `closed` loops them
 * round a ring, otherwise they fade in and out at the ends. `skip` hides dots inside part symbols.
 */
export function FlowDots({
  pts,
  phase,
  gap = 4,
  color = AMP,
  r = 0.55,
  o = 1,
  closed = false,
  skip,
}: {
  pts: readonly Pt[]
  phase: number
  gap?: number
  color?: string
  r?: number
  o?: number
  closed?: boolean
  skip?: (x: number, y: number) => boolean
}) {
  if (o <= 0.001) return null
  const len = polyLength(pts)
  const n = Math.floor(len / gap)
  const out: React.ReactNode[] = []
  for (let i = 0; i < n; i++) {
    const raw = i * gap + phase
    const d = ((raw % len) + len) % len
    const [x, y] = polyAt(pts, d)
    if (skip?.(x, y)) continue
    const edge = closed ? 1 : clamp01(Math.min(d, len - d) / 3)
    out.push(<circle key={i} cx={x} cy={y} r={r} fill={color} stroke="none" opacity={o * edge} />)
  }
  return <>{out}</>
}

/** An arrow head at (x, y) pointing along `angle` (radians, 0 = right). */
export function Head({ x, y, angle, size = 1.3, color, o = 1 }: { x: number; y: number; angle: number; size?: number; color?: string; o?: number }) {
  const a = (k: number) => [x - Math.cos(angle + k) * size, y - Math.sin(angle + k) * size]
  const [x1, y1] = a(0.5)
  const [x2, y2] = a(-0.5)
  return <path d={`M${x1} ${y1} L${x} ${y} L${x2} ${y2}`} stroke={color} opacity={o} />
}

/** A straight arrow from (x1, y1) to (x2, y2), drawn `p` of the way. */
export function Arrow({ x1, y1, x2, y2, p = 1, color, width = 0.4 }: { x1: number; y1: number; x2: number; y2: number; p?: number; color?: string; width?: number }) {
  if (p <= 0.001) return null
  const x = lerp(x1, x2, p)
  const y = lerp(y1, y2, p)
  const a = Math.atan2(y2 - y1, x2 - x1)
  return (
    <g stroke={color} strokeWidth={width}>
      <path d={`M${x1} ${y1} L${x} ${y}`} />
      {p > 0.6 && <Head x={x} y={y} angle={a} size={1.5} color={color} o={clamp01((p - 0.6) / 0.4)} />}
    </g>
  )
}

/** Sample f over [a, b] into a polyline path. */
export function curvePts(f: (v: number) => number, a: number, b: number, n = 60): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const v = lerp(a, b, i / n)
    return [v, f(v)] as Pt
  })
}

/** A caption chip like "口算窍门": a small pill label. */
export function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-input px-[0.9em] py-[0.45em] text-muted-foreground">{children}</span>
}

/** A subscript in KaTeX's math italic: V<Sb>f</Sb>. */
export function Sb({ children }: { children: React.ReactNode }) {
  return <span style={{ fontFamily: "KaTeX_Math, serif", fontStyle: "italic", fontSize: "0.62em", verticalAlign: "-0.28em", marginLeft: "0.05em" }}>{children}</span>
}

import * as React from "react"
import { trace } from "@/lab/colors"
import { T, V } from "../kit"

export const VOLT = trace.voltage
export const AMP = trace.current
export const POWER = trace.power
export const MUTED = "var(--muted-foreground)"
export const LINE = "var(--border)"

/** Deterministic pseudo-random in [0, 1). */
export const rnd = (i: number, k = 0) => {
  const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453
  return s - Math.floor(s)
}

/** The integral of a speed over time, for dots whose speed changes. */
export function integ(f: (s: number) => number, a: number, b: number) {
  let p = 0
  const dt = 1 / 30
  for (let s = a; s < b; s += dt) p += f(s) * Math.min(dt, b - s)
  return p
}

/** Dots drifting along the segment (x0,y0)→(x1,y1). `phase` is the distance travelled so far. */
export function Flow({ x0, y0, x1, y1, phase, spacing = 3.4, o = 1, color = AMP, r = 0.6, skip }: { x0: number; y0: number; x1: number; y1: number; phase: number; spacing?: number; o?: number; color?: string; r?: number; skip?: [number, number][] }) {
  if (o <= 0.01) return null
  const len = Math.hypot(x1 - x0, y1 - y0)
  const n = Math.floor(len / spacing)
  const out: React.ReactNode[] = []
  for (let i = 0; i < n; i++) {
    const s = (((i + 0.5) * spacing + phase) % len + len) % len
    if (skip?.some(([a, b]) => s > a && s < b)) continue
    out.push(<circle key={i} cx={x0 + ((x1 - x0) * s) / len} cy={y0 + ((y1 - y0) * s) / len} r={r} fill={color} stroke="none" opacity={o} />)
  }
  return <>{out}</>
}

/** A zigzag resistor from (x0,y0) to (x1,y1), with short straight leads at both ends. */
export function zig(x0: number, y0: number, x1: number, y1: number, n = 6, amp = 1.5, lead = 0.2) {
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.hypot(dx, dy)
  const ux = dx / len
  const uy = dy / len
  const px = -uy
  const py = ux
  const a = len * lead
  const body = len - 2 * a
  const pts: string[] = [`M${x0} ${y0}`, `L${x0 + ux * a} ${y0 + uy * a}`]
  for (let i = 0; i < n; i++) {
    const s = a + (body * (i + 0.5)) / n
    const side = i % 2 ? -amp : amp
    pts.push(`L${x0 + ux * s + px * side} ${y0 + uy * s + py * side}`)
  }
  pts.push(`L${x0 + ux * (len - a)} ${y0 + uy * (len - a)}`, `L${x1} ${y1}`)
  return pts.join(" ")
}

/** A battery between (x, y-1.2) and (x, y+1.2), long (+) plate up, vertical orientation. */
export function BatteryV({ x, y, o = 1 }: { x: number; y: number; o?: number }) {
  return (
    <g opacity={o}>
      <path d={`M${x - 3.4} ${y - 1.2} H${x + 3.4}`} />
      <path d={`M${x - 1.6} ${y + 1.2} H${x + 1.6}`} strokeWidth={0.75} />
      <path d={`M${x + 3.4} ${y - 2.7} h1.6 M${x + 4.2} ${y - 3.5} v1.6`} strokeWidth={0.22} stroke={VOLT} />
    </g>
  )
}

export function Readout({ x = 62, right = 90, y, label, letter, color, o, value, size = 4.6 }: { x?: number; right?: number; y: number; label: string; letter: string; color?: string; o: number; value: string; size?: number }) {
  return (
    <>
      <T x={x} y={y} size={2.5} anchor="start" color={MUTED} o={o}>
        {label} <V c={color}>{letter}</V>
      </T>
      <T x={right} y={y} size={size} anchor="end" weight={600} color={color} o={o} className="tabular">
        {value}
      </T>
    </>
  )
}

/** A ground symbol with its stem top at (x, y). */
export function Ground({ x, y, o = 1 }: { x: number; y: number; o?: number }) {
  return (
    <g opacity={o}>
      <path d={`M${x} ${y} V${y + 1.5} M${x - 2.2} ${y + 1.5} H${x + 2.2} M${x - 1.4} ${y + 2.5} H${x + 1.4} M${x - 0.6} ${y + 3.5} H${x + 0.6}`} />
    </g>
  )
}

/** The numbers that make "×", "−" etc. look right inside T. */
export const fmt = (n: number, d = 0) => n.toFixed(d)

import * as React from "react"
import { trace } from "@/lab/colors"
import { T, V } from "../kit"

export const VOLT = trace.voltage
export const AMP = trace.current
export const POWER = trace.power
export const MUTED = "var(--muted-foreground)"
export const LINE = "var(--border)"
export const FG = "var(--foreground)"

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
    const s = ((((i + 0.5) * spacing + phase) % len) + len) % len
    if (skip?.some(([a, b]) => s > a && s < b)) continue
    out.push(<circle key={i} cx={x0 + ((x1 - x0) * s) / len} cy={y0 + ((y1 - y0) * s) / len} r={r} fill={color} stroke="none" opacity={o} />)
  }
  return <>{out}</>
}

/** Dots drifting around a closed rectangle (x0,y0)–(x1,y1), clockwise from the top-left corner. */
export function LoopFlow({ x0, y0, x1, y1, phase, spacing = 3.4, o = 1, color = AMP, r = 0.6, skip }: { x0: number; y0: number; x1: number; y1: number; phase: number; spacing?: number; o?: number; color?: string; r?: number; skip?: (x: number, y: number) => boolean }) {
  if (o <= 0.01) return null
  const w = x1 - x0
  const h = y1 - y0
  const per = 2 * (w + h)
  const n = Math.floor(per / spacing)
  const out: React.ReactNode[] = []
  for (let i = 0; i < n; i++) {
    const s = ((((i + 0.5) * spacing + phase) % per) + per) % per
    let x: number
    let y: number
    if (s < w) [x, y] = [x0 + s, y0]
    else if (s < w + h) [x, y] = [x1, y0 + s - w]
    else if (s < 2 * w + h) [x, y] = [x1 - (s - w - h), y1]
    else [x, y] = [x0, y1 - (s - 2 * w - h)]
    if (skip?.(x, y)) continue
    out.push(<circle key={i} cx={x} cy={y} r={r} fill={color} stroke="none" opacity={o} />)
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

/** A battery between (x, y-1.2) and (x, y+1.2), long (+) plate up, drawn across the wire (wire runs vertically). */
export function BatteryV({ x, y, o = 1 }: { x: number; y: number; o?: number }) {
  return (
    <g opacity={o}>
      <path d={`M${x - 3.4} ${y - 1.2} H${x + 3.4}`} />
      <path d={`M${x - 1.6} ${y + 1.2} H${x + 1.6}`} strokeWidth={0.75} />
      <path d={`M${x + 3.4} ${y - 2.7} h1.6 M${x + 4.2} ${y - 3.5} v1.6`} strokeWidth={0.22} stroke={VOLT} />
    </g>
  )
}

/** A label and its value, in the three-row readout style of the other films. */
export function Readout({ x = 62, right = 90, y, label, letter, color, o, value, size = 4.6 }: { x?: number; right?: number; y: number; label: string; letter?: string; color?: string; o: number; value: string; size?: number }) {
  return (
    <>
      <T x={x} y={y} size={2.5} anchor="start" color={MUTED} o={o}>
        {label} {letter && <V c={color}>{letter}</V>}
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

/** Resistor colour-code paint: the colours of the real part, so they are data, not theme. */
export const PAINT = {
  yellow: "#f5d10d", // design-allow: 色环是实物颜色
  violet: "#8e44ad", // design-allow: 色环是实物颜色
  red: "#d0281e", // design-allow: 色环是实物颜色
  gold: "#c9a227", // design-allow: 色环是实物颜色
  black: "#1c1c1c", // design-allow: 色环是实物颜色
  brown: "#7b4a1e", // design-allow: 色环是实物颜色
  orange: "#f07f13", // design-allow: 色环是实物颜色
  green: "#2e9e4b", // design-allow: 色环是实物颜色
  blue: "#2b63c9", // design-allow: 色环是实物颜色
  grey: "#8c8c8c", // design-allow: 色环是实物颜色
  white: "#f7f7f7", // design-allow: 色环是实物颜色
  body: "#e3cfa4", // design-allow: 碳膜电阻本体的实物颜色
} as const

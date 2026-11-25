import * as React from "react"
import { Svg, T, easeInOut, enter, type StageProps } from "../kit"

const MUTED = "var(--muted-foreground)"

/** A small outlined label that names the step a scene belongs to ("第一步 · 降压"). */
export function StepChip({ x = 50, y = 7, o = 1, children }: { x?: number; y?: number; o?: number; children: React.ReactNode }) {
  return (
    <T x={x} y={y} size={2.5} o={o} color={MUTED} className="rounded-full border border-input px-[0.9em] py-[0.45em]">
      {children}
    </T>
  )
}

/** The closing card: "动手试试", a hint and a bobbing arrow that points down at the lab. */
export function Outro({ t, b, still, hint }: Pick<StageProps, "t" | "b" | "still"> & { hint: string }) {
  const rise = (at: number, d = 1.6) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)
  return (
    <>
      <T x={50} y={24} size={6} weight={600} dy={rise(b.outro)} o={enter(t, b.outro - 0.1, 0.5)}>
        动手试试
      </T>
      <T x={50} y={32.5} size={2.8} color={MUTED} o={enter(t, b.drag)} dy={rise(b.drag, 1)}>
        {hint}
      </T>
      <Svg>
        <g opacity={enter(t, b.drag + 0.3)} transform={`translate(0 ${still ? 0 : Math.sin(t * 3.2) * 0.6})`} strokeWidth={0.45}>
          <path d="M50 38 V45 M47.6 42.6 L50 45 L52.4 42.6" />
        </g>
      </Svg>
    </>
  )
}

/** A diode drawn on a slanted wire: the triangle points along the way the current may go (`angle` in degrees, 0 = right). */
export function DiodeMark({ x, y, angle, color, o = 1, size = 1 }: { x: number; y: number; angle: number; color?: string; o?: number; size?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${size})`} opacity={o} stroke={color} strokeWidth={0.32 / size}>
      <path d="M-1.5 -1.5 V1.5 L1.5 0 Z" fill="var(--background)" />
      <path d="M1.5 -1.7 V1.7" />
    </g>
  )
}

/** A sine-like half-cycle path: a bump of height `h` (up when h > 0) between xa and xb on baseline y. */
export function lobe(xa: number, xb: number, y: number, h: number, n = 14) {
  const pts: string[] = []
  for (let i = 0; i <= n; i++) {
    const p = i / n
    pts.push(`${i ? "L" : "M"}${(xa + (xb - xa) * p).toFixed(2)} ${(y - h * Math.sin(Math.PI * p)).toFixed(2)}`)
  }
  return pts.join("")
}

/** `easeInOut` re-exported for films that animate a mode switch. */
export const ease = easeInOut

/** One straight piece of a current path. `hide` pieces are under a component: dots skip them. */
export type Seg = readonly [x0: number, y0: number, x1: number, y1: number, hide?: boolean]

/** Dots drifting along a path of segments; `phase` is how far they have travelled, in stage units. */
export function PolyDots({ segs, phase, spacing = 3.2, o = 1, color, r = 0.55 }: { segs: readonly Seg[]; phase: number; spacing?: number; o?: number; color: string; r?: number }) {
  if (o <= 0.01) return null
  const lens = segs.map(([x0, y0, x1, y1]) => Math.hypot(x1 - x0, y1 - y0))
  const total = lens.reduce((a, c) => a + c, 0)
  const out: React.ReactNode[] = []
  const n = Math.floor(total / spacing)
  for (let i = 0; i < n; i++) {
    let s = (((i * spacing + phase) % total) + total) % total
    let k = 0
    while (k < segs.length - 1 && s > lens[k]) s -= lens[k++]
    const [x0, y0, x1, y1, hide] = segs[k]
    if (hide) continue
    const p = lens[k] ? s / lens[k] : 0
    out.push(<circle key={i} cx={x0 + (x1 - x0) * p} cy={y0 + (y1 - y0) * p} r={r} fill={color} stroke="none" opacity={o} />)
  }
  return <>{out}</>
}

/** A zigzag resistor on the vertical wire x, from y0 to y1, with `n` teeth. */
export function vzig(x: number, y0: number, y1: number, n = 5, amp = 1.5) {
  const step = (y1 - y0) / n
  let d = `M${x} ${y0}`
  for (let i = 0; i < n; i++) d += ` L${x + (i % 2 ? -amp : amp)} ${y0 + step * (i + 0.5)}`
  return `${d} L${x} ${y1}`
}

/** A coil (inductor) on the horizontal wire y, from x0 to x1, as `n` humps. */
export function coil(x0: number, x1: number, y: number, n = 4) {
  const w = (x1 - x0) / n
  let d = `M${x0} ${y}`
  for (let i = 0; i < n; i++) d += ` a${w / 2} ${w / 2} 0 0 1 ${w} 0`
  return d
}

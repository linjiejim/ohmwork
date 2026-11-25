import * as React from "react"
import { Scene, Svg, T, enter, type StageProps } from "../kit"

/** Shared by the rf chapter's films. */

export const MUTED = "var(--muted-foreground)"
export const BORDER = "var(--border)"

/** How far (stage units) a layer still has to rise: 0 when `still`. */
export const riseOf = (t: number, still: boolean) => (at: number, d = 1.6) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)

/** A sine as a path: `lambda` stage units per cycle, `phase` in cycles. `amp` may be a function of x for envelopes. */
export function sinePath(x0: number, x1: number, y: number, amp: number | ((x: number) => number), lambda: number | ((x: number) => number), phase = 0, step = 0.5) {
  const pts: string[] = []
  let ph = 0
  for (let x = x0; x <= x1 + 1e-6; x += step) {
    const a = typeof amp === "number" ? amp : amp(x)
    const l = typeof lambda === "number" ? lambda : lambda(x)
    if (typeof lambda === "function" && x > x0) ph += step / l
    const arg = typeof lambda === "number" ? (x - x0) / l : ph
    pts.push(`${pts.length ? "L" : "M"}${x.toFixed(2)} ${(y - a * Math.sin(2 * Math.PI * (arg - phase))).toFixed(2)}`)
  }
  return pts.join("")
}

/** A cheap deterministic hash in [0, 1), for jitter that must not change between frames. */
export function hash(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

/** The closing "try it below" scene shared by the films. */
export function Outro({ t, b, still, title = "动手试试", hint }: StageProps & { title?: string; hint: string }) {
  const rise = riseOf(t, still)
  const o = enter(t, b.outro - 0.1, 0.5)
  return (
    <Scene o={o}>
      <T x={50} y={24} size={6} weight={600} dy={rise(b.outro)}>
        {title}
      </T>
      <T x={50} y={32.5} size={2.8} color={MUTED} o={enter(t, b.drag)} dy={rise(b.drag, 1)}>
        {hint}
      </T>
      <Svg>
        <g opacity={enter(t, b.drag + 0.3)} transform={`translate(0 ${still ? 0 : Math.sin(t * 3.2) * 0.6})`} strokeWidth={0.45}>
          <path d="M50 38 V45 M47.6 42.6 L50 45 L52.4 42.6" />
        </g>
      </Svg>
    </Scene>
  )
}

/** A small rounded tag, like the references' "口算窍门". */
export function Pill({ x, y, o, children }: { x: number; y: number; o: number; children: React.ReactNode }) {
  return (
    <T x={x} y={y} size={2.4} o={o} className="rounded-full border border-input px-[0.9em] py-[0.45em] text-muted-foreground">
      {children}
    </T>
  )
}

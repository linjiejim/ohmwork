import { trace } from "@/lab/colors"
import { Draw, Svg, T, enter, span } from "../kit"

/* Helpers shared by the sensors films. */

export const VOLT = trace.voltage
export const AMP = trace.current
export const HEAT = trace.power
export const GOOD = trace.good
export const MUTED = "var(--muted-foreground)"
export const LINE = "var(--border)"
export const FAINT = "var(--faint-foreground)"

/** Deterministic pseudo-random in 0–1. */
export const rnd = (i: number, k = 0) => {
  const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453
  return s - Math.floor(s)
}

/** A scene visible from 0.3 s before `from` to 0.15 s before `to`: neighbours overlap, the stage is never bare. */
export const sceneO = (t: number, from: number, to: number) => span(t, from - 0.3, to - 0.15, 0.3, 0.3)

/** Entrance offset in stage units (zero when motion is reduced). */
export const riseFn = (t: number, still: boolean) => (at: number, d = 1.6) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)

/** A rounded box on the drawing layer. */
export function Box({ x, y, w, h, o = 1, color = LINE, sw = 0.25, rx = 1.6 }: { x: number; y: number; w: number; h: number; o?: number; color?: string; sw?: number; rx?: number }) {
  if (o <= 0.001) return null
  return <rect x={x} y={y} width={w} height={h} rx={rx} stroke={color} strokeWidth={sw} opacity={o} />
}

/** A small arrow from (x0,y) to (x1,y) drawn as `p` goes 0 → 1. */
export function HArrow({ x0, x1, y, p, color }: { x0: number; x1: number; y: number; p: number; color?: string }) {
  const dir = x1 >= x0 ? 1 : -1
  return (
    <g stroke={color}>
      <Draw d={`M${x0} ${y} H${x1}`} p={p} />
      <Draw d={`M${x1 - dir * 1.1} ${y - 1} L${x1} ${y} L${x1 - dir * 1.1} ${y + 1}`} p={p} />
    </g>
  )
}

/** A polyline path through (x, f(x)) for x0 ≤ x ≤ x1. */
export function curve(f: (x: number) => number, x0: number, x1: number, n = 60) {
  let d = ""
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n
    d += `${i ? "L" : "M"}${x.toFixed(2)} ${f(x).toFixed(2)}`
  }
  return d
}

/** The closing scene: a title, a hint, and an arrow pointing at the lab under the film. */
export function Outro({ t, still, at, hintAt, title = "动手试试", hint }: { t: number; still: boolean; at: number; hintAt: number; title?: string; hint: string }) {
  const rise = riseFn(t, still)
  return (
    <>
      <T x={50} y={24} size={6} weight={600} o={enter(t, at, 0.45)} dy={rise(at)}>
        {title}
      </T>
      <T x={50} y={32.5} size={2.8} color={MUTED} o={enter(t, hintAt, 0.45)} dy={rise(hintAt, 1)}>
        {hint}
      </T>
      <Svg>
        <g opacity={enter(t, hintAt + 0.3)} transform={`translate(0 ${still ? 0 : Math.sin(t * 3.2) * 0.6})`} strokeWidth={0.45}>
          <path d="M50 38 V45 M47.6 42.6 L50 45 L52.4 42.6" />
        </g>
      </Svg>
    </>
  )
}

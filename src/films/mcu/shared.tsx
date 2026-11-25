import { Scene, Svg, T, easeInOut, enter, lerp, type StageProps } from "../kit"

/* Helpers the mcu films share: waveform paths, polyline walking, boxes, arrows and the closing "try it" scene. */

export const MUTED = "var(--muted-foreground)"
export const LINE = "var(--border)"
export const FG = "var(--foreground)"

/** A repeatable pseudo-random number in 0–1. */
export const rnd = (i: number, k = 0) => {
  const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453
  return s - Math.floor(s)
}

/** A digital waveform as a path. `pts` are [time, level] changes in order (level 0 or 1); the path holds the last level up to `end`. Drawn only up to time `upto`. */
export function stepPath(pts: readonly (readonly [number, number])[], end: number, x0: number, slot: number, yHi: number, yLo: number, upto = Infinity) {
  const y = (v: number) => (v ? yHi : yLo)
  let d = `M${x0 + pts[0][0] * slot} ${y(pts[0][1])}`
  let level = pts[0][1]
  for (let i = 1; i <= pts.length; i++) {
    const at = i < pts.length ? pts[i][0] : end
    if (at >= upto) {
      d += `H${x0 + upto * slot}`
      return d
    }
    d += `H${x0 + at * slot}`
    if (i < pts.length) {
      level = pts[i][1]
      d += `V${y(level)}`
    }
  }
  return d
}

/** Level of a stepPath signal at time `at`. */
export function levelAt(pts: readonly (readonly [number, number])[], at: number) {
  let v = pts[0][1]
  for (const [ti, vi] of pts) if (ti <= at) v = vi
  return v
}

/** A point `p` (0–1) of the way along a polyline, by length. */
export function along(poly: readonly (readonly [number, number])[], p: number): [number, number] {
  const lens = poly.slice(1).map(([x, y], i) => Math.hypot(x - poly[i][0], y - poly[i][1]))
  const total = lens.reduce((a, b) => a + b, 0)
  let d = Math.min(1, Math.max(0, p)) * total
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) {
      const k = lens[i] ? Math.min(1, d / lens[i]) : 0
      return [lerp(poly[i][0], poly[i + 1][0], k), lerp(poly[i][1], poly[i + 1][1], k)]
    }
    d -= lens[i]
  }
  return [poly[0][0], poly[0][1]]
}

export const polyD = (poly: readonly (readonly [number, number])[]) => poly.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join("")

/** An arrow head at (x, y) pointing right (dir 1), left (-1), down (2) or up (-2). */
export function head(x: number, y: number, dir: 1 | -1 | 2 | -2 = 1, s = 1) {
  if (dir === 1) return `M${x - 1.1 * s} ${y - 0.9 * s}L${x} ${y}L${x - 1.1 * s} ${y + 0.9 * s}`
  if (dir === -1) return `M${x + 1.1 * s} ${y - 0.9 * s}L${x} ${y}L${x + 1.1 * s} ${y + 0.9 * s}`
  if (dir === 2) return `M${x - 0.9 * s} ${y - 1.1 * s}L${x} ${y}L${x + 0.9 * s} ${y - 1.1 * s}`
  return `M${x - 0.9 * s} ${y + 1.1 * s}L${x} ${y}L${x + 0.9 * s} ${y + 1.1 * s}`
}

/** A rounded box on the drawing layer. */
export function Box({ x, y, w, h, o = 1, color, fill, rx = 1, strokeWidth }: { x: number; y: number; w: number; h: number; o?: number; color?: string; fill?: string; rx?: number; strokeWidth?: number }) {
  if (o <= 0.001) return null
  return <rect x={x} y={y} width={w} height={h} rx={rx} stroke={color} fill={fill ?? "var(--background)"} strokeWidth={strokeWidth} opacity={o} />
}

/** A horizontal zigzag resistor from x0 to x1 at y. */
export function zig(x0: number, x1: number, y: number, amp = 1.2, teeth = 6) {
  const lead = 1.6
  const a = x0 + lead
  const b = x1 - lead
  const step = (b - a) / teeth
  let d = `M${x0} ${y}H${a}`
  for (let i = 0; i < teeth; i++) d += `L${a + step * (i + 0.5)} ${y + (i % 2 ? amp : -amp)}`
  return d + `L${b} ${y}H${x1}`
}

/** The last scene of every film: points at the lesson's first interactive widget. */
export function Outro({ t, b, still, title = "动手试试", hint, tryAt }: StageProps & { title?: string; hint: string; tryAt: number }) {
  const o = enter(t, b.outro - 0.1, 0.5)
  const rise = (at: number, d = 1) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)
  return (
    <Scene o={o}>
      <T x={50} y={22} size={6} weight={600} dy={rise(b.outro, 1.6)}>
        {title}
      </T>
      <T x={50} y={31} size={2.8} color={MUTED} o={enter(t, tryAt)} dy={rise(tryAt)}>
        {hint}
      </T>
      <Svg>
        <g opacity={enter(t, tryAt + 0.3)} transform={`translate(0 ${still ? 0 : Math.sin(t * 3.2) * 0.6})`} strokeWidth={0.45}>
          <path d="M50 37 V44 M47.6 41.6 L50 44 L52.4 41.6" />
        </g>
      </Svg>
    </Scene>
  )
}

export { easeInOut }

/** A vertical switch from y0 to y1 at x; `closed` 0–1 swings the lever. */
export function Sw({ x, y0, y1, closed }: { x: number; y0: number; y1: number; closed: number }) {
  const m = (y0 + y1) / 2
  return (
    <g>
      <path d={`M${x} ${y0}V${y0 + 3}M${x} ${y1 - 3}V${y1}`} />
      <circle cx={x} cy={y0 + 3} r={0.45} fill="var(--foreground)" />
      <circle cx={x} cy={y1 - 3} r={0.45} fill="var(--foreground)" />
      <path d={`M${x} ${y0 + 3}L${lerp(x + 3.4, x, closed)} ${lerp(m + 1.5, y1 - 3, closed)}`} />
    </g>
  )
}

/** A vertical zigzag resistor from y0 to y1 at x. */
export function vzig(x: number, y0: number, y1: number, amp = 1.2, teeth = 6) {
  const a = y0 + 1.6
  const e = y1 - 1.6
  const step = (e - a) / teeth
  let d = `M${x} ${y0}V${a}`
  for (let i = 0; i < teeth; i++) d += `L${x + (i % 2 ? amp : -amp)} ${a + step * (i + 0.5)}`
  return d + `L${x} ${e}V${y1}`
}

/** A ground symbol hanging from (x, y). */
export const gnd = (x: number, y: number) => `M${x - 3} ${y}H${x + 3}M${x - 1.8} ${y + 1.6}H${x + 1.8}M${x - 0.8} ${y + 3.2}H${x + 0.8}`

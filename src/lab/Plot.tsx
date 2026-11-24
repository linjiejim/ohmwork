import * as React from "react"
import { cn } from "@/lib/utils"
import { SERIES_COLORS } from "./colors"
import { sig } from "./format"
import { useWidth } from "./hooks"

export interface Axis {
  min: number
  max: number
  /** Quantity and unit: "时间 (ms)". */
  label?: string
  /** Logarithmic axis (min > 0). */
  log?: boolean
  /** Explicit tick positions; chosen automatically otherwise. */
  ticks?: number[]
  /** Tick and hover text. Defaults to a compact engineering form (1k, 2.2M, 0.5). */
  format?: (v: number) => string
}

export interface Series {
  /** y = fn(x), sampled across the x axis. */
  fn?: (x: number) => number
  /** Or explicit [x, y] pairs, x ascending. NaN breaks the line. */
  points?: readonly (readonly [number, number])[]
  /** Name in the legend. Always give one when a plot has several series. */
  label?: string
  color?: string
  dashed?: boolean
  width?: number
  /** Draw as a staircase (digital signals, sampled values). */
  step?: boolean
  /** Tint the area between the line and y = 0. */
  area?: boolean
}

export interface Marker {
  x: number
  y: number
  label?: string
  color?: string
}

export interface RefLine {
  /** A vertical line at this x … */
  x?: number
  /** … or a horizontal line at this y. */
  y?: number
  label?: string
  color?: string
}

/** Compact number for ticks: 1k, 2.2M, 0.5, 4.7m. */
export function tickLabel(v: number): string {
  const a = Math.abs(v)
  if (a === 0) return "0"
  if (a >= 1e9) return `${sig(v / 1e9)}G`
  if (a >= 1e6) return `${sig(v / 1e6)}M`
  if (a >= 1e3) return `${sig(v / 1e3)}k`
  if (a >= 0.01) return sig(v)
  if (a >= 1e-6 * 0.9995) return a >= 1e-3 * 0.9995 ? `${sig(v * 1e3)}m` : `${sig(v * 1e6)}μ`
  if (a >= 1e-9 * 0.9995) return `${sig(v * 1e9)}n`
  return `${sig(v * 1e12)}p`
}

function linearTicks(min: number, max: number, target: number): number[] {
  const span = max - min
  if (!(span > 0)) return [min]
  const raw = span / target
  const mag = 10 ** Math.floor(Math.log10(raw))
  const n = raw / mag
  const step = (n > 5 ? 10 : n > 2 ? 5 : n > 1 ? 2 : 1) * mag
  const out: number[] = []
  for (let i = Math.ceil(min / step - 1e-9); i * step <= max + step * 1e-9; i++) out.push(Number((i * step).toPrecision(12)))
  return out
}

function logTicks(min: number, max: number): number[] {
  const out: number[] = []
  for (let e = Math.ceil(Math.log10(min) - 1e-9); e <= Math.floor(Math.log10(max) + 1e-9); e++) out.push(10 ** e)
  return out.length > 7 ? out.filter((_, i) => i % 2 === 0) : out
}

const norm = (axis: Axis, v: number) => (axis.log ? Math.log(v / axis.min) / Math.log(axis.max / axis.min) : (v - axis.min) / (axis.max - axis.min))
const denorm = (axis: Axis, n: number) => (axis.log ? axis.min * (axis.max / axis.min) ** n : axis.min + (axis.max - axis.min) * n)

function valueAt(s: Series, x: number): number {
  if (s.fn) return s.fn(x)
  const p = s.points
  if (!p || p.length === 0) return Number.NaN
  if (x <= p[0][0]) return p[0][1]
  if (x >= p[p.length - 1][0]) return p[p.length - 1][1]
  let lo = 0
  let hi = p.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (p[mid][0] <= x) lo = mid
    else hi = mid
  }
  if (s.step) return p[lo][1]
  const t = (x - p[lo][0]) / (p[hi][0] - p[lo][0] || 1)
  return p[lo][1] + (p[hi][1] - p[lo][1]) * t
}

/**
 * A line chart for curves and waveforms: fills its container's width, draws
 * hairline axes, and shows every series' value under the pointer.
 * Each series needs a `label` (colour is never the only way to tell them apart).
 */
export function Plot({
  x,
  y,
  series,
  markers = [],
  lines = [],
  height = 220,
  samples = 240,
  hover = true,
  className,
  ariaLabel,
}: {
  x: Axis
  y: Axis
  series: Series[]
  /** Dots with an optional label: an operating point, a −3 dB point. */
  markers?: Marker[]
  /** Dashed reference lines across the plot. */
  lines?: RefLine[]
  height?: number
  /** Points sampled for `fn` series. */
  samples?: number
  /** Show values under the pointer. */
  hover?: boolean
  className?: string
  ariaLabel?: string
}) {
  const [ref, width] = useWidth<HTMLDivElement>(640)
  const clipId = React.useId()
  const [hoverN, setHoverN] = React.useState<number | null>(null)

  const m = { l: 44, r: 14, t: y.label ? 26 : 10, b: x.label ? 42 : 24 }
  const pw = Math.max(40, width - m.l - m.r)
  const ph = Math.max(40, height - m.t - m.b)
  const sx = (v: number) => m.l + norm(x, v) * pw
  const sy = (v: number) => m.t + (1 - norm(y, v)) * ph
  const fx = x.format ?? tickLabel
  const fy = y.format ?? tickLabel

  const xTicks = (x.ticks ?? (x.log ? logTicks(x.min, x.max) : linearTicks(x.min, x.max, width < 420 ? 4 : 6))).filter((v) => v >= x.min && v <= x.max)
  const yTicks = (y.ticks ?? (y.log ? logTicks(y.min, y.max) : linearTicks(y.min, y.max, height < 180 ? 3 : 5))).filter((v) => v >= y.min && v <= y.max)

  const paths = series.map((s, i) => {
    const color = s.color ?? SERIES_COLORS[i % SERIES_COLORS.length]
    const pts: [number, number][] = s.fn
      ? Array.from({ length: samples }, (_, k) => {
          const xv = denorm(x, k / (samples - 1))
          return [xv, s.fn!(xv)] as [number, number]
        })
      : ((s.points as [number, number][] | undefined) ?? [])
    let d = ""
    let pen = false
    let prevY = 0
    for (const [xv, yv] of pts) {
      if (!Number.isFinite(yv) || !Number.isFinite(xv) || (x.log && xv <= 0)) {
        pen = false
        continue
      }
      const px = sx(xv)
      // keep wild values near the frame so the path stays numerically sane; the clip hides them
      const py = m.t + (1 - Math.min(1.5, Math.max(-0.5, y.log && yv <= 0 ? -0.5 : norm(y, yv)))) * ph
      if (!pen) d += `M${px.toFixed(1)} ${py.toFixed(1)}`
      else if (s.step) d += `H${px.toFixed(1)}V${py.toFixed(1)}`
      else d += `L${px.toFixed(1)} ${py.toFixed(1)}`
      pen = true
      prevY = py
    }
    void prevY
    let area = ""
    if (s.area && pts.length > 1 && d) {
      const base = sy(Math.min(y.max, Math.max(y.min, 0)))
      area = `${d}L${sx(pts[pts.length - 1][0]).toFixed(1)} ${base.toFixed(1)}L${sx(pts[0][0]).toFixed(1)} ${base.toFixed(1)}Z`
    }
    return { d, area, color, s }
  })

  const hx = hoverN == null ? null : denorm(x, hoverN)
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!hover) return
    const rect = e.currentTarget.getBoundingClientRect()
    const n = (e.clientX - rect.left - m.l) / pw
    setHoverN(n >= 0 && n <= 1 ? n : null)
  }

  const named = paths.filter((p) => p.s.label)

  // Place labels so they never sit on each other: markers first (they matter most), then each
  // reference-line label takes the first candidate spot that is free and inside the plot.
  type Box = { l: number; r: number; t: number; b: number }
  const textW = (t: string) => [...t].reduce((w, ch) => w + (ch.codePointAt(0)! > 0x2e80 ? 12 : 6.8), 0)
  const boxOf = (x: number, y: number, anchor: "start" | "end", text: string): Box => {
    const w = textW(text)
    return { l: anchor === "start" ? x : x - w, r: anchor === "start" ? x + w : x, t: y - 11, b: y + 3 }
  }
  const hits = (a: Box, b: Box) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b
  const inside = (a: Box) => a.l >= m.l - 1 && a.r <= m.l + pw + 1 && a.t >= m.t - 1 && a.b <= m.t + ph + 1
  const taken: Box[] = []
  const markerLabels = markers.map((mk) => {
    const px = sx(mk.x)
    const py = sy(mk.y)
    const left = px > m.l + pw - 100
    const pos = { x: px + (left ? -9 : 9), y: py + (py < m.t + 22 ? 16 : -8), anchor: (left ? "end" : "start") as "start" | "end" }
    if (mk.label) taken.push(boxOf(pos.x, pos.y, pos.anchor, mk.label))
    return pos
  })
  const lineLabels = lines.map((l) => {
    if (!l.label) return null
    const cands: { x: number; y: number; anchor: "start" | "end" }[] = []
    if (l.x != null) {
      const px = sx(l.x)
      for (const y of [m.t + 14, m.t + ph - 6, m.t + ph / 2]) cands.push({ x: px + 6, y, anchor: "start" }, { x: px - 6, y, anchor: "end" })
    } else if (l.y != null) {
      const py = sy(l.y)
      for (const y of [py - 5, py + 14]) cands.push({ x: m.l + pw - 6, y, anchor: "end" }, { x: m.l + 6, y, anchor: "start" })
    }
    const ok = cands.find((c) => {
      const b = boxOf(c.x, c.y, c.anchor, l.label!)
      return inside(b) && !taken.some((t) => hits(t, b))
    }) ?? cands.find((c) => inside(boxOf(c.x, c.y, c.anchor, l.label!))) ?? cands[0]
    if (ok) taken.push(boxOf(ok.x, ok.y, ok.anchor, l.label))
    return ok ?? null
  })

  return (
    <div ref={ref} className={cn("w-full min-w-0", className)}>
      {(named.length > 0 || hx != null) && (
        <div className="mb-1 flex min-h-5 flex-wrap items-center gap-x-4 gap-y-1 text-caption text-muted-foreground">
          {named.map((p, i) => (
            <span key={i} className="inline-flex items-center gap-1.5">
              <svg aria-hidden width="16" height="8" className="shrink-0">
                <line x1="1" y1="4" x2="15" y2="4" stroke={p.color} strokeWidth="2" strokeDasharray={p.s.dashed ? "4 3" : undefined} strokeLinecap="round" />
              </svg>
              {p.s.label}
              {hx != null && <span className="tabular text-foreground">{fy(valueAt(p.s, hx))}</span>}
            </span>
          ))}
          {hx != null && (
            <span className="tabular ml-auto">
              {x.label ? `${x.label.replace(/\s*[（(].*$/, "")} ` : "x "}
              {fx(hx)}
            </span>
          )}
        </div>
      )}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel ?? [y.label, x.label].filter(Boolean).join(" / ")}
        className="block max-w-full touch-pan-y select-none"
        onPointerMove={onMove}
        onPointerLeave={() => setHoverN(null)}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={m.l} y={m.t} width={pw} height={ph} />
          </clipPath>
        </defs>
        {/* grid */}
        <g stroke="var(--border)" strokeWidth="1">
          {xTicks.map((v) => (
            <line key={`x${v}`} x1={sx(v)} x2={sx(v)} y1={m.t} y2={m.t + ph} />
          ))}
          {yTicks.map((v) => (
            <line key={`y${v}`} x1={m.l} x2={m.l + pw} y1={sy(v)} y2={sy(v)} />
          ))}
        </g>
        {/* zero line reads stronger than the grid */}
        {!y.log && y.min < 0 && y.max > 0 && <line x1={m.l} x2={m.l + pw} y1={sy(0)} y2={sy(0)} stroke="var(--input)" strokeWidth="1" />}
        <rect x={m.l} y={m.t} width={pw} height={ph} fill="none" stroke="var(--input)" strokeWidth="1" />
        {/* tick labels */}
        <g className="tabular fill-faint-foreground text-caption">
          {xTicks.map((v) => (
            <text key={`xt${v}`} x={sx(v)} y={m.t + ph + 16} textAnchor="middle">
              {fx(v)}
            </text>
          ))}
          {yTicks.map((v) => (
            <text key={`yt${v}`} x={m.l - 6} y={sy(v) + 4} textAnchor="end">
              {fy(v)}
            </text>
          ))}
          {x.label && (
            <text x={m.l + pw / 2} y={height - 6} textAnchor="middle">
              {x.label}
            </text>
          )}
          {y.label && (
            <text x={4} y={14} textAnchor="start">
              {y.label}
            </text>
          )}
        </g>
        <g clipPath={`url(#${clipId})`}>
          {lines.map((l, i) => {
            const color = l.color ?? "var(--faint-foreground)"
            if (l.x != null) {
              const px = sx(l.x)
              return (
                <g key={`l${i}`}>
                  <line x1={px} x2={px} y1={m.t} y2={m.t + ph} stroke={color} strokeWidth="1.25" strokeDasharray="4 4" />
                  {l.label && lineLabels[i] && (
                    <text x={lineLabels[i]!.x} y={lineLabels[i]!.y} textAnchor={lineLabels[i]!.anchor} className="text-caption" fill={color}>
                      {l.label}
                    </text>
                  )}
                </g>
              )
            }
            if (l.y != null) {
              const py = sy(l.y)
              return (
                <g key={`l${i}`}>
                  <line x1={m.l} x2={m.l + pw} y1={py} y2={py} stroke={color} strokeWidth="1.25" strokeDasharray="4 4" />
                  {l.label && lineLabels[i] && (
                    <text x={lineLabels[i]!.x} y={lineLabels[i]!.y} textAnchor={lineLabels[i]!.anchor} className="text-caption" fill={color}>
                      {l.label}
                    </text>
                  )}
                </g>
              )
            }
            return null
          })}
          {paths.map((p, i) => (
            <g key={i}>
              {p.area && <path d={p.area} fill={p.color} opacity="0.12" />}
              <path d={p.d} fill="none" stroke={p.color} strokeWidth={p.s.width ?? 2} strokeDasharray={p.s.dashed ? "5 4" : undefined} strokeLinejoin="round" strokeLinecap="round" />
            </g>
          ))}
          {hx != null && <line x1={sx(hx)} x2={sx(hx)} y1={m.t} y2={m.t + ph} stroke="var(--faint-foreground)" strokeWidth="1" />}
          {hx != null &&
            paths.map((p, i) => {
              const v = valueAt(p.s, hx)
              if (!Number.isFinite(v)) return null
              return <circle key={`h${i}`} cx={sx(hx)} cy={sy(v)} r="3.5" fill={p.color} stroke="var(--background)" strokeWidth="1.5" />
            })}
        </g>
        {markers.map((mk, i) => {
          const px = sx(mk.x)
          const py = sy(mk.y)
          if (px < m.l - 1 || px > m.l + pw + 1 || py < m.t - 1 || py > m.t + ph + 1) return null
          const color = mk.color ?? "var(--foreground)"
          const pos = markerLabels[i]
          return (
            <g key={`m${i}`}>
              <circle cx={px} cy={py} r="4.5" fill={color} stroke="var(--background)" strokeWidth="2" />
              {mk.label && (
                <text x={pos.x} y={pos.y} textAnchor={pos.anchor} className="tabular fill-foreground text-caption font-medium">
                  {mk.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

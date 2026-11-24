import * as React from "react"
import { cn } from "@/lib/utils"
import { trace } from "./colors"
import { useWidth } from "./hooks"

/** Level in one time slot: 0 low, 1 high, "z" released / floating, "x" unknown. */
export type Level = 0 | 1 | "z" | "x"

export interface TimingSignal {
  /** Name at the left: "SCL", "TX", "Q". */
  label: string
  /** One level per time slot, all signals the same length. */
  values: readonly Level[]
  color?: string
}

export interface TimingSpan {
  /** Slots [from, to) this label covers. */
  from: number
  to: number
  /** Keep it short: "起始", "D0", "ACK". */
  label: string
  /** Tint the span across all rows. */
  highlight?: boolean
}

export interface TimingMark {
  /** Position in slots; may be fractional (2.5 = middle of slot 2). */
  at: number
  label?: string
  color?: string
}

const ROW = 40
const HEAD = 24
const LABEL_W = 52
const PAD_R = 10

/**
 * A digital timing diagram: stacked square-wave rows that share a time axis
 * cut into equal slots, with named spans above (start bit, address, ACK …),
 * sampling marks, and an optional cursor that an animation can move.
 * Scrolls sideways when there are more slots than fit.
 */
export function Timing({
  signals,
  spans = [],
  marks = [],
  cursor,
  minSlot = 14,
  className,
  ariaLabel,
}: {
  signals: TimingSignal[]
  spans?: TimingSpan[]
  /** Dashed vertical lines: where the receiver samples, a clock edge. */
  marks?: TimingMark[]
  /** Slot position of "now" (fractional allowed); slots before it are drawn solid, after it faded. */
  cursor?: number
  /** Narrowest a slot may get before the diagram scrolls. */
  minSlot?: number
  className?: string
  ariaLabel?: string
}) {
  const [ref, width] = useWidth<HTMLDivElement>(640)
  const n = Math.max(1, ...signals.map((s) => s.values.length))
  const slot = Math.max(minSlot, (width - LABEL_W - PAD_R) / n)
  const w = Math.ceil(LABEL_W + n * slot + PAD_R)
  const head = spans.length ? HEAD : 6
  // mark labels get their own band under the rows, so they never sit on a trace
  const foot = marks.some((mk) => mk.label) ? 20 : 6
  const rowsBottom = head + signals.length * ROW
  const h = rowsBottom + foot
  const x = (i: number) => LABEL_W + i * slot
  const clipId = React.useId()

  return (
    <div ref={ref} className={cn("w-full min-w-0 overflow-x-auto", className)}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={ariaLabel ?? `时序图：${signals.map((s) => s.label).join("、")}`} className="block select-none">
        {cursor != null && (
          <defs>
            <clipPath id={clipId}>
              <rect x={0} y={0} width={x(Math.max(0, Math.min(n, cursor)))} height={h} />
            </clipPath>
          </defs>
        )}
        {/* spans: tint + boundaries + label */}
        {spans.map((sp, i) => (
          <g key={`s${i}`}>
            {sp.highlight && <rect x={x(sp.from)} y={head} width={x(sp.to) - x(sp.from)} height={signals.length * ROW} fill="var(--selected)" />}
            <line x1={x(sp.from)} x2={x(sp.from)} y1={4} y2={rowsBottom} stroke="var(--border)" />
            <line x1={x(sp.to)} x2={x(sp.to)} y1={4} y2={rowsBottom} stroke="var(--border)" />
            <text x={(x(sp.from) + x(sp.to)) / 2} y={16} textAnchor="middle" className="fill-muted-foreground text-caption">
              {sp.label}
            </text>
          </g>
        ))}
        {signals.map((sig, row) => {
          const top = head + row * ROW
          const yHi = top + 9
          const yLo = top + ROW - 9
          const yMid = (yHi + yLo) / 2
          const color = sig.color ?? trace.voltage
          let d = ""
          const floats: React.ReactNode[] = []
          let prev: number | null = null
          sig.values.forEach((v, i) => {
            if (v === 0 || v === 1) {
              const y = v ? yHi : yLo
              d += prev == null ? `M${x(i)} ${y}` : prev === y ? "" : `V${y}`
              d += `H${x(i + 1)}`
              prev = y
            } else {
              prev = null
              floats.push(
                v === "z" ? (
                  <line key={i} x1={x(i)} x2={x(i + 1)} y1={yMid} y2={yMid} stroke={color} strokeWidth="1.5" strokeDasharray="3 3" />
                ) : (
                  <path key={i} d={`M${x(i)} ${yHi}H${x(i + 1)}M${x(i)} ${yLo}H${x(i + 1)}`} stroke={color} strokeWidth="1.5" opacity="0.6" fill="none" />
                ),
              )
            }
          })
          return (
            <g key={sig.label + row}>
              <text x={LABEL_W - 8} y={yMid + 4} textAnchor="end" className="tabular fill-foreground text-caption font-medium">
                {sig.label}
              </text>
              <line x1={LABEL_W} x2={w - PAD_R} y1={yLo} y2={yLo} stroke="var(--border)" />
              {/* the whole trace faded, the part before the cursor solid */}
              <g opacity={cursor != null ? 0.28 : 1}>
                <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
                {floats}
              </g>
              {cursor != null && (
                <g clipPath={`url(#${clipId})`}>
                  <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
                  {floats}
                </g>
              )}
            </g>
          )
        })}
        {marks.map((mk, i) => (
          <g key={`m${i}`}>
            <line x1={x(mk.at)} x2={x(mk.at)} y1={head} y2={rowsBottom} stroke={mk.color ?? "var(--faint-foreground)"} strokeWidth="1.25" strokeDasharray="3 3" />
            {mk.label && (
              <text x={x(mk.at)} y={rowsBottom + 14} textAnchor="middle" className="text-caption" fill={mk.color ?? "var(--faint-foreground)"}>
                {mk.label}
              </text>
            )}
          </g>
        ))}
        {cursor != null && cursor >= 0 && cursor <= n && <line x1={x(cursor)} x2={x(cursor)} y1={head - 2} y2={rowsBottom + 2} stroke="var(--foreground)" strokeWidth="1.5" />}
      </svg>
    </div>
  )
}

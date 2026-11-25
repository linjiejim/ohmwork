import * as React from "react"
import { trace } from "@/lab/colors"
import { T, enter } from "../kit"

export const VOLT = trace.voltage
export const AMP = trace.current
export const POWER = trace.power
export const GOOD = trace.good
export const SECOND = trace.second
export const MUTED = "var(--muted-foreground)"
export const LINE = "var(--border)"
export const FG = "var(--foreground)"

/** Entrance offset: slides up `d` units unless reduced motion. */
export const riseAt = (t: number, at: number, still: boolean, d = 1.6, dur = 0.5) => (still ? 0 : (1 - enter(t, at, dur)) * d)

/** A rounded highlight box around part of a drawing. */
export function Hl({ x, y, w, h, o, color = AMP, dash }: { x: number; y: number; w: number; h: number; o: number; color?: string; dash?: boolean }) {
  if (o <= 0.01) return null
  return <rect x={x} y={y} width={w} height={h} rx={1.2} stroke={color} strokeWidth={0.34} strokeDasharray={dash ? "1.2 0.9" : undefined} opacity={o} fill="none" />
}

/** A small tag-style caption, like a pill. */
export function Pill({ x, y, o, children, color }: { x: number; y: number; o: number; children: React.ReactNode; color?: string }) {
  return (
    <T x={x} y={y} size={2.4} o={o} color={color ?? MUTED} className="rounded-full border border-input px-[0.9em] py-[0.45em]">
      {children}
    </T>
  )
}

/** A cross, for "not connected". */
export function Cross({ x, y, r = 1.4, p, color = POWER }: { x: number; y: number; r?: number; p: number; color?: string }) {
  if (p <= 0.01) return null
  return <path d={`M${x - r} ${y - r} L${x + r} ${y + r} M${x + r} ${y - r} L${x - r} ${y + r}`} stroke={color} strokeWidth={0.45} opacity={p} />
}

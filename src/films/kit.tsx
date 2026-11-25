import * as React from "react"
import { cn } from "@/lib/utils"

/*
 * Lesson films: a short narrated animation at the top of a lesson.
 *
 * Everything on the stage is a pure function of the audio clock `t`: no state,
 * no timers. Pausing, scrubbing and replaying always show the right frame, and
 * the picture can never drift from the voice. Times come from timing.json,
 * which scripts/films/build.py writes from film.json: `b.lineId` is when a
 * narration line starts, `b.beatName` when a named word in it is spoken.
 *
 * The stage is 100 units wide and 56.25 high (16:9). Units are `cqw`: one
 * percent of the stage width, so text and drawings scale together.
 */

export interface Timing {
  duration: number
  lines: { id: string; text: string; start: number; end: number }[]
  beats: Record<string, number>
  captions: { start: number; end: number; text: string }[]
}

export interface StageProps {
  /** Seconds since the film started. */
  t: number
  /** Beat times by name, from timing.json. */
  b: Record<string, number>
  /** Reduced motion: keep fades, drop movement. */
  still: boolean
}

export interface FilmDef {
  /** Accessible name: "欧姆定律". */
  title: string
  audio: string
  timing: Timing
  /** The moment shown before the film is played. */
  poster: number
  Stage: React.ComponentType<StageProps>
}

export const W = 100
export const H = 56.25

// ── time ─────────────────────────────────────────────────────────────────────

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p
export const easeOut = (x: number) => 1 - (1 - clamp01(x)) ** 3
export const easeInOut = (x: number) => {
  const p = clamp01(x)
  return p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2
}
/** 0 → 1 over `dur` seconds from `at`. */
export const enter = (t: number, at: number, dur = 0.45) => easeOut((t - at) / dur)
/** 1 → 0 over `dur` seconds from `at`. */
export const leave = (t: number, at: number, dur = 0.4) => 1 - easeInOut((t - at) / dur)
/** Shown from `a` to `b`, fading at both ends. */
export const span = (t: number, a: number, b: number, fadeIn = 0.4, fadeOut = 0.4) => Math.min(enter(t, a, fadeIn), leave(t, b, fadeOut))
/** A value that moves from `from` to `to` starting at `at`. */
export const glide = (t: number, at: number, from: number, to: number, dur = 0.5) => lerp(from, to, easeInOut((t - at) / dur))

// ── stage pieces ─────────────────────────────────────────────────────────────

/** A layer of the stage. Not rendered at all while invisible. `dy` shifts the whole layer, in stage units. */
export function Scene({ o, dy = 0, children }: { o: number; dy?: number; children: React.ReactNode }) {
  if (o <= 0.001) return null
  return (
    <div className="absolute inset-0" style={{ opacity: o, transform: dy ? `translateY(${dy}cqw)` : undefined }}>
      {children}
    </div>
  )
}

/** A variable in a formula, in KaTeX's math italic. */
export function V({ c, children }: { c?: string; children: React.ReactNode }) {
  return <span style={{ ...FONT.var, color: c }}>{children}</span>
}

/** Numbers, units and operators in a formula, in KaTeX's upright face. */
export function M({ c, children, className }: { c?: string; children: React.ReactNode; className?: string }) {
  return (
    <span className={className} style={{ ...FONT.math, fontStyle: "normal", color: c }}>
      {children}
    </span>
  )
}

/** A word under (or beside) a piece of a formula. Sized relative to the formula. */
export function Sub({ children, side = "below" }: { children: React.ReactNode; side?: "below" | "right" }) {
  return (
    <span
      data-film-text=""
      className="absolute whitespace-nowrap text-muted-foreground"
      style={{
        fontFamily: "var(--font-sans, inherit)",
        fontStyle: "normal",
        fontSize: "0.34em",
        ...(side === "below" ? { top: "100%", marginTop: "0.5em", left: "50%", transform: "translateX(-50%)" } : { left: "100%", marginLeft: "0.7em", top: "50%", transform: "translateY(-50%)" }),
      }}
    >
      {children}
    </span>
  )
}

type Font = "text" | "var" | "math"
const FONT: Record<Font, React.CSSProperties> = {
  text: {},
  // the same faces KaTeX uses in the lesson text, so a film's "I = V/R" matches the paragraph below it
  var: { fontFamily: "KaTeX_Math, serif", fontStyle: "italic" },
  math: { fontFamily: "KaTeX_Main, serif" },
}

/** Text placed on the stage. x, y and size are in stage units; y is the vertical centre. */
export function T({
  x,
  y,
  size = 3,
  anchor = "middle",
  color,
  weight,
  font = "text",
  o = 1,
  dy = 0,
  scale = 1,
  className,
  children,
}: {
  x: number
  y: number
  size?: number
  anchor?: "start" | "middle" | "end"
  color?: string
  weight?: 400 | 500 | 600
  font?: Font
  o?: number
  /** Extra vertical offset, for entrances. */
  dy?: number
  scale?: number
  className?: string
  children: React.ReactNode
}) {
  if (o <= 0.001) return null
  const ax = anchor === "middle" ? -50 : anchor === "end" ? -100 : 0
  return (
    <div
      data-film-text=""
      className={cn("absolute whitespace-nowrap leading-none", className)}
      style={{
        left: `${x}cqw`,
        top: `${y}cqw`,
        // the stage is a picture: it scales as a whole, like a video, so its layout is the same at every width.
        // The captions and controls under it are real text at full size.
        fontSize: `${size}cqw`,
        color,
        fontWeight: weight,
        opacity: o,
        transform: `translate(${ax}%, -50%) translateY(${dy}cqw) scale(${scale})`,
        transformOrigin: anchor === "middle" ? "center" : anchor === "end" ? "right center" : "left center",
        ...FONT[font],
      }}
    >
      {children}
    </div>
  )
}

/** A stacked fraction for inline use inside <T>. */
export function Frac({ top, bottom, bar = 1, gap = 0.18 }: { top: React.ReactNode; bottom: React.ReactNode; /** How much of the bar is drawn, 0–1. */ bar?: number; gap?: number }) {
  return (
    <span className="inline-flex flex-col items-center align-middle" style={{ gap: `${gap}em` }}>
      <span>{top}</span>
      <span className="h-[0.06em] w-full min-w-[1.2em] origin-left rounded-full bg-current" style={{ transform: `scaleX(${bar})` }} />
      <span>{bottom}</span>
    </span>
  )
}

/** The drawing layer, in the same units as <T>. */
export function Svg({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn("absolute inset-0 size-full overflow-visible", className)} fill="none" stroke="currentColor" strokeWidth={0.32} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  )
}

/** A path that draws itself as `p` goes 0 → 1. */
export function Draw({ d, p, ...rest }: { d: string; p: number } & React.SVGProps<SVGPathElement>) {
  if (p <= 0.001) return null
  return <path d={d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - clamp01(p)} {...rest} />
}

/**
 * A schematic symbol from the lesson kit (src/lab/schematic.tsx: Resistor, Battery, Led, Capacitor…)
 * placed on the stage at (x, y), drawn `scale` times its 60-unit size in stage units (0.2 → 12 units
 * long). Keeps the stage's line weight. Give the part no `label` / `value`: put text on the stage with <T>.
 *
 *   <Svg><Sym x={30} y={28} scale={0.25}><Resistor x={0} y={0} rot={90} /></Sym></Svg>
 */
export function Sym({ x, y, scale, opacity, color, children }: { x: number; y: number; scale: number; opacity?: number; color?: string; children: React.ReactNode }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} strokeWidth={0.32 / scale} opacity={opacity} stroke={color}>
      {children}
    </g>
  )
}

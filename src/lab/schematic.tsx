import * as React from "react"
import { cn } from "@/lib/utils"
import { glow, trace, type GlowColor } from "./colors"
import { useFrame } from "./hooks"

/*
 * Schematic drawing kit. Everything is SVG in one coordinate space where
 * 1 unit = 1 CSS px at full size; lay parts out on a 20-unit grid.
 *
 * Two-terminal parts are 60 long. At rot=0 terminal A is at (x−30, y) and B at
 * (x+30, y); rot=90 turns it clockwise so A is at (x, y−30) and B at (x, y+30).
 * Polarised parts (battery, diode, LED, polarised cap) have + / anode at A.
 * Connect terminals with <Wire points={[[x, y], …]} />.
 */

export type Rot = 0 | 90 | 180 | 270
export type Pt = readonly [number, number]

const STROKE = 1.75

export function rotPt(x: number, y: number, rot: Rot): [number, number] {
  switch (rot) {
    case 90:
      return [-y, x]
    case 180:
      return [-x, -y]
    case 270:
      return [y, -x]
    default:
      return [x, y]
  }
}

/** The canvas. Scales down to fit narrow screens (never below `minScale`, then it scrolls). */
export function Schematic({
  width,
  height,
  label,
  minScale = 0.9,
  className,
  children,
}: {
  width: number
  height: number
  /** What the picture shows, for screen readers. */
  label?: string
  minScale?: number
  className?: string
  children: React.ReactNode
}) {
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={label}
      className={cn("mx-auto block select-none text-foreground", className)}
      // natural size, shrinking with the container: a percentage width would collapse inside shrink-to-fit parents (flex items, figures)
      style={{ width, maxWidth: "100%", minWidth: Math.round(width * minScale), height: "auto" }}
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

/** Text on the canvas: node names, values, annotations. Never smaller than 12. */
export function Label({
  x,
  y,
  children,
  anchor = "middle",
  size = 13,
  color,
  weight,
  muted,
}: {
  x: number
  y: number
  children: React.ReactNode
  anchor?: "start" | "middle" | "end"
  size?: number
  color?: string
  weight?: 400 | 500 | 600
  /** Secondary text colour. */
  muted?: boolean
}) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={Math.max(12, size)} fontWeight={weight} fill={color ?? (muted ? "var(--muted-foreground)" : "var(--foreground)")} stroke="none" className="tabular">
      {children}
    </text>
  )
}

export interface PartProps {
  x: number
  y: number
  rot?: Rot
  /** Designator: "R1". */
  label?: React.ReactNode
  /** Value: "330 Ω". */
  value?: React.ReactNode
  /** Where label and value go. Default: above a horizontal part, right of a vertical one. */
  labelSide?: "top" | "bottom" | "left" | "right"
  /** Stroke colour (a CSS colour or var). */
  color?: string
  /** Faded: a branch that is switched off. */
  dim?: boolean
  /** Makes the part clickable (a switch). Also give the same control in <LabControls>. */
  onClick?: () => void
  /** Name read out for a clickable part. */
  ariaLabel?: string
}

function Part({
  x,
  y,
  rot = 0,
  label,
  value,
  labelSide,
  color,
  dim,
  onClick,
  ariaLabel,
  ext,
  flip,
  overlay,
  children,
}: PartProps & { ext: number; flip?: boolean; overlay?: React.ReactNode; children: React.ReactNode }) {
  const vertical = rot === 90 || rot === 270
  const side = labelSide ?? (vertical ? "right" : "top")
  const lines = [label, value].filter((v) => v != null && v !== "")
  const texts = lines.map((line, i) => {
    const n = lines.length
    let tx = 0
    let ty = 0
    let anchor: "start" | "middle" | "end" = "middle"
    if (side === "top") ty = -(ext + 7) - (n - 1 - i) * 15
    else if (side === "bottom") ty = ext + 17 + i * 15
    else {
      tx = side === "right" ? ext + 8 : -(ext + 8)
      anchor = side === "right" ? "start" : "end"
      ty = n === 1 ? 4.5 : i === 0 ? -3 : 12
    }
    return (
      <text key={i} x={tx} y={ty} textAnchor={anchor} fontSize={13} stroke="none" fill={i === 0 && n > 1 ? "var(--foreground)" : "var(--muted-foreground)"} className="tabular">
        {line}
      </text>
    )
  })
  const interactive = onClick
    ? {
        onClick,
        role: "button",
        tabIndex: 0,
        "aria-label": ariaLabel,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onClick()
          }
        },
        className: "cursor-pointer outline-none focus-visible:[&_.part-hit]:stroke-ring",
      }
    : {}
  return (
    <g transform={`translate(${x} ${y})`} opacity={dim ? 0.35 : undefined} style={color ? { color } : undefined} stroke="currentColor" {...interactive}>
      {onClick && <rect className="part-hit" x={-32} y={-22} width={64} height={44} rx={6} fill="transparent" stroke="transparent" transform={rot ? `rotate(${rot})` : undefined} />}
      <g transform={`rotate(${rot})${flip ? " scale(1 -1)" : ""}`}>{children}</g>
      {overlay}
      {texts}
    </g>
  )
}

export function Resistor({ variant = "zigzag", variable, ...p }: PartProps & { /** "iec" draws the GB / IEC rectangle. */ variant?: "zigzag" | "iec"; /** Diagonal arrow: adjustable. */ variable?: boolean }) {
  return (
    <Part ext={8} {...p}>
      {variant === "iec" ? (
        <>
          <path d="M-30 0H-18M18 0H30" />
          <rect x={-18} y={-7} width={36} height={14} />
        </>
      ) : (
        <path d="M-30 0H-18L-15 -7L-9 7L-3 -7L3 7L9 -7L15 7L18 0H30" />
      )}
      {variable && <path d="M-12 13L12 -13M12 -13L6 -11.5M12 -13L10.5 -7" />}
    </Part>
  )
}

/** Three terminals: A (x−30, y), B (x+30, y) and the wiper at (x, y−26) for rot=0. */
export function Potentiometer(p: PartProps) {
  return (
    <Part ext={8} labelSide={p.labelSide ?? (p.rot === 90 || p.rot === 270 ? "right" : "bottom")} {...p}>
      <path d="M-30 0H-18L-15 -7L-9 7L-3 -7L3 7L9 -7L15 7L18 0H30" />
      <path d="M0 -26V-10M-4 -16L0 -10L4 -16" />
    </Part>
  )
}

export function Capacitor({ polarized, ...p }: PartProps & { /** Electrolytic: + at terminal A. */ polarized?: boolean }) {
  return (
    <Part ext={12} {...p}>
      <path d="M-30 0H-4M4 0H30M-4 -12V12M4 -12V12" />
      {polarized && <path d="M-15 -9H-9M-12 -12V-6" strokeWidth={1.25} />}
    </Part>
  )
}

export function Inductor({ core, ...p }: PartProps & { /** Two lines: an iron / ferrite core. */ core?: boolean }) {
  return (
    <Part ext={core ? 13 : 7} {...p}>
      <path d="M-30 0H-18a4.5 4.5 0 0 1 9 0a4.5 4.5 0 0 1 9 0a4.5 4.5 0 0 1 9 0a4.5 4.5 0 0 1 9 0H30" />
      {core && <path d="M-18 -9H18M-18 -12H18" strokeWidth={1.25} />}
    </Part>
  )
}

/** A cell. The long plate (+) is terminal A. */
export function Battery(p: PartProps) {
  return (
    <Part ext={12} {...p}>
      <path d="M-30 0H-4M4 0H30M-4 -12V12" />
      <path d="M4 -6V6" strokeWidth={3.5} />
      <path d="M-15 -9H-9M-12 -12V-6" strokeWidth={1.25} />
    </Part>
  )
}

/** Ideal source in a circle. kind "dc" (+ at A), "ac" (sine) or "current" (arrow toward B). */
export function Source({ kind = "dc", ...p }: PartProps & { kind?: "dc" | "ac" | "current" }) {
  const rot = p.rot ?? 0
  const [px, py] = rotPt(-6, 0, rot)
  const [mx, my] = rotPt(6, 0, rot)
  return (
    <Part
      ext={14}
      {...p}
      overlay={
        kind === "dc" ? (
          <path d={`M${px - 3.5} ${py}H${px + 3.5}M${px} ${py - 3.5}V${py + 3.5}M${mx - 3.5} ${my}H${mx + 3.5}`} strokeWidth={1.4} />
        ) : kind === "ac" ? (
          <path d="M-8 0C-5.5 -8 -2.5 -8 0 0S5.5 8 8 0" strokeWidth={1.4} />
        ) : undefined
      }
    >
      <path d="M-30 0H-14M14 0H30" />
      <circle r={14} />
      {kind === "current" && <path d="M-8 0H8M3 -4L8 0L3 4" />}
    </Part>
  )
}

/** Diode family. Anode at A, cathode (the bar) at B. */
export function Diode({ variant = "diode", ...p }: PartProps & { variant?: "diode" | "zener" | "schottky" | "photo" }) {
  return (
    <Part ext={variant === "photo" ? 16 : 9} {...p}>
      <path d="M-30 0H-8M8 0H30" />
      <path d="M-8 -8V8L8 0Z" />
      <path d={variant === "zener" ? "M4 -11L8 -8V8L12 11" : variant === "schottky" ? "M12 -5V-8H8V8H4V5" : "M8 -8V8"} />
      {variant === "photo" && <path d="M5 -20L-1 -13M-1 -13L-0.5 -17M-1 -13L3 -13.5M12 -20L6 -13M6 -13L6.5 -17M6 -13L10 -13.5" strokeWidth={1.4} />}
    </Part>
  )
}

/** LED that actually lights: `brightness` 0–1 drives the glow. Anode at A. */
export function Led({ color = "red", brightness = 0, ...p }: PartProps & { color?: GlowColor; brightness?: number }) {
  const b = Math.min(1, Math.max(0, brightness))
  const c = glow[color]
  return (
    <Part ext={16} {...p}>
      {b > 0.01 && <circle r={15 + b * 11} fill={c} stroke="none" opacity={0.1 + b * 0.25} />}
      <path d="M-30 0H-8M8 0H30" />
      <path d="M-8 -8V8L8 0Z" fill={c} fillOpacity={b} />
      <path d="M8 -8V8" />
      <path d="M-1 -13L5 -20M5 -20L4.5 -16M5 -20L1 -19.5M6 -13L12 -20M12 -20L11.5 -16M12 -20L8 -19.5" strokeWidth={1.4} stroke={b > 0.05 ? c : undefined} />
    </Part>
  )
}

/** Incandescent lamp: glows with `brightness` 0–1. */
export function Lamp({ brightness = 0, ...p }: PartProps & { brightness?: number }) {
  const b = Math.min(1, Math.max(0, brightness))
  return (
    <Part ext={13} {...p}>
      {b > 0.01 && <circle r={14 + b * 12} fill={glow.amber} stroke="none" opacity={0.12 + b * 0.3} />}
      <path d="M-30 0H-12M12 0H30" />
      <circle r={12} fill={glow.amber} fillOpacity={b * 0.6} />
      <path d="M-8.5 -8.5L8.5 8.5M-8.5 8.5L8.5 -8.5" />
    </Part>
  )
}

/** SPST switch. `closed` draws the lever down. */
export function Switch({ closed, ...p }: PartProps & { closed?: boolean }) {
  return (
    <Part ext={closed ? 6 : 15} ariaLabel={p.ariaLabel ?? (closed ? "断开开关" : "闭合开关")} {...p}>
      <path d="M-30 0H-14.5M14.5 0H30" />
      <circle cx={-12} r={2.5} />
      <circle cx={12} r={2.5} />
      <path d={closed ? "M-9.5 0H9.5" : "M-10 -1.5L9 -13"} />
    </Part>
  )
}

export function Fuse(p: PartProps) {
  return (
    <Part ext={7} {...p}>
      <path d="M-30 0H30" />
      <rect x={-14} y={-6} width={28} height={12} />
    </Part>
  )
}

export function Crystal(p: PartProps) {
  return (
    <Part ext={12} {...p}>
      <path d="M-30 0H-9M9 0H30M-9 -9V9M9 -9V9" />
      <rect x={-5} y={-11} width={10} height={22} />
    </Part>
  )
}

/** A circle with a letter: V (voltmeter), A (ammeter), M (motor) … */
export function Meter({ letter = "V", ...p }: PartProps & { letter?: string }) {
  return (
    <Part
      ext={14}
      {...p}
      overlay={
        <text y={5} textAnchor="middle" fontSize={14} fontWeight={600} stroke="none" fill="currentColor">
          {letter}
        </text>
      }
    >
      <path d="M-30 0H-13M13 0H30" />
      <circle r={13} />
    </Part>
  )
}

export interface TransistorProps extends PartProps {
  /** Mirror top-to-bottom, so the emitter / source is on top (usual for PNP / P-channel high-side switches). */
  flip?: boolean
  /** Draw the envelope circle (BJT only). */
  circle?: boolean
}

/**
 * BJT. Terminals at rot=0: base (x−30, y), collector (x+14, y−30), emitter (x+14, y+30).
 * With `flip` the collector and emitter swap places.
 */
export function Bjt({ type = "npn", circle = true, flip, ...p }: TransistorProps & { type?: "npn" | "pnp" }) {
  return (
    <Part ext={22} flip={flip} labelSide={p.labelSide ?? "right"} {...p}>
      {circle && <circle cx={3} r={19} strokeWidth={1.25} />}
      <path d="M-30 0H-6M-6 -5L14 -16V-30M-6 5L14 16V30" />
      <path d="M-6 -11V11" strokeWidth={3} />
      {type === "npn" ? <path d="M3.7 14.3L11.5 14.6L7.1 8.2Z" fill="currentColor" strokeWidth={1} /> : <path d="M-1 7.75L6.8 8.05L3.4 14.2Z" fill="currentColor" strokeWidth={1} />}
    </Part>
  )
}

/**
 * Enhancement MOSFET, body tied to source. Terminals at rot=0: gate (x−30, y),
 * drain (x+14, y−30), source (x+14, y+30). With `flip` drain and source swap places.
 */
export function Mosfet({ type = "n", flip, ...p }: TransistorProps & { type?: "n" | "p" }) {
  return (
    <Part ext={20} flip={flip} labelSide={p.labelSide ?? "right"} {...p}>
      <path d="M-30 0H-12M-12 -10V10" />
      <path d="M-6 -12V-5M-6 -3.5V3.5M-6 5V12" />
      <path d="M-6 -8.5H14V-30M-6 8.5H14V30M-6 0H14V8.5" />
      {type === "n" ? <path d="M-5 0L2 -3.5V3.5Z" fill="currentColor" strokeWidth={1} /> : <path d="M6 0L-1 -3.5V3.5Z" fill="currentColor" strokeWidth={1} />}
    </Part>
  )
}

/**
 * Op-amp. Terminals: upper input (x−40, y−14), lower input (x−40, y+14), output (x+44, y).
 * By default the inverting input (−) is on top; `plusOnTop` swaps them.
 */
export function OpAmp({ plusOnTop, ...p }: PartProps & { plusOnTop?: boolean }) {
  const minusY = plusOnTop ? 14 : -14
  const plusY = -minusY
  return (
    <Part ext={30} {...p}>
      <path d="M-24 -28V28L28 0Z" />
      <path d="M-40 -14H-24M-40 14H-24M28 0H44" />
      <path d={`M-20 ${minusY}H-14M-20 ${plusY}H-14M-17 ${plusY - 3}V${plusY + 3}`} strokeWidth={1.4} />
    </Part>
  )
}

export type GateType = "and" | "or" | "not" | "nand" | "nor" | "xor" | "xnor" | "buf"

/**
 * Logic gate. Inputs at (x−30, y−8) and (x−30, y+8) — a single input at
 * (x−30, y) for not / buf — output at (x+30, y). Pass a / b / out to colour
 * the leads that are high.
 */
export function Gate({ type, a, b, out, ...p }: PartProps & { type: GateType; a?: boolean; b?: boolean; out?: boolean }) {
  const single = type === "not" || type === "buf"
  const orLike = type === "or" || type === "nor" || type === "xor" || type === "xnor"
  const exclusive = type === "xor" || type === "xnor"
  const bubble = type === "nand" || type === "nor" || type === "xnor" || type === "not"
  const hi = (on?: boolean) => (on ? trace.voltage : undefined)
  const inEnd = single ? -12 : exclusive ? -18.5 : orLike ? -13.5 : -14
  const bodyEnd = single ? 8 : 14
  return (
    <Part ext={16} labelSide={p.labelSide ?? "bottom"} {...p}>
      {single ? (
        <path d={`M-30 0H${inEnd}`} stroke={hi(a)} strokeWidth={a ? 2.25 : STROKE} />
      ) : (
        <>
          <path d={`M-30 -8H${inEnd}`} stroke={hi(a)} strokeWidth={a ? 2.25 : STROKE} />
          <path d={`M-30 8H${inEnd}`} stroke={hi(b)} strokeWidth={b ? 2.25 : STROKE} />
        </>
      )}
      {single ? <path d="M-12 -11V11L8 0Z" /> : orLike ? <path d="M-16 -14C-4 -14 8 -8 14 0C8 8 -4 14 -16 14C-11 5 -11 -5 -16 -14Z" /> : <path d="M-14 -14H0A14 14 0 0 1 0 14H-14Z" />}
      {exclusive && <path d="M-21 -14C-16 -5 -16 5 -21 14" />}
      {bubble && <circle cx={bodyEnd + 3.5} r={3.5} />}
      <path d={`M${bodyEnd + (bubble ? 7 : 0)} 0H30`} stroke={hi(out)} strokeWidth={out ? 2.25 : STROKE} />
    </Part>
  )
}

/** Ground symbol hanging from (x, y). */
export function Ground({ x, y, color }: { x: number; y: number; color?: string }) {
  return <path transform={`translate(${x} ${y})`} d="M0 0V8M-10 8H10M-6 13H6M-2 18H2" stroke={color} />
}

/** Supply rail above (x, y): a short bar with its name ("5V", "VCC"). */
export function Rail({ x, y, label, color }: { x: number; y: number; label?: React.ReactNode; color?: string }) {
  return (
    <g transform={`translate(${x} ${y})`} stroke={color}>
      <path d="M0 0V-10M-8 -10H8" />
      {label != null && (
        <text y={-16} textAnchor="middle" fontSize={13} stroke="none" fill={color ?? "var(--foreground)"} className="tabular">
          {label}
        </text>
      )}
    </g>
  )
}

/** A dot where wires join. */
export function Junction({ x, y, color }: { x: number; y: number; color?: string }) {
  return <circle cx={x} cy={y} r={3} fill={color ?? "currentColor"} stroke="none" />
}

/** An open terminal with a name: Vin, Vout, a test point. */
export function Port({ x, y, label, side = "right", color }: { x: number; y: number; label?: React.ReactNode; side?: "left" | "right" | "top" | "bottom"; color?: string }) {
  const dx = side === "right" ? 9 : side === "left" ? -9 : 0
  const dy = side === "top" ? -9 : side === "bottom" ? 19 : 4.5
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={3.5} fill="var(--background)" stroke={color} />
      {label != null && (
        <text x={dx} y={dy} textAnchor={side === "right" ? "start" : side === "left" ? "end" : "middle"} fontSize={13} stroke="none" fill={color ?? "var(--foreground)"} className="tabular">
          {label}
        </text>
      )}
    </g>
  )
}

/** Antenna standing on (x, y). */
export function Antenna({ x, y, color }: { x: number; y: number; color?: string }) {
  return <path transform={`translate(${x} ${y})`} d="M0 0V-26M0 -12L-10 -26M0 -12L10 -26" stroke={color} />
}

/**
 * A wire through `points`. Give `current` (amps, positive = flowing from the
 * first point to the last) and `scale` (the current that should look "fast")
 * and dots drift along it, so the learner sees where current goes and how much.
 */
export function Wire({
  points,
  current,
  scale = 1,
  color,
  dashed,
  width,
  dotColor = trace.current,
}: {
  points: readonly Pt[]
  current?: number
  /** Current that maps to full dot speed. Pick the largest current the widget can reach. */
  scale?: number
  color?: string
  dashed?: boolean
  width?: number
  dotColor?: string
}) {
  const d = points.map(([px, py], i) => `${i ? "L" : "M"}${px} ${py}`).join("")
  const dots = React.useRef<SVGPathElement>(null)
  const phase = React.useRef(0)
  const rate = current == null ? 0 : Math.max(-1.6, Math.min(1.6, current / scale))
  const flowing = Math.abs(rate) > 0.004
  useFrame((dt) => {
    // compressed (power 0.6) so currents a hundred times apart still look different:
    // slow ones crawl visibly, fast ones stop short of a blur
    const speed = Math.sign(rate) * (6 + 100 * Math.min(1.6, Math.abs(rate)) ** 0.6)
    phase.current = (phase.current + speed * dt) % 16
    dots.current?.setAttribute("stroke-dashoffset", (-phase.current).toFixed(2))
  }, flowing)
  return (
    <g>
      <path d={d} stroke={color} strokeWidth={width} strokeDasharray={dashed ? "5 5" : undefined} />
      {flowing && <path ref={dots} d={d} stroke={dotColor} strokeWidth={4.5} strokeDasharray="0.01 16" />}
    </g>
  )
}

/** An annotation arrow from one point to another (a voltage drop, a direction of flow). */
export function Arrow({ from, to, label, color = "var(--muted-foreground)", labelSide = 1 }: { from: Pt; to: Pt; label?: React.ReactNode; color?: string; /** 1 or −1: which side of the arrow the label sits on. */ labelSide?: 1 | -1 }) {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const hx = to[0] - ux * 7
  const hy = to[1] - uy * 7
  const mx = (from[0] + to[0]) / 2 - uy * 12 * labelSide
  const my = (from[1] + to[1]) / 2 + ux * 12 * labelSide
  return (
    <g stroke={color} strokeWidth={1.4}>
      <path d={`M${from[0]} ${from[1]}L${to[0]} ${to[1]}M${hx - uy * 3.5} ${hy + ux * 3.5}L${to[0]} ${to[1]}L${hx + uy * 3.5} ${hy - ux * 3.5}`} />
      {label != null && (
        <text x={mx} y={my + 4.5} textAnchor="middle" fontSize={13} stroke="none" fill={color} className="tabular">
          {label}
        </text>
      )}
    </g>
  )
}

export interface ChipSpec {
  /** Centre of the body. */
  x: number
  y: number
  w: number
  h: number
  /** Pin names per side, top-to-bottom / left-to-right. "" leaves a gap. */
  left?: string[]
  right?: string[]
  top?: string[]
  bottom?: string[]
  /** Distance between pins. */
  pitch?: number
}

/** Where each named pin of a <Chip> ends, so wires can attach: chipPins(spec).SDA → [x, y]. */
export function chipPins(spec: ChipSpec): Record<string, [number, number]> {
  const { x, y, w, h, pitch = 20 } = spec
  const out: Record<string, [number, number]> = {}
  const along = (names: string[] | undefined, place: (offset: number) => [number, number]) => {
    if (!names) return
    names.forEach((name, i) => {
      if (name) out[name] = place((i - (names.length - 1) / 2) * pitch)
    })
  }
  along(spec.left, (o) => [x - w / 2 - 14, y + o])
  along(spec.right, (o) => [x + w / 2 + 14, y + o])
  along(spec.top, (o) => [x + o, y - h / 2 - 14])
  along(spec.bottom, (o) => [x + o, y + h / 2 + 14])
  return out
}

/** An IC drawn as a box with named pins. Use chipPins() with the same spec to find the pin ends. */
export function Chip({ label, sub, color, ...spec }: ChipSpec & { label?: React.ReactNode; sub?: React.ReactNode; color?: string }) {
  const { x, y, w, h, pitch = 20 } = spec
  const pins: React.ReactNode[] = []
  const side = (names: string[] | undefined, kind: "left" | "right" | "top" | "bottom") => {
    names?.forEach((name, i) => {
      if (!name) return
      const o = (i - (names.length - 1) / 2) * pitch
      const horizontal = kind === "left" || kind === "right"
      const sx = kind === "left" ? -w / 2 : kind === "right" ? w / 2 : o
      const sy = kind === "top" ? -h / 2 : kind === "bottom" ? h / 2 : o
      const dx = kind === "left" ? -14 : kind === "right" ? 14 : 0
      const dy = kind === "top" ? -14 : kind === "bottom" ? 14 : 0
      pins.push(
        <g key={`${kind}${i}`}>
          <path d={`M${sx} ${sy}L${sx + dx} ${sy + dy}`} />
          <text
            x={horizontal ? sx - Math.sign(dx) * 6 : sx}
            y={horizontal ? sy + 4 : sy - Math.sign(dy) * 8 + 4}
            textAnchor={kind === "left" ? "start" : kind === "right" ? "end" : "middle"}
            fontSize={12}
            stroke="none"
            fill="var(--muted-foreground)"
            className="tabular"
          >
            {name}
          </text>
        </g>,
      )
    })
  }
  side(spec.left, "left")
  side(spec.right, "right")
  side(spec.top, "top")
  side(spec.bottom, "bottom")
  return (
    <g transform={`translate(${x} ${y})`} stroke={color}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={3} fill="var(--background)" />
      {pins}
      {label != null && (
        <text y={sub != null ? -3 : 4.5} textAnchor="middle" fontSize={13} fontWeight={600} stroke="none" fill="var(--foreground)">
          {label}
        </text>
      )}
      {sub != null && (
        <text y={13} textAnchor="middle" fontSize={12} stroke="none" fill="var(--muted-foreground)">
          {sub}
        </text>
      )}
    </g>
  )
}

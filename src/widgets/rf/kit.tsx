import * as React from "react"
import { cn } from "@/lib/utils"
import { fixed, sig, useWidth } from "@/lab"

/*
 * Shared by the RF chapter's widgets: a drawing surface that follows its
 * container's width (so nothing has to scale or scroll on a phone), plus the
 * few formatters the chapter needs (lengths in cm, decibels with ∞).
 */

/** Speed of light in vacuum, m/s. */
export const C0 = 299_792_458

/**
 * An SVG as wide as its container. `children` receives the width in px and
 * lays itself out from it. Same stroke defaults as <Schematic>, so the
 * schematic parts and <Label> can be used inside.
 */
export function Canvas({
  height,
  label,
  min = 260,
  className,
  children,
}: {
  height: number
  /** What the picture shows, for screen readers. */
  label: string
  /** Narrowest layout the drawing supports; below it the picture scales down. */
  min?: number
  className?: string
  children: (width: number) => React.ReactNode
}) {
  const [ref, measured] = useWidth<HTMLDivElement>(640)
  const width = Math.max(min, measured)
  return (
    <div ref={ref} className={cn("w-full min-w-0", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        role="img"
        aria-label={label}
        className="block h-auto max-w-full select-none text-foreground"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children(width)}
      </svg>
    </div>
  )
}

/** A length the way people say it: 3 km, 69.1 cm, 3.06 cm, 3.9 mm. */
export function formatLength(metres: number, digits = 3): string {
  const a = Math.abs(metres)
  if (!Number.isFinite(metres)) return sig(metres)
  if (a >= 999.5) return `${sig(metres / 1000, digits)} km`
  if (a >= 0.9995) return `${sig(metres, digits)} m`
  if (a >= 0.009995) return `${sig(metres * 100, digits)} cm`
  return `${sig(metres * 1000, digits)} mm`
}

/** Decibels with one decimal; an infinite value reads "∞". */
export function formatDb(value: number, unit = "dB", decimals = 1): string {
  if (!Number.isFinite(value)) return value > 0 ? "∞" : "−∞"
  return `${fixed(value, decimals)} ${unit}`
}

/** Small seeded generator (mulberry32): the same seed always gives the same sequence, so pictures don't jump between renders. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

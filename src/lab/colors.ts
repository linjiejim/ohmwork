import { catVar } from "@/lib/categorical"

/*
 * Colours carry meaning across the whole course, so a learner can read any
 * widget at a glance: voltage is always orange, current always blue, power /
 * heat always red. They come from the theme's categorical pairs (data colours),
 * never hex, so they hold up in dark mode.
 */
export const trace = {
  /** Voltage: traces, node labels, "high" logic level. */
  voltage: catVar("orange"),
  /** Current: traces and the moving dots on wires. */
  current: catVar("blue"),
  /** Power, heat, loss. */
  power: catVar("red"),
  /** A second and third signal when a plot compares several. */
  second: catVar("purple"),
  third: catVar("teal"),
  fourth: catVar("pink"),
  /** "Within limits", the target value. */
  good: catVar("green"),
  /** Reference curves, ideal lines, things in the background. */
  ref: "var(--faint-foreground)",
} as const

/** Series colours in the order plots hand them out when a series names none. */
export const SERIES_COLORS = [trace.current, trace.voltage, trace.second, trace.third, trace.fourth, trace.good, trace.power]

/** Light colours for LEDs and lamps. */
export const glow = {
  red: catVar("red"),
  green: catVar("green"),
  blue: catVar("blue"),
  amber: catVar("amber"),
  orange: catVar("orange"),
  white: "var(--foreground)",
} as const
export type GlowColor = keyof typeof glow

import { T } from "../kit"

/** Helpers the ac-signals films share. Everything is a pure function of its arguments. */
export const TAU = Math.PI * 2

/** An SVG path through `n + 1` points, `f(u)` giving the point at u in 0..1. */
export function curve(n: number, f: (u: number) => [number, number]) {
  let d = ""
  for (let i = 0; i <= n; i++) {
    const [x, y] = f(i / n)
    d += `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)} `
  }
  return d
}

/** A sine from x0 to x1 around y = yc; `phase` is in cycles (positive slides the wave to the right). */
export function sinePath(x0: number, x1: number, yc: number, amp: number, cycles: number, phase = 0, n = 220) {
  return curve(n, (u) => [x0 + (x1 - x0) * u, yc - amp * Math.sin(TAU * (cycles * u - phase))])
}

/** A vertical double arrow. */
export const vArrow = (x: number, y0: number, y1: number, h = 1.1) => {
  const s = Math.sign(y1 - y0) || 1
  return `M${x} ${y0} V${y1} M${x - h * 0.7} ${y0 + s * h} L${x} ${y0} L${x + h * 0.7} ${y0 + s * h} M${x - h * 0.7} ${y1 - s * h} L${x} ${y1} L${x + h * 0.7} ${y1 - s * h}`
}

/** A horizontal double arrow. */
export const hArrow = (x0: number, x1: number, y: number, h = 1.1) => {
  const s = Math.sign(x1 - x0) || 1
  return `M${x0} ${y} H${x1} M${x0 + s * h} ${y - h * 0.7} L${x0} ${y} L${x0 + s * h} ${y + h * 0.7} M${x1 - s * h} ${y - h * 0.7} L${x1} ${y} L${x1 - s * h} ${y + h * 0.7}`
}

/** A small label in a rounded outline, like the references' 「口算窍门」. */
export function Pill({ x, y, o, children }: { x: number; y: number; o: number; children: React.ReactNode }) {
  return (
    <T x={x} y={y} size={2.6} o={o} className="rounded-full border border-input px-[0.9em] py-[0.45em] text-muted-foreground">
      {children}
    </T>
  )
}

/** Log-spaced frequency (Hz) to x. */
export const logX = (f: number, f0: number, f1: number, x0: number, x1: number) => x0 + ((Math.log10(f) - Math.log10(f0)) / (Math.log10(f1) - Math.log10(f0))) * (x1 - x0)

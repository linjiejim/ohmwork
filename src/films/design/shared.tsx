import { trace } from "@/lab/colors"
import { clamp01 } from "../kit"

export { VOLT, AMP, POWER, MUTED, LINE, rnd, Flow, integ, Ground, zig, BatteryV } from "../basics/shared"

export const GOOD = trace.good

/** A tick in a circle, centred on (x, y). `p` draws it 0 → 1. Use inside <Svg>. */
export function Check({ x, y, p = 1, r = 1.5, color = GOOD }: { x: number; y: number; p?: number; r?: number; color?: string }) {
  if (p <= 0.01) return null
  return (
    <g opacity={clamp01(p * 2)} stroke={color} strokeWidth={0.3}>
      <circle cx={x} cy={y} r={r} />
      <path d={`M${x - r * 0.45} ${y} L${x - r * 0.1} ${y + r * 0.4} L${x + r * 0.5} ${y - r * 0.4}`} />
    </g>
  )
}

/** A rounded box. Use inside <Svg>. */
export function Box({ x, y, w, h, o = 1, color, fill = 0, dash, sw }: { x: number; y: number; w: number; h: number; o?: number; color?: string; fill?: number; dash?: string; sw?: number }) {
  if (o <= 0.01) return null
  return (
    <g opacity={o}>
      {fill > 0 && <rect x={x} y={y} width={w} height={h} rx={1} fill={color ?? "var(--foreground)"} fillOpacity={fill} stroke="none" />}
      <rect x={x} y={y} width={w} height={h} rx={1} stroke={color} strokeDasharray={dash} strokeWidth={sw} />
    </g>
  )
}

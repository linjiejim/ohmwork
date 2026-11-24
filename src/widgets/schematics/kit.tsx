/** Small drawing helpers shared by the widgets of the 读懂原理图 chapter. */

/**
 * A net label drawn as a flag (the "global label" of KiCad / 立创 EDA). The
 * wire attaches at (x, y); the flag is 40 long and 16 tall and points back at
 * that point. `side` says where the flag body goes: "right" spans x … x+40,
 * "left" spans x−40 … x. Names up to four capitals fit.
 */
export function NetFlag({ x, y, name, side = "right", color }: { x: number; y: number; name: string; side?: "left" | "right"; color?: string }) {
  const s = side === "right" ? 1 : -1
  const d = `M${x} ${y}L${x + 6 * s} ${y - 8}H${x + 40 * s}V${y + 8}H${x + 6 * s}Z`
  return (
    <g stroke={color}>
      <path d={d} fill="var(--background)" strokeWidth={1.4} />
      <text x={x + 23 * s} y={y + 4.5} textAnchor="middle" fontSize={12} fontWeight={500} stroke="none" fill={color ?? "var(--foreground)"} className="tabular">
        {name}
      </text>
    </g>
  )
}

/** The "no connect" cross on a pin end: this pin is left open on purpose. */
export function NoConnect({ x, y, color }: { x: number; y: number; color?: string }) {
  return <path d={`M${x - 4} ${y - 4}L${x + 4} ${y + 4}M${x + 4} ${y - 4}L${x - 4} ${y + 4}`} stroke={color} strokeWidth={1.5} />
}

/** A repeatable pseudo-random generator (mulberry32). Same seed, same sequence, so renders never change the picture. */
export function seeded(seed: number): () => number {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A shuffled copy (Fisher–Yates) driven by a fixed seed. */
export function shuffled<T>(items: readonly T[], seed: number): T[] {
  const rand = seeded(seed)
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

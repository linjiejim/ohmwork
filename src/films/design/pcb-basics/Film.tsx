import * as React from "react"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, M, Scene, Svg, T, easeInOut, enter, glide, lerp, span, type FilmDef, type StageProps } from "../../kit"
import { AMP, Box, GOOD, MUTED, POWER, VOLT } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

/*
 * PCB 基础, ~65 s.
 *   title (schematic wire → copper) → a board cut open, its layers peeling apart, then four layers
 *   → trace and via (current walks down the barrel) → three SMD sizes drawn to scale → 100 mil = 2.54 mm
 *   → trace width from current → inner layer needs more → files to the factory → "try the stack-up".
 * Copper is drawn in the voltage orange, the ground layer in the foreground colour.
 */
const COPPER = VOLT

/**
 * When each narration line starts. Some beats share their line's id ("via": "过孔" sits four seconds
 * into the line "via"), and a beat overrides the line of the same name in `b`, so scene changes read
 * the line starts from here.
 */
const LINE = Object.fromEntries(timing.lines.map((l) => [l.id, l.start])) as Record<string, number>

function Stage({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.6) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)
  const lift = (at: number) => (still ? 0 : -easeInOut((t - at) / 0.45) * 2)

  // each scene is gone before the next one's content arrives
  const title = span(t, 0.25, LINE.cutL - 0.45)
  const stack = span(t, LINE.cutL - 0.25, LINE.viaL - 0.45)
  const via = span(t, LINE.viaL - 0.25, LINE.pkgL - 0.45)
  const pkg = span(t, LINE.pkgL - 0.25, LINE.milL - 0.45)
  const mil = span(t, LINE.milL - 0.25, b.width - 0.45)
  // the 0.5 A and 2 A rows fill in after "约 0.3 mm": the scene stays up through the gap
  const width = span(t, b.width - 0.25, b.inner - 0.3)
  const inner = span(t, b.inner - 0.1, LINE.filesL - 0.45)
  const files = span(t, LINE.filesL - 0.25, b.outro - 0.45)
  const outro = enter(t, b.outro - 0.1, 0.5)

  return (
    <>
      <Scene o={title} dy={lift(LINE.cutL - 0.45)}>
        <T x={50} y={11} size={7.4} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
          PCB 基础
        </T>
        <T x={50} y={19} size={2.8} color={MUTED} o={enter(t, b.intro + 0.9)} dy={rise(b.intro + 0.9, 1)}>
          从原理图的一根线，到板子上的一条铜
        </T>
        <Title t={t} b={b} />
      </Scene>

      <Scene o={stack}>
        <Stack t={t} b={b} still={still} />
      </Scene>

      <Scene o={via}>
        <Via t={t} b={b} still={still} />
      </Scene>

      <Scene o={pkg}>
        <Packages t={t} b={b} still={still} />
      </Scene>

      <Scene o={mil}>
        <Mil t={t} b={b} />
      </Scene>

      <Scene o={width}>
        <Width t={t} b={b} still={still} />
      </Scene>

      <Scene o={inner}>
        <Inner t={t} b={b} still={still} />
      </Scene>

      <Scene o={files}>
        <Files t={t} b={b} />
      </Scene>

      <Scene o={outro}>
        <T x={50} y={24} size={6} weight={600} dy={rise(b.outro)}>
          动手试试
        </T>
        <T x={50} y={32.5} size={2.8} color={MUTED} o={enter(t, b.drag)} dy={rise(b.drag, 1)}>
          拖动下面的叠层，再去试试线宽
        </T>
        <Svg>
          <g opacity={enter(t, b.drag + 0.3)} transform={`translate(0 ${still ? 0 : Math.sin(t * 3.2) * 0.6})`} strokeWidth={0.45}>
            <path d="M50 38 V45 M47.6 42.6 L50 45 L52.4 42.6" />
          </g>
        </Svg>
      </Scene>
    </>
  )
}

// ── title ────────────────────────────────────────────────────────────────────

function Title({ t, b }: Pick<StageProps, "t" | "b">) {
  const a = enter(t, b.intro + 1.2, 0.8)
  const c = enter(t, b.intro + 2.8, 0.8)
  return (
    <>
      <Svg>
        <g opacity={a}>
          <circle cx={14} cy={34} r={1} />
          <circle cx={40} cy={34} r={1} />
          <Draw d="M15 34 H39" p={a} strokeWidth={0.25} />
        </g>
        <path d="M44 34 H54 M51 31.5 L54 34 L51 36.5" opacity={c} />
        <g opacity={c}>
          <Box x={58} y={26} w={34} h={16} />
          <circle cx={64} cy={34} r={2} fill={COPPER} fillOpacity={0.3} stroke={COPPER} />
          <circle cx={86} cy={34} r={2} fill={COPPER} fillOpacity={0.3} stroke={COPPER} />
          <rect x={66} y={32.8} width={18} height={2.4} fill={COPPER} stroke="none" />
        </g>
      </Svg>
      <T x={27} y={39.5} size={2.2} color={MUTED} o={a}>
        原理图：只说相连
      </T>
      <T x={75} y={46} size={2.2} color={COPPER} o={c}>
        板子：真正的铜线
      </T>
    </>
  )
}

// ── the stack-up ─────────────────────────────────────────────────────────────

type LayerKind = "silk" | "mask" | "cu" | "fr4" | "gnd" | "pwr"

function layerStyle(kind: LayerKind): { fill: string; fo: number; stroke?: string } {
  switch (kind) {
    case "silk":
      return { fill: "var(--foreground)", fo: 0.55 }
    case "mask":
      return { fill: GOOD, fo: 0.35, stroke: GOOD }
    case "cu":
      return { fill: COPPER, fo: 0.7, stroke: COPPER }
    case "gnd":
      return { fill: "var(--foreground)", fo: 0.7 }
    case "pwr":
      return { fill: POWER, fo: 0.6, stroke: POWER }
    default:
      return { fill: "var(--muted-foreground)", fo: 0.16 }
  }
}

const SX0 = 18
const SW = 46
const H2: [LayerKind, number][] = [["silk", 0.8], ["mask", 1.2], ["cu", 1.2], ["fr4", 8], ["cu", 1.2], ["mask", 1.2], ["silk", 0.8]]
const H4: [LayerKind, number][] = [["silk", 0.8], ["mask", 1.2], ["cu", 1.2], ["fr4", 3.2], ["gnd", 1.2], ["fr4", 3.2], ["pwr", 1.2], ["fr4", 3.2], ["cu", 1.2], ["mask", 1.2], ["silk", 0.8]]

/** y positions of a layer list: `gap` apart, starting at `y0`. */
function stackY(list: [LayerKind, number][], y0: number, gap: number) {
  let y = y0
  return list.map(([, h]) => {
    const r = y
    y += h + gap
    return r
  })
}

function Stack({ t, b, still }: StageProps) {
  const slab = enter(t, LINE.cutL, 0.6)
  const e = still ? (t > b.stack ? 1 : 0) : easeInOut((t - b.stack) / 0.9)
  const four = enter(t, b.n + 0.2, 0.5)
  const two = 1 - four

  // 2-layer: compressed slab → exploded
  const total = H2.reduce((s, [, h]) => s + h, 0)
  const flat = stackY(H2, 56.25 / 2 - 3 - total / 2 + 3, 0)
  const open = stackY(H2, 12.5, 3.3)
  const y4 = stackY(H4, 11.5, 1.8)

  const names2: Record<number, [string, number]> = { 0: ["丝印", b.silk], 1: ["阻焊", b.mask], 2: ["铜", b.cu], 3: ["基材 FR-4", b.fr4], 4: ["铜", b.cu], 5: ["阻焊", b.mask], 6: ["丝印", b.silk] }
  const names4: Record<number, [string, number, string?]> = { 2: ["信号", b.four], 4: ["地", b.gnd, undefined], 6: ["电源", b.pwr], 8: ["信号", b.four] }

  const cutLine = span(t, b.cut + 0.1, b.stack - 0.1, 0.3, 0.3)
  return (
    <>
      <Svg>
        <g opacity={two * slab}>
          {H2.map(([k, h], i) => {
            const y = lerp(flat[i], open[i], e)
            const s = layerStyle(k)
            return (
              <g key={i}>
                <rect x={SX0} y={y} width={SW} height={lerp(h, h, e)} fill={s.fill} fillOpacity={s.fo} stroke={s.stroke ?? "var(--muted-foreground)"} strokeWidth={0.25} />
                {k === "silk" && <path d={`M${SX0 + 4} ${y + h / 2} h5 M${SX0 + 14} ${y + h / 2} h3 M${SX0 + 24} ${y + h / 2} h8`} stroke="var(--background)" strokeWidth={0.25} />}
              </g>
            )
          })}
        </g>
        <g opacity={four}>
          {H4.map(([k, h], i) => {
            const s = layerStyle(k)
            const o = enter(t, b.n + 0.3 + i * 0.05, 0.4)
            return <rect key={i} x={SX0} y={y4[i]} width={SW} height={h} fill={s.fill} fillOpacity={s.fo} stroke={s.stroke ?? "var(--muted-foreground)"} strokeWidth={0.25} opacity={o} />
          })}
        </g>
        {cutLine > 0.01 && <path d={`M${SX0 + SW / 2} ${flat[0] - 3} V${lerp(flat[0] - 3, flat[6] + 4, cutLine)}`} stroke="var(--foreground)" strokeDasharray="0.8 0.8" opacity={cutLine} strokeWidth={0.25} />}
      </Svg>

      {/* names of the two-layer stack, each lit while its word is spoken */}
      {H2.slice(0, 4).map((_, i) => {
        const [name, at] = names2[i]
        const o = two * e * enter(t, at - 0.2, 0.4)
        const on = Math.abs(t - at) < 1.1 ? 1 : 0
        return (
          <T key={i} x={72} y={open[i] + H2[i][1] / 2} size={2.6} anchor="start" weight={on ? 600 : 400} color={on ? undefined : MUTED} o={o}>
            {name}
          </T>
        )
      })}
      <T x={SX0 + SW / 2} y={43} size={2.6} color={MUTED} o={two * slab * (1 - e)}>
        一块普通的板子，总厚约 1.6 mm
      </T>
      {Object.entries(names4).map(([i, [name, at]]) => (
        <T key={i} x={72} y={y4[Number(i)] + H4[Number(i)][1] / 2} size={2.8} anchor="start" weight={600} color={name === "电源" ? POWER : undefined} o={enter(t, at - 0.1) * four}>
          {name}
        </T>
      ))}
      <T x={SX0 + SW / 2} y={50.5} size={2.4} color={MUTED} o={enter(t, b.n) * four} className="tabular">
        <M>4</M> 层：信号 – 地 – 电源 – 信号
      </T>
    </>
  )
}

// ── trace and via ────────────────────────────────────────────────────────────

const VX = 48
const TOPY = 22
const BOTY = 38

function Via({ t, b, still }: StageProps) {
  const top = enter(t, b.trace - 0.1, 0.7)
  const v = enter(t, b.via - 0.1, 0.6)
  const bot = enter(t, b.via + 0.3, 0.7)
  // a dot of current walks the path: top trace, down the barrel, bottom trace
  const pts: [number, number][] = [[10, TOPY], [VX, TOPY], [VX, BOTY], [90, BOTY]]
  const lens = [38, 16, 42]
  const L = 96
  const dots: React.ReactNode[] = []
  if (!still && t > b.via + 0.9) {
    const n = 8
    for (let i = 0; i < n; i++) {
      let s = (((t - b.via) * 12 + (i * L) / n) % L + L) % L
      let k = 0
      while (k < 2 && s > lens[k]) s -= lens[k++]
      const [x0, y0] = pts[k]
      const [x1, y1] = pts[k + 1]
      dots.push(<circle key={i} cx={x0 + ((x1 - x0) * s) / lens[k]} cy={y0 + ((y1 - y0) * s) / lens[k]} r={0.6} fill={AMP} stroke="none" opacity={enter(t, b.via + 0.9)} />)
    }
  }
  return (
    <>
      <T x={50} y={11} size={3} color={MUTED} o={enter(t, LINE.viaL)}>
        板子的侧面
      </T>
      <Svg>
        <rect x={10} y={TOPY - 1} width={80} height={BOTY - TOPY + 2} fill="var(--muted-foreground)" fillOpacity={0.12} stroke="none" opacity={enter(t, LINE.viaL)} />
        <Draw d={`M10 ${TOPY} H${VX}`} p={top} stroke={COPPER} strokeWidth={1.1} />
        <Draw d={`M${VX} ${TOPY} V${BOTY}`} p={v} stroke={COPPER} strokeWidth={1.1} />
        <Draw d={`M${VX} ${BOTY} H90`} p={bot} stroke={COPPER} strokeWidth={1.1} />
        <rect x={VX - 2} y={TOPY - 1.6} width={4} height={BOTY - TOPY + 3.2} rx={0.5} stroke={COPPER} strokeWidth={0.25} strokeDasharray="0.7 0.7" opacity={v} />
        {dots}
      </Svg>
      <T x={26} y={TOPY - 5} size={3.4} weight={600} color={COPPER} o={enter(t, b.trace)} dy={still ? 0 : (1 - enter(t, b.trace, 0.5)) * 1}>
        走线
      </T>
      <T x={VX + 4.5} y={30} size={3.4} weight={600} anchor="start" o={enter(t, b.via)} dy={still ? 0 : (1 - enter(t, b.via, 0.5)) * 1}>
        过孔
      </T>
      <T x={VX + 4.5} y={34.2} size={2.2} anchor="start" color={MUTED} o={enter(t, b.via + 0.4)}>
        孔壁镀铜，连通上下层
      </T>
      <T x={72} y={BOTY + 4.5} size={2.4} color={COPPER} o={bot}>
        另一层的走线
      </T>
      <T x={26} y={46} size={2.4} color={MUTED} o={enter(t, b.trace + 0.5)}>
        同一层，用走线
      </T>
    </>
  )
}

// ── packages ────────────────────────────────────────────────────────────────

function Packages({ t, b, still }: StageProps) {
  const U = 12 // stage units per mm
  const items: [string, number, number, string, string, number, string][] = [
    ["0402", 1.0, 0.5, "1.0 × 0.5 mm", "手焊难", b.p0402, POWER],
    ["0603", 1.6, 0.8, "1.6 × 0.8 mm", "手焊适中", b.p0603, VOLT],
    ["0805", 2.0, 1.25, "2.0 × 1.25 mm", "手焊容易", b.p0805, GOOD],
  ]
  return (
    <>
      <T x={50} y={12} size={3} color={MUTED} o={enter(t, b.pkg)}>
        封装：元件的外形和焊盘
      </T>
      {items.map(([name, w, h, dim, hint, at, c], i) => {
        const cx = 20 + i * 30
        const o = 0.25 + 0.75 * enter(t, at - 0.1, 0.5)
        const lab = enter(t, at - 0.1, 0.5)
        const bw = w * U
        const bh = h * U
        return (
          <React.Fragment key={name}>
            <Svg>
              <g opacity={o} transform={`translate(0 ${still ? 0 : (1 - o) * 1.2})`}>
                <rect x={cx - bw / 2} y={26 - bh / 2} width={bw} height={bh} rx={0.5} fill="var(--muted-foreground)" fillOpacity={0.22} stroke="none" />
                <rect x={cx - bw / 2 - 0.6} y={26 - bh / 2} width={bw * 0.22} height={bh} fill={COPPER} stroke="none" />
                <rect x={cx + bw / 2 - bw * 0.22 + 0.6} y={26 - bh / 2} width={bw * 0.22} height={bh} fill={COPPER} stroke="none" />
              </g>
            </Svg>
            <T x={cx} y={39} size={4.4} weight={600} o={lab} className="tabular">
              <M>{name}</M>
            </T>
            <T x={cx} y={44.5} size={2.3} color={MUTED} o={enter(t, at + 0.15)} className="tabular">
              {dim}
            </T>
            <T x={cx} y={49} size={2.4} weight={600} color={c} o={enter(t, at + 0.3)}>
              {hint}
            </T>
          </React.Fragment>
        )
      })}
    </>
  )
}

// ── mil ──────────────────────────────────────────────────────────────────────

function Mil({ t, b }: Pick<StageProps, "t" | "b">) {
  const pins = [10, 30, 50, 70, 90]
  const dim = enter(t, b.mil - 0.2, 0.8)
  return (
    <>
      <T x={50} y={13} size={3} color={MUTED} o={enter(t, LINE.milL + 0.2)}>
        <M>1 mil = 0.0254 mm</M>
      </T>
      <Svg>
        <Box x={4} y={22} w={92} h={12} o={enter(t, LINE.milL + 0.4)} />
        {pins.map((x, i) => (
          <circle key={x} cx={x} cy={28} r={2.4} fill={COPPER} fillOpacity={0.3} stroke={COPPER} opacity={enter(t, LINE.milL + 0.5 + i * 0.12)} />
        ))}
        <g opacity={dim} strokeWidth={0.25}>
          <path d="M30 40 H50 M30 38 V42 M50 38 V42" />
          <path d="M30 34 V40 M50 34 V40" strokeDasharray="0.6 0.6" />
        </g>
      </Svg>
      <T x={40} y={45.5} size={4.4} weight={600} o={dim} className="tabular" anchor="end">
        <M>100 mil</M>
      </T>
      <T x={42} y={45.5} size={4.4} weight={600} o={enter(t, b.mm - 0.1)} className="tabular" anchor="start">
        <M>= 2.54 mm</M>
      </T>
      <T x={50} y={18} size={2.4} color={MUTED} o={enter(t, LINE.milL + 0.8)}>
        排针
      </T>
    </>
  )
}

// ── trace width ─────────────────────────────────────────────────────────────

/** IPC-2221 width in mm for I amps, 10 °C rise, 1 oz. k = 0.048 outer, 0.024 inner. */
export function ipcWidth(I: number, k = 0.048) {
  const a = (I / (k * 10 ** 0.44)) ** (1 / 0.725)
  return (a / 1.378) * 0.0254
}

function Strip({ x0, x1, y, w, p, c = COPPER, flow, phase = 0 }: { x0: number; x1: number; y: number; w: number; p: number; c?: string; flow?: number; phase?: number }) {
  if (p <= 0.01) return null
  const x = lerp(x0, x1, p)
  const dots: React.ReactNode[] = []
  if (flow) for (let i = 0; i < 8; i++) {
    const dx = ((i * 5.5 + phase) % 44) + x0
    if (dx < x) dots.push(<circle key={i} cx={dx} cy={y} r={0.5} fill={AMP} stroke="none" />)
  }
  return (
    <g>
      <rect x={x0} y={y - w / 2} width={x - x0} height={w} fill={c} fillOpacity={0.75} stroke="none" />
      {dots}
    </g>
  )
}

function Width({ t, b, still }: StageProps) {
  const U = 12
  const rows: [number, number, number, string][] = [
    [0.5, 21, b.mm03 + 0.3, "0.5 A"],
    [1, 32, b.amp, "1 A"],
    [2, 43, b.mm03 + 0.55, "2 A"],
  ]
  const phase = still ? 0 : t * 12
  return (
    <>
      <T x={50} y={glideY(t, b.amp - 0.3)} size={glideS(t, b.amp - 0.3)} weight={600} color={t < b.amp ? undefined : MUTED} o={enter(t, b.width)}>
        线该画多宽？
      </T>
      {rows.map(([I, y, at, label]) => {
        const w = ipcWidth(I) * U
        return (
          <React.Fragment key={label}>
            <T x={10} y={y} size={3.2} weight={600} anchor="start" color={AMP} o={Math.max(enter(t, at), 0.35 * enter(t, b.amp - 0.1))} className="tabular">
              {label}
            </T>
            <Svg>
              <path d={`M28 ${y} H70`} stroke="var(--border)" strokeDasharray="0.8 1" strokeWidth={0.25} opacity={enter(t, b.amp - 0.1)} />
              <Strip x0={28} x1={70} y={y} w={w} p={enter(t, at, 0.7)} flow={1} phase={phase} />
            </Svg>
            <T x={74} y={y} size={I === 1 ? 3.2 : 2.6} anchor="start" weight={I === 1 ? 600 : 400} color={I === 1 ? undefined : MUTED} o={enter(t, I === 1 ? b.mm03 : at + 0.4)} className="tabular">
              {`${ipcWidth(I).toFixed(2)} mm`}
            </T>
          </React.Fragment>
        )
      })}
      <T x={50} y={glide(t, b.amp - 0.3, 33, 51, 0.6)} size={2.4} color={MUTED} o={enter(t, b.width + 0.6)}>
        外层，1 oz 铜，温升 10°C
      </T>
    </>
  )
}
const glideY = (t: number, at: number) => lerp(24, 11, easeInOut((t - at) / 0.6))
const glideS = (t: number, at: number) => lerp(5.2, 2.8, easeInOut((t - at) / 0.6))

// ── inner layer ──────────────────────────────────────────────────────────────

function Inner({ t, b, still }: StageProps) {
  const U = 12
  const phase = still ? 0 : t * 12
  const heat = enter(t, b.hot, 0.5)
  return (
    <>
      <T x={50} y={12} size={3} color={MUTED} o={enter(t, b.inner + 0.2)} className="tabular">
        同样 1 A
      </T>
      <T x={10} y={25} size={3} weight={600} anchor="start" o={enter(t, b.inner + 0.2)}>
        外层
      </T>
      <Svg>
        <Strip x0={28} x1={70} y={25} w={ipcWidth(1) * U} p={enter(t, b.inner + 0.2, 0.7)} flow={1} phase={phase} />
        <Box x={24} y={31} w={48} h={17} o={enter(t, b.inner + 0.5)} color="var(--muted-foreground)" fill={0.1} dash="1 0.8" sw={0.2} />
        <Strip x0={28} x1={70} y={40} w={ipcWidth(1, 0.024) * U} p={enter(t, b.inner + 0.7, 0.8)} flow={1} phase={phase} />
        {[36, 50, 64].map((x, i) => {
          const wob = still ? 0 : Math.sin(t * 3 + i) * 0.4
          return <path key={x} d={`M${x} 35 q1.2 -1.2 0 -2.4 q-1.2 -1.2 ${wob} -2.4`} stroke={POWER} opacity={heat * 0.9} strokeWidth={0.3} transform="translate(0 -1)" />
        })}
      </Svg>
      <T x={75} y={25} size={3.2} weight={600} anchor="start" o={enter(t, b.inner + 0.2)} className="tabular">
        {`${ipcWidth(1).toFixed(2)} mm`}
      </T>
      <T x={10} y={40} size={3} weight={600} anchor="start" o={enter(t, b.inner + 0.6)}>
        内层
      </T>
      <T x={75} y={40} size={3.2} weight={600} anchor="start" color={POWER} o={enter(t, b.mm078)} className="tabular">
        {`${ipcWidth(1, 0.024).toFixed(2)} mm`}
      </T>
      <T x={48} y={50.6} size={2.4} color={POWER} o={heat}>
        被板材包着，散热差
      </T>
    </>
  )
}

// ── files for the factory ───────────────────────────────────────────────────

function Files({ t, b }: Pick<StageProps, "t" | "b">) {
  const cards: [string, number][] = [
    ["顶层铜", b.files],
    ["阻焊", b.files + 0.4],
    ["丝印", b.files + 0.8],
    ["底层铜", b.files + 1.2],
  ]
  const drill = enter(t, b.drill - 0.1, 0.5)
  const arrow = enter(t, b.files + 1.6, 0.6)
  const fac = enter(t, LINE.filesL + 0.4, 0.7)
  const holes = enter(t, b.drill, 0.4)
  return (
    <>
      <T x={21} y={12} size={2.6} color={MUTED} o={enter(t, b.files)}>
        每一层一个文件
      </T>
      <Svg>
        {cards.map(([, at], i) => (
          <Box key={at} x={8} y={16 + i * 7} w={26} h={5.4} o={enter(t, at, 0.4)} />
        ))}
        <Box x={8} y={46} w={26} h={5.4} o={drill} color={AMP} />
        <path d="M38 33 H54 M51 30.5 L54 33 L51 35.5" opacity={arrow} />
        <g opacity={fac}>
          <Box x={58} y={20} w={34} h={26} />
          <path d="M62 28 H78 V38 H88" stroke={COPPER} strokeWidth={0.5} />
          {[[66, 36], [74, 25], [84, 30]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={1.1} fill="var(--background)" stroke={AMP} opacity={holes} />
          ))}
        </g>
      </Svg>
      {cards.map(([s, at], i) => (
        <T key={s} x={21} y={18.7 + i * 7} size={2.5} o={enter(t, at + 0.1)}>
          {s}
        </T>
      ))}
      <T x={21} y={48.7} size={2.5} color={AMP} o={drill}>
        钻孔文件
      </T>
      <T x={75} y={16} size={2.6} color={MUTED} o={fac}>
        交给工厂
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "PCB 基础",
  audio,
  timing,
  poster: 3.8,
  Stage,
}

export default function PcbBasicsFilm() {
  return <FilmPlayer film={film} />
}

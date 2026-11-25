import * as React from "react"
import { Capacitor, Inductor } from "@/lab/schematic"
import { trace } from "@/lab/colors"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, Scene, Svg, Sym, T, V, easeInOut, enter, glide, lerp, span, type FilmDef, type StageProps } from "../../kit"
import { AMP, BatteryV, FG, LINE, LoopFlow, MUTED, POWER, VOLT, integ, zig } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

const FIELD = trace.fourth

/*
 * 电感器, ~68 s. Scenes, each keyed to the words that introduce it:
 *   title → capacitor keeps its voltage, inductor keeps its current
 *   → a coil with a field growing around it → "想变大，顶着；想变小，推着"
 *   → I(t) and V(t) plotted together: V is the slope of I
 *   → closing a switch: the current climbs, τ = L / R
 *   → opening it: 350 V spike; with the freewheel diode: 12.7 V and a slow decay
 *   → three kinds of inductor → the mirror table with the capacitor → "try it below".
 */
function Stage({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.6) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)
  const lift = (at: number) => (still ? 0 : -easeInOut((t - at) / 0.45) * 2)

  const title = span(t, 0.25, b.coil - 0.15, 0.4, 0.3)
  const coil = span(t, b.coil - 0.3, b.inertia - 0.15, 0.3, 0.3)
  const inertia = span(t, b.inertia - 0.3, b.volt - 0.15, 0.3, 0.3)
  const volt = span(t, b.volt - 0.3, b.rise - 0.15, 0.3, 0.3)
  const climb = span(t, b.rise - 0.3, b.off - 0.15, 0.3, 0.3)
  const kick = span(t, b.off - 0.3, b.types - 0.15, 0.3, 0.3)
  const types = span(t, b.types - 0.3, b.mirror - 0.15, 0.3, 0.3)
  // the mirror table holds a beat longer: its last cell (电流) lands just before the outro line
  const mirror = span(t, b.mirror - 0.3, b.outro - 0.1, 0.3, 0.3)
  const outro = enter(t, b.outro + 0.1, 0.4)

  return (
    <>
      <Scene o={title} dy={lift(b.coil - 0.45)}>
        <Title t={t} b={b} rise={rise} />
      </Scene>
      <Scene o={coil}>
        <Coil t={t} b={b} still={still} />
      </Scene>
      <Scene o={inertia}>
        <Inertia t={t} b={b} rise={rise} />
      </Scene>
      <Scene o={volt}>
        <Slope t={t} b={b} />
      </Scene>
      <Scene o={climb}>
        <Climb t={t} b={b} still={still} rise={rise} />
      </Scene>
      <Scene o={kick}>
        <Kick t={t} b={b} still={still} />
      </Scene>
      <Scene o={types}>
        <Kinds t={t} b={b} rise={rise} />
      </Scene>
      <Scene o={mirror}>
        <Mirror t={t} b={b} rise={rise} />
      </Scene>
      <Scene o={outro}>
        <T x={50} y={24} size={6} weight={600} dy={rise(b.outro + 0.1)}>
          动手试试
        </T>
        <T x={50} y={32.5} size={2.8} color={MUTED} o={enter(t, b.open)} dy={rise(b.open, 1)}>
          断开开关，对比有没有续流二极管
        </T>
        <Svg>
          <g opacity={enter(t, b.open + 0.3)} transform={`translate(0 ${still ? 0 : Math.sin(t * 3.2) * 0.6})`} strokeWidth={0.45}>
            <path d="M50 38 V45 M47.6 42.6 L50 45 L52.4 42.6" />
          </g>
        </Svg>
      </Scene>
    </>
  )
}

type Rise = (at: number, d?: number) => number

// ── title ────────────────────────────────────────────────────────────────────

function Title({ t, b, rise }: { t: number; b: Record<string, number>; rise: Rise }) {
  const l = enter(t, b.cap - 0.1, 0.5)
  const r = enter(t, b.ind - 0.1, 0.5)
  return (
    <>
      <T x={50} y={10} size={7.6} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
        电感器
      </T>
      <Svg>
        <g opacity={l}>
          <Sym x={27} y={26} scale={0.45}>
            <Capacitor x={0} y={0} />
          </Sym>
        </g>
        <g opacity={r}>
          <Sym x={73} y={26} scale={0.45}>
            <Inductor x={0} y={0} />
          </Sym>
        </g>
      </Svg>
      <T x={27} y={37} size={3} weight={600} o={l}>
        电容
      </T>
      <T x={27} y={43} size={2.6} color={VOLT} o={enter(t, b.cap + 0.7, 0.5)}>
        不让电压突变
      </T>
      <T x={73} y={37} size={3} weight={600} o={r}>
        电感
      </T>
      <T x={73} y={43} size={2.6} color={AMP} o={enter(t, b.cur - 0.1, 0.5)}>
        不让电流突变
      </T>
    </>
  )
}

// ── a coil and its field ─────────────────────────────────────────────────────

function Coil({ t, b, still }: StageProps) {
  const wire = enter(t, b.coil - 0.2, 0.6)
  const coilO = enter(t, b.coil + 0.1, 0.6)
  const field = enter(t, b.field - 0.2, 1.2)
  const dots = enter(t, b.coilw + 0.4, 0.5)
  const phase = still ? 0 : t * 7
  const cy = 24
  const arcs = [0, 1, 2].map((k) => ({ rx: 17 + k * 6, ry: 7 + k * 4.5 }))
  return (
    <>
      <Svg>
        <Draw d={`M6 ${cy} H27.5 M72.5 ${cy} H94`} p={wire} />
        <g opacity={coilO}>
          <Sym x={50} y={cy} scale={0.75}>
            <Inductor x={0} y={0} />
          </Sym>
        </g>
        {dots > 0.01 &&
          Array.from({ length: 11 }, (_, i) => {
            const x = 6 + ((i * 8.2 + phase) % 88)
            if (x > 26 && x < 74) return null
            return <circle key={i} cx={x} cy={cy} r={0.6} fill={AMP} stroke="none" opacity={dots} />
          })}
        {arcs.map((a, k) => {
          const p = easeInOut(field * 1.4 - k * 0.3)
          return (
            <g key={k} stroke={FIELD} strokeWidth={0.32} opacity={0.95 - k * 0.15}>
              <Draw d={`M${50 - a.rx} ${cy - 2} C${50 - a.rx} ${cy - a.ry * 1.5} ${50 + a.rx} ${cy - a.ry * 1.5} ${50 + a.rx} ${cy - 2}`} p={p} strokeDasharray="1.2 0.8" />
              <Draw d={`M${50 - a.rx} ${cy + 2} C${50 - a.rx} ${cy + a.ry * 1.5} ${50 + a.rx} ${cy + a.ry * 1.5} ${50 + a.rx} ${cy + 2}`} p={p} strokeDasharray="1.2 0.8" />
            </g>
          )
        })}
      </Svg>
      <T x={26} y={45} size={3} weight={600} o={enter(t, b.coilw, 0.5)}>
        绕成线圈
      </T>
      <T x={50} y={45} size={3} weight={600} color={FIELD} o={enter(t, b.field, 0.5)}>
        建起磁场
      </T>
      <T x={74} y={45} size={3} weight={600} color={VOLT} o={enter(t, b.energy, 0.5)}>
        存下能量
      </T>
    </>
  )
}

// ── inertia: pushing back, pushing on ────────────────────────────────────────

function Inertia({ t, b, rise }: { t: number; b: Record<string, number>; rise: Rise }) {
  const head = enter(t, b.inertia, 0.5)
  const stuck = enter(t, b.stuck + 0.3, 0.5)
  const up = enter(t, b.up - 0.2, 0.5)
  const down = enter(t, b.down - 0.2, 0.5)
  const arrow = (x0: number, x1: number, y: number) => `M${x0} ${y} H${x1} M${x1 + (x1 > x0 ? -1.6 : 1.6)} ${y - 1.3} L${x1} ${y} L${x1 + (x1 > x0 ? -1.6 : 1.6)} ${y + 1.3}`
  return (
    <>
      <T x={50} y={9} size={3.6} weight={600} o={head} dy={rise(b.inertia - 0.1, 1)}>
        磁场不肯立刻变
      </T>
      <Svg>
        <g opacity={stuck}>
          <Sym x={26} y={27} scale={0.4}>
            <Inductor x={0} y={0} />
          </Sym>
          <Sym x={74} y={27} scale={0.4}>
            <Inductor x={0} y={0} />
          </Sym>
        </g>
        {/* want more: the coil pushes back */}
        <g opacity={up}>
          <path d={arrow(12, glide(t, b.up, 18, 38, 0.8), 19.5)} stroke={AMP} strokeWidth={0.6} />
          <path d={arrow(40, 14, 36)} stroke={VOLT} strokeWidth={0.6} />
        </g>
        {/* want less: the coil pushes on */}
        <g opacity={down}>
          <path d={arrow(62, glide(t, b.down, 86, 74, 0.8), 19.5)} stroke={AMP} strokeWidth={0.6} />
          <path d={arrow(62, 88, 36)} stroke={VOLT} strokeWidth={0.6} />
        </g>
      </Svg>
      <T x={26} y={14.5} size={2.6} color={AMP} o={up}>
        电流想变大
      </T>
      <T x={26} y={42} size={2.8} weight={600} color={VOLT} o={enter(t, b.up + 0.3, 0.5)}>
        线圈顶着它
      </T>
      <T x={74} y={14.5} size={2.6} color={AMP} o={down}>
        电流想变小
      </T>
      <T x={74} y={42} size={2.8} weight={600} color={VOLT} o={enter(t, b.down + 0.3, 0.5)}>
        线圈推着它
      </T>
    </>
  )
}

// ── the voltage is the slope of the current ──────────────────────────────────

/** Current over a short episode: flat, a gentle climb, a steep climb, flat, a fall, flat. */
const KNOTS: [number, number][] = [
  [0, 0.2],
  [0.15, 0.2],
  [0.4, 0.4],
  [0.5, 0.8],
  [0.65, 0.8],
  [0.82, 0.3],
  [1, 0.3],
]
const SX0 = 14
const SX1 = 86

function Slope({ t, b }: Pick<StageProps, "t" | "b">) {
  const t0 = b.volt + 0.2
  const p = Math.max(0, Math.min(1, (t - t0) / 5.4))
  const axes = enter(t, b.volt - 0.1, 0.6)
  const x = (u: number) => SX0 + u * (SX1 - SX0)
  const yI = (v: number) => 24 - v * 16
  const yV = (s: number) => 38 - s * 2.4
  const iPts: string[] = []
  const vPts: string[] = []
  KNOTS.forEach(([u, v], k) => {
    if (u > p && k > 0) {
      const [u0, v0] = KNOTS[k - 1]
      if (p > u0) {
        const vv = lerp(v0, v, (p - u0) / (u - u0))
        iPts.push(`L${x(p)} ${yI(vv)}`)
      }
      return
    }
    iPts.push(`${k === 0 ? "M" : "L"}${x(u)} ${yI(v)}`)
  })
  // the voltage: the slope of each piece, drawn as steps
  let started = false
  for (let k = 1; k < KNOTS.length; k++) {
    const [u0, v0] = KNOTS[k - 1]
    const [u1, v1] = KNOTS[k]
    if (p <= u0) break
    const s = (v1 - v0) / (u1 - u0)
    const e = Math.min(p, u1)
    vPts.push(`${started ? "L" : "M"}${x(u0)} ${yV(s)} L${x(e)} ${yV(s)}`)
    started = true
  }
  const tip = Math.min(p, 1)
  const slopeNow = (() => {
    for (let k = 1; k < KNOTS.length; k++) if (tip <= KNOTS[k][0]) return (KNOTS[k][1] - KNOTS[k - 1][1]) / (KNOTS[k][0] - KNOTS[k - 1][0])
    return 0
  })()
  const steep = enter(t, b.rate, 0.5)
  const flat = enter(t, b.zero, 0.5)
  return (
    <>
      <Svg>
        <Draw d={`M${SX0} 24 H${SX1 + 2}`} p={axes} />
        <Draw d={`M${SX0} 24.8 V6`} p={axes} />
        <Draw d={`M${SX0} 38 H${SX1 + 2}`} p={axes} />
        <Draw d={`M${SX0} 49 V27`} p={axes} />
        {iPts.length > 1 && <path d={iPts.join(" ")} stroke={AMP} strokeWidth={0.55} />}
        {vPts.length > 0 && <path d={vPts.join(" ")} stroke={VOLT} strokeWidth={0.55} />}
        {p > 0.01 && p < 1 && <circle cx={x(tip)} cy={yV(slopeNow)} r={0.7} fill={VOLT} stroke="none" />}
        {/* the steep stretch, and the flat one */}
        <g opacity={steep} stroke={VOLT} strokeWidth={0.3} strokeDasharray="0.9 0.8">
          <rect x={x(0.4)} y={6} width={x(0.5) - x(0.4)} height={43} />
        </g>
        <g opacity={flat} stroke={AMP} strokeWidth={0.3} strokeDasharray="0.9 0.8">
          <rect x={x(0.82)} y={6} width={x(1) - x(0.82)} height={43} />
        </g>
      </Svg>
      <T x={SX0 + 1.5} y={6.5} size={2.6} anchor="start" color={AMP} o={axes}>
        电流 <V c={AMP}>I</V>
      </T>
      <T x={SX0 + 1.5} y={29} size={2.6} anchor="start" color={VOLT} o={enter(t, b.lv, 0.5)}>
        线圈两端的电压 <V c={VOLT}>V</V>
      </T>
      <T x={x(0.45)} y={51} size={2.6} weight={600} color={VOLT} o={steep}>
        变得快：电压高
      </T>
      <T x={x(0.91)} y={51} size={2.6} weight={600} color={AMP} o={flat}>
        不变：电压为 0
      </T>
    </>
  )
}

// ── switching on ─────────────────────────────────────────────────────────────

const GX0 = 60
const GX1 = 94
const GY0 = 40
const GY1 = 14
const TAU_W = 6.1

/** A switch on a horizontal wire from (x0, y) to (x1, y); closed = 1 lays the blade on the far contact. */
function SwitchH({ x0, x1, y, closed, o = 1 }: { x0: number; x1: number; y: number; closed: number; o?: number }) {
  return (
    <g opacity={o}>
      <circle cx={x0} cy={y} r={0.6} fill="var(--background)" />
      <circle cx={x1} cy={y} r={0.6} fill="var(--background)" />
      <path d={`M${x0} ${y} L${lerp(x1 - 1, x1, closed)} ${lerp(y - 4.2, y, closed)}`} />
    </g>
  )
}

function Climb({ t, b, still, rise }: { t: number; b: Record<string, number>; still: boolean; rise: Rise }) {
  const ts = b.rise + 0.4
  const closed = enter(t, ts - 0.2, 0.25)
  const t0 = ts + 0.1
  const dur = 4.2
  const uAt = (s: number) => Math.max(0, Math.min(5.2, ((s - t0) / dur) * 5.2))
  const i = (s: number) => 1 - Math.exp(-uAt(s))
  const u = uAt(t)
  const phase = still ? 0 : integ((s) => 11 * i(s), t0, Math.max(t, t0))
  const circuit = enter(t, b.rise - 0.1, 0.6)
  const axes = enter(t, b.rise, 0.6)
  const yv = (v: number) => GY0 + (GY1 - GY0) * v
  const xu = (uu: number) => GX0 + uu * TAU_W
  const pts: string[] = []
  const steps = Math.max(1, Math.floor(u * 12))
  for (let k = 0; k <= steps; k++) {
    const uu = (u * k) / steps
    pts.push(`${k === 0 ? "M" : "L"}${xu(uu).toFixed(2)} ${yv(1 - Math.exp(-uu)).toFixed(2)}`)
  }
  const m = enter(t, b.lr, 0.5)
  return (
    <>
      <Svg>
        <Draw d="M8 14 H12 M19.5 14 H20 M20 14 H34 V19 M34 33 V38 H8 V27.2 M8 24.8 V14" p={circuit} />
        <SwitchH x0={12} x1={19.5} y={14} closed={closed} o={circuit} />
        <g opacity={circuit}>
          <path d="M20 14 a2 2 0 0 1 4 0 a2 2 0 0 1 4 0 a2 2 0 0 1 4 0" />
        </g>
        <Draw d={zig(34, 19, 34, 33, 5, 1.6, 0.15)} p={circuit} />
        <BatteryV x={8} y={26} o={circuit} />
        <LoopFlow x0={8} y0={14} x1={34} y1={38} phase={phase} spacing={3.2} o={circuit * closed * (still ? 0 : 1)} skip={(x, y) => (y === 14 && x > 11 && x < 33) || (x === 34 && y > 18 && y < 34) || (x === 8 && y > 23.8 && y < 28.2)} />

        <Draw d={`M${GX0} ${GY0} H${GX1 + 1.5}`} p={axes} />
        <Draw d={`M${GX0} ${GY0 + 1} V${GY1 - 3}`} p={axes} />
        <path d={`M${GX0} ${yv(1)} H${GX1}`} stroke={AMP} strokeWidth={0.22} strokeDasharray="0.9 0.8" opacity={axes} />
        {u > 0.01 && <path d={pts.join(" ")} stroke={AMP} strokeWidth={0.5} />}
        {u > 0.01 && <circle cx={xu(u)} cy={yv(1 - Math.exp(-u))} r={0.75} fill={AMP} stroke="none" />}
        <g opacity={m} stroke={MUTED} strokeWidth={0.22} strokeDasharray="0.8 0.8">
          <path d={`M${xu(1)} ${GY0} V${yv(1 - Math.exp(-1))}`} />
        </g>
        <circle cx={xu(1)} cy={yv(1 - Math.exp(-1))} r={0.9} fill={AMP} stroke="none" opacity={m} />
      </Svg>
      <T x={26} y={9.8} size={2.6} o={circuit}>
        <V>L</V>
      </T>
      <T x={42} y={26} size={2.6} anchor="start" o={circuit}>
        <V>R</V>
      </T>
      <T x={16} y={31.5} size={2.6} anchor="start" color={VOLT} o={circuit}>
        电源
      </T>
      <T x={GX0 - 2} y={yv(1)} size={2.2} anchor="end" color={AMP} o={axes}>
        <V c={AMP}>V</V> ÷ <V>R</V>
      </T>
      <T x={GX0} y={GY1 - 5} size={2.4} color={MUTED} o={axes}>
        线圈的电流
      </T>
      <T x={GX1 + 2} y={GY0 - 2.4} size={2.2} anchor="end" color={MUTED} o={axes}>
        时间
      </T>
      <T x={xu(1)} y={GY0 + 3} size={2.2} color={MUTED} o={m}>
        1τ
      </T>
      <T x={21} y={44.5} size={5} o={enter(t, b.lr - 0.2, 0.5)} dy={rise(b.lr - 0.2, 1)}>
        <span className="inline-flex items-center gap-[0.3em]">
          <V>τ</V>
          <span>=</span>
          <span className="inline-flex flex-col items-center align-middle" style={{ gap: "0.12em" }}>
            <V>L</V>
            <span className="h-[0.06em] w-full rounded-full bg-current" />
            <V>R</V>
          </span>
        </span>
      </T>
    </>
  )
}

// ── switching off, without and with the diode ────────────────────────────────

function Kick({ t, b, still }: StageProps) {
  const off1 = b.offw
  const on2 = b.diode + 0.3
  const off2 = b.loop
  /** Current in the supply loop, 0–1. */
  const main = (s: number) => (s < off1 ? 1 : s < off1 + 0.2 ? 1 - (s - off1) / 0.2 : s < on2 ? 0 : s < on2 + 0.4 ? (s - on2) / 0.4 : s < off2 ? 1 : s < off2 + 0.2 ? 1 - (s - off2) / 0.2 : 0)
  /** Current circling through coil and diode once the second break comes. */
  const free = (s: number) => (s < off2 ? 0 : Math.exp(-(s - off2) / 1.3))
  const coilI = (s: number) => Math.max(main(s), free(s))
  const closed = t < off1 ? 1 : t < off1 + 0.15 ? 1 - (t - off1) / 0.15 : t < on2 ? 0 : t < on2 + 0.15 ? (t - on2) / 0.15 : t < off2 ? 1 : t < off2 + 0.15 ? 1 - (t - off2) / 0.15 : 0
  const volts = t < off1 ? 0 : t < off1 + 0.2 ? glide(t, off1, 0, 350, 0.2) : t < on2 ? 350 : t < off2 ? 0 : 12.7
  const spark = (t >= off1 && t < on2 ? 1 : 0) * enter(t, off1, 0.1)
  const diode = enter(t, b.diode + 0.3, 0.6)
  const phase1 = still ? 0 : integ((s) => 11 * main(s), 0, t)
  const phase2 = still ? 0 : integ((s) => 11 * free(s), off2, Math.max(t, off2))
  const readI = coilI(t) * 100
  const o = enter(t, b.offw - 0.4, 0.6)
  const spikeLbl = span(t, b.nopath + 0.3, on2 - 0.2, 0.4, 0.3)
  const barW = (volts / 350) * 34
  return (
    <>
      <Svg>
        <Draw d="M8 14 H12 M20 14 H34 M34 14 V19 M34 33 V38 M8 38 H34 M8 24.8 V14 M8 27.2 V38" p={o} />
        {/* the branch for the diode only appears with it */}
        <path d="M34 14 H46 V24.6 M46 29.5 V38 H34" opacity={diode} />
        <SwitchH x0={12} x1={20} y={14} closed={closed} o={o} />
        <g opacity={o}>
          <path d="M34 19 a2 2 0 0 1 0 4 a2 2 0 0 1 0 4 a2 2 0 0 1 0 4" />
        </g>
        <BatteryV x={8} y={26} o={o} />
        {/* the freewheel diode, anode at the bottom, across the coil */}
        <g opacity={diode}>
          <path d="M43.8 29.5 H48.2 L46 25 Z M43.8 24.6 H48.2" />
        </g>
        <LoopFlow x0={8} y0={14} x1={34} y1={38} phase={phase1} spacing={3.2} o={o * (still ? 0 : 1) * Math.min(1, main(t) * 3)} skip={(x, y) => (y === 14 && x > 11 && x < 21) || (x === 34 && y > 18 && y < 34) || (x === 8 && y > 23.8 && y < 28.2)} />
        <LoopFlow x0={34} y0={14} x1={46} y1={38} phase={-phase2} spacing={3.2} o={o * (still ? 0 : 1) * Math.min(1, free(t) * 3)} skip={(x, y) => (x === 34 && y > 18 && y < 34) || (x === 46 && y > 23.5 && y < 30)} />
        {/* the spark at the contacts */}
        <g opacity={spark} stroke={POWER} strokeWidth={0.4}>
          <path d={`M20 12 l1.4 -2.2 l-1.2 0.4 l1.6 -2.4 M18.6 11.2 l-1.8 -1.6 M21.2 12.6 l2.2 -0.4`} />
        </g>
        {/* the voltage across the switch, to scale */}
        <path d={`M59 24 H93`} stroke={LINE} strokeWidth={0.25} opacity={o} />
        {barW > 0.05 && <rect x={59} y={22.6} width={Math.max(barW, 0.6)} height={2.8} rx={0.6} fill={volts > 100 ? POWER : VOLT} stroke="none" />}
      </Svg>
      <T x={30} y={26} size={2.4} anchor="end" o={o}>
        <V>L</V>
      </T>
      <T x={16} y={31} size={2.4} anchor="start" color={VOLT} o={o} className="tabular">
        12 V
      </T>
      <T x={46} y={42.5} size={2.6} weight={600} color={AMP} o={enter(t, b.dio - 0.1, 0.5)}>
        续流二极管
      </T>

      <T x={59} y={14} size={2.5} anchor="start" color={MUTED} o={o}>
        开关上的尖峰
      </T>
      <T x={92} y={14} size={4.8} anchor="end" weight={600} color={volts > 100 ? POWER : VOLT} o={o} className="tabular">
        {volts >= 100 ? Math.round(volts) : volts.toFixed(volts === 0 ? 0 : 1)} V
      </T>
      <T x={59} y={30.5} size={2.5} anchor="start" color={POWER} o={spikeLbl}>
        触点拉弧，三极管会被击穿
      </T>
      <T x={59} y={30.5} size={2.5} anchor="start" color={VOLT} o={enter(t, off2, 0.5)}>
        只比电源高 0.7 V
      </T>
      <T x={59} y={38} size={2.5} anchor="start" color={MUTED} o={o}>
        线圈的电流
      </T>
      <T x={92} y={38} size={4.8} anchor="end" weight={600} color={AMP} o={o} className="tabular">
        {Math.round(readI)} mA
      </T>
      <T x={59} y={46} size={2.5} anchor="start" color={MUTED} o={enter(t, b.burn - 0.3, 0.5)}>
        电流在回路里慢慢耗掉
      </T>
    </>
  )
}

// ── three kinds ──────────────────────────────────────────────────────────────

function Kinds({ t, b, rise }: { t: number; b: Record<string, number>; rise: Rise }) {
  const a = enter(t, b.types, 0.5)
  const c = enter(t, b.types + 0.3, 0.5)
  const d = enter(t, b.types + 0.6, 0.5)
  const cols = [
    { x: 17, name: "功率电感", note: "电源里储能", at: b.pwr },
    { x: 50, name: "磁珠", note: "吸收噪声，变成热", at: b.bead },
    { x: 83, name: "变压器", note: "改变电压，电气隔离", at: b.xfmr },
  ]
  return (
    <>
      <T x={50} y={8} size={2.8} color={MUTED} o={a}>
        常见的电感
      </T>
      <Svg>
        <g opacity={a}>
          <Sym x={17} y={24} scale={0.42}>
            <Inductor x={0} y={0} core />
          </Sym>
        </g>
        <g opacity={c}>
          <path d="M37 24 H63" />
          <rect x={44} y={19.5} width={12} height={9} rx={1.2} fill="var(--muted)" stroke={FG} strokeWidth={0.4} />
          <path d="M38 17 l1.6 -2 M50 15.5 v-2.4 M62 17 l-1.6 -2" stroke={POWER} strokeWidth={0.3} opacity={enter(t, b.bead, 0.5)} />
        </g>
        <g opacity={d}>
          <path d="M80 14 V16 M80 34 V32 M86 14 V16 M86 34 V32" />
          <path d="M80 16 a2 2 0 0 1 0 4 a2 2 0 0 1 0 4 a2 2 0 0 1 0 4 M86 16 a2 2 0 0 0 0 4 a2 2 0 0 0 0 4 a2 2 0 0 0 0 4" />
          <path d="M82.2 15.5 V32.5 M83.8 15.5 V32.5" strokeWidth={0.4} />
        </g>
      </Svg>
      {cols.map((col) => (
        <React.Fragment key={col.name}>
          <T x={col.x} y={40} size={3.2} weight={600} o={enter(t, col.at - 0.1, 0.5)} dy={rise(col.at - 0.1, 1)}>
            {col.name}
          </T>
          <T x={col.x} y={46} size={2.4} color={MUTED} o={enter(t, col.at + 0.3, 0.5)}>
            {col.note}
          </T>
        </React.Fragment>
      ))}
    </>
  )
}

// ── mirror table ─────────────────────────────────────────────────────────────

function Mirror({ t, b, rise }: { t: number; b: Record<string, number>; rise: Rise }) {
  const head = enter(t, b.mirror - 0.1, 0.5)
  const m = enter(t, b.mir, 0.5)
  const rows = [
    { y: 28, label: "不能突变的量", l: <span style={{ color: VOLT }}>电压</span>, r: <span style={{ color: AMP }}>电流</span>, la: b.cv, ra: b.ci },
    { y: 36.5, label: "时间常数", l: <span><V>R</V><V>C</V></span>, r: <span><V>L</V> ÷ <V>R</V></span>, la: b.mir, ra: b.mir },
    { y: 45, label: "对直流稳态", l: <span>相当于断路</span>, r: <span>相当于导线</span>, la: b.mir + 0.8, ra: b.mir + 0.8 },
  ]
  return (
    <>
      <Svg>
        <g opacity={head}>
          <Sym x={50} y={12} scale={0.3}>
            <Capacitor x={0} y={0} />
          </Sym>
          <Sym x={80} y={12} scale={0.3}>
            <Inductor x={0} y={0} />
          </Sym>
        </g>
        <path d="M8 22 H94" stroke={LINE} strokeWidth={0.25} opacity={head} />
        <path d="M65 8 V50" stroke={LINE} strokeWidth={0.25} strokeDasharray="0.8 0.8" opacity={m} />
      </Svg>
      <T x={50} y={18} size={2.8} weight={600} o={head} dy={rise(b.mirror - 0.1, 1)}>
        电容
      </T>
      <T x={80} y={18} size={2.8} weight={600} o={head} dy={rise(b.mirror - 0.1, 1)}>
        电感
      </T>
      {rows.map((r) => (
        <React.Fragment key={r.label}>
          <T x={8} y={r.y} size={2.4} anchor="start" color={MUTED} o={enter(t, Math.min(r.la, r.ra), 0.5)}>
            {r.label}
          </T>
          <T x={50} y={r.y} size={3.4} weight={600} o={enter(t, r.la, 0.5)}>
            {r.l}
          </T>
          <T x={80} y={r.y} size={3.4} weight={600} o={enter(t, r.ra, 0.5)}>
            {r.r}
          </T>
        </React.Fragment>
      ))}
    </>
  )
}

export const film: FilmDef = {
  title: "电感器",
  audio,
  timing,
  poster: 7.0,
  Stage,
}

export default function InductorsFilm() {
  return <FilmPlayer film={film} />
}

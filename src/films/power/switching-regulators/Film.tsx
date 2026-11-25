import * as React from "react"
import { trace } from "@/lab/colors"
import { FilmPlayer } from "../../FilmPlayer"
import { M, Scene, Svg, T, V, clamp01, easeInOut, enter, lerp, span, type FilmDef, type StageProps } from "../../kit"
import { AMP, LINE, MUTED, POWER, VOLT, Readout, rnd } from "../../basics/shared"
import { DiodeMark, Outro, PolyDots, StepChip, coil, vzig, type Seg } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

const GOOD = trace.good

/*
 * 开关电源, ~60 s. Scenes, each keyed to the words that introduce it:
 *   title → a heat-shimmering linear regulator beside a switch that chops
 *   → energy packets hop across a gap into a tank, one small piece per click
 *   → why it stays cool: switch closed = no voltage, switch open = no current, power = 0 either way
 *   → a square wave through an inductor and a capacitor comes out flat
 *   → the buck circuit: switch on, the inductor current rises; switch off, it falls through the diode
 *   → duty cycle: the pulse width moves the average (12 V × 42 % ≈ 5 V)
 *   → the boost circuit: 3.7 V in, 5 V out
 *   → efficiency 90 % vs a linear regulator's 42 % on the same 12 V → 5 V, and the noise → "try it below".
 */

function Stage({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.6) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)
  const lift = (at: number) => (still ? 0 : -easeInOut((t - at) / 0.45) * 2)
  const sc = (a: number, z: number) => span(t, a - 0.3, z - 0.15, 0.3, 0.3)

  const title = span(t, 0.25, b.chop - 0.15, 0.4, 0.3)
  return (
    <>
      <Scene o={title} dy={lift(b.chop - 0.45)}>
        <Title t={t} b={b} still={still} rise={rise} />
      </Scene>
      <Scene o={sc(b.chop, b.cool)}>
        <Packets t={t} b={b} still={still} />
      </Scene>
      <Scene o={sc(b.cool, b.square)}>
        <Cool t={t} b={b} still={still} />
      </Scene>
      <Scene o={sc(b.square, b.buck)}>
        <Filter t={t} b={b} still={still} />
      </Scene>
      <Scene o={sc(b.buck, b.duty)}>
        <Buck t={t} b={b} still={still} />
      </Scene>
      <Scene o={sc(b.duty, b.boost)}>
        <Duty t={t} b={b} still={still} />
      </Scene>
      <Scene o={sc(b.boost, b.eff)}>
        <Boost t={t} b={b} still={still} />
      </Scene>
      <Scene o={sc(b.eff, b.outro)}>
        <Efficiency t={t} b={b} still={still} />
      </Scene>
      <Scene o={enter(t, b.outro - 0.3, 0.4)}>
        <Outro t={t} b={b} still={still} hint="拖动下面实验台里的占空比" />
      </Scene>
    </>
  )
}

/** A switch lever: closed lies flat, open lifts by `open` (0–1). */
function Lever({ x0, x1, y, open, color }: { x0: number; x1: number; y: number; open: number; color?: string }) {
  return (
    <g stroke={color}>
      <circle cx={x0} cy={y} r={0.55} fill="var(--background)" />
      <circle cx={x1} cy={y} r={0.55} fill="var(--background)" />
      <path d={`M${x0} ${y} L${x1 - (x1 - x0) * 0.1 * open} ${y - (x1 - x0) * 0.5 * open}`} strokeWidth={0.45} />
    </g>
  )
}

// ── title ───────────────────────────────────────────────────────────────────

function Title({ t, b, still, rise }: StageProps & { rise: (at: number, d?: number) => number }) {
  const shimmer = (i: number) => (still ? 0 : Math.sin(t * 4 + i * 1.9))
  const burn = enter(t, b.burn - 0.3, 0.6)
  const neu = enter(t, b.newway - 0.3, 0.6)
  const open = still ? 0 : Math.max(0, Math.sin(t * 6)) // chops fast
  return (
    <>
      <T x={50} y={13} size={7.5} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
        开关电源
      </T>
      <Svg>
        <g opacity={burn}>
          <rect x={16} y={26} width={18} height={10} rx={1.2} strokeWidth={0.35} />
          {[0, 1, 2, 3].map((i) => (
            <path key={i} d={`M${19 + i * 4} 24 q1 -1.2 0 -2.4 t0 -2.4`} stroke={POWER} strokeWidth={0.4} opacity={0.5 + 0.5 * shimmer(i)} transform={`translate(${shimmer(i) * 0.4} 0)`} />
          ))}
        </g>
        <g opacity={neu}>
          <path d="M60 33 H66" />
          <Lever x0={66} x1={76} y={33} open={open} />
          <path d="M76 33 H88" />
          <path d="M60 28 H88" stroke={LINE} strokeWidth={0.15} opacity={0} />
        </g>
      </Svg>
      <T x={25} y={31} size={2.6} weight={600} o={burn}>
        线性稳压器
      </T>
      <T x={25} y={42} size={2.6} color={POWER} o={burn}>
        多余的电压：烧成热
      </T>
      <T x={74} y={42} size={2.6} color={GOOD} o={neu}>
        新思路：开关高速通断
      </T>
    </>
  )
}

// ── energy in small packets ─────────────────────────────────────────────────

function Packets({ t, b, still }: StageProps) {
  const T0 = b.chopw
  const per = 0.55 // one packet per click
  const open = (s: number) => ((s - T0) % per) / per // 0..1 within a click
  const clicks = Math.max(0, Math.floor((t - T0) / per))
  const fill = clamp01(1 - Math.exp(-(t - T0 - 0.8) / 4)) * enter(t, T0 + 0.8, 0.4)
  const pk: React.ReactNode[] = []
  for (let i = Math.max(0, clicks - 3); i <= clicks; i++) {
    const born = T0 + i * per + 0.12
    const p = clamp01((t - born) / 0.9)
    if (p <= 0 || p >= 1 || still) continue
    const x = lerp(30, 70, easeInOut(p))
    pk.push(<rect key={i} x={x - 1} y={29 - 1} width={2} height={2} rx={0.4} fill={VOLT} stroke="none" opacity={Math.min(1, p * 6) * Math.min(1, (1 - p) * 6)} />)
  }
  const sw = enter(t, b.chop - 0.2, 0.5)
  const phase = open(t)
  return (
    <>
      <StepChip o={enter(t, b.chop - 0.1)}>能量，一小份一小份</StepChip>
      <Svg>
        <g opacity={sw}>
          <path d="M8 29 H20" />
          <Lever x0={20} x1={30} y={29} open={t > T0 && !still ? (phase < 0.35 ? 1 : 0) : 0} />
          <path d="M30 29 H70" stroke={LINE} strokeWidth={0.15} strokeDasharray="0.6 0.6" />
          <rect x={72} y={16} width={14} height={26} rx={1} strokeWidth={0.3} />
          <rect x={72.2} y={16 + 26 * (1 - fill)} width={13.6} height={Math.max(0, 26 * fill - 0.2)} fill={VOLT} stroke="none" opacity={0.3} />
        </g>
        {pk}
      </Svg>
      <T x={25} y={38} size={2.6} color={MUTED} o={sw}>
        开关
      </T>
      <T x={79} y={46.5} size={2.6} color={MUTED} o={sw}>
        输出
      </T>
      <T x={50} y={20} size={2.6} color={MUTED} o={enter(t, b.pack - 0.2, 0.5)}>
        每次只搬一小份
      </T>
    </>
  )
}

// ── why a switch stays cool ─────────────────────────────────────────────────

function Cool({ t, b }: StageProps) {
  const colX = [26, 74]
  const showOn = enter(t, b.on - 0.3, 0.5)
  const showOff = enter(t, b.off - 0.3, 0.5)
  const zero = enter(t, b.coolw - 0.3, 0.5)
  const Col = ({ x, o, closed }: { x: number; o: number; closed: boolean }) => {
    const bw = 22
    return (
      <>
        <T x={x} y={11} size={3.2} weight={600} o={o}>
          {closed ? "开关通" : "开关断"}
        </T>
        <Svg>
          <g opacity={o}>
            <path d={`M${x - 10} 22 H${x - 6}`} />
            <Lever x0={x - 6} x1={x + 6} y={22} open={closed ? 0 : 1} />
            <path d={`M${x + 6} 22 H${x + 10}`} />
            <rect x={x - bw / 2} y={31} width={closed ? 0.8 : bw} height={3.4} fill={VOLT} stroke="none" opacity={0.7} />
            <rect x={x - bw / 2} y={39} width={closed ? bw : 0.8} height={3.4} fill={AMP} stroke="none" opacity={0.7} />
            <path d={`M${x - bw / 2} 30 V44`} strokeWidth={0.2} />
          </g>
        </Svg>
        <T x={x - bw / 2 - 1.5} y={32.7} size={2.3} anchor="end" color={VOLT} o={o}>
          电压 {closed ? "≈ 0" : "很高"}
        </T>
        <T x={x - bw / 2 - 1.5} y={40.7} size={2.3} anchor="end" color={AMP} o={o}>
          电流 {closed ? "很大" : "= 0"}
        </T>
        <T x={x} y={48.5} size={3} weight={600} color={GOOD} o={o * zero}>
          功率 ≈ 0
        </T>
      </>
    )
  }
  return (
    <>
      <Col x={colX[0]} o={showOn} closed />
      <Col x={colX[1]} o={showOff} closed={false} />
    </>
  )
}

// ── square → flat ───────────────────────────────────────────────────────────

function Filter({ t, b, still }: StageProps) {
  const off = still ? 0 : (t * 4) % 12
  const sq = enter(t, b.sq - 0.4, 0.6)
  const lc = enter(t, b.sq + 0.5, 0.5)
  const out = enter(t, b.flat - 0.2, 0.7)
  const pts: string[] = []
  for (let k = -1; k < 5; k++) {
    const xa = 6 - off + k * 12
    const xb = xa + 12
    const hi = xa + 5
    const seg = [[xa, 34], [xa, 18], [hi, 18], [hi, 34], [xb, 34]]
    seg.forEach(([x, y], i) => pts.push(`${pts.length === 0 ? "M" : i === 0 ? "L" : "L"}${Math.max(6, Math.min(30, x)).toFixed(2)} ${y}`))
  }
  return (
    <>
      <Svg>
        <clipPath id="fl-c">
          <rect x={6} y={14} width={24} height={24} />
        </clipPath>
        <g opacity={sq}>
          <path d="M6 34 H30" stroke={LINE} strokeWidth={0.15} />
          <path d={pts.join("")} stroke={VOLT} strokeWidth={0.5} clipPath="url(#fl-c)" />
          <path d="M30 26 H34" />
        </g>
        <g opacity={lc}>
          <path d="M34 26 H38" />
          <path d={coil(38, 54, 26, 4)} />
          <path d="M54 26 H62" />
          <path d="M60 26 V30 M56 30 H64 M56 32 H64 M60 32 V36" />
        </g>
        <g opacity={out}>
          <path d="M66 34 H94" stroke={LINE} strokeWidth={0.15} />
        </g>
      </Svg>
      <T x={18} y={42} size={2.8} weight={600} o={sq}>
        方波
      </T>
      <T x={46} y={19.5} size={2.6} color={MUTED} o={lc}>
        电感
      </T>
      <T x={60} y={43} size={2.6} color={MUTED} o={lc}>
        电容
      </T>
      <FlatOut t={t} o={out} />
      <T x={80} y={42} size={2.8} weight={600} o={out}>
        平稳的直流
      </T>
      <T x={80} y={21} size={2.3} color={MUTED} o={out}>
        方波的平均值
      </T>
    </>
  )
}

/** The square wave is high 5 of every 12 units, between y 34 (0) and 18: its average sits here. */
const AVG_Y = 34 - 16 * (5 / 12)

/** The smoothed output: a flat line on the average with a hair of ripple. */
function FlatOut({ t, o }: { t: number; o: number }) {
  const pts: string[] = []
  for (let x = 66; x <= 94; x += 0.7) pts.push(`${pts.length ? "L" : "M"}${x} ${(AVG_Y + 0.25 * Math.sin(x * 2.2 + t * 6)).toFixed(2)}`)
  return (
    <Svg>
      <path d={pts.join("")} stroke={VOLT} strokeWidth={0.65} opacity={o} />
    </Svg>
  )
}

// ── the buck circuit ────────────────────────────────────────────────────────

const ON_PATH: Seg[] = [
  [8, 27.8, 8, 14],
  [8, 14, 13, 14],
  [13, 14, 21, 14, true],
  [21, 14, 26, 14],
  [26, 14, 38, 14, true],
  [38, 14, 49, 14],
  [49, 14, 49, 25],
  [49, 25, 49, 35, true],
  [49, 35, 49, 44],
  [49, 44, 8, 44],
  [8, 44, 8, 30.2],
]
const OFF_PATH: Seg[] = [
  [26, 14, 38, 14, true],
  [38, 14, 49, 14],
  [49, 14, 49, 25],
  [49, 25, 49, 35, true],
  [49, 35, 49, 44],
  [49, 44, 24, 44],
  [24, 44, 24, 33],
  [24, 33, 24, 23, true],
  [24, 23, 24, 14],
  [24, 14, 26, 14],
]

function Buck({ t, b, still }: StageProps) {
  const t0 = b.ion - 0.5 // switch closes
  const t1 = b.ioff - 0.3 // opens
  const t2 = b.duty - 0.6 // closes again
  const on = (t >= t0 && t < t1) || t >= t2
  const wires = enter(t, b.buckw - 0.3, 0.7)
  const ph = still ? 0 : t * 10
  // inductor current: rises while on, falls while off
  const lo = 0.35
  const hi = 0.75
  const iL = (s: number) => (s < t0 ? lo : s < t1 ? lerp(lo, hi, (s - t0) / (t1 - t0)) : s < t2 ? lerp(hi, lo, (s - t1) / (t2 - t1)) : lo)
  const GX0 = 60
  const GX1 = 94
  const gx = (s: number) => lerp(GX0 + 2, GX1, (s - t0) / (t2 + 0.4 - t0))
  const gy = (v: number) => 44 - v * 28
  const pts: string[] = []
  for (let s = t0; s <= Math.min(t, t2 + 0.4); s += 0.08) pts.push(`${pts.length ? "L" : "M"}${gx(s).toFixed(2)} ${gy(iL(s)).toFixed(2)}`)
  const cur = iL(t)
  const grow = enter(t, b.buckw + 0.3, 0.5) // the empty plot waits beside the circuit
  const swOpen = on ? 0 : 1
  const freewheel = t >= t1 && t < t2 // the diode carries the inductor's current
  return (
    <>
      <Svg>
        <g opacity={wires}>
          {/* battery */}
          <path d="M8 27.8 V14 M8 30.2 V44 M4.6 27.8 H11.4" />
          <path d="M6.4 30.2 H9.6" strokeWidth={0.75} />
          <path d="M8 44 H49" />
          {/* top rail */}
          <path d="M8 14 H13 M21 14 H26 M38 14 H49" />
          <Lever x0={13} x1={21} y={14} open={swOpen} color={on ? AMP : undefined} />
          <path d={coil(26, 38, 14, 3)} stroke={on || !on ? AMP : undefined} strokeWidth={0.5} opacity={0.9} />
          {/* diode */}
          <path d="M24 14 V23 M24 33 V44" />
          <DiodeMark x={24} y={28} angle={-90} size={2.2} color={freewheel ? AMP : undefined} o={freewheel ? 1 : 0.45} />
          {/* capacitor and load */}
          <path d="M42 14 V27.4 M42 30.6 V44 M39.6 27.4 H44.4 M39.6 30.6 H44.4" />
          <path d={vzig(49, 25, 35)} />
          <path d="M49 14 V25 M49 35 V44" />
        </g>
        <PolyDots segs={on ? ON_PATH : OFF_PATH} phase={ph} o={wires * enter(t, t0, 0.3)} color={AMP} />
        {/* inductor current, drawn as it happens */}
        <g opacity={grow}>
          <path d={`M${GX0} 44 H${GX1 + 1} M${GX0} 44 V14`} />
          {pts.length > 1 && <path d={pts.join("")} stroke={AMP} strokeWidth={0.6} />}
          {pts.length > 0 && <circle cx={gx(Math.min(t, t2 + 0.4))} cy={gy(cur)} r={0.8} fill={AMP} stroke="none" />}
        </g>
      </Svg>
      <T x={17} y={19} size={2.3} color={MUTED} o={wires}>
        开关
      </T>
      <T x={32} y={9.5} size={2.3} color={MUTED} o={wires}>
        电感
      </T>
      <T x={28.6} y={28} size={2.3} anchor="start" color={MUTED} o={wires}>
        二极管
      </T>
      <T x={42} y={48.5} size={2.3} color={MUTED} o={wires}>
        电容
      </T>
      <T x={49} y={48.5} size={2.3} color={MUTED} o={wires}>
        负载
      </T>
      <T x={77} y={10.5} size={2.6} color={MUTED} o={grow}>
        电感电流
      </T>
      <T x={77} y={48.5} size={2.6} weight={600} color={AMP} o={span(t, b.ion - 0.3, t1 + 0.1, 0.3, 0.2)}>
        开关通：上升，储能
      </T>
      <T x={77} y={48.5} size={2.6} weight={600} color={POWER} o={span(t, t1 + 0.1, t2 + 0.3, 0.3, 0.2)}>
        开关断：下降，放能
      </T>
      <T x={27} y={4.8} size={2.5} o={enter(t, b.buckw - 0.2, 0.5)} color={MUTED}>
        降压电路
      </T>
    </>
  )
}

// ── duty cycle ──────────────────────────────────────────────────────────────

function Duty({ t, b }: StageProps) {
  // D sweeps while "占空比" is explained, then settles on 42 %
  const keys: [number, number][] = [
    [b.dutyw - 0.2, 0.2],
    [b.dutyw + 1.0, 0.7],
    [b.dutyw + 2.2, 0.3],
    [b.d42 - 0.2, 0.42],
  ]
  let D = keys[0][1]
  for (let i = 1; i < keys.length; i++) if (t > keys[i - 1][0]) D = lerp(keys[i - 1][1], keys[i][1], easeInOut((t - keys[i - 1][0]) / Math.max(0.3, keys[i][0] - keys[i - 1][0])))
  const vin = 12
  const X0 = 8
  const per = 15
  const Y0 = 40
  const Y1 = 16
  const vy = (v: number) => lerp(Y0, Y1, v / vin)
  const o = enter(t, b.duty - 0.2, 0.6)
  const bars: string[] = []
  const shade: React.ReactNode[] = []
  for (let k = 0; k < 3; k++) {
    const xa = X0 + 2 + k * per
    const xb = xa + D * per
    bars.push(`${k ? "L" : "M"}${xa} ${Y0} L${xa} ${Y1} L${xb} ${Y1} L${xb} ${Y0} L${xa + per} ${Y0}`)
    shade.push(<rect key={k} x={xa} y={Y1} width={D * per} height={Y0 - Y1} fill={VOLT} stroke="none" opacity={0.14} />)
  }
  const avg = D * vin
  const dpct = Math.round(D * 100)
  const vo = enter(t, b.d42 - 0.1, 0.5)
  return (
    <>
      <Svg>
        <g opacity={o}>
          <path d={`M${X0} ${Y0} H${X0 + 3 * per + 4} M${X0} ${Y0} V12`} />
          {shade}
          <path d={bars.join("").replace("MNaN", "M")} stroke={VOLT} strokeWidth={0.55} />
          <path d={`M${X0} ${vy(avg)} H${X0 + 3 * per + 4}`} stroke={GOOD} strokeWidth={0.5} strokeDasharray="1.2 0.8" opacity={vo} />
          <path d={`M${X0 + 2} ${Y0 + 2.6} H${X0 + 2 + per} M${X0 + 2} ${Y0 + 1.8} V${Y0 + 3.4} M${X0 + 2 + per} ${Y0 + 1.8} V${Y0 + 3.4}`} strokeWidth={0.25} />
        </g>
      </Svg>
      <T x={X0 + 2 + per / 2} y={Y0 + 5.2} size={2.2} color={MUTED} o={o}>
        一个周期
      </T>
      <T x={X0 + 2 + (D * per) / 2} y={Y1 - 2.3} size={2.2} color={VOLT} o={o}>
        接通
      </T>
      <T x={X0 - 1.5} y={Y1} size={2.2} anchor="end" color={MUTED} o={o} className="tabular">
        <M>12 V</M>
      </T>
      <T x={X0 - 1.5} y={Y0} size={2.2} anchor="end" color={MUTED} o={o} className="tabular">
        <M>0</M>
      </T>
      <T x={78} y={16} size={2.6} color={MUTED} o={o}>
        占空比
      </T>
      <T x={78} y={25} size={7} weight={600} color={VOLT} o={o} className="tabular">
        <M>{dpct}%</M>
      </T>
      <T x={78} y={38} size={3.4} o={vo}>
        <span className="inline-flex items-center gap-[0.25em]">
          <V c={GOOD}>V</V>
          <sub style={{ fontSize: "0.55em" }}>
            <M>out</M>
          </sub>
          <M> = </M>
          <V c={VOLT}>D</V>
          <M> × </M>
          <V>V</V>
          <sub style={{ fontSize: "0.55em" }}>
            <M>in</M>
          </sub>
        </span>
      </T>
      <T x={78} y={46} size={3} weight={600} color={GOOD} o={enter(t, b.v12 - 0.2, 0.4)} className="tabular">
        <M>
          12 V × 42% <span style={{ opacity: enter(t, b.v5 - 0.2, 0.4) }}>≈ 5 V</span>
        </M>
      </T>
    </>
  )
}

// ── the boost circuit ───────────────────────────────────────────────────────

const BON: Seg[] = [
  [8, 27.8, 8, 14],
  [8, 14, 14, 14],
  [14, 14, 26, 14, true],
  [26, 14, 28, 14],
  [28, 14, 28, 22],
  [28, 22, 28, 30, true],
  [28, 30, 28, 44],
  [28, 44, 8, 44],
  [8, 44, 8, 30.2],
]
const BOFF: Seg[] = [
  [8, 27.8, 8, 14],
  [8, 14, 14, 14],
  [14, 14, 26, 14, true],
  [26, 14, 31, 14],
  [31, 14, 39, 14, true],
  [39, 14, 50, 14],
  [50, 14, 50, 25],
  [50, 25, 50, 35, true],
  [50, 35, 50, 44],
  [50, 44, 8, 44],
  [8, 44, 8, 30.2],
]

function Boost({ t, b, still }: StageProps) {
  const wires = enter(t, b.boost - 0.1, 0.8)
  const per = 2.8
  const ph = still ? 0 : t * 10
  const on = still ? true : ((t - b.boostw) % per + per) % per < per * 0.45
  const swOpen = on ? 0 : 1
  const vout = enter(t, b.v5b - 0.2, 0.5)
  return (
    <>
      <Svg>
        <g opacity={wires}>
          <path d="M8 27.8 V14 M8 30.2 V44 M4.6 27.8 H11.4" />
          <path d="M6.4 30.2 H9.6" strokeWidth={0.75} />
          <path d="M8 14 H14 M26 14 H31.7 M38.3 14 H50 M8 44 H50" />
          <path d={coil(14, 26, 14, 3)} strokeWidth={0.5} stroke={AMP} />
          {/* switch to ground */}
          <path d="M28 14 V20 M28 32 V44" />
          <g transform="rotate(90 28 26)">
            <Lever x0={22} x1={34} y={26} open={swOpen} color={on ? AMP : undefined} />
          </g>
          {/* diode: from the node to the output */}
          <DiodeMark x={35} y={14} angle={0} size={2.2} color={on ? undefined : AMP} o={on ? 0.45 : 1} />
          {/* capacitor and load */}
          <path d="M44 14 V27.4 M44 30.6 V44 M41.6 27.4 H46.4 M41.6 30.6 H46.4" />
          <path d={vzig(50, 25, 35)} />
          <path d="M50 14 V25 M50 35 V44" />
        </g>
        <PolyDots segs={on ? BON : BOFF} phase={ph} o={wires} color={AMP} />
      </Svg>
      <T x={20} y={8.8} size={2.3} color={MUTED} o={wires}>
        电感
      </T>
      <T x={22} y={26} size={2.3} anchor="end" color={MUTED} o={wires}>
        开关
      </T>
      <T x={35} y={8.8} size={2.3} color={MUTED} o={wires}>
        二极管
      </T>
      <T x={30} y={49.5} size={2.5} weight={600} color={on ? AMP : VOLT} o={wires}>
        {on ? "开关通：电感储能" : "开关断：叠加在输入上，推向输出"}
      </T>
      <T x={72} y={11} size={2.6} color={MUTED} o={wires}>
        升压电路
      </T>
      <Readout y={22} label="输入" letter="" color={VOLT} o={enter(t, b.boost + 1.0, 0.5)} value="3.7 V" />
      <Readout y={34} label="输出" letter="" color={VOLT} o={vout} value="5 V" size={6} />
      <Svg>
        <g stroke="var(--border)" strokeWidth={0.12}>
          <path d="M62 27 H90" opacity={enter(t, b.boost + 1.0, 0.5)} />
          <path d="M62 40 H90" opacity={vout} />
        </g>
        <g opacity={vout} strokeWidth={0.5} stroke={GOOD}>
          <path d="M76 45 V50 M74.2 47 L76 45 L77.8 47" />
        </g>
      </Svg>
    </>
  )
}

// ── efficiency and noise ────────────────────────────────────────────────────

function Efficiency({ t, b, still }: StageProps) {
  const x0 = 24
  const x1 = 76
  const g1 = enter(t, b.eff - 0.2, 0.6)
  const g2 = enter(t, b.effw - 0.2, 0.9)
  const nz = enter(t, b.effw + 1.0, 0.8)
  const pts: string[] = []
  for (let x = 14; x <= 86; x += 0.35) {
    const spike = rnd(Math.floor((x * 3 + (still ? 0 : t * 12)) / 1.5), 2) > 0.8 ? (rnd(Math.floor(x * 3 + (still ? 0 : t * 12)), 5) - 0.3) * 4 : 0
    pts.push(`${pts.length ? "L" : "M"}${x.toFixed(2)} ${(45 + 0.5 * Math.sin(x * 2.6 + (still ? 0 : t * 10)) - spike).toFixed(2)}`)
  }
  return (
    <>
      <T x={50} y={9} size={2.6} color={MUTED} o={g1}>
        <M className="tabular">12 V → 5 V</M> 的效率
      </T>
      <Svg>
        <g opacity={g1}>
          <rect x={x0} y={14} width={x1 - x0} height={5} rx={0.6} strokeWidth={0.2} />
          <rect x={x0} y={14} width={(x1 - x0) * 0.42 * g1} height={5} rx={0.6} fill={POWER} stroke="none" opacity={0.45} />
        </g>
        <g opacity={g2}>
          <rect x={x0} y={24} width={x1 - x0} height={5} rx={0.6} strokeWidth={0.2} />
          <rect x={x0} y={24} width={(x1 - x0) * 0.9 * g2} height={5} rx={0.6} fill={GOOD} stroke="none" opacity={0.5} />
        </g>
        <g opacity={nz}>
          <path d="M14 45 H86" stroke={LINE} strokeWidth={0.12} />
          <path d={pts.join("")} stroke={VOLT} strokeWidth={0.4} />
        </g>
      </Svg>
      <T x={x0 - 1.5} y={16.5} size={2.4} anchor="end" color={MUTED} o={g1}>
        线性
      </T>
      <T x={x0 - 1.5} y={26.5} size={2.4} anchor="end" color={MUTED} o={g2}>
        开关
      </T>
      <T x={x0 + (x1 - x0) * 0.42 + 2} y={16.5} size={2.6} anchor="start" weight={600} color={POWER} o={g1} className="tabular">
        <M>42%</M>
      </T>
      <T x={x1 + 2} y={26.5} size={3} anchor="start" weight={600} color={GOOD} o={g2} className="tabular">
        <M>90%</M>
      </T>
      <T x={50} y={37} size={2.6} weight={600} o={enter(t, b.noise - 0.5, 0.5)}>
        代价：输出上多了噪声
      </T>
      <T x={50} y={50} size={2.3} color={MUTED} o={enter(t, b.noise - 0.2, 0.5)}>
        怕噪声的电路，后面再接一级线性稳压
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "开关电源：Buck 与 Boost",
  audio,
  timing,
  poster: 5.0,
  Stage,
}

export default function SwitchingRegulatorsFilm() {
  return <FilmPlayer film={film} />
}

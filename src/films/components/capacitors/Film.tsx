import { Capacitor, Resistor } from "@/lab/schematic"
import { trace } from "@/lab/colors"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, Scene, Svg, Sym, T, V, easeInOut, enter, glide, lerp, span, type FilmDef, type StageProps } from "../../kit"
import { AMP, BatteryV, FG, LINE, LoopFlow, MUTED, POWER, VOLT, integ, zig } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

const CHARGE = trace.second

/*
 * 电容器, ~61 s. Scenes, each keyed to the words that introduce it:
 *   title → resistor makes heat / capacitor stores charge
 *   → two plates fill with + and − → the bucket picture of Q = C V, water rising slowly
 *   → an RC loop with a charging curve: fast, then slow; τ = R × C; 63 % and 5τ; 10 kΩ × 100 μF = 1 s
 *   → ceramic vs electrolytic (polarity, bulging) → a 100 nF beside the chip's supply pin → "try it below".
 */
function Stage({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.6) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)
  const lift = (at: number) => (still ? 0 : -easeInOut((t - at) / 0.45) * 2)

  const title = span(t, 0.25, b.plates - 0.15, 0.4, 0.3)
  const plates = span(t, b.plates - 0.3, b.q - 0.15, 0.3, 0.3)
  const bucket = span(t, b.q - 0.3, b.rc - 0.15, 0.3, 0.3)
  const rc = span(t, b.rc - 0.3, b.types - 0.15, 0.3, 0.3)
  const types = span(t, b.types - 0.3, b.decouple - 0.15, 0.3, 0.3)
  const decouple = span(t, b.decouple - 0.3, b.outro - 0.15, 0.3, 0.3)
  const outro = enter(t, b.outro - 0.3, 0.4)

  return (
    <>
      <Scene o={title} dy={lift(b.plates - 0.45)}>
        <Title t={t} b={b} still={still} rise={rise} />
      </Scene>
      <Scene o={plates}>
        <Plates t={t} b={b} />
      </Scene>
      <Scene o={bucket}>
        <Bucket t={t} b={b} rise={rise} />
      </Scene>
      <Scene o={rc}>
        <Rc t={t} b={b} still={still} rise={rise} />
      </Scene>
      <Scene o={types}>
        <Types t={t} b={b} still={still} rise={rise} />
      </Scene>
      <Scene o={decouple}>
        <Decouple t={t} b={b} still={still} />
      </Scene>
      <Scene o={outro}>
        <T x={50} y={24} size={6} weight={600} dy={rise(b.outro - 0.3)}>
          动手试试
        </T>
        <T x={50} y={32.5} size={2.8} color={MUTED} o={enter(t, b.try)} dy={rise(b.try, 1)}>
          在下面的实验台改 R 和 C，看曲线被拉长、压短
        </T>
        <Svg>
          <g opacity={enter(t, b.try + 0.3)} transform={`translate(0 ${still ? 0 : Math.sin(t * 3.2) * 0.6})`} strokeWidth={0.45}>
            <path d="M50 38 V45 M47.6 42.6 L50 45 L52.4 42.6" />
          </g>
        </Svg>
      </Scene>
    </>
  )
}

type Rise = (at: number, d?: number) => number

// ── title: heat vs stored charge ─────────────────────────────────────────────

function Title({ t, b, still, rise }: { t: number; b: Record<string, number>; still: boolean; rise: Rise }) {
  const r = enter(t, b.res - 0.1, 0.5)
  const c = enter(t, b.store - 0.3, 0.5)
  const leaving = enter(t, b.out, 0.5)
  const run = still ? 0 : t * 5
  return (
    <>
      <T x={50} y={10} size={7.6} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
        电容器
      </T>
      <Svg>
        <g opacity={r}>
          <Sym x={27} y={27} scale={0.45}>
            <Resistor x={0} y={0} />
          </Sym>
          {[-4, 0, 4].map((k, i) => {
            const lift = still ? 0 : ((t * 2 + i * 0.5) % 1.5) * 1.2
            return <path key={k} d={`M${27 + k} ${20 - lift} q1.2 -1.6 0 -3.2`} stroke={POWER} strokeWidth={0.35} opacity={Math.max(0, 1 - lift / 1.8)} />
          })}
        </g>
        <g opacity={c}>
          <Sym x={73} y={27} scale={0.45}>
            <Capacitor x={0} y={0} />
          </Sym>
          {[-3.6, 0, 3.6].map((dy, i) => (
            <g key={i} opacity={enter(t, b.store + i * 0.25, 0.4)}>
              <path d={`M${68.2} ${27 + dy} h1.6 M${69} ${27 + dy - 0.8} v1.6`} stroke={POWER} strokeWidth={0.28} />
              <path d={`M${76.2} ${27 + dy} h1.6`} stroke={AMP} strokeWidth={0.28} />
            </g>
          ))}
        </g>
        {/* the stored charge leaves again */}
        {leaving > 0.01 &&
          [0, 1, 2, 3].map((i) => {
            const s = (((t * 6 + i * 4.2) % 16.8) / 16.8) * leaving
            return <circle key={i} cx={78.5 + s * 14} cy={27} r={0.55} fill={AMP} stroke="none" opacity={(1 - s) * leaving} />
          })}
        <path d="M86.5 27 h5" opacity={leaving} strokeWidth={0.28} stroke={AMP} strokeDasharray="0.9 0.9" strokeDashoffset={run * 0.0} />
      </Svg>
      <T x={27} y={39} size={3} weight={600} o={r}>
        电阻
      </T>
      <T x={27} y={44} size={2.5} color={POWER} o={enter(t, b.res + 0.4, 0.5)}>
        把电变成热
      </T>
      <T x={73} y={39} size={3} weight={600} o={c}>
        电容
      </T>
      <T x={65} y={44} size={2.5} color={CHARGE} o={enter(t, b.store, 0.5)}>
        存起来
      </T>
      <T x={81} y={44} size={2.5} color={AMP} o={leaving}>
        放出去
      </T>
    </>
  )
}

// ── two plates ───────────────────────────────────────────────────────────────

function Plates({ t, b }: { t: number; b: Record<string, number> }) {
  const n = 8
  const plate = enter(t, b.plates - 0.2, 0.6)
  const wires = enter(t, b.gap + 1.0, 0.7)
  const fill = (t - (b.charge - 0.5)) / 2.6
  const xs = Array.from({ length: n }, (_, i) => 33 + (i * 34) / (n - 1))
  const yT = 20.6
  const yB = 33.4
  return (
    <>
      <Svg>
        <g opacity={enter(t, b.gap - 0.1, 0.6)}>
          <rect x={30} y={yT + 0.6} width={40} height={yB - yT - 1.2} fill="var(--muted)" fillOpacity={0.7} stroke="none" />
        </g>
        <Draw d={`M30 ${yT} H70`} p={plate} strokeWidth={0.9} />
        <Draw d={`M30 ${yB} H70`} p={plate} strokeWidth={0.9} />
        <Draw d={`M30 ${yT} H14 V25.8 M14 28.2 V${yB} H30`} p={wires} />
        <BatteryV x={14} y={27} o={wires} />
        {/* the + on the upper plate, the − on the lower */}
        {xs.map((x, i) => {
          const o = enter(fill, i / n, 0.1) * wires
          return (
            <g key={i} opacity={o}>
              <path d={`M${x - 0.8} ${yT + 1.9} h1.6 M${x} ${yT + 1.1} v1.6`} stroke={POWER} strokeWidth={0.3} />
              <path d={`M${x - 0.8} ${yB - 1.9} h1.6`} stroke={AMP} strokeWidth={0.3} />
            </g>
          )
        })}
        {/* the voltage between the plates */}
        <Draw d={`M78 ${yB} V${yT} M76.6 ${yT + 1.8} L78 ${yT} L79.4 ${yT + 1.8}`} p={enter(t, b.charge, 0.6)} stroke={VOLT} strokeWidth={0.4} />
      </Svg>
      <T x={50} y={15} size={2.6} color={MUTED} o={enter(t, b.plates, 0.5)}>
        导体
      </T>
      <T x={50} y={38.8} size={2.6} color={MUTED} o={enter(t, b.plates + 0.5, 0.5)}>
        导体
      </T>
      <T x={50} y={27} size={2.6} o={enter(t, b.gap, 0.5)}>
        绝缘层
      </T>
      <T x={82} y={27} size={3.6} font="var" color={VOLT} o={enter(t, b.charge, 0.5)} anchor="start">
        V
      </T>
    </>
  )
}

// ── the bucket ───────────────────────────────────────────────────────────────

const BX = 24
const BTOP = 15
const BBOT = 44
const HALF_TOP = 15
const HALF_BOT = 11

function Bucket({ t, b, rise }: { t: number; b: Record<string, number>; rise: Rise }) {
  // 0.55 while the formula is explained, then drained a little and refilled slowly: the level can only climb
  const level = t < b.fill - 0.2 ? glide(t, b.qq, 0.15, 0.55, 0.9) : t < b.fill + 0.4 ? glide(t, b.fill - 0.2, 0.55, 0.2, 0.6) : glide(t, b.fill + 0.4, 0.2, 0.95, b.nojump - b.fill + 1.6)
  const yTop = BBOT - level * (BBOT - BTOP)
  const halfAt = (y: number) => lerp(HALF_TOP, HALF_BOT, (y - BTOP) / (BBOT - BTOP))
  const outline = `M${BX - HALF_TOP} ${BTOP} L${BX - HALF_BOT} ${BBOT} H${BX + HALF_BOT} L${BX + HALF_TOP} ${BTOP}`
  const water = `M${BX - halfAt(yTop)} ${yTop} H${BX + halfAt(yTop)} L${BX + HALF_BOT} ${BBOT} H${BX - HALF_BOT} Z`
  const volts = (level * 5).toFixed(1)
  const left = enter(t, b.q - 0.2, 0.6)
  return (
    <>
      <Svg>
        <Draw d={outline} p={left} strokeWidth={0.45} />
        <path d={water} fill={CHARGE} fillOpacity={0.35} stroke="none" opacity={left} />
        <path d={`M${BX - HALF_TOP - 1.5} ${yTop} H${BX + HALF_TOP + 1.5}`} stroke={CHARGE} strokeWidth={0.3} opacity={left} />
        {/* the level, as a voltage */}
        <g opacity={enter(t, b.ratio, 0.5)} stroke={VOLT} strokeWidth={0.4}>
          <path d={`M${BX + 20} ${BBOT} V${yTop} M${BX + 18.8} ${yTop + 1.6} L${BX + 20} ${yTop} L${BX + 21.2} ${yTop + 1.6}`} />
        </g>
        {/* the width, as a capacitance */}
        <Draw d={`M${BX - HALF_TOP} 11.5 H${BX + HALF_TOP} M${BX - HALF_TOP + 1.4} 10.3 L${BX - HALF_TOP} 11.5 L${BX - HALF_TOP + 1.4} 12.7 M${BX + HALF_TOP - 1.4} 10.3 L${BX + HALF_TOP} 11.5 L${BX + HALF_TOP - 1.4} 12.7`} p={enter(t, b.cap, 0.5)} stroke={FG} strokeWidth={0.3} />
      </Svg>
      <T x={BX + 22} y={BBOT - (BBOT - yTop) / 2} size={3.4} font="var" color={VOLT} anchor="start" o={enter(t, b.ratio, 0.5)}>
        V
      </T>
      <T x={BX} y={yTop - 2.6} size={2.6} color={MUTED} o={left} className="tabular">
        {volts} V
      </T>

      {/* Q = C V */}
      <T x={72} y={15} size={7.4} o={enter(t, b.qq - 0.2, 0.4)} dy={rise(b.qq - 0.2)}>
        <span className="inline-flex items-center gap-[0.3em]">
          <V c={CHARGE}>Q</V>
          <span style={{ opacity: enter(t, b.ratio, 0.4) }}>=</span>
          <span style={{ opacity: enter(t, b.cap, 0.4) }}>
            <V>C</V>
          </span>
          <span style={{ opacity: enter(t, b.ratio, 0.4) }}>
            <V c={VOLT}>V</V>
          </span>
        </span>
      </T>
      <Legend y={27} at={b.qq} letter="Q" color={CHARGE} text="水量 = 存下的电荷" t={t} />
      <Legend y={33.5} at={b.ratio} letter="V" color={VOLT} text="水位 = 电压" t={t} />
      <Legend y={40} at={b.cap} letter="C" text="桶的粗细 = 电容量" t={t} />
      <T x={72} y={48} size={2.8} color={MUTED} o={span(t, b.farad - 0.1, b.fill + 0.5, 0.4, 0.3)}>
        电容量的单位：法拉（F）
      </T>
      <T x={72} y={48} size={3} weight={600} color={VOLT} o={enter(t, b.nojump, 0.5)}>
        电压不能突变
      </T>
    </>
  )
}

function Legend({ y, at, letter, color, text, t }: { y: number; at: number; letter: string; color?: string; text: string; t: number }) {
  const o = enter(t, at, 0.5)
  return (
    <>
      <T x={52} y={y} size={3.4} font="var" color={color} anchor="start" o={o}>
        {letter}
      </T>
      <T x={58} y={y} size={2.8} anchor="start" o={o}>
        {text}
      </T>
    </>
  )
}

// ── charging through a resistor ──────────────────────────────────────────────

const GX0 = 60
const GX1 = 94
const GY0 = 40
const GY1 = 14
const TAU_W = 6.1 // stage units per τ

function Rc({ t, b, still, rise }: { t: number; b: Record<string, number>; still: boolean; rise: Rise }) {
  const t0 = b.rcw + 0.2
  // time in units of τ: charges for 6 s of film time up to 5.5 τ
  const u = Math.max(0, Math.min(5.5, ((t - t0) / 6.4) * 5.5))
  const speed = (s: number) => 11 * Math.exp(-Math.max(0, Math.min(5.5, ((s - t0) / 6.4) * 5.5)))
  const phase = still ? 0 : integ(speed, t0, Math.max(t, t0))
  const vc = 1 - Math.exp(-u)
  const yv = (v: number) => GY0 + (GY1 - GY0) * v
  const xu = (uu: number) => GX0 + uu * TAU_W
  const pts: string[] = []
  const steps = Math.max(1, Math.floor(u * 12))
  for (let i = 0; i <= steps; i++) {
    const uu = (u * i) / steps
    pts.push(`${i === 0 ? "M" : "L"}${xu(uu).toFixed(2)} ${yv(1 - Math.exp(-uu)).toFixed(2)}`)
  }
  const circuit = enter(t, b.rcw - 0.1, 0.6)
  const axes = enter(t, b.rcw, 0.6)
  const exO = enter(t, b.r10 - 0.1, 0.5)
  const tauO = span(t, b.tauw - 0.1, b.r10 - 0.15, 0.4, 0.3)
  const marks = enter(t, b.tauw + 1.2, 0.5)
  const m1 = enter(t, b.t1, 0.4)
  const m63 = enter(t, b.p63, 0.4)
  const m5 = enter(t, b.t5, 0.4)
  const cx = 34
  return (
    <>
      <Svg>
        {/* the loop: battery, resistor, capacitor */}
        <Draw d="M8 14 H15 M27 14 H34 V24.6 M34 27.4 V38 H8 V27.2 M8 24.8 V14" p={circuit} />
        <Draw d={zig(15, 14, 27, 14, 6, 1.6, 0.2)} p={circuit} />
        <BatteryV x={8} y={26} o={circuit} />
        <g opacity={circuit}>
          <path d={`M${cx - 3.2} 24.6 H${cx + 3.2} M${cx - 3.2} 27.4 H${cx + 3.2}`} strokeWidth={0.5} />
        </g>
        <LoopFlow x0={8} y0={14} x1={cx} y1={38} phase={phase} spacing={3.2} o={circuit * (still ? 0 : 1)} skip={(x, y) => (y === 14 && x > 14.5 && x < 27.5) || (x === 8 && y > 23.8 && y < 28.2) || (x === cx && y > 23.8 && y < 28.2)} />

        {/* the curve */}
        <Draw d={`M${GX0} ${GY0} H${GX1 + 1.5}`} p={axes} />
        <Draw d={`M${GX0} ${GY0 + 1} V${GY1 - 3}`} p={axes} />
        <path d={`M${GX0} ${yv(1)} H${GX1}`} stroke={VOLT} strokeWidth={0.22} strokeDasharray="0.9 0.8" opacity={axes} />
        {u > 0.01 && <path d={pts.join(" ")} stroke={VOLT} strokeWidth={0.5} />}
        {u > 0.01 && <circle cx={xu(u)} cy={yv(vc)} r={0.75} fill={VOLT} stroke="none" />}

        {/* 1τ → 63 %, 5τ → done */}
        <g opacity={m1} stroke={MUTED} strokeWidth={0.22} strokeDasharray="0.8 0.8">
          <path d={`M${xu(1)} ${GY0} V${yv(1 - Math.exp(-1))}`} />
          <path d={`M${GX0} ${yv(1 - Math.exp(-1))} H${xu(1)}`} opacity={m63} />
        </g>
        <circle cx={xu(1)} cy={yv(1 - Math.exp(-1))} r={0.9} fill={VOLT} stroke="none" opacity={m63} />
        <g opacity={m5} stroke={MUTED} strokeWidth={0.22} strokeDasharray="0.8 0.8">
          <path d={`M${xu(5)} ${GY0} V${yv(1 - Math.exp(-5))}`} />
        </g>
        <circle cx={xu(5)} cy={yv(1 - Math.exp(-5))} r={0.9} fill={VOLT} stroke="none" opacity={m5} />
      </Svg>
      <T x={21} y={10} size={2.6} o={circuit * (1 - exO)}>
        <V>R</V>
      </T>
      <T x={21} y={10} size={2.6} o={circuit * exO} className="tabular">
        10 kΩ
      </T>
      <T x={41} y={26} size={2.6} anchor="start" o={circuit * (1 - exO)}>
        <V>C</V>
      </T>
      <T x={39} y={26} size={2.6} anchor="start" o={circuit * exO} className="tabular">
        100 μF
      </T>
      <T x={16} y={31.5} size={2.6} anchor="start" color={VOLT} o={circuit} className="tabular">
        5 V
      </T>
      <T x={GX0 - 2} y={yv(1)} size={2.2} anchor="end" color={VOLT} o={axes}>
        电源
      </T>
      <T x={GX0} y={GY1 - 5} size={2.4} color={MUTED} o={axes}>
        电容的电压
      </T>
      <T x={GX1 + 2} y={GY0 - 2.4} size={2.2} anchor="end" color={MUTED} o={axes}>
        时间
      </T>
      {[1, 2, 3, 4, 5].map((k) => (
        <T key={k} x={xu(k)} y={GY0 + 3} size={2.2} color={MUTED} o={marks} className="tabular">
          {k}τ
        </T>
      ))}
      <T x={xu(1) + 1.4} y={yv(1 - Math.exp(-1)) + 3.8} size={3} weight={600} anchor="start" color={VOLT} o={m63} className="tabular">
        63%
      </T>
      <T x={xu(5) - 1} y={yv(1) - 3} size={2.6} weight={600} anchor="end" color={VOLT} o={m5} className="tabular">
        ≈ 99%
      </T>
      <T x={21} y={46} size={5.2} o={tauO} dy={rise(b.tauw - 0.1, 1)}>
        <span className="inline-flex items-center gap-[0.3em]">
          <V c={FG}>τ</V>
          <span>=</span>
          <V>R</V>
          <span>×</span>
          <V>C</V>
        </span>
      </T>
      <T x={30} y={46.5} size={3.8} o={exO} dy={rise(b.r10 - 0.1, 1)} className="tabular">
        <span className="inline-flex items-center gap-[0.3em]">
          <span style={{ opacity: enter(t, b.r10) }}>10 kΩ</span>
          <span style={{ opacity: enter(t, b.c100) }}>× 100 μF</span>
          <span className="font-semibold" style={{ opacity: enter(t, b.one), color: VOLT }}>
            = 1 s
          </span>
        </span>
      </T>
    </>
  )
}

// ── two kinds ────────────────────────────────────────────────────────────────

function Types({ t, b, still, rise }: { t: number; b: Record<string, number>; still: boolean; rise: Rise }) {
  const a = enter(t, b.typesw - 0.1, 0.6)
  const e = enter(t, b.elec - 0.3, 0.6)
  const bulge = enter(t, b.rev, 1.2)
  const shake = still ? 0 : Math.sin(t * 40) * 0.12 * bulge * (1 - bulge * 0.3)
  const pol = enter(t, b.pol, 0.4)
  const ex = 73
  return (
    <>
      <Svg>
        {/* ceramic chip: small, no polarity */}
        <g opacity={a}>
          <rect x={20} y={20} width={14} height={8} fill={FG} fillOpacity={0.18} stroke={MUTED} strokeWidth={0.3} rx={0.6} />
          <rect x={19.2} y={20} width={3.6} height={8} fill={MUTED} stroke="none" />
          <rect x={31.2} y={20} width={3.6} height={8} fill={MUTED} stroke="none" />
        </g>
        {/* aluminium can with a stripe on the negative side */}
        <g opacity={e} transform={`translate(${shake} 0)`}>
          <rect x={ex - 6} y={14} width={12} height={17} rx={1.2} fill="var(--muted)" stroke={FG} strokeWidth={0.4} />
          <rect x={ex - 6} y={14} width={3} height={17} rx={0.8} fill={AMP} fillOpacity={0.6} stroke="none" />
          <path d={`M${ex - 4.5} 18 h1.4 M${ex - 4.5} 22.5 h1.4 M${ex - 4.5} 27 h1.4`} stroke="var(--background)" strokeWidth={0.4} />
          <path d={`M${ex - 6} 14 q6 ${-1 - 3.4 * bulge} 12 0`} stroke={POWER} strokeWidth={0.45} opacity={bulge} />
          <path d={`M${ex - 1.8} 31 V37 M${ex + 2.4} 31 V39.5`} />
        </g>
        <g opacity={pol} strokeWidth={0.35}>
          <path d={`M${ex + 2.4 - 1} 42 h2 M${ex + 2.4} 41 v2`} stroke={POWER} />
          <path d={`M${ex - 1.8 - 1} 42 h2`} stroke={AMP} />
        </g>
      </Svg>
      <T x={27} y={9} size={3.2} weight={600} o={a} dy={rise(b.typesw - 0.1, 1)}>
        陶瓷贴片
      </T>
      <T x={27} y={34} size={2.6} color={MUTED} o={a}>
        小、便宜
      </T>
      <T x={27} y={39} size={2.6} color={MUTED} o={a}>
        没有正负极
      </T>
      <T x={ex} y={9} size={3.2} weight={600} o={e} dy={rise(b.elec - 0.3, 1)}>
        铝电解
      </T>
      <T x={ex - 12} y={22} size={2.6} anchor="end" color={MUTED} o={e}>
        容量大
      </T>
      <T x={ex - 12} y={27} size={2.6} anchor="end" color={AMP} o={pol}>
        色带对着负极
      </T>
      <T x={ex} y={47.5} size={3} weight={600} color={POWER} o={enter(t, b.rev, 0.5)}>
        接反：发热、鼓包
      </T>
    </>
  )
}

// ── decoupling ───────────────────────────────────────────────────────────────

function Decouple({ t, b, still }: StageProps) {
  const chip = enter(t, b.decouple - 0.1, 0.6)
  const cap = enter(t, b.c100n - 0.3, 0.5)
  const near = enter(t, b.near - 0.2, 0.7)
  const plot = enter(t, b.decouple + 0.3, 0.6)
  const depth = lerp(7, 1.3, easeInOut(near))
  const gauss = (x: number, c: number) => Math.exp(-(((x - c) / 2.2) ** 2))
  const dip = (x: number) => depth * (gauss(x, 30) + gauss(x, 52) + gauss(x, 74))
  const pts: string[] = []
  for (let x = 14; x <= 90; x += 1) pts.push(`${x === 14 ? "M" : "L"}${x} ${(43 + dip(x)).toFixed(2)}`)
  const phase = still ? 0 : t * 5
  return (
    <>
      <Svg>
        <g opacity={chip}>
          <rect x={56} y={11} width={26} height={19} rx={1.2} fill="var(--muted)" stroke={FG} strokeWidth={0.4} />
          <path d="M52 17 H56 M82 24 H88" />
        </g>
        {/* a long way to the supply */}
        <Draw d="M12 17 H52" p={chip} />
        <BatteryV x={9} y={22} o={chip} />
        <Draw d="M9 20.8 V17 H12" p={chip} />
        <Draw d="M9 23.2 V32.5 H88 V24" p={chip} />
        {/* the 100 nF by the pin */}
        <g opacity={cap}>
          <path d="M46 17 V21.8 M46 24.6 V32.5" />
          <path d="M43 21.8 H49 M43 24.6 H49" strokeWidth={0.5} />
        </g>
        <circle cx={46} cy={17} r={0.6} fill="currentColor" stroke="none" opacity={cap} />
        {/* the supply voltage, dipping when the chip pulls current */}
        <Draw d="M14 41 H90" p={plot} stroke={LINE} strokeWidth={0.25} />
        <path d={pts.join(" ")} stroke={VOLT} strokeWidth={0.5} opacity={plot} />
        <g opacity={cap * (1 - near * 0.0)} stroke={AMP} strokeWidth={0.3}>
          {[0, 1, 2].map((i) => {
            const s = ((phase * 0.12 + i / 3) % 1) * 7
            return <circle key={i} cx={46 + (s < 3 ? 0 : s - 3)} cy={s < 3 ? 21.8 - s * 1.6 : 17} r={0.5} fill={AMP} stroke="none" opacity={near} />
          })}
        </g>
      </Svg>
      <T x={69} y={20.5} size={3.2} weight={600} o={chip}>
        芯片
      </T>
      <T x={19} y={13.5} size={2.3} color={MUTED} o={chip}>
        电源在远处
      </T>
      <T x={41.5} y={23.2} size={2.4} anchor="end" weight={600} color={AMP} o={cap} className="tabular">
        100 nF
      </T>
      <T x={14} y={37.2} size={2.4} anchor="start" color={VOLT} o={plot}>
        电源脚的电压
      </T>
      <T x={90} y={37.2} size={2.4} anchor="end" color={MUTED} o={plot * (1 - near)}>
        芯片一用电，电压就塌一下
      </T>
      <T x={90} y={37.2} size={2.4} anchor="end" color={VOLT} o={near}>
        近处有小水缸，塌得浅
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "电容器",
  audio,
  timing,
  poster: 5.3,
  Stage,
}

export default function CapacitorsFilm() {
  return <FilmPlayer film={film} />
}

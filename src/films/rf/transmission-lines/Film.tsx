import * as React from "react"
import { trace } from "@/lab/colors"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, M, Scene, Svg, T, V, enter, span, type FilmDef, type StageProps } from "../../kit"
import { MUTED, Outro, riseOf, sinePath } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

const VOLT = trace.voltage
const AMP = trace.current
const GOOD = trace.good
const BAD = trace.power
const BORDER = "var(--border)"

/*
 * 传输线与阻抗匹配, ~60 s. Scenes, each keyed to the words that introduce it:
 *   title (a wire with a wave on it) → 2.4 GHz on a 6 cm trace: crest, trough, crest
 *   → a pulse carries V and I in a fixed ratio, Z0 → 50 Ω as a compromise
 *   → one line, one pulse train: a 150 Ω load reflects, 50 Ω absorbs, open and short bounce back
 *   → Γ and the share of power → three ways to say it → a matching network → "drag the slider".
 */
function Stage({ t, b, still }: StageProps) {
  const rise = riseOf(t, still)
  // the old scene has faded out by the time the next line starts and the new one fades in from there,
  // so two scenes never sit on top of each other
  const sc = (a: number, z: number) => span(t, a - 0.05, z - 0.3, 0.35, 0.3)
  const title = span(t, 0.25, b.delay - 0.3, 0.4, 0.3)
  const delay = sc(b.delay, b.z0)
  const z0 = sc(b.z0, b.fifty)
  const fifty = sc(b.fifty, b.refl)
  const line = sc(b.refl, b.gamma)
  // the worked example stays up while "这件事有三种说法" is said; the table arrives with its first column
  const gamma = span(t, b.gamma - 0.05, b.three + 1.2, 0.35, 0.4)
  const three = sc(b.three, b.net)
  const net = sc(b.net, b.outro)

  return (
    <>
      <Scene o={title}>
        <T x={50} y={13} size={8} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
          传输线
        </T>
        <T x={50} y={22} size={3} color={MUTED} o={enter(t, b.intro + 1.1)} dy={rise(b.intro + 1.1, 1)}>
          导线，不再只是连接
        </T>
        <Svg>
          <g opacity={enter(t, 0.6, 0.6)}>
            <circle cx={9} cy={39} r={2.8} />
            <path d="M7 39 q1 -1.6 2 0 t2 0" strokeWidth={0.25} />
            <path d="M12 36.5 H88 M12 41.5 H88" />
          </g>
          <path d={sinePath(14, 14 + 72 * enter(t, b.intro + 1.8, 1.6), 30, 3.6, 18, still ? 0 : t * 0.35)} stroke={VOLT} strokeWidth={0.45} />
        </Svg>
      </Scene>

      <Scene o={delay}>
        <Delay t={t} b={b} still={still} />
      </Scene>
      <Scene o={z0}>
        <Z0 t={t} b={b} still={still} />
      </Scene>
      <Scene o={fifty}>
        <Fifty t={t} b={b} still={still} />
      </Scene>
      <Scene o={line}>
        <Line t={t} b={b} still={still} />
      </Scene>
      <Scene o={gamma}>
        <Gamma t={t} b={b} still={still} />
      </Scene>
      <Scene o={three}>
        <Three t={t} b={b} still={still} />
      </Scene>
      <Scene o={net}>
        <Net t={t} b={b} still={still} />
      </Scene>

      <Outro t={t} b={b} still={still} hint="拖动下面的负载阻抗，看反射怎么变" />
    </>
  )
}

// ── a trace as long as the wave ──────────────────────────────────────────────

function Delay({ t, b, still }: StageProps) {
  const rise = riseOf(t, still)
  const x0 = 14
  const W = 72
  const ph = still ? 0 : 0.03 * Math.sin(t * 1.5)
  const wave = enter(t, b.delay + 0.3, 0.7)
  const yc = 25
  const A = 7
  const crest = enter(t, b.crest - 0.2, 0.4)
  const trough = enter(t, b.trough - 0.2, 0.4)
  const at = (u: number) => yc - A * Math.sin(TAU * (u + 0.25 + ph))
  return (
    <>
      <T x={50} y={6} size={3} color={MUTED} o={enter(t, b.delay)} dy={rise(b.delay, 1)}>
        <M>2.4 GHz</M> 的信号
      </T>
      <Svg>
        <path d={sinePath(x0, x0 + W, yc, A, W, -0.25 - ph)} stroke={VOLT} strokeWidth={0.45} opacity={wave} />
        <path d={`M${x0} 43 H${x0 + W}`} strokeWidth={1.1} opacity={enter(t, b.delay, 0.6)} />
        <g opacity={enter(t, b.delay + 0.8, 0.5)} strokeWidth={0.3}>
          <path d={`M${x0} 47 V50 M${x0 + W} 47 V50 M${x0} 48.5 H${x0 + W}`} />
        </g>
        <g opacity={crest} fill={VOLT} stroke="none">
          <circle cx={x0} cy={at(0)} r={1} />
          <circle cx={x0 + W} cy={at(1)} r={1} />
        </g>
        <circle cx={x0 + W / 2} cy={at(0.5)} r={1} fill={AMP} stroke="none" opacity={trough} />
      </Svg>
      <T x={x0} y={11.5} size={2.8} weight={600} color={VOLT} o={crest} dy={rise(b.crest, 1)}>
        波峰
      </T>
      <T x={x0 + W} y={11.5} size={2.8} weight={600} color={VOLT} o={crest}>
        波峰
      </T>
      <T x={x0 + W / 2} y={36} size={2.8} weight={600} color={AMP} o={trough} dy={rise(b.trough, 1)}>
        波谷
      </T>
      <T x={50} y={52} size={2.6} color={MUTED} o={enter(t, b.delay + 1)}>
        走线长 <M>6 cm</M> · 同一时刻
      </T>
    </>
  )
}

const TAU = Math.PI * 2

// ── Z0 ───────────────────────────────────────────────────────────────────────

const bump = (x: number, c: number, w = 2.4) => Math.exp(-(((x - c) / w) ** 2))

function Z0({ t, b, still }: StageProps) {
  const rise = riseOf(t, still)
  const L0 = 8
  const L1 = 62
  const v = 22
  const per = (L1 - L0 + 14) / v
  const xp = still ? 30 : L0 - 4 + (((t - b.z0) % per) + per) % per * v
  const vd: string[] = []
  const id: string[] = []
  for (let x = L0; x <= L1 + 1e-6; x += 0.5) {
    vd.push(`${vd.length ? "L" : "M"}${x} ${22 - 7 * bump(x, xp)}`)
    id.push(`${id.length ? "L" : "M"}${x} ${44 + 7 * bump(x, xp)}`)
  }
  const e = enter(t, b.z0, 0.5)
  const r = enter(t, b.ratio, 0.5)
  return (
    <>
      <Svg>
        <g opacity={e}>
          <path d={`M${L0} 30 H${L1} M${L0} 36 H${L1}`} strokeWidth={0.5} />
          <path d={`M${L0} 22 H${L1}`} strokeWidth={0.12} stroke={BORDER} />
          <path d={`M${L0} 44 H${L1}`} strokeWidth={0.12} stroke={BORDER} />
        </g>
        <path d={vd.join("")} stroke={VOLT} strokeWidth={0.5} opacity={e} />
        <path d={id.join("")} stroke={AMP} strokeWidth={0.5} opacity={e} />
      </Svg>
      <T x={L0} y={13} size={2.6} anchor="start" color={VOLT} o={e}>
        电压
      </T>
      <T x={L0} y={52} size={2.6} anchor="start" color={AMP} o={e}>
        电流
      </T>
      <T x={86} y={17} size={3} anchor="end" color={VOLT} o={r} dy={rise(b.ratio, 1)}>
        <M>1 V</M>
      </T>
      <T x={86} y={25} size={3} anchor="end" color={AMP} o={r} dy={rise(b.ratio, 1)}>
        <M>20 mA</M>
      </T>
      <T x={86} y={36} size={2.6} anchor="end" color={MUTED} o={enter(t, b.zz - 0.2)}>
        比值 <V>Z</V>
        <span style={{ fontSize: "0.7em", verticalAlign: "-0.28em" }}>0</span>
      </T>
      <T x={86} y={44} size={6} anchor="end" weight={600} o={enter(t, b.zz)} dy={rise(b.zz, 1)}>
        <M>50 Ω</M>
      </T>
    </>
  )
}

// ── why 50 Ω ─────────────────────────────────────────────────────────────────

function Fifty({ t, b, still }: StageProps) {
  const rise = riseOf(t, still)
  const X = (z: number) => 10 + (z - 20)
  const curve = (f: (z: number) => number) => {
    const pts: string[] = []
    for (let z = 20; z <= 100; z += 1) pts.push(`${pts.length ? "L" : "M"}${X(z)} ${f(z).toFixed(2)}`)
    return pts.join("")
  }
  const g = (z: number, c: number) => Math.exp(-(((z - c) / 16) ** 2))
  const lossRow = 19
  const powRow = 35
  const ax = enter(t, b.fifty - 0.9, 0.6)
  const pl = enter(t, b.loss - 0.1, 0.9)
  const pp = enter(t, b.power - 0.1, 0.9)
  const f50 = enter(t, b.fif, 0.5)
  return (
    <>
      <Svg>
        <g opacity={ax}>
          <path d={`M10 46 H90`} strokeWidth={0.3} />
          {[30, 50, 77, 100].map((z) => (
            <path key={z} d={`M${X(z)} 46 v1`} strokeWidth={0.25} />
          ))}
        </g>
        <Draw d={curve((z) => lossRow + 7 * g(z, 77))} p={pl} stroke={BAD} strokeWidth={0.5} />
        <Draw d={curve((z) => powRow - 7 * g(z, 30))} p={pp} stroke={GOOD} strokeWidth={0.5} />
        <path d={`M${X(50)} 12 V46`} stroke={VOLT} strokeWidth={0.35} strokeDasharray="1 0.9" opacity={f50} />
        {/* each marker lands when its curve has been drawn that far */}
        <circle cx={X(77)} cy={lossRow + 7} r={0.9} fill={BAD} stroke="none" opacity={enter(t, b.loss + 0.25, 0.3)} />
        <circle cx={X(30)} cy={powRow - 7} r={0.9} fill={GOOD} stroke="none" opacity={enter(t, b.power, 0.3)} />
      </Svg>
      {[
        [30, "30 Ω"],
        [77, "77 Ω"],
      ].map(([z, s]) => (
        <T key={s} x={X(z as number)} y={50} size={2.4} color={MUTED} o={ax} className="tabular">
          {s}
        </T>
      ))}
      <T x={X(100)} y={50} size={2.4} color={MUTED} o={ax}>
        阻抗
      </T>
      <T x={X(50)} y={50} size={3} weight={600} color={VOLT} o={f50} className="tabular">
        <M>50 Ω</M>
      </T>
      <T x={10} y={lossRow - 6} size={2.8} anchor="start" weight={600} color={BAD} o={pl} dy={rise(b.loss, 1)}>
        损耗：77 Ω 最低
      </T>
      <T x={10} y={powRow - 12} size={2.8} anchor="start" weight={600} color={GOOD} o={pp} dy={rise(b.power, 1)}>
        耐功率：30 Ω 最高
      </T>
      <T x={X(50) + 3} y={8} size={3.6} anchor="start" weight={600} o={f50} dy={rise(b.fif, 1)}>
        折中：<M>50 Ω</M>
      </T>
    </>
  )
}

// ── one line, four loads ─────────────────────────────────────────────────────

const LX0 = 14
const LX1 = 70
const SPEED = 38
const TRAVEL = (LX1 - LX0) / SPEED

function Line({ t, b }: StageProps) {
  // when each pulse reaches the load, and what the load does to it
  const hits = [
    { h: b.refl + 1.6, g: 0.5 },
    { h: b.back - 0.3, g: 0.5 },
    { h: b.match + 0.2, g: 0 },
    { h: b.open + 0.3, g: 1 },
    { h: b.short + 0.3, g: -1 },
  ]
  // the load changes as each case is named ("负载等于五十欧" comes a second before "全被吸收");
  // its note appears when the pulse gets there
  const starts = [b.load - 0.2, b.match - 1, b.open - 0.4, b.short - 0.4]
  const ends = [starts[1], starts[2], starts[3], Infinity]
  const noteAt = [b.back - 0.6, b.match, b.open + 0.3, b.short + 0.3]
  const is = (i: number) => span(t, starts[i], ends[i] - 0.2, 0.3, 0.2)
  const labels = ["150 Ω", "50 Ω", "开路", "短路"]
  const notes = ["一部分反射回来", "全被吸收，没有反射", "同相弹回", "反相弹回"]
  const cols = [BAD, GOOD, VOLT, VOLT]
  const ys = 22
  const pts: string[] = []
  for (let x = LX0; x <= LX1 + 1e-6; x += 0.5) {
    let y = 0
    for (const p of hits) {
      const inc = (t - (p.h - TRAVEL)) * SPEED + LX0
      if (inc > LX0 - 6 && inc < LX1 + 8) y += bump(x, inc)
      const back = LX1 - (t - p.h) * SPEED
      if (t > p.h && back > LX0 - 8) y += p.g * bump(x, back)
    }
    pts.push(`${pts.length ? "L" : "M"}${x} ${ys - 8 * y}`)
  }
  const e = enter(t, b.refl, 0.5)
  const loadX = 76
  const zig = (() => {
    const q = [`M${loadX} 34`, `V35.2`]
    for (let i = 0; i < 6; i++) q.push(`L${loadX + (i % 2 ? -1.5 : 1.5)} ${35.2 + (i + 0.5) * 1.35}`)
    q.push(`L${loadX} 43.3`, `V44`)
    return q.join("")
  })()
  const lo = enter(t, b.load - 0.2, 0.5)
  return (
    <>
      <Svg>
        <g opacity={e}>
          <circle cx={9} cy={39} r={2.8} />
          <path d="M7 39 q1 -1.6 2 0 t2 0" strokeWidth={0.25} />
          <path d={`M12 34 H${loadX} M12 44 H${loadX}`} strokeWidth={0.5} />
          <path d={`M${LX0} ${ys} H${LX1}`} strokeWidth={0.12} stroke={BORDER} />
        </g>
        <path d={pts.join("")} stroke={VOLT} strokeWidth={0.5} opacity={e} />
        <path d={zig} stroke={BAD} opacity={is(0)} />
        <path d={zig} stroke={GOOD} opacity={is(1)} />
        <path d={`M${loadX - 1} 34 v3 M${loadX + 1} 41 v3`} stroke={VOLT} opacity={is(2)} />
        <path d={`M${loadX} 34 V44`} stroke={VOLT} strokeWidth={0.6} opacity={is(3)} />
      </Svg>
      <T x={8} y={22} size={2.4} anchor="end" color={MUTED} o={e}>
        电压
      </T>
      {labels.map((s, i) => (
        <T key={s} x={loadX + 4} y={39} size={3.4} anchor="start" weight={600} color={cols[i]} o={is(i)} className="tabular">
          {s}
        </T>
      ))}
      <T x={loadX} y={29} size={2.4} color={MUTED} o={lo}>
        负载
      </T>
      <T x={44} y={52} size={2.4} color={MUTED} o={e}>
        <M>50 Ω</M> 传输线
      </T>
      {notes.map((s, i) => (
        <T key={s} x={86} y={9} size={3} anchor="end" weight={600} color={cols[i]} o={span(t, noteAt[i], ends[i] - 0.2, 0.4, 0.2)}>
          {s}
        </T>
      ))}
    </>
  )
}

// ── the reflection coefficient ───────────────────────────────────────────────

function Gamma({ t, b, still }: StageProps) {
  const rise = riseOf(t, still)
  const bar = enter(t, b.quarter - 0.2, 0.9)
  const x0 = 15
  const W = 70
  const refl = W * 0.25 * bar
  // Z and its subscript as one piece, so the flex gap does not split them
  const z = (s: string) => (
    <span>
      <V>Z</V>
      <span style={{ fontSize: "0.7em", verticalAlign: "-0.28em" }}>{s}</span>
    </span>
  )
  return (
    <>
      <T x={50} y={11} size={4.4} o={enter(t, b.gamma)} dy={rise(b.gamma, 1)}>
        <span className="inline-flex items-center gap-[0.25em]">
          <V c={VOLT}>Γ</V>
          <M>=</M>
          <M>(</M>
          {z("L")}
          <M>−</M>
          {z("0")}
          <M>) ÷ (</M>
          {z("L")}
          <M>+</M>
          {z("0")}
          <M>)</M>
        </span>
      </T>
      <T x={50} y={23} size={5} o={enter(t, b.r150, 0.5)} dy={rise(b.r150, 1)} className="tabular">
        <M>(150 − 50) ÷ (150 + 50) = </M>
        <M c={VOLT} className="font-semibold">
          0.5
        </M>
      </T>
      <Svg>
        <g opacity={enter(t, b.quarter - 0.4, 0.5)}>
          <rect x={x0} y={36} width={W - refl} height={7} rx={0.6} stroke="none" fill={GOOD} fillOpacity={0.55} />
          <rect x={x0 + W - refl} y={36} width={refl} height={7} rx={0.6} stroke="none" fill={BAD} fillOpacity={0.7} />
        </g>
      </Svg>
      <T x={x0 + (W - refl) / 2} y={48.5} size={2.8} weight={600} color={GOOD} o={enter(t, b.quarter)} className="tabular">
        送进负载 75%
      </T>
      <T x={x0 + W - 8.75} y={48.5} size={2.8} weight={600} color={BAD} o={enter(t, b.quarter)} className="tabular">
        反射 25%
      </T>
      <T x={50} y={31} size={2.6} color={MUTED} o={enter(t, b.quarter - 0.3)}>
        功率 = <M>0.5² = 25%</M>
      </T>
    </>
  )
}

// ── three ways to say it ─────────────────────────────────────────────────────

function Three({ t, b, still }: StageProps) {
  const rise = riseOf(t, still)
  const cols = [
    { x: 20, at: b.gam, head: "反射系数 |Γ|", vals: ["0.20", "0.33", "0.50"], c: VOLT },
    { x: 50, at: b.vswr, head: "驻波比", vals: ["1.5", "2.0", "3.0"], c: trace.second },
    { x: 80, at: b.rl, head: "回波损耗", vals: ["14.0 dB", "9.5 dB", "6.0 dB"], c: AMP },
  ]
  const ys = [26, 35, 44]
  return (
    <>
      <Svg>
        <path d="M6 16 H94" strokeWidth={0.2} stroke={BORDER} opacity={enter(t, b.three + 1.4, 0.6)} />
        {[30.5, 39.5].map((y) => (
          <path key={y} d={`M6 ${y} H94`} strokeWidth={0.12} stroke={BORDER} opacity={enter(t, b.three + 1.5, 0.6)} />
        ))}
      </Svg>
      <T x={50} y={6} size={2.6} color={MUTED} o={enter(t, b.three + 1.4)}>
        同一件事的三种说法
      </T>
      {cols.map((c) => (
        <React.Fragment key={c.x}>
          <T x={c.x} y={12} size={3.2} weight={600} color={c.c} o={enter(t, c.at - 0.1, 0.4)} dy={rise(c.at, 1)}>
            {c.head}
          </T>
          {c.vals.map((v, i) => (
            <T key={i} x={c.x} y={ys[i]} size={4.6} o={enter(t, c.at + i * 0.18, 0.4)} className="tabular">
              <M>{v}</M>
            </T>
          ))}
        </React.Fragment>
      ))}
    </>
  )
}

// ── a matching network ───────────────────────────────────────────────────────

function Net({ t, b, still }: StageProps) {
  const rise = riseOf(t, still)
  const net = enter(t, b.mnet - 0.1, 0.8)
  const miss = enter(t, b.net, 0.5) * (1 - enter(t, b.mnet + 0.4, 0.5))
  const ok = enter(t, b.mnet + 0.8, 0.5)
  const yt = 24
  const yb = 40
  const cap = (x: number) => (
    <g key={x}>
      <path d={`M${x} ${yt} V29.5 M${x - 2.2} 29.5 H${x + 2.2} M${x - 2.2} 33 H${x + 2.2} M${x} 33 V${yb}`} />
    </g>
  )
  const flow = still ? 0 : (t * 18) % 28
  return (
    <>
      <Svg>
        <g strokeWidth={0.5}>
          <path d={`M8 ${yt} H36 M8 ${yb} H66`} opacity={enter(t, b.net - 0.2, 0.5)} />
          <path d={`M66 ${yt} H82 M66 ${yb} H82`} opacity={enter(t, b.net - 0.2, 0.5)} />
        </g>
        <g opacity={net} strokeWidth={0.5}>
          <path d={`M36 ${yt} H46 a1.5 1.5 0 0 1 3 0 a1.5 1.5 0 0 1 3 0 a1.5 1.5 0 0 1 3 0 H66`} />
          {cap(40)}
          {cap(62)}
          <rect x={33} y={17} width={36} height={30} rx={1.2} strokeWidth={0.25} strokeDasharray="1.2 1" />
        </g>
        <g opacity={enter(t, b.net - 0.2, 0.5)}>
          <path d={`M82 ${yb} V${yt - 8} M82 ${yt - 4} L78 ${yt - 8} M82 ${yt - 4} L86 ${yt - 8}`} strokeWidth={0.55} />
        </g>
        {!still && ok > 0.01 && [0, 1, 2].map((i) => <circle key={i} cx={10 + ((flow + i * 9) % 28)} cy={yt} r={0.55} fill={AMP} stroke="none" opacity={ok} />)}
        <g opacity={miss} stroke={BAD} strokeWidth={0.5}>
          <path d="M34 33 H12 M14.4 31.2 L12 33 L14.4 34.8" />
        </g>
      </Svg>
      <T x={22} y={13} size={2.6} color={MUTED} o={enter(t, b.net - 0.1)} dy={rise(b.net, 1)}>
        <M>50 Ω</M> 传输线
      </T>
      <T x={82} y={10} size={2.6} color={MUTED} o={enter(t, b.net - 0.1)}>
        天线
      </T>
      <T x={24} y={37} size={2.6} weight={600} color={BAD} o={miss}>
        反射回来
      </T>
      <T x={51} y={52} size={3} weight={600} o={net} dy={rise(b.mnet, 1)}>
        匹配网络
      </T>
      <T x={82} y={52} size={2.8} weight={600} color={GOOD} o={ok}>
        匹配了
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "传输线与阻抗匹配",
  audio,
  timing,
  poster: 4.8,
  Stage,
}

export default function TransmissionLinesFilm() {
  return <FilmPlayer film={film} />
}

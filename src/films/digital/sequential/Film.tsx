import * as React from "react"
import { trace } from "@/lab/colors"
import { Crystal } from "@/lab/schematic"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, M, Scene, Sym, Svg, T, enter, lerp, span, type FilmDef, type StageProps } from "../../kit"
import { DownArrow, FG, GateAt, HI, LINE, MUTED, keys, makeLift, makeRise } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

/*
 * 触发器与时序逻辑, ~60 s. Scenes, each keyed to the words that introduce it:
 *   title (a cell that remembers a 1) → two NAND gates feed each other: a latch
 *   → CLK / D / Q timing: Q copies D only at the rising edge, a glitch between edges is ignored
 *   → four flip-flops count clock pulses → each stage halves the frequency → 32768 Hz halved 15 times is 1 Hz
 *   → bits shift into eight cells, then show on the outputs together → "try it below".
 */

const SEC = trace.second

function Stage({ t, b, still }: StageProps) {
  const rise = makeRise(t, still)
  const lift = makeLift(t, still)
  const sc = (a: number, z: number) => span(t, a - 0.3, z - 0.15, 0.3, 0.3)

  return (
    <>
      <Scene o={span(t, 0.25, b.latchL - 0.15, 0.4, 0.3)} dy={lift(b.latchL - 0.45)}>
        <T x={50} y={16} size={7} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
          触发器与时序逻辑
        </T>
        <Svg>
          <rect x={42} y={26} width={16} height={12} rx={1.6} strokeWidth={0.45} stroke={HI} opacity={enter(t, 1.6, 0.6)} />
        </Svg>
        <T x={50} y={32} size={6} weight={600} color={HI} o={enter(t, 1.8, 0.6)} dy={rise(1.8, 1)} className="tabular">
          1
        </T>
        <T x={50} y={42} size={2.8} color={MUTED} o={enter(t, 3.6, 0.6)} dy={rise(3.6, 1)}>
          电路记住了这一位
        </T>
      </Scene>

      <Scene o={span(t, b.latchL - 0.3, b.edgeL - 0.45, 0.3, 0.3)}>
        <Latch t={t} b={b} />
      </Scene>
      <Scene o={sc(b.edgeL, b.countL)}>
        <Edge t={t} b={b} />
      </Scene>
      <Scene o={sc(b.countL, b.divL)}>
        <Count t={t} b={b} />
      </Scene>
      <Scene o={sc(b.divL, b.xtalL)}>
        <Div t={t} b={b} />
      </Scene>
      <Scene o={sc(b.xtalL, b.shiftL)}>
        <Xtal t={t} b={b} />
      </Scene>
      <Scene o={sc(b.shiftL, b.outro)}>
        <Shift t={t} b={b} />
      </Scene>

      <Scene o={enter(t, b.outro - 0.3, 0.4)}>
        <T x={50} y={22} size={6} weight={600} dy={rise(b.outro)}>
          动手试试
        </T>
        <T x={50} y={31} size={2.8} color={MUTED} o={enter(t, b.try, 0.5)} dy={rise(b.try, 1)}>
          拨动输入 D，看 Q 只在时钟沿变化
        </T>
        <Svg>
          <DownArrow t={t} at={b.try + 0.3} still={still} y={37} />
        </Svg>
      </Scene>
    </>
  )
}

// ── latch: two NAND gates feeding each other ────────────────────────────────

function Latch({ t, b }: Pick<StageProps, "t" | "b">) {
  const gates = enter(t, b.latchL, 0.5)
  const loop = enter(t, b.loop - 0.1, 1.0)
  // a NAND latch: S̄ and R̄ are active low. It starts holding 0; at "锁住" S̄ dips to 0 and sets Q = 1,
  // then S̄ goes back to 1 and Q stays 1: the loop holds it.
  const ph = t < b.hold - 0.15 ? 0 : t < b.hold + 0.75 ? 1 : 2
  const sn = ph === 1 ? 0 : 1
  const q = ph === 0 ? 0 : 1
  const qn = 1 - q
  // the two feedback wires cross between the gates: Q → lower gate, Q̄ → upper gate
  const w1 = `M60 17 H64 V24 L26 30 V35 H30`
  const w2 = `M60 39 H64 V32 L26 26 V21 H30`
  const wc = (v: number) => ({ stroke: v ? HI : MUTED, strokeWidth: v ? 0.5 : 0.3 })
  const bar = (c: string) => <span style={{ textDecoration: "overline" }}>{c}</span>
  const val = (v: number) => <span style={{ color: v ? HI : FG, fontWeight: 600 }}>{v}</span>
  return (
    <>
      <Svg>
        <g opacity={gates}>
          <path d="M17 13 H30" {...wc(sn)} />
          <path d="M17 43 H30" {...wc(1)} />
          <path d="M60 17 H71" {...wc(q)} />
          <path d="M60 39 H71" {...wc(qn)} />
        </g>
        <GateAt x={45} y={17} scale={0.5} type="nand" a={!!sn} b={!!qn} out={!!q} o={gates} />
        <GateAt x={45} y={39} scale={0.5} type="nand" a={!!q} b out={!!qn} o={gates} />
        <Draw d={w1} p={loop} {...wc(q)} />
        <Draw d={w2} p={loop} {...wc(qn)} />
        <g opacity={loop} stroke="none">
          <circle cx={64} cy={17} r={0.6} fill={q ? HI : MUTED} />
          <circle cx={64} cy={39} r={0.6} fill={qn ? HI : MUTED} />
        </g>
      </Svg>
      <T x={15} y={13} size={2.8} anchor="end" o={gates}>
        <span style={{ color: MUTED }}>{bar("S")} </span>
        {val(sn)}
      </T>
      <T x={15} y={43} size={2.8} anchor="end" o={gates}>
        <span style={{ color: MUTED }}>{bar("R")} </span>
        {val(1)}
      </T>
      <T x={73} y={17} size={3.4} anchor="start" o={loop}>
        <span style={{ color: MUTED }}>Q </span>
        {val(q)}
      </T>
      <T x={73} y={39} size={3.4} anchor="start" o={loop}>
        <span style={{ color: MUTED }}>{bar("Q")} </span>
        {val(qn)}
      </T>
      <T x={50} y={51} size={4} weight={600} o={enter(t, b.latch, 0.5)}>
        锁存器
      </T>
    </>
  )
}

// ── timing: CLK, D, Q ───────────────────────────────────────────────────────

const X0 = 22
const PW = 20

/** Path of a signal: `init` level, then [position, level] transitions, up to `end` (positions in clock periods). */
function wave(init: number, trans: [number, number][], end: number, hi: number, lo: number) {
  const x = (p: number) => X0 + PW * p
  const y = (v: number) => (v ? hi : lo)
  let d = `M${x(0)} ${y(init)}`
  let cur = init
  trans.forEach(([p, v]) => {
    d += `H${x(p)}`
    if (v !== cur) d += `V${y(v)}`
    cur = v
  })
  return d + `H${x(end)}`
}

const CLK: [number, number][] = Array.from({ length: 8 }, (_, i) => [i * 0.5, i % 2 ? 0 : 1] as [number, number])
const DT: [number, number][] = [[0.6, 1], [1.5, 0], [2.3, 1], [2.7, 0], [3.2, 1]]
const QT: [number, number][] = [[1, 1], [2, 0]]
const dAt = (p: number) => DT.reduce((v, [q, x]) => (p >= q ? x : v), 0)

function Edge({ t, b }: Pick<StageProps, "t" | "b">) {
  const c = keys(t, [
    [b.edgeL + 0.3, 0],
    [b.edge - 0.1, 1.0],
    [b.copy + 0.4, 2.0],
    [b.shake - 0.3, 2.3],
    [b.ignore, 2.75],
    [b.countL - 0.5, 3.5],
  ])
  const rows = [
    { y: 14, label: "时钟", d: wave(1, CLK.slice(1), 3.5, 10, 18), color: MUTED },
    { y: 29, label: "D", d: wave(0, DT, 3.5, 25, 33), color: HI },
    { y: 44, label: "Q", d: wave(0, QT, 3.5, 40, 48), color: SEC },
  ]
  const clip = React.useId()
  const on = enter(t, b.edgeL, 0.5)
  const clipW = Math.max(0, PW * c)
  return (
    <>
      <Svg>
        <defs>
          <clipPath id={clip}>
            <rect x={X0} y={0} width={clipW} height={56} />
          </clipPath>
        </defs>
        {rows.map((r) => (
          <g key={r.label} opacity={on}>
            <path d={r.d} stroke={r.color} strokeWidth={0.5} opacity={0.2} />
            <path d={r.d} stroke={r.color} strokeWidth={0.5} clipPath={`url(#${clip})`} />
          </g>
        ))}
        {[1, 2, 3].map((k) => {
          const o = enter(c, k - 0.02, 0.1) * on
          const dv = dAt(k - 0.01)
          return (
            <g key={k} opacity={o}>
              <path d={`M${X0 + PW * k} 8 V50`} stroke={MUTED} strokeDasharray="1 1" strokeWidth={0.2} />
              <circle cx={X0 + PW * k} cy={dv ? 25 : 33} r={0.9} fill={HI} stroke="none" />
            </g>
          )
        })}
        {/* the glitch between two edges */}
        <rect x={X0 + PW * 2.2} y={22} width={PW * 0.6} height={13} rx={1} stroke={HI} strokeWidth={0.25} strokeDasharray="1 0.8" opacity={enter(t, b.shake, 0.4)} />
      </Svg>
      {rows.map((r) => (
        <T key={r.label} x={18} y={r.y} size={2.6} anchor="end" weight={600} color={r.color === MUTED ? FG : r.color} o={on}>
          {r.label}
        </T>
      ))}
      <T x={X0 + PW} y={52} size={2.4} color={MUTED} o={enter(t, b.edge, 0.4) * (1 - enter(t, b.shake, 0.4))}>
        上升沿：抄一次 D
      </T>
      <T x={X0 + PW * 2.5} y={52} size={2.4} color={MUTED} o={enter(t, b.ignore, 0.4)}>
        抖动，没被记下
      </T>
    </>
  )
}

// ── counter ─────────────────────────────────────────────────────────────────

function Count({ t, b }: Pick<StageProps, "t" | "b">) {
  const ticks = Array.from({ length: 16 }, (_, k) => b.same + 0.9 + 0.75 * k)
  const n = ticks.filter((x) => t >= x).length
  const last = n ? ticks[n - 1] : -9
  const flash = Math.max(0, 1 - (t - last) / 0.35)
  const xs = [28, 42, 56, 70]
  const on = enter(t, b.countL, 0.5)
  return (
    <>
      <T x={50} y={8} size={3.4} weight={600} o={enter(t, b.count, 0.5)}>
        计数器
      </T>
      <T x={14} y={20} size={2.6} anchor="start" color={MUTED} o={enter(t, b.same, 0.4)}>
        时钟
      </T>
      <Svg>
        <path d="M24 20 H28 V16 H33 V20 H37" stroke={FG} strokeWidth={0.4} opacity={enter(t, b.same, 0.4)} />
        <circle cx={30.5} cy={16} r={1.4 + flash * 1.2} fill={HI} stroke="none" opacity={flash * 0.8} />
        {xs.map((x, i) => {
          const v = (n >> (3 - i)) & 1
          return <rect key={i} x={x - 5.5} y={26} width={11} height={13} rx={1.4} stroke={v ? HI : LINE} strokeWidth={0.4} opacity={on} />
        })}
      </Svg>
      {xs.map((x, i) => {
        const v = (n >> (3 - i)) & 1
        return (
          <React.Fragment key={i}>
            <T x={x} y={32.5} size={6} weight={600} color={v ? HI : MUTED} o={on} className="tabular">
              {v}
            </T>
            <T x={x} y={43} size={2.4} color={MUTED} o={on}>
              {`Q${3 - i}`}
            </T>
          </React.Fragment>
        )
      })}
      <T x={86} y={32.5} size={6} weight={600} o={enter(t, b.count, 0.5)} className="tabular">
        {n}
      </T>
      <T x={86} y={25} size={2.4} color={MUTED} o={enter(t, b.count, 0.5)}>
        数到
      </T>
    </>
  )
}

// ── each stage halves the frequency ─────────────────────────────────────────

function Div({ t, b }: Pick<StageProps, "t" | "b">) {
  const x = (p: number) => 22 + 8 * p
  const clk: [number, number][] = Array.from({ length: 16 }, (_, i) => [i * 0.5, i % 2 ? 0 : 1] as [number, number]).slice(1)
  const q0: [number, number][] = Array.from({ length: 8 }, (_, k) => [k, (k + 1) & 1] as [number, number])
  const q1: [number, number][] = [[1, 1], [3, 0], [5, 1], [7, 0]]
  const q2: [number, number][] = [[3, 1], [7, 0]]
  const rows = [
    { y: 12, d: wave2(1, clk, 8, x), label: "时钟", at: b.divL + 0.1, color: MUTED, tag: "" },
    { y: 24, d: wave2(0, q0, 8, x), label: "Q0", at: b.divL + 0.9, color: SEC, tag: "÷2" },
    { y: 36, d: wave2(0, q1, 8, x), label: "Q1", at: b.half - 0.7, color: SEC, tag: "÷4" },
    { y: 48, d: wave2(0, q2, 8, x), label: "Q2", at: b.half + 0.1, color: SEC, tag: "÷8" },
  ]
  return (
    <>
      <Svg>
        {rows.map((r) => (
          <Draw key={r.label} d={r.d.replace(/\{y\}/g, "")} p={enter(t, r.at, 1.3)} stroke={r.color} strokeWidth={0.5} transform={`translate(0 ${r.y - 4})`} />
        ))}
      </Svg>
      {rows.map((r) => (
        <React.Fragment key={r.label}>
          <T x={19} y={r.y} size={2.6} anchor="end" weight={600} color={r.color === MUTED ? FG : r.color} o={enter(t, r.at, 0.4)}>
            {r.label}
          </T>
          {r.tag && (
            <T x={88} y={r.y} size={3} anchor="start" weight={600} o={enter(t, b.div + 0.3 * (rows.indexOf(r) - 1), 0.4)}>
              {r.tag}
            </T>
          )}
        </React.Fragment>
      ))}
      <T x={50} y={4.5} size={2.6} color={MUTED} o={enter(t, b.div, 0.5)}>
        分频器
      </T>
    </>
  )
}

/** A wave 8 units tall (top at y 0) for use inside a translated group. */
function wave2(init: number, trans: [number, number][], end: number, x: (p: number) => number) {
  const y = (v: number) => (v ? 0 : 8)
  let d = `M${x(0)} ${y(init)}`
  let cur = init
  trans.forEach(([p, v]) => {
    d += `H${x(p)}`
    if (v !== cur) d += `V${y(v)}`
    cur = v
  })
  return d + `H${x(end)}`
}

// ── crystal: 32768 Hz halved fifteen times ──────────────────────────────────

function Xtal({ t, b }: Pick<StageProps, "t" | "b">) {
  const a = b.halve
  const z = b.one - 0.5
  const k = Math.max(0, Math.min(15, Math.floor(((t - a) / (z - a)) * 15.999)))
  const val = 32768 >> k
  const done = enter(t, b.one, 0.5)
  const blink = Math.max(0, Math.cos((t - b.one) * Math.PI * 2)) ** 6
  return (
    <>
      <Svg>
        <Sym x={14} y={20} scale={0.28} opacity={enter(t, b.xtalL, 0.5)}>
          <Crystal x={0} y={0} />
        </Sym>
        {Array.from({ length: 15 }, (_, i) => (
          <rect key={i} x={15 + i * 4.9} y={34} width={3.6} height={3.6} rx={0.6} stroke={i < k ? HI : LINE} fill={i < k ? HI : "none"} fillOpacity={0.25} strokeWidth={0.3} opacity={enter(t, b.xtalL + 1.2 + i * 0.05, 0.4)} />
        ))}
        <circle cx={50} cy={46} r={1.4 + blink * 0.8} fill={HI} stroke="none" opacity={done * (0.35 + 0.65 * blink)} />
      </Svg>
      <T x={14} y={28} size={2.6} color={MUTED} o={enter(t, b.xtal, 0.4)}>
        晶振
      </T>
      <T x={62} y={20} size={8} weight={600} color={k >= 15 ? HI : FG} o={enter(t, b.xtalL + 0.3, 0.5)} className="tabular">
        {val.toLocaleString("en-US").replace(/,/g, "")}
        <span style={{ fontSize: "0.4em", fontWeight: 400, color: "var(--muted-foreground)" }}> Hz</span>
      </T>
      <T x={50} y={42} size={2.8} color={MUTED} o={enter(t, b.fifteen, 0.4) * (1 - done)}>
        <M>÷2</M> 已经 {k} 次
      </T>
      <T x={50} y={51} size={2.8} weight={600} o={done}>
        每秒一次
      </T>
    </>
  )
}

// ── shift register ──────────────────────────────────────────────────────────

const SD = [1, 0, 1, 1, 0, 0, 1, 0]

function Shift({ t, b }: Pick<StageProps, "t" | "b">) {
  const ticks = Array.from({ length: 8 }, (_, j) => lerp(b.shiftL + 0.5, b.latch2 - 0.6, j / 7))
  const n = ticks.filter((x) => t >= x).length
  const cx = (i: number) => 24 + 8.6 * i
  const out = enter(t, b.latch2, 0.5)
  const on = enter(t, b.shiftL, 0.5)
  return (
    <>
      <T x={50} y={8} size={3.4} weight={600} o={on}>
        移位寄存器
      </T>
      <T x={10} y={14.5} size={2.4} color={MUTED} o={on}>
        数据
      </T>
      <T x={10} y={22} size={5} weight={600} color={HI} o={on * (n < 8 ? 1 : 0)} className="tabular">
        {SD[n] ?? ""}
      </T>
      <Svg>
        <path d="M14 22 H18.5 M17 20.6 L18.5 22 L17 23.4" opacity={on} strokeWidth={0.35} />
        {SD.map((_, i) => (
          <g key={i}>
            <rect x={cx(i) - 3.6} y={18} width={7.2} height={8} rx={1} stroke={n - 1 - i >= 0 && SD[n - 1 - i] ? HI : LINE} strokeWidth={0.35} opacity={on} />
            <circle cx={cx(i)} cy={40} r={2.2} stroke={out > 0.5 && SD[7 - i] ? HI : MUTED} fill={SD[7 - i] ? HI : "none"} fillOpacity={out * 0.9} strokeWidth={0.3} opacity={enter(t, b.shiftL + 0.4, 0.5)} />
            <path d={`M${cx(i)} 26 V37.8`} stroke={out * (SD[7 - i] ? 1 : 0) > 0.5 ? HI : LINE} strokeWidth={0.25} strokeDasharray="0.8 0.8" opacity={enter(t, b.shiftL + 0.4, 0.5)} />
          </g>
        ))}
      </Svg>
      {SD.map((_, i) => {
        const j = n - 1 - i
        return (
          <T key={i} x={cx(i)} y={22} size={4.4} weight={600} color={j >= 0 && SD[j] ? HI : MUTED} o={j >= 0 ? 1 : 0} className="tabular">
            {j >= 0 ? SD[j] : ""}
          </T>
        )
      })}
      <T x={50} y={13.5} size={2.4} color={MUTED} o={on * (1 - out)}>
        每个时钟，挪一格 {"→"}
      </T>
      <T x={50} y={50} size={2.8} weight={600} o={out}>
        八路输出同时更新
      </T>
      <T x={12} y={40} size={2.4} color={MUTED} o={enter(t, b.shiftL + 0.4, 0.5)}>
        输出
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "触发器与时序逻辑",
  audio,
  timing,
  poster: 3.4,
  Stage,
}

export default function SequentialFilm() {
  return <FilmPlayer film={film} />
}

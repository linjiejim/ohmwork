import * as React from "react"
import { trace } from "@/lab/colors"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, Scene, Svg, T, easeInOut, enter, lerp, span, type FilmDef, type StageProps } from "../../kit"
import { Box, LINE, MUTED, Outro, along, head, polyD, stepPath, vzig } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

const VOLT = trace.voltage
const AMP = trace.current
const GOOD = trace.good
const BAD = trace.power
const SEC = trace.second

/*
 * CAN、RS-485 与 USB 一览, ~65 s. Scenes, each keyed to the words that introduce it:
 *   title → a long cable picks up noise
 *   → single-ended: signal + noise = a misread bit
 *   → differential: two opposite wires, the difference is clean, shared noise cancels
 *   → termination: a pulse reflects at the end until 120 Ω resistors absorb it
 *   → RS-485 bus of nodes → CAN arbitration (lowest ID wins) → USB host polling devices
 *   → how to choose, by distance → "try it below".
 */
function Stage({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.6) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)
  const lift = (at: number) => (still ? 0 : -easeInOut((t - at) / 0.45) * 2)

  const title = span(t, 0.25, b.single - 0.45)
  const single = span(t, b.single - 0.2, b.diff - 0.45)
  const diff = span(t, b.diff - 0.2, b.term - 0.45)
  const term = span(t, b.term - 0.2, b.rs485 - 0.45)
  const rs = span(t, b.rs485 - 0.2, b.can - 0.45)
  const can = span(t, b.can - 0.2, b.usb - 0.45)
  const usb = span(t, b.usb - 0.2, b.choose - 0.45)
  const choose = span(t, b.choose - 0.2, b.outro - 0.45)

  return (
    <>
      <Scene o={title} dy={lift(b.single - 0.45)}>
        <Title t={t} b={b} rise={rise} />
      </Scene>
      <Scene o={single}>
        <Single t={t} b={b} />
      </Scene>
      <Scene o={diff}>
        <Diff t={t} b={b} />
      </Scene>
      <Scene o={term}>
        <Term t={t} b={b} still={still} />
      </Scene>
      <Scene o={rs}>
        <Rs485 t={t} b={b} still={still} />
      </Scene>
      <Scene o={can}>
        <Can t={t} b={b} />
      </Scene>
      <Scene o={usb}>
        <Usb t={t} b={b} />
      </Scene>
      <Scene o={choose}>
        <Choose t={t} b={b} />
      </Scene>
      <Outro t={t} b={b} still={still} hint="拖动干扰的大小，看差分怎样把噪声抵消" tryAt={b.tryit} />
    </>
  )
}

const nz = (x: number, ph = 3, f = 1.3) => 0.65 * Math.sin(x * f + ph) + 0.35 * Math.sin(x * 2.3 + ph * 1.7)
const lin = (t: number, a: number, c: number, from: number, to: number) => lerp(from, to, Math.min(1, Math.max(0, (t - a) / Math.max(0.01, c - a))))
const BITS = [1, 0, 1, 1, 0, 1, 0, 0]
const SIG: [number, number][] = [[0, BITS[0]]]
BITS.forEach((v, i) => {
  if (SIG[SIG.length - 1][1] !== v) SIG.push([i, v])
})
const LX0 = 20
const LS = 9 // units per bit

// ── title ────────────────────────────────────────────────────────────────────

function Title({ t, b, rise }: { t: number; b: Record<string, number>; rise: (at: number, d?: number) => number }) {
  const dev = enter(t, 1.8, 0.6)
  const cable = enter(t, b.intro + 1.6, 0.8)
  const meas = enter(t, b.longW, 0.5)
  const amp = enter(t, b.noiseW, 0.6)
  const q = Math.floor(t * 8)
  let d = "M24 31"
  for (let x = 24; x <= 76; x += 1.3) {
    const n = (Math.sin(x * 12.9898 + q * 78.233) * 43758.5453) % 1
    d += `L${x} ${31 + n * 2.6 * amp}`
  }
  return (
    <>
      <Svg>
        <Box x={6} y={22} w={18} h={18} o={dev} />
        <Box x={76} y={22} w={18} h={18} o={dev} />
        {amp < 0.02 ? <Draw d="M24 31H76" p={cable} stroke={VOLT} strokeWidth={0.5} /> : <path d={d} stroke={VOLT} strokeWidth={0.5} />}
        <g opacity={meas} strokeWidth={0.3}>
          <path d="M26 46H74M26 44.8V47.2M74 44.8V47.2" stroke={MUTED} />
          <path d={head(74, 46, 1, 1)} stroke={MUTED} />
          <path d={head(26, 46, -1, 1)} stroke={MUTED} />
        </g>
      </Svg>
      <T x={50} y={10} size={5.2} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
        CAN、RS-485 与 USB 一览
      </T>
      <T x={15} y={31} size={2.8} weight={600} o={dev}>
        设备 A
      </T>
      <T x={85} y={31} size={2.8} weight={600} o={dev}>
        设备 B
      </T>
      <T x={50} y={41.5} size={2.8} color={MUTED} o={meas}>
        几米，甚至上千米
      </T>
      <T x={50} y={24.5} size={2.8} weight={600} color={BAD} o={amp}>
        干扰
      </T>
    </>
  )
}

// ── single-ended ─────────────────────────────────────────────────────────────

function Single({ t, b }: Pick<StageProps, "t" | "b">) {
  const l1 = enter(t, b.single + 0.1, 0.5)
  const cur1 = lin(t, b.single + 0.3, b.oneW + 1.4, 0, 8)
  const l2 = enter(t, b.noise - 0.2, 0.5)
  const cur2 = lin(t, b.noise - 0.1, b.noise + 1.4, 0, 8)
  const l3 = enter(t, b.noise + 1.0, 0.5)
  const cur3 = lin(t, b.noise + 1.2, b.noise + 2.6, 0, 8)
  const lost = enter(t, b.lost - 0.2, 0.4)
  const C1 = 11
  const C2 = 25
  const C3 = 38
  const wave = (c: number, from: (x: number, i: number) => number, upto: number) => {
    let d = ""
    const end = LX0 + upto * LS
    for (let x = LX0, i = 0; x <= end; x += 0.6, i++) d += `${i ? "L" : "M"}${x} ${c + from(x, i)}`
    return d
  }
  const bitAt = (x: number) => BITS[Math.min(7, Math.max(0, Math.floor((x - LX0) / LS)))]
  const sample = BITS.map((bit, k) => {
    const x = LX0 + LS * (k + 0.5)
    const y = (bit ? -3 : 3) + 4.5 * nz(x)
    return { k, x, y, got: y < 0 ? 1 : 0, bit }
  })
  return (
    <>
      <Svg>
        <g opacity={l1}>
          <path d={`M${LX0} ${C1 + 6}H${LX0 + 8 * LS}`} stroke={LINE} />
          <path d={stepPath(SIG, 8, LX0, LS, C1 - 3, C1 + 3, cur1)} stroke={VOLT} strokeWidth={0.5} />
        </g>
        <path d={wave(C2, (x) => 4.5 * nz(x), cur2)} stroke={BAD} strokeWidth={0.4} opacity={l2} />
        <path d={`M${LX0} ${C2}H${LX0 + 8 * LS}`} stroke={LINE} strokeDasharray="0.6 0.8" opacity={l2} />
        <g opacity={l3}>
          <path d={`M${LX0} ${C3}H${LX0 + 8 * LS}`} stroke={MUTED} strokeDasharray="0.8 0.8" strokeWidth={0.2} />
          <path d={wave(C3, (x) => (bitAt(x) ? -3 : 3) + 4.5 * nz(x), cur3)} stroke={VOLT} strokeWidth={0.5} />
        </g>
        {sample.map((s) => {
          const wrong = s.got !== s.bit
          return (
            <g key={s.k} opacity={lost * (cur3 >= s.k + 0.5 ? 1 : 0)}>
              <circle cx={s.x} cy={C3 + s.y} r={0.9} fill={wrong ? BAD : GOOD} stroke="none" />
              {wrong && <path d={`M${s.x - 1.2} ${C3 + s.y - 3.2}L${s.x + 1.2} ${C3 + s.y - 0.8}M${s.x + 1.2} ${C3 + s.y - 3.2}L${s.x - 1.2} ${C3 + s.y - 0.8}`} stroke={BAD} strokeWidth={0.5} />}
            </g>
          )
        })}
      </Svg>
      <T x={LX0 - 2} y={C1} size={2.6} anchor="end" weight={600} color={VOLT} o={l1}>
        信号
      </T>
      <T x={LX0 - 2} y={C2} size={2.6} anchor="end" weight={600} color={BAD} o={l2}>
        干扰
      </T>
      <T x={LX0 - 2} y={C3} size={2.6} anchor="end" weight={600} o={l3}>
        收到
      </T>
      <T x={LX0 + 4 * LS} y={51} size={2.8} weight={600} color={BAD} o={lost}>
        叠在一起，有的位读错了
      </T>
    </>
  )
}

// ── differential ─────────────────────────────────────────────────────────────

function Diff({ t, b }: Pick<StageProps, "t" | "b">) {
  const A = { hi: 13, lo: 19 }
  const B = { hi: 26, lo: 32 }
  const D = { hi: 38, lo: 46 }
  const ab = enter(t, b.diff + 0.2, 0.5)
  const curAB = lin(t, b.diff + 0.3, b.pair + 2.4, 0, 8)
  const dd = enter(t, b.sub - 0.2, 0.5)
  const curD = lin(t, b.sub, b.sub + 2.2, 0, 8)
  const noise = enter(t, b.twist, 0.8)
  const canc = enter(t, b.cancelW, 0.4)
  const wave = (c: number, level: (x: number) => number, upto: number) => {
    let d = ""
    const end = LX0 + upto * LS
    for (let x = LX0, i = 0; x <= end; x += 0.6, i++) d += `${i ? "L" : "M"}${x} ${c + level(x) + 3 * noise * nz(x)}`
    return d
  }
  const bitAt = (x: number) => BITS[Math.min(7, Math.max(0, Math.floor((x - LX0) / LS)))]
  // twisted pair glyph
  const tw = enter(t, b.twist - 0.1, 0.5)
  let g1 = ""
  let g2 = ""
  for (let x = 70; x <= 92; x += 0.5) {
    const y = Math.sin((x - 70) * 0.9) * 1.5
    g1 += `${x === 70 ? "M" : "L"}${x} ${5.5 + y}`
    g2 += `${x === 70 ? "M" : "L"}${x} ${5.5 - y}`
  }
  return (
    <>
      <Svg>
        <g opacity={ab}>
          <path d={`M${LX0} ${A.lo + 4.5}H${LX0 + 8 * LS}`} stroke={LINE} />
          <path d={`M${LX0} ${B.lo + 4.5}H${LX0 + 8 * LS}`} stroke={LINE} />
        </g>
        {ab > 0 && (
          <>
            <path d={wave((A.hi + A.lo) / 2, (x) => (bitAt(x) ? -3 : 3), curAB)} stroke={VOLT} strokeWidth={0.5} opacity={ab} />
            <path d={wave((B.hi + B.lo) / 2, (x) => (bitAt(x) ? 3 : -3), curAB)} stroke={SEC} strokeWidth={0.5} opacity={ab} />
          </>
        )}
        <g opacity={dd}>
          <path d={`M${LX0} ${(D.hi + D.lo) / 2}H${LX0 + 8 * LS}`} stroke={LINE} strokeDasharray="0.6 0.8" />
          <path d={stepPath(SIG, 8, LX0, LS, D.hi, D.lo, curD)} stroke={AMP} strokeWidth={0.7} />
        </g>
        <g opacity={tw}>
          <path d={g1} stroke={VOLT} strokeWidth={0.35} />
          <path d={g2} stroke={SEC} strokeWidth={0.35} />
        </g>
      </Svg>
      <T x={LX0 - 2} y={(A.hi + A.lo) / 2} size={2.6} anchor="end" weight={600} color={VOLT} o={ab}>
        A 线
      </T>
      <T x={LX0 - 2} y={(B.hi + B.lo) / 2} size={2.6} anchor="end" weight={600} color={SEC} o={ab}>
        B 线
      </T>
      <T x={LX0 - 2} y={(D.hi + D.lo) / 2} size={2.6} anchor="end" weight={600} color={AMP} o={dd}>
        A − B
      </T>
      <T x={67} y={5.5} size={2.6} anchor="end" color={MUTED} o={tw}>
        双绞线
      </T>
      <T x={50} y={9} size={2.8} color={MUTED} o={enter(t, b.pair, 0.4) * (1 - tw)}>
        一对相反的电压
      </T>
      <T x={50} y={50.5} size={2.8} weight={600} color={GOOD} o={canc}>
        同样的干扰相减，抵消了
      </T>
    </>
  )
}

// ── termination ──────────────────────────────────────────────────────────────

function Term({ t, b, still }: StageProps) {
  const Y1 = 22
  const Y2 = 34
  const on = enter(t, b.term, 0.6)
  const res = enter(t, b.termW - 1.1, 0.5)
  const RE = 86
  const LE = 14
  const tau = (t - b.term) % 3.4
  const fwd = Math.min(1, tau / 1.5)
  const echo = res > 0.5 ? 0 : Math.max(0, Math.min(1, (tau - 1.5) / 1.5))
  const x = lerp(LE, RE, fwd)
  const xe = lerp(RE, LE, echo)
  const absorbed = res > 0.5 && tau > 1.5 ? Math.max(0, 1 - (tau - 1.5) / 0.3) : 1
  const refl = enter(t, b.reflect, 0.4) * (1 - res)
  return (
    <>
      <Svg>
        <Draw d={`M${LE} ${Y1}H${RE}`} p={on} stroke={VOLT} strokeWidth={0.5} />
        <Draw d={`M${LE} ${Y2}H${RE}`} p={on} stroke={SEC} strokeWidth={0.5} />
        {[LE, RE].map((cx) => (
          <g key={cx} opacity={res}>
            <path d={vzig(cx, Y1, Y2, 1.5, 6)} />
            <circle cx={cx} cy={Y1} r={0.7} fill={VOLT} stroke="none" />
            <circle cx={cx} cy={Y2} r={0.7} fill={SEC} stroke="none" />
          </g>
        ))}
        {on > 0.9 && (still ? tau < 0 : true) && (
          <g opacity={absorbed}>
            <circle cx={x} cy={Y1} r={1.1} fill={VOLT} stroke="none" opacity={echo > 0 ? 0 : 1} />
            <circle cx={x} cy={Y2} r={1.1} fill={SEC} stroke="none" opacity={echo > 0 ? 0 : 1} />
          </g>
        )}
        {echo > 0 && echo < 1 && (
          <>
            <circle cx={xe} cy={Y1} r={1.1} fill={BAD} stroke="none" />
            <circle cx={xe} cy={Y2} r={1.1} fill={BAD} stroke="none" />
          </>
        )}
        <g opacity={on * 0.9} stroke={MUTED} strokeWidth={0.25}>
          <path d={`M${LE} 42H${RE}M${LE} 40.8V43.2M${RE} 40.8V43.2`} />
        </g>
      </Svg>
      <T x={50} y={9} size={3} color={MUTED} o={on}>
        长长的一对线
      </T>
      <T x={RE - 3} y={Y1 - 4.5} size={2.8} weight={600} color={BAD} o={refl} anchor="end">
        到了尽头，反射回来
      </T>
      <T x={50} y={46.5} size={2.6} color={MUTED} o={on}>
        线很长
      </T>
      {[LE, RE].map((cx) => (
        <T key={cx} x={cx === LE ? cx - 2.6 : cx + 2.6} y={(Y1 + Y2) / 2} size={2.8} weight={600} anchor={cx === LE ? "end" : "start"} o={res} className="tabular">
          120 Ω
        </T>
      ))}
      <T x={50} y={28} size={2.8} weight={600} color={GOOD} o={res * 0.0}>
        {""}
      </T>
      <T x={50} y={50.5} size={3} weight={600} color={GOOD} o={res}>
        两端各一只，把信号吃掉
      </T>
    </>
  )
}

// ── RS-485 ───────────────────────────────────────────────────────────────────

function Rs485({ t, b, still }: StageProps) {
  const A = 22
  const B = 29
  const on = enter(t, b.rs485, 0.5)
  const hdr = enter(t, b.rs485 + 0.2, 0.5)
  const sub = enter(t, b.rsW, 0.5)
  const C = [18, 34, 50, 66, 82]
  const node = (i: number) => enter(t, b.rsW + 0.2 + i * 0.25, 0.45)
  const talk = still ? -1 : Math.floor((t - b.nodes) / 1.2)
  const cur = t > b.nodes ? ((talk % 5) + 5) % 5 : -1
  return (
    <>
      <Svg>
        <Draw d={`M10 ${A}H90`} p={on} stroke={VOLT} strokeWidth={0.5} />
        <Draw d={`M10 ${B}H90`} p={on} stroke={SEC} strokeWidth={0.5} />
        {[10, 90].map((x) => (
          <g key={x} opacity={on}>
            <path d={vzig(x, A, B, 1, 4)} strokeWidth={0.25} />
          </g>
        ))}
        {C.map((c, i) => (
          <g key={c}>
            <Box x={c - 6} y={37} w={12} h={9} o={node(i)} color={i === cur ? VOLT : undefined} strokeWidth={i === cur ? 0.6 : undefined} />
            <Draw d={`M${c - 2} 37V${B}`} p={node(i)} stroke={SEC} />
            <Draw d={`M${c + 2} 37V${A}`} p={node(i)} stroke={VOLT} />
            <circle cx={c - 2} cy={B} r={0.6} fill={SEC} stroke="none" opacity={node(i)} />
            <circle cx={c + 2} cy={A} r={0.6} fill={VOLT} stroke="none" opacity={node(i)} />
          </g>
        ))}
      </Svg>
      <T x={50} y={9} size={4.6} weight={600} o={hdr}>
        RS-485
      </T>
      <T x={50} y={15} size={2.8} color={MUTED} o={sub}>
        差分版的串口：同样的帧，换成一对线
      </T>
      <T x={7} y={A} size={2.4} anchor="end" weight={600} color={VOLT} o={on}>
        A
      </T>
      <T x={7} y={B} size={2.4} anchor="end" weight={600} color={SEC} o={on}>
        B
      </T>
      {C.map((c, i) => (
        <T key={c} x={c} y={41.5} size={2.6} color={i === cur ? undefined : MUTED} weight={i === cur ? 600 : 400} o={node(i)}>
          {`节点 ${i + 1}`}
        </T>
      ))}
      <T x={50} y={51} size={2.8} color={MUTED} o={enter(t, b.nodes, 0.5)}>
        一条总线，挂几十个节点
      </T>
    </>
  )
}

// ── CAN arbitration ──────────────────────────────────────────────────────────

const IDS = [[1, 0, 1, 1, 0], [1, 0, 0, 1, 0], [1, 1, 0, 0, 0]]
const NAMES = ["节点 A", "节点 B", "节点 C"]
function Can({ t, b }: Pick<StageProps, "t" | "b">) {
  const X = [44, 54, 64, 74, 84]
  const Y = [20, 28, 36]
  const BUS_Y = 46
  const hdr = enter(t, b.can, 0.5)
  const sub = enter(t, b.grab - 0.3, 0.5)
  const dt = (b.arb + 0.6 - (b.can + 1.0)) / 5
  const colT = (i: number) => b.can + 1.0 + i * dt
  const col = (i: number) => enter(t, colT(i), 0.3)
  const LOSS = [2, 99, 1] // node A leaves after bit 2, C after bit 1
  const winner = enter(t, colT(4) + 0.9, 0.5)
  const busBits = [0, 1, 2, 3, 4].map((i) => Math.min(...IDS.filter((_, n) => LOSS[n] >= i).map((id) => id[i])))
  const cur = Math.min(4, Math.max(0, Math.floor((t - (b.can + 1.0)) / dt)))
  const showCur = t >= b.can + 1.0 && t < colT(4) + dt
  return (
    <>
      <Svg>
        {showCur && <rect x={X[cur] - 4.6} y={16} width={9.2} height={35} rx={1} fill="var(--selected)" stroke="none" opacity={0.8} />}
        <path d={`M12 41.5H92`} stroke={LINE} opacity={sub} />
        <rect x={12} y={Y[1] - 4} width={80} height={8} rx={1} fill="none" stroke={GOOD} strokeWidth={0.5} opacity={winner} />
      </Svg>
      <T x={50} y={8} size={4.6} weight={600} o={hdr}>
        CAN
      </T>
      <T x={50} y={13.5} size={2.6} color={MUTED} o={sub}>
        谁先开口？数值小的赢
      </T>
      {IDS.map((id, n) =>
        id.map((v, i) => {
          const out = LOSS[n] < i
          return (
            <T key={`${n}-${i}`} x={X[i]} y={Y[n]} size={3.4} weight={600} color={out ? "var(--faint-foreground)" : VOLT} o={col(i)} className="tabular">
              {v}
            </T>
          )
        }),
      )}
      {IDS.map((_, n) => (
        <T key={n} x={36} y={Y[n]} size={2.6} anchor="end" weight={n === 1 && winner > 0.5 ? 600 : 400} color={LOSS[n] < 5 && t > colT(Math.min(4, LOSS[n])) + 0.2 ? "var(--faint-foreground)" : undefined} o={enter(t, b.can + 0.8, 0.5)}>
          {NAMES[n]}
        </T>
      ))}
      {([[0, 2], [2, 1]] as const).map(([n, i]) => (
        <T key={n} x={X[i] + 5.2} y={Y[n] - 3} size={2.1} anchor="start" weight={600} color={BAD} o={enter(t, colT(i) + 0.3, 0.3)}>
          退出
        </T>
      ))}
      {busBits.map((v, i) => (
        <T key={i} x={X[i]} y={BUS_Y} size={3.4} weight={600} color={AMP} o={col(i)} className="tabular">
          {v}
        </T>
      ))}
      <T x={36} y={BUS_Y} size={2.6} anchor="end" weight={600} color={AMP} o={enter(t, b.can + 0.8, 0.5)}>
        总线
      </T>
      <T x={50} y={51} size={2.6} weight={600} color={GOOD} o={winner}>
        节点 B 胜出，其余自动让路
      </T>
    </>
  )
}

// ── USB ──────────────────────────────────────────────────────────────────────

function Usb({ t, b }: Pick<StageProps, "t" | "b">) {
  const YC = [14, 31, 48]
  const host = enter(t, b.usb, 0.5)
  const hostHi = enter(t, b.hostW - 0.1, 0.3)
  const links = enter(t, b.usbW - 0.2, 0.6)
  const dev = (i: number) => enter(t, b.usb + 0.4 + i * 0.2, 0.5)
  const paths = YC.map((y) => [[28, 31], [50, 31], [50, y], [70, y]] as [number, number][])
  const go = t - b.asked
  const idx = go < 0 ? -1 : Math.floor(go / 2.2) % 3
  const ph = go < 0 ? 0 : (go % 2.2) / 2.2
  let pos: [number, number] | null = null
  let ans = false
  if (idx >= 0) {
    if (ph < 0.4) pos = along(paths[idx], ph / 0.4)
    else if (ph > 0.5 && ph < 0.9) {
      pos = along([...paths[idx]].reverse(), (ph - 0.5) / 0.4)
      ans = true
    }
  }
  return (
    <>
      <Svg>
        <Box x={8} y={21} w={20} h={20} o={host} color={hostHi > 0.5 ? VOLT : undefined} strokeWidth={hostHi > 0.5 ? 0.6 : undefined} />
        {paths.map((p, i) => (
          <g key={i} opacity={links}>
            <path d={polyD(p)} stroke={idx === i && pos ? VOLT : "var(--foreground)"} strokeWidth={1.5} opacity={0.35} />
            <path d={polyD(p)} stroke="var(--background)" strokeWidth={0.6} />
          </g>
        ))}
        {YC.map((y, i) => (
          <Box key={i} x={70} y={y - 4.5} w={22} h={9} o={dev(i)} color={idx === i && pos ? VOLT : undefined} strokeWidth={idx === i && pos ? 0.6 : undefined} />
        ))}
        {pos && <circle cx={pos[0]} cy={pos[1]} r={1.1} fill={ans ? AMP : VOLT} stroke="none" />}
      </Svg>
      <T x={18} y={31} size={3.2} weight={600} o={host}>
        电脑
      </T>
      <T x={18} y={37.5} size={2.4} color={hostHi > 0.5 ? VOLT : MUTED} weight={hostHi > 0.5 ? 600 : 400} o={host}>
        {hostHi > 0.5 ? "主机" : "USB"}
      </T>
      {YC.map((y, i) => (
        <T key={i} x={81} y={y} size={2.8} color={MUTED} o={dev(i)}>
          {["键盘", "U 盘", "鼠标"][i]}
        </T>
      ))}
      <T x={39} y={27} size={2.4} color={MUTED} o={links}>
        D+  D−
      </T>
      <T x={50} y={51} size={2.8} color={MUTED} o={enter(t, b.asked - 0.3, 0.5)}>
        {ans ? "设备：回答" : pos ? "主机：问" : "设备：等着被问"}
      </T>
    </>
  )
}

// ── choosing ─────────────────────────────────────────────────────────────────

const STOPS: { x: number; label: string; items: string[]; far: boolean }[] = [
  { x: 18, label: "板内", items: ["I²C", "SPI"], far: false },
  { x: 40, label: "几米", items: ["UART"], far: false },
  { x: 64, label: "几百米", items: ["CAN"], far: true },
  { x: 86, label: "上千米", items: ["RS-485"], far: true },
]

function Choose({ t, b }: Pick<StageProps, "t" | "b">) {
  const near = enter(t, b.shortW - 0.1, 0.5)
  const far = enter(t, b.longD - 0.1, 0.5)
  const o = (f: boolean) => (f ? far : near)
  const ax = enter(t, b.choose, 0.7)
  return (
    <>
      <Svg>
        <Draw d="M8 38H93" p={ax} strokeWidth={0.4} />
        <path d={head(93, 38, 1, 1.2)} opacity={ax} />
        {STOPS.map((s) => (
          <g key={s.x} opacity={ax}>
            <circle cx={s.x} cy={38} r={0.9} fill={s.far ? SEC : "var(--foreground)"} stroke="none" />
            <path d={`M${s.x} 36.5V33`} stroke={LINE} />
          </g>
        ))}
      </Svg>
      <T x={8} y={44.5} size={2.6} anchor="start" color={MUTED} o={ax}>
        距离
      </T>
      {STOPS.map((s) => (
        <React.Fragment key={s.x}>
          <T x={s.x} y={43} size={2.8} weight={600} color={s.far ? SEC : undefined} o={enter(t, b.choose + 0.5, 0.5)}>
            {s.label}
          </T>
          {s.items.map((it, i) => (
            <T
              key={it}
              x={s.x}
              y={29 - i * 7}
              size={2.8}
              weight={600}
              color={s.far ? SEC : undefined}
              o={o(s.far) * enter(t, (s.far ? b.longD : b.shortW) + i * 0.25, 0.4)}
              className={`rounded-full border px-[0.9em] py-[0.4em] ${s.far ? "border-input" : "border-input"}`}
            >
              {it}
            </T>
          ))}
        </React.Fragment>
      ))}
      <T x={29} y={9} size={2.8} color={MUTED} o={near}>
        前面三种：板内、短距离
      </T>
      <T x={75} y={9} size={2.8} weight={600} color={SEC} o={far}>
        长距离：差分总线
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "CAN、RS-485 与 USB 一览",
  audio,
  timing,
  poster: 4.6,
  Stage,
}

export default function BusesOverviewFilm() {
  return <FilmPlayer film={film} />
}

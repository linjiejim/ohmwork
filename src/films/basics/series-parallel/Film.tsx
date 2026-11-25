import * as React from "react"
import { glow } from "@/lab/colors"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, M, Scene, Svg, T, V, easeInOut, enter, leave, lerp, span, type FilmDef, type StageProps } from "../../kit"
import { AMP, BatteryV, Flow, LINE, MUTED, POWER, VOLT, integ, zig } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

const FG = "var(--foreground)"

/*
 * 串联与并联, 56 s. Scenes, each keyed to the words that introduce it:
 *   title → two mini circuits, series and parallel
 *   → series: three resistors on one loop, same current (1 mA each), voltage split (1 + 2 + 3 V),
 *     then 1 k + 2 k + 3 k merge into one 6 k
 *   → parallel: three branches between two rails, 6 V on each, currents 6 / 3 / 2 mA, total 11 mA
 *   → bars: the equivalent resistance is shorter than the shortest → two 10 k make 5 k
 *   → one breaks: series goes dark, parallel keeps two lamps → "try parallel below".
 */
function Stage({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.6) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)
  // a scene has faded out by the time the next line starts, and the next fades in from there:
  // two scenes are never on the stage at once
  const sc = (a: number, z: number) => span(t, a - 0.05, z - 0.3, 0.35, 0.3)
  const title = span(t, 0.25, b.sA - 0.3, 0.4, 0.3)
  const series = sc(b.sA, b.pA)
  const parallel = sc(b.pA, b.pC)
  const bars = sc(b.pC, b.trick)
  const trick = sc(b.trick, b.brk)
  const brk = sc(b.brk, b.outro)
  const outro = enter(t, b.outro - 0.05, 0.4)
  return (
    <>
      <Scene o={title}>
        <Title t={t} b={b} rise={rise} />
      </Scene>
      <Scene o={series}>
        <Series t={t} b={b} still={still} />
      </Scene>
      <Scene o={parallel}>
        <Parallel t={t} b={b} still={still} />
      </Scene>
      <Scene o={bars}>
        <Bars t={t} b={b} />
      </Scene>
      <Scene o={trick}>
        <Trick t={t} b={b} />
      </Scene>
      <Scene o={brk}>
        <Break t={t} b={b} />
      </Scene>
      <Scene o={outro}>
        <Outro t={t} b={b} still={still} rise={rise} />
      </Scene>
    </>
  )
}

// ── title ────────────────────────────────────────────────────────────────────

function Title({ t, b, rise }: { t: number; b: Record<string, number>; rise: (at: number, d?: number) => number }) {
  const frame = enter(t, b.intro + 1.0, 0.6)
  const cards = [
    { x: 29, word: "串联", at: b.ser },
    { x: 71, word: "并联", at: b.par },
  ]
  return (
    <>
      <T x={50} y={12} size={7.6} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
        串联与并联
      </T>
      <Svg>
        {cards.map((c) => (
          <rect key={c.word} x={c.x - 17} y={22} width={34} height={21} rx={1.6} stroke={LINE} strokeWidth={0.25} opacity={frame} />
        ))}
        {/* series: two resistors in a row */}
        <path d={`M12 29 H14 ${zig(14, 29, 27, 29, 5, 1.4)} ${zig(31, 29, 44, 29, 5, 1.4)} M27 29 H31 M44 29 H46`} opacity={enter(t, b.ser, 0.5)} />
        {/* parallel: two resistors side by side */}
        <g opacity={enter(t, b.par, 0.5)}>
          <path d="M54 29 H58 M58 25 V33 M58 25 H60 M58 33 H60 M80 25 H84 M80 33 H84 M84 25 V33 M84 29 H88" />
          <path d={zig(60, 25, 80, 25, 6, 1.3)} />
          <path d={zig(60, 33, 80, 33, 6, 1.3)} />
        </g>
      </Svg>
      {cards.map((c) => (
        <T key={c.word} x={c.x} y={38} size={3.2} o={enter(t, c.at + 0.1, 0.4)}>
          {c.word}
        </T>
      ))}
    </>
  )
}

// ── series ───────────────────────────────────────────────────────────────────

const L = 16
const R = 86
const TOP = 14
const BOT = 46
const MID = 30
const PER = 2 * (R - L) + 2 * (BOT - TOP)
const XS = [34, 54, 74]
const HALF = 7

function onLoop(d: number): [number, number] {
  const w = R - L
  const h = BOT - TOP
  const s = ((d % PER) + PER) % PER
  if (s < w) return [L + s, TOP]
  if (s < w + h) return [R, TOP + (s - w)]
  if (s < 2 * w + h) return [R - (s - w - h), BOT]
  return [L, BOT - (s - 2 * w - h)]
}

function Series({ t, b, still }: StageProps) {
  const phase = still ? 0 : integ((s) => 8 * enter(s, b.one, 0.6), b.one, Math.max(t, b.one))
  const wires = enter(t, b.sA - 0.3, 0.8)
  const rAt = [b.sA - 0.1, b.chain, b.chain + 0.5]
  const merge = enter(t, b.r6, 0.6)
  // the 1 mA / 1-2-3 V tags land at the end of their line: keep them until the sum starts
  const tags = leave(t, b.sum - 0.4, 0.4)
  const values = ["1 kΩ", "2 kΩ", "3 kΩ"]
  const eq = (at: number) => enter(t, at, 0.4)
  return (
    <>
      <Svg>
        <Draw d={`M${L} ${MID - 1.2} V${TOP} H${XS[0] - HALF}`} p={wires} />
        <Draw d={`M${XS[0] + HALF} ${TOP} H${XS[1] - HALF}`} p={enter(t, b.chain, 0.5)} opacity={1 - merge} />
        <Draw d={`M${XS[1] + HALF} ${TOP} H${XS[2] - HALF}`} p={enter(t, b.chain + 0.5, 0.5)} opacity={1 - merge} />
        <Draw d={`M${XS[2] + HALF} ${TOP} H${R} V${BOT} H${L} V${MID + 1.2}`} p={wires} />
        <BatteryV x={L} y={MID} o={enter(t, b.sA - 0.3, 0.45)} />
        {XS.map((x, i) => (
          <path key={x} d={zig(x - HALF, TOP, x + HALF, TOP, 5, 1.5)} opacity={enter(t, rAt[i], 0.45) * (1 - merge)} />
        ))}
        <path d={zig(33, TOP, 75, TOP, 12, 1.6, 0.14)} opacity={merge} />
        {(
          <g>
            {Array.from({ length: Math.floor(PER / 4) }, (_, i) => {
              const [x, y] = onLoop(i * 4 + phase)
              if (y === TOP && ((merge < 0.5 && XS.some((c) => Math.abs(x - c) < HALF + 0.3)) || (merge >= 0.5 && x > 32.7 && x < 75.3))) return null
              if (x === L && Math.abs(y - MID) < 3) return null
              return <circle key={i} cx={x} cy={y} r={0.6} fill={AMP} stroke="none" opacity={enter(t, b.one, 0.4)} />
            })}
          </g>
        )}
      </Svg>
      <T x={23} y={MID} size={3.6} anchor="start" weight={600} color={VOLT} o={enter(t, b.sA, 0.5)}>
        6 V
      </T>
      {XS.map((x, i) => (
        <React.Fragment key={x}>
          <T x={x} y={8.5} size={3} color={FG} o={enter(t, rAt[i] + 0.1, 0.4) * (1 - merge)} className="tabular">
            <M>{values[i]}</M>
          </T>
          <T x={x} y={20.5} size={3} weight={600} color={AMP} o={enter(t, b.same + i * 0.25, 0.4) * tags} className="tabular">
            <M>1 mA</M>
          </T>
          <T x={x} y={26} size={3} weight={600} color={VOLT} o={enter(t, b.split + i * 0.25, 0.4) * tags} className="tabular">
            <M>{i + 1} V</M>
          </T>
        </React.Fragment>
      ))}
      <T x={54} y={8.5} size={3.6} weight={600} o={merge} className="tabular">
        <M>6 kΩ</M>
      </T>
      <T x={50} y={33} size={2.6} color={MUTED} o={eq(b.sum)}>
        等效电阻
      </T>
      <T x={51} y={40} size={4.2}>
        <span className="inline-flex items-center gap-[0.3em] tabular">
          <span style={{ opacity: eq(b.r1) }}>
            <M>1 kΩ</M>
          </span>
          <span style={{ opacity: eq(b.r2 - 0.2) }}>
            <M>+</M>
          </span>
          <span style={{ opacity: eq(b.r2) }}>
            <M>2 kΩ</M>
          </span>
          <span style={{ opacity: eq(b.r3 - 0.2) }}>
            <M>+</M>
          </span>
          <span style={{ opacity: eq(b.r3) }}>
            <M>3 kΩ</M>
          </span>
          <span style={{ opacity: eq(b.r6 - 0.3) }}>
            <M>=</M>
          </span>
          <span className="inline-block" style={{ opacity: eq(b.r6), transform: `scale(${lerp(1.18, 1, enter(t, b.r6, 0.5))})` }}>
            <M c={FG} className="font-semibold">
              6 kΩ
            </M>
          </span>
        </span>
      </T>
    </>
  )
}

// ── parallel ─────────────────────────────────────────────────────────────────

const PX = [32, 50, 68]
const PT = 14
const PB = 46
const CUR = [6, 3, 2]
const RES = ["1 kΩ", "2 kΩ", "3 kΩ"]

function Parallel({ t, b, still }: StageProps) {
  const base = still ? 0 : integ((s) => enter(s, b.fork, 0.6), b.fork, Math.max(t, b.fork))
  const ph = (i: number) => base * i * 1.1
  const on = enter(t, b.fork, 0.4)
  const legAt = [b.pA - 0.1, b.ends, b.ends + 0.5]
  const rail = [enter(t, b.pA - 0.3, 0.8), enter(t, b.ends, 0.5), enter(t, b.ends + 0.5, 0.5)]
  const pulse = span(t, b.small, b.small + 1.4, 0.2, 0.6)
  const leg = (x: number, i: number) => (
    <g key={x} opacity={1}>
      <Draw d={`M${x} ${PT} V24`} p={enter(t, legAt[i], 0.5)} />
      <path d={zig(x, 24, x, 36, 4, 1.5)} opacity={enter(t, legAt[i] + 0.15, 0.4)} />
      <Draw d={`M${x} 36 V${PB}`} p={enter(t, legAt[i] + 0.3, 0.5)} />
    </g>
  )
  return (
    <>
      <Svg>
        <Draw d={`M14 ${PB} V31.2 M14 28.8 V${PT} H${PX[0]}`} p={rail[0]} />
        <Draw d={`M${PX[0]} ${PB} H14`} p={rail[0]} />
        <Draw d={`M${PX[0]} ${PT} H${PX[1]}`} p={rail[1]} />
        <Draw d={`M${PX[1]} ${PB} H${PX[0]}`} p={rail[1]} />
        <Draw d={`M${PX[1]} ${PT} H${PX[2]}`} p={rail[2]} />
        <Draw d={`M${PX[2]} ${PB} H${PX[1]}`} p={rail[2]} />
        <BatteryV x={14} y={30} o={enter(t, b.pA - 0.3, 0.45)} />
        {PX.map(leg)}
        <g fill={FG} stroke="none">
          {[0, 1].map((i) => (
            <React.Fragment key={i}>
              <circle cx={PX[i]} cy={PT} r={0.75} opacity={enter(t, legAt[i], 0.4)} />
              <circle cx={PX[i]} cy={PB} r={0.75} opacity={enter(t, legAt[i], 0.4)} />
            </React.Fragment>
          ))}
        </g>
        {/* the charges: speed follows the current in each piece of wire */}
        <Flow x0={14} y0={PB} x1={14} y1={31.2} phase={ph(11)} o={on * rail[0]} />
        <Flow x0={14} y0={28.8} x1={14} y1={PT} phase={ph(11)} o={on * rail[0]} />
        <Flow x0={14} y0={PT} x1={PX[0]} y1={PT} phase={ph(11)} o={on * rail[0]} />
        <Flow x0={PX[0]} y0={PT} x1={PX[1]} y1={PT} phase={ph(5)} o={on * rail[1]} />
        <Flow x0={PX[1]} y0={PT} x1={PX[2]} y1={PT} phase={ph(2)} o={on * rail[2]} />
        {PX.map((x, i) => (
          <Flow key={x} x0={x} y0={PT} x1={x} y1={PB} phase={ph(CUR[i])} o={on * enter(t, legAt[i] + 0.3, 0.4)} skip={[[9.4, 22.6]]} />
        ))}
        <Flow x0={PX[2]} y0={PB} x1={PX[1]} y1={PB} phase={ph(2)} o={on * rail[2]} />
        <Flow x0={PX[1]} y0={PB} x1={PX[0]} y1={PB} phase={ph(5)} o={on * rail[1]} />
        <Flow x0={PX[0]} y0={PB} x1={14} y1={PB} phase={ph(11)} o={on * rail[0]} />
        <rect x={PX[0] - 3.1} y={22.4} width={6.2} height={15.2} rx={1.6} stroke={AMP} strokeWidth={0.4} opacity={pulse * 0.9} />
      </Svg>
      <T x={7} y={22} size={3.4} weight={600} color={VOLT} o={enter(t, b.pA, 0.5)}>
        6 V
      </T>
      {PX.map((x, i) => (
        <React.Fragment key={x}>
          <T x={x + 3.8} y={30} size={2.8} anchor="start" o={enter(t, legAt[i] + 0.2, 0.4)} className="tabular">
            <M>{RES[i]}</M>
          </T>
          <T x={x} y={8.5} size={3} weight={600} color={VOLT} o={enter(t, b.samev + i * 0.25, 0.4)} className="tabular">
            <M>6 V</M>
          </T>
          <T x={x + 3.8} y={41} size={3} anchor="start" weight={600} color={AMP} o={enter(t, b.each + i * 0.3, 0.4)} className="tabular">
            <M>{CUR[i]} mA</M>
          </T>
        </React.Fragment>
      ))}
      <T x={82} y={21} size={2.5} anchor="start" color={MUTED} o={enter(t, b.each + 1.3, 0.5)}>
        总电流 <V c={AMP}>I</V>
      </T>
      <T x={82} y={29} size={4.2} anchor="start" weight={600} color={AMP} o={enter(t, b.each + 1.3, 0.5)} className="tabular">
        11 mA
      </T>
    </>
  )
}

// ── equivalent resistance is shorter than the shortest ───────────────────────

function Bars({ t, b }: Pick<StageProps, "t" | "b">) {
  const rows = [
    { y: 16, ohm: 1000, label: "1 kΩ", at: b.pC - 0.1 },
    { y: 26, ohm: 2000, label: "2 kΩ", at: b.pC + 0.15 },
    { y: 36, ohm: 3000, label: "3 kΩ", at: b.pC + 0.4 },
  ]
  const S = 0.02
  const X0 = 24
  const len = (ohm: number, at: number) => ohm * S * easeInOut((t - at) / 0.7)
  const rAt = b.less - 0.3
  return (
    <>
      <Svg>
        {rows.map((r) => (
          <rect key={r.y} x={X0} y={r.y - 1.5} width={Math.max(0.01, len(r.ohm, r.at))} height={3} rx={0.6} fill={MUTED} stroke="none" opacity={0.5 * enter(t, r.at, 0.2)} />
        ))}
        <path d={`M${X0 + 1000 * S} 10 V48`} stroke={MUTED} strokeWidth={0.25} strokeDasharray="1 0.8" opacity={enter(t, b.pC + 1.0, 0.5)} />
        <rect x={X0} y={44.5} width={Math.max(0.01, len(545, rAt))} height={3} rx={0.6} fill={FG} stroke="none" opacity={enter(t, rAt, 0.2)} />
      </Svg>
      {rows.map((r) => (
        <T key={r.y} x={X0 - 2} y={r.y} size={3} anchor="end" o={enter(t, r.at, 0.4)} className="tabular">
          <M>{r.label}</M>
        </T>
      ))}
      <T x={X0 + 1000 * S + 1.5} y={9} size={2.4} anchor="start" color={MUTED} o={enter(t, b.pC + 1.0, 0.5)}>
        最小的那只
      </T>
      <T x={X0 - 2} y={46} size={3} anchor="end" weight={600} o={enter(t, rAt, 0.4)}>
        并联后
      </T>
      <T x={X0 + 545 * S + 2} y={46} size={3.4} anchor="start" weight={600} o={enter(t, b.less, 0.4)} className="tabular">
        <M>≈ 545 Ω</M>
      </T>
      <T x={50} y={51.5} size={2.8} color={MUTED} o={enter(t, b.extra, 0.5)}>
        多一条路，电流更容易通过
      </T>
    </>
  )
}

// ── two equal resistors → half ───────────────────────────────────────────────

function Trick({ t, b }: Pick<StageProps, "t" | "b">) {
  const first = enter(t, b.trick - 0.1, 0.5)
  const second = enter(t, b.two, 0.5)
  const res = enter(t, b.half, 0.5)
  return (
    <>
      <T x={50} y={9} size={2.6} o={enter(t, b.trick - 0.1, 0.4)} className="rounded-full border border-input px-[0.9em] py-[0.45em] text-muted-foreground">
        口算窍门
      </T>
      <Svg>
        <g opacity={first}>
          <path d="M8 28 H16 M16 21 V28 M16 21 H20 M40 21 H44 M44 21 V28 M44 28 H52" />
          <path d={zig(20, 21, 40, 21, 6, 1.6)} />
        </g>
        <g opacity={second}>
          <path d="M16 28 V35 H20 M40 35 H44 V28" />
          <path d={zig(20, 35, 40, 35, 6, 1.6)} />
        </g>
        <Draw d="M55 28 H64 M61 26 L64 28 L61 30" p={res} stroke={MUTED} />
        <g opacity={res}>
          <path d={zig(68, 28, 92, 28, 8, 1.8)} />
        </g>
      </Svg>
      <T x={30} y={16} size={3} o={first} className="tabular">
        <M>10 kΩ</M>
      </T>
      <T x={30} y={40.5} size={3} o={second} className="tabular">
        <M>10 kΩ</M>
      </T>
      <T x={80} y={21} size={4.4} weight={600} o={res} className="tabular">
        <M>5 kΩ</M>
      </T>
      <T x={50} y={47} size={3.2} color={MUTED} o={enter(t, b.half + 0.5, 0.5)} className="tabular">
        <M>10 kΩ ÷ 2 = 5 kΩ</M>
      </T>
    </>
  )
}

// ── one breaks ───────────────────────────────────────────────────────────────

function Lamp({ x, y, lit }: { x: number; y: number; lit: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={3.2} fill={glow.amber} stroke="none" opacity={0.5 * lit} />
      <circle cx={x} cy={y} r={3.2} stroke={lit > 0.5 ? glow.amber : MUTED} />
      <path d={`M${x - 2.26} ${y - 2.26} L${x + 2.26} ${y + 2.26} M${x - 2.26} ${y + 2.26} L${x + 2.26} ${y - 2.26}`} strokeWidth={0.25} />
    </g>
  )
}

function Break({ t, b }: Pick<StageProps, "t" | "b">) {
  // all lamps lit first; each circuit opens on "断开" and goes dark a moment later
  const sOpen = enter(t, b.sb + 0.5, 0.3)
  const pOpen = enter(t, b.pb + 0.5, 0.3)
  const sLit = 1 - enter(t, b.sb + 1.0, 0.4)
  const pLit = 1 - enter(t, b.pb + 1.0, 0.4)
  const a = enter(t, b.brk - 0.3, 0.6)
  return (
    <>
      <Svg>
        <path d="M50 12 V46" stroke={LINE} strokeWidth={0.2} opacity={a} />
        <g opacity={a}>
          <path d="M10 29.8 V20 H13.8 M20.2 20 H23.8 M30.2 20 H33.8 M40.2 20 H44 V28 M44 32 V42 H10 V32.2" />
          <path d="M44 28 V32" opacity={1 - sOpen} />
        </g>
        <g fill={POWER} stroke="none" opacity={sOpen}>
          <circle cx={44} cy={28} r={0.6} />
          <circle cx={44} cy={32} r={0.6} />
        </g>
        <BatteryV x={10} y={31} o={a} />
        <Lamp x={17} y={20} lit={sLit} />
        <Lamp x={27} y={20} lit={sLit} />
        <Lamp x={37} y={20} lit={sLit} />
        <g opacity={a}>
          <path d="M56 29.8 V18 H84 M56 32.2 V44 H84" />
          {[64, 72, 80].map((x) => (
            <path key={x} d={x === 72 ? `M${x} 18 V26.8 M${x} 33.2 V36.6 M${x} 40.6 V44` : `M${x} 18 V26.8 M${x} 33.2 V44`} />
          ))}
        </g>
        <BatteryV x={56} y={31} o={a} />
        <path d="M72 36.6 V40.6" opacity={a * (1 - pOpen)} />
        <g fill={POWER} stroke="none" opacity={pOpen}>
          <circle cx={72} cy={36.6} r={0.6} />
          <circle cx={72} cy={40.6} r={0.6} />
        </g>
        <Lamp x={64} y={30} lit={1} />
        <Lamp x={72} y={30} lit={pLit} />
        <Lamp x={80} y={30} lit={1} />
      </Svg>
      <T x={27} y={49} size={3} color={MUTED} o={a}>
        串联
      </T>
      <T x={70} y={49} size={3} color={MUTED} o={a}>
        并联
      </T>
      <T x={42.4} y={30} size={2.4} weight={600} anchor="end" color={POWER} o={sOpen}>
        断开
      </T>
      <T x={73.6} y={38.6} size={2.4} weight={600} anchor="start" color={POWER} o={pOpen}>
        断开
      </T>
      <T x={27} y={11} size={3.2} weight={600} o={enter(t, b.sb + 1.3, 0.5)}>
        全都熄灭
      </T>
      <T x={70} y={11} size={3.2} weight={600} o={enter(t, b.pb + 1.3, 0.5)}>
        其他照常亮
      </T>
    </>
  )
}

// ── outro ────────────────────────────────────────────────────────────────────

function Outro({ t, b, still, rise }: { t: number; b: Record<string, number>; still: boolean; rise: (at: number, d?: number) => number }) {
  const chip = "rounded-full border border-input px-[1em] py-[0.5em]"
  return (
    <>
      <T x={50} y={17} size={6} weight={600} o={enter(t, b.outro - 0.25, 0.5)} dy={rise(b.outro - 0.25)}>
        动手试试
      </T>
      <T x={50} y={26} size={2.8} color={MUTED} o={enter(t, b.outro + 0.4, 0.5)}>
        用下面的实验台
      </T>
      <T x={30} y={36} size={2.8} className={chip} o={enter(t, b.go - 0.1, 0.5)} dy={rise(b.go, 1)}>
        切到并联
      </T>
      <T x={70} y={36} size={2.8} color={AMP} className={chip} o={enter(t, b.chk - 0.1, 0.5)} dy={rise(b.chk, 1)}>
        总电阻比最小的还小吗？
      </T>
      <Svg>
        <g opacity={enter(t, b.go + 0.3)} transform={`translate(0 ${still ? 0 : Math.sin(t * 3.2) * 0.6})`} strokeWidth={0.45}>
          <path d="M50 42 V49 M47.6 46.6 L50 49 L52.4 46.6" />
        </g>
      </Svg>
    </>
  )
}

export const film: FilmDef = {
  title: "串联与并联",
  audio,
  timing,
  poster: 6.2,
  Stage,
}

export default function SeriesParallelFilm() {
  return <FilmPlayer film={film} />
}

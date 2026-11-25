import * as React from "react"
import { Battery, Diode, Resistor } from "@/lab/schematic"
import { trace } from "@/lab/colors"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, Frac, M, Scene, Svg, Sym, T, V, clamp01, easeInOut, enter, glide, lerp, leave, span, type FilmDef, type StageProps } from "../../kit"
import { AMP, FlowDots, HEAT, LINE, MUTED, Sb, VOLT, Arrow, curvePts, polyD, type Pt } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

/*
 * 二极管, 66 s. Scenes, each keyed to the words that introduce it:
 *   title → a diode with current running through it one way
 *   → the one-way valve in a pipe (forward: flap opens, reverse: water piles up against it)
 *   → anode / cathode on the symbol → the I–V curve draws (threshold, steep), 0.7 V and 0.3 V marked,
 *   then the reverse side (leakage, breakdown) → the formula (Vs − Vf) / R → worked example
 *   → four uses → "try it below" with the operating point sliding along the curve.
 */

const SCHOTTKY = trace.second

function Stage({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.6) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)
  const lift = (at: number) => (still ? 0 : -easeInOut((t - at) / 0.45) * 2)

  const title = span(t, 0.25, b.valve - 0.15, 0.4, 0.3)
  const valve = span(t, b.valve - 0.3, b.pins - 0.15, 0.3, 0.3)
  const pins = span(t, b.pins - 0.3, b.curve + 0.15, 0.3, 0.3)
  // the curve holds until breakdown has been seen, the uses until 钳位 has been read
  const plot = span(t, b.curve - 0.3, b.calc + 0.1, 0.3, 0.3)
  const calc = span(t, b.calc + 0.1, b.example - 0.15, 0.3, 0.3)
  const example = span(t, b.example - 0.3, b.uses - 0.15, 0.3, 0.3)
  const uses = span(t, b.uses - 0.3, b.outro + 0.05, 0.3, 0.3)
  const outro = enter(t, b.outro + 0.05, 0.4)

  return (
    <>
      <Scene o={title} dy={lift(b.valve - 0.45)}>
        <Title t={t} b={b} still={still} rise={rise} />
      </Scene>
      <Scene o={valve}>
        <Valve t={t} b={b} still={still} />
      </Scene>
      <Scene o={pins}>
        <Pins t={t} b={b} still={still} />
      </Scene>
      <Scene o={plot}>
        <Plot t={t} b={b} />
      </Scene>
      <Scene o={calc}>
        <Calc t={t} b={b} still={still} rise={rise} />
      </Scene>
      <Scene o={example}>
        <Example t={t} b={b} still={still} />
      </Scene>
      <Scene o={uses}>
        <Uses t={t} b={b} still={still} rise={rise} />
      </Scene>
      <Scene o={outro}>
        <Outro t={t} b={b} still={still} rise={rise} />
      </Scene>
    </>
  )
}

// ── title ────────────────────────────────────────────────────────────────────

function Title({ t, b, still, rise }: StageProps & { rise: (at: number, d?: number) => number }) {
  const d = enter(t, b.intro + 0.15, 0.6)
  const flow = enter(t, b.dir - 0.1, 0.4)
  const phase = still ? 0 : Math.max(0, t - b.dir) * 14
  const wires = enter(t, b.intro + 0.3, 0.8)
  return (
    <>
      <T x={50} y={12} size={8} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
        二极管
      </T>
      <Svg>
        <Draw d="M12 33 H26" p={wires} />
        <Draw d="M74 33 H88" p={wires} />
        <Sym x={50} y={33} scale={0.8} opacity={d}>
          <Diode x={0} y={0} />
        </Sym>
        <FlowDots pts={[[12, 33], [88, 33]]} phase={phase} gap={4.5} o={flow} skip={(x) => x > 43 && x < 57} />
        <Arrow x1={30} y1={22.5} x2={70} y2={22.5} p={enter(t, b.dir, 0.7)} color={AMP} />
      </Svg>
      <T x={50} y={18.5} size={2.6} color={AMP} o={enter(t, b.dir + 0.3)}>
        电流
      </T>
    </>
  )
}

// ── the one-way valve ────────────────────────────────────────────────────────

const PY = 21
const PIPE_TOP = 21
const PIPE_BOT = 39
const FLAP = 16.4

function Valve({ t, b, still }: StageProps) {
  const pipe = enter(t, b.valve - 0.3, 0.8)
  const closeAt = b.vrev - 0.1
  const ang = t < closeAt ? glide(t, b.fwd, 0, 68, 0.5) : glide(t, closeAt, 68, 0, 0.45)
  const rad = (ang * Math.PI) / 180
  const fx = 50 + FLAP * Math.sin(rad)
  const fy = PY + FLAP * Math.cos(rad)

  const fOn = enter(t, b.valve - 0.1, 0.6) * leave(t, b.vrev - 0.25, 0.35)
  const ph = still ? 0 : Math.max(0, t - b.fwd) * 14
  const rOn = enter(t, b.vrev, 0.3)
  const rt = still ? 0 : Math.max(0, t - b.vrev)
  const lanes = [26.5, 30, 33.5]

  return (
    <>
      <Svg>
        <Draw d={`M6 ${PIPE_TOP} H94`} p={pipe} />
        <Draw d={`M6 ${PIPE_BOT} H94`} p={pipe} />
        {/* the valve seat, and the flap hanging from its hinge */}
        <g opacity={pipe}>
          <path d={`M49 ${PIPE_TOP} V24 M49 ${PIPE_BOT} V36`} strokeWidth={0.7} />
          <path d={`M50 ${PY} L${fx} ${fy}`} strokeWidth={0.8} />
          <circle cx={50} cy={PY} r={0.9} fill="var(--background)" />
        </g>
        {Array.from({ length: 24 }, (_, i) => {
          const x = 8 + ((i * 3.5 + ph) % 84)
          return <circle key={`f${i}`} cx={x} cy={lanes[i % 3]} r={0.6} fill={AMP} stroke="none" opacity={fOn * clamp01(Math.min(x - 8, 92 - x) / 3)} />
        })}
        {Array.from({ length: 15 }, (_, i) => {
          const lane = i % 3
          const k = Math.floor(i / 3)
          const x0 = 99 + k * 6.5 + lane * 2
          const stop = 52.6 + k * 2.3 + (lane === 1 ? 0.6 : 0)
          const x = Math.max(stop, x0 - 14 * rt)
          return <circle key={`r${i}`} cx={x} cy={lanes[lane]} r={0.6} fill={AMP} stroke="none" opacity={rOn * clamp01((95 - x) / 2)} />
        })}
        <Arrow x1={10} y1={14} x2={30} y2={14} p={enter(t, b.fwd, 0.5)} color={VOLT} width={0.5} />
        <Arrow x1={90} y1={14} x2={70} y2={14} p={enter(t, b.vrev, 0.5)} color={VOLT} width={0.5} />
      </Svg>
      <T x={20} y={9.5} size={2.6} color={VOLT} o={enter(t, b.fwd + 0.1) * leave(t, b.vrev - 0.3, 0.3)}>
        推力
      </T>
      <T x={80} y={9.5} size={2.6} color={VOLT} o={enter(t, b.vrev + 0.1)}>
        推力
      </T>
      <T x={50} y={47} size={3.4} weight={500} color={MUTED} o={enter(t, b.valve + 0.2) * leave(t, b.fwd + 0.1, 0.3)}>
        水管里的单向阀
      </T>
      <T x={50} y={47} size={3.4} weight={500} o={enter(t, b.fwd + 0.3) * leave(t, b.vrev - 0.3, 0.3)}>
        顺着推：阀门打开，水流通过
      </T>
      <T x={50} y={47} size={3.4} weight={500} o={enter(t, b.vrev + 0.3)}>
        反着推：阀门关紧，水流不动
      </T>
    </>
  )
}

// ── anode and cathode ────────────────────────────────────────────────────────

function Pins({ t, b, still }: StageProps) {
  const wires = enter(t, b.pins - 0.2, 0.7)
  const d = enter(t, b.pins - 0.1, 0.6)
  const phase = still ? 0 : Math.max(0, t - b.go) * 12
  return (
    <>
      <Svg>
        <Draw d="M10 27 H27.5" p={wires} />
        <Draw d="M72.5 27 H90" p={wires} />
        <Sym x={50} y={27} scale={0.75} opacity={d}>
          <Diode x={0} y={0} />
        </Sym>
        <Arrow x1={22} y1={14} x2={78} y2={14} p={enter(t, b.go, 0.8)} color={AMP} />
        <FlowDots pts={[[10, 27], [90, 27]]} phase={phase} gap={5} o={enter(t, b.go + 0.5, 0.5)} skip={(x) => x > 42 && x < 58} />
      </Svg>
      <T x={22} y={36} size={3.6} weight={600} o={enter(t, b.anode)}>
        阳极 <V c={MUTED}>A</V>
      </T>
      <T x={78} y={36} size={3.6} weight={600} o={enter(t, b.cath)}>
        阴极 <V c={MUTED}>K</V>
      </T>
      <T x={50} y={9.5} size={2.6} color={AMP} o={enter(t, b.go + 0.3)}>
        电流方向
      </T>
      <T x={50} y={46} size={3} color={MUTED} o={enter(t, b.go - 0.3)}>
        三角形的尖，指着电流能走的方向
      </T>
    </>
  )
}

// ── the I–V curve ────────────────────────────────────────────────────────────

const OX = 40
const OY = 40
const XS = 40
const H = 30

const siI = (v: number) => H * Math.exp((v - 0.8) / 0.06)
const schI = (v: number) => H * Math.exp((v - 0.5) / 0.06)
const toPath = (pts: Pt[], ox = OX, oy = OY, xs = XS) => polyD(pts.map(([v, i]) => [ox + v * xs, oy - i] as Pt))
const SI_PATH = toPath(curvePts(siI, 0, 0.8, 80))
const SCH_PATH = toPath(curvePts(schI, 0, 0.5, 60))

function Plot({ t, b }: Pick<StageProps, "t" | "b">) {
  const axes = enter(t, b.curve + 0.05, 0.6)
  const siP = clamp01((t - (b.crv - 0.1)) / (b.steep - b.crv + 1.2))
  const kneeO = span(t, b.knee, b.si - 0.1, 0.3, 0.3)
  const steepO = enter(t, b.steep, 0.4)
  const fwdO = leave(t, b.rev - 0.1, 0.4)
  const schP = easeInOut((t - b.sch) / 0.9)
  const schO = 0.3 + 0.7 * fwdO
  const leakP = easeInOut((t - b.leak) / 0.8)
  const brkP = easeInOut((t - (b.brk - 1.0)) / 0.7)

  return (
    <>
      <Svg>
        <Draw d={`M12 ${OY} H86`} p={axes} />
        <Draw d={`M${OX} 51 V8`} p={axes} />
        <g opacity={enter(t, b.curve + 0.45)}>
          <path d={`M84.6 ${OY - 1.1} L86 ${OY} L84.6 ${OY + 1.1} M${OX - 1.1} 9.4 L${OX} 8 L${OX + 1.1} 9.4`} />
        </g>
        {/* the threshold */}
        <g opacity={kneeO} stroke={MUTED} strokeWidth={0.2} strokeDasharray="0.8 0.8">
          <path d={`M${OX + 0.5 * XS} ${OY + 2} V29`} />
        </g>
        {/* silicon, then the steep stretch drawn heavier */}
        <Draw d={SI_PATH} p={siP} stroke={AMP} strokeWidth={0.45} />
        {steepO > 0.01 && (
          <path d={toPath(curvePts(siI, 0.68, 0.8, 20))} stroke={AMP} strokeWidth={0.9} opacity={steepO * 0.9} />
        )}
        {/* 0.7 V and 0.3 V */}
        <g opacity={enter(t, b.v07, 0.4) * fwdO} stroke={MUTED} strokeWidth={0.2} strokeDasharray="0.8 0.8">
          <path d={`M${OX + 0.7 * XS} ${OY + 2} V${OY - siI(0.7)}`} />
        </g>
        <g opacity={schO} stroke={SCHOTTKY}>
          <Draw d={SCH_PATH} p={schP} strokeWidth={0.45} />
        </g>
        <g opacity={enter(t, b.v03, 0.4) * fwdO} stroke={MUTED} strokeWidth={0.2} strokeDasharray="0.8 0.8">
          <path d={`M${OX + 0.3 * XS} ${OY + 2} V${OY - schI(0.3)}`} />
        </g>
        {/* the reverse side: a hair of leakage, then breakdown */}
        <g stroke={AMP}>
          <Draw d={`M${OX} ${OY + 0.4} L18 ${OY + 1.1}`} p={leakP} strokeWidth={0.45} />
        </g>
        <g stroke={HEAT}>
          <Draw d={`M18 ${OY + 1.1} C16 ${OY + 1.3} 14.8 ${OY + 3} 14.4 51`} p={brkP} strokeWidth={0.55} />
        </g>
      </Svg>
      <T x={88} y={OY} size={2.4} anchor="start" color={MUTED} o={enter(t, b.curve + 0.45)}>
        电压 <V c={VOLT}>V</V>
      </T>
      <T x={OX} y={5.2} size={2.4} color={MUTED} o={enter(t, b.curve + 0.45)}>
        电流 <V c={AMP}>I</V>
      </T>
      <T x={OX + 0.5 * XS} y={26.5} size={2.6} color={MUTED} o={kneeO}>
        门槛
      </T>
      <T x={67} y={19.5} size={2.6} anchor="end" color={AMP} o={steepO}>
        很陡
      </T>
      <T x={74} y={10.5} size={2.4} anchor="start" color={AMP} o={enter(t, b.si, 0.4)}>
        硅管
      </T>
      <T x={62} y={10.5} size={2.4} anchor="start" color={SCHOTTKY} o={enter(t, b.sch + 0.3) * schO}>
        肖特基
      </T>
      <T x={OX + 0.7 * XS} y={OY + 4.2} size={2.4} color={MUTED} o={enter(t, b.v07, 0.4) * fwdO} className="tabular">
        <M>0.7 V</M>
      </T>
      <T x={OX + 0.3 * XS} y={OY + 4.2} size={2.4} color={MUTED} o={enter(t, b.v03, 0.4) * fwdO} className="tabular">
        <M>0.3 V</M>
      </T>
      <T x={26} y={33.5} size={2.6} color={MUTED} o={enter(t, b.rev, 0.4)}>
        反向
      </T>
      <T x={29} y={OY + 4.4} size={2.4} color={AMP} o={enter(t, b.leak, 0.4)}>
        漏电流，极小
      </T>
      <T x={17} y={48} size={2.6} anchor="start" weight={600} color={HEAT} o={enter(t, b.brk - 0.3)}>
        击穿
      </T>
    </>
  )
}

// ── the formula ──────────────────────────────────────────────────────────────

function Calc({ t, b, rise }: StageProps & { rise: (at: number, d?: number) => number }) {
  const legend: { x: number; letter: React.ReactNode; word: string; at: number }[] = [
    { x: 14, letter: <V c={AMP}>I</V>, word: "电流", at: b.cI },
    { x: 37, letter: <><V c={VOLT}>V</V><Sb>S</Sb></>, word: "电源电压", at: b.cVs },
    { x: 63, letter: <><V c={VOLT}>V</V><Sb>f</Sb></>, word: "压降", at: b.cVf },
    { x: 87, letter: <V>R</V>, word: "电阻", at: b.cR },
  ]
  return (
    <>
      <T x={50} y={8} size={2.6} color={MUTED} o={enter(t, b.calc + 0.3)} dy={rise(b.calc + 0.3)}>
        导通时的电流
      </T>
      <T x={50} y={23} size={7.2}>
        <span className="inline-flex items-center gap-[0.28em]">
          <span style={{ opacity: enter(t, b.cI) }}>
            <V c={AMP}>I</V>
          </span>
          <span style={{ opacity: enter(t, b.cI + 0.25) }}>
            <M>=</M>
          </span>
          <Frac
            top={
              <span className="inline-flex items-baseline gap-[0.2em]">
                <span style={{ opacity: enter(t, b.cVs) }}>
                  <V c={VOLT}>V</V>
                  <Sb>S</Sb>
                </span>
                <span style={{ opacity: enter(t, b.cVf) }}>
                  &thinsp;<M>−</M>&thinsp;<V c={VOLT}>V</V>
                  <Sb>f</Sb>
                </span>
              </span>
            }
            bottom={
              <span style={{ opacity: enter(t, b.cR) }}>
                <V>R</V>
              </span>
            }
            bar={enter(t, b.cVs - 0.1, 0.5)}
          />
        </span>
      </T>
      <Svg>
        <Draw d="M26 41 H33.4 M46.6 41 H53.4 M66.6 41 H74" p={enter(t, b.cRs, 0.6)} />
        <Sym x={40} y={41} scale={0.22} opacity={enter(t, b.cRs + 0.1, 0.5)}>
          <Resistor x={0} y={0} />
        </Sym>
        <Sym x={60} y={41} scale={0.22} opacity={enter(t, b.cRs + 0.25, 0.5)}>
          <Diode x={0} y={0} />
        </Sym>
      </Svg>
      <T x={50} y={36} size={2.6} color={MUTED} o={enter(t, b.cRs + 0.2)}>
        串联
      </T>
      {legend.map((l) => (
        <T key={l.word} x={l.x} y={49.5} size={3.4} o={enter(t, l.at + 0.15)} dy={rise(l.at, 1)}>
          <span className="inline-flex items-baseline gap-[0.7em]">
            <span>{l.letter}</span>
            <span style={{ color: MUTED, fontSize: "0.85em" }}>{l.word}</span>
          </span>
        </T>
      ))}
    </>
  )
}

// ── worked example ───────────────────────────────────────────────────────────

const RING: Pt[] = [[12, 19], [12, 12], [44, 12], [44, 44], [12, 44], [12, 37], [12, 19]]

function Example({ t, b, still }: StageProps) {
  const wires = enter(t, b.example - 0.1, 0.8)
  const parts = enter(t, b.example, 0.5)
  const flowOn = enter(t, b.eI - 0.2, 0.5)
  const phase = still ? 0 : Math.max(0, t - (b.eI - 0.2)) * 13
  const hide = (x: number, y: number) => (y === 12 && x > 18 && x < 38) || (x === 44 && y > 18 && y < 38) || (x === 12 && y > 18 && y < 38)
  return (
    <>
      <Svg>
        <Draw d="M12 19 V12 H19" p={wires} />
        <Draw d="M37 12 H44 V19" p={wires} />
        <Draw d="M44 37 V44 H12 V37" p={wires} />
        <Sym x={12} y={28} scale={0.3} opacity={parts}>
          <Battery x={0} y={0} rot={90} />
        </Sym>
        <Sym x={28} y={12} scale={0.3} opacity={enter(t, b.eV + 0.2, 0.5)}>
          <Resistor x={0} y={0} />
        </Sym>
        <Sym x={44} y={28} scale={0.3} opacity={enter(t, b.example + 0.4, 0.5)}>
          <Diode x={0} y={0} rot={90} />
        </Sym>
        <FlowDots pts={RING} phase={phase} gap={3.6} closed o={flowOn} skip={hide} />
      </Svg>
      <T x={7.5} y={28} size={3.2} anchor="end" weight={600} color={VOLT} o={enter(t, b.eV)} className="tabular">
        <M>5 V</M>
      </T>
      <T x={28} y={6.5} size={2.8} o={enter(t, b.eR)} className="tabular">
        <M>330 Ω</M>
      </T>
      <T x={48} y={28} size={2.8} anchor="start" color={VOLT} o={enter(t, b.example + 0.6)} className="tabular">
        <M>0.7 V</M>
      </T>
      <T x={77} y={19} size={2.8} color={MUTED} o={enter(t, b.eI - 0.2)} className="tabular">
        <M>(5 V − 0.7 V) ÷ 330 Ω</M>
      </T>
      <T x={77} y={31} size={8} weight={600} color={AMP} o={enter(t, b.eI, 0.4)} scale={still ? 1 : lerp(1.15, 1, enter(t, b.eI, 0.5))} className="tabular">
        <M>≈ 13 mA</M>
      </T>
    </>
  )
}

// ── uses ─────────────────────────────────────────────────────────────────────

function Uses({ t, b, rise }: StageProps & { rise: (at: number, d?: number) => number }) {
  const cells = [
    { x: 14, name: "整流", note: "只放一个方向", at: b.u1 },
    { x: 38, name: "防反接", note: "电池插反就截止", at: b.u2 },
    { x: 62, name: "续流", note: "给线圈电流绕路", at: b.u3 },
    { x: 86, name: "钳位", note: "把信号限在电源内", at: b.u4 },
  ]
  return (
    <>
      <T x={50} y={9} size={2.6} color={MUTED} o={enter(t, b.uses + 0.1)} dy={rise(b.uses)}>
        常见用途
      </T>
      <Svg>
        {cells.map((c) => (
          <g key={c.name}>
            <rect x={c.x - 11} y={15} width={22} height={30} rx={1.6} stroke={LINE} strokeWidth={0.25} opacity={enter(t, b.uses + 0.1, 0.5)} />
            <Sym x={c.x} y={26} scale={0.3} opacity={enter(t, b.uses + 0.3, 0.5)}>
              <Diode x={0} y={0} />
            </Sym>
          </g>
        ))}
      </Svg>
      {cells.map((c) => (
        <React.Fragment key={c.name}>
          <T x={c.x} y={35} size={3.4} weight={600} o={enter(t, c.at + 0.05)} dy={rise(c.at, 1)}>
            {c.name}
          </T>
          <T x={c.x} y={40.5} size={2.1} color={MUTED} o={enter(t, c.at + 0.25)}>
            {c.note}
          </T>
        </React.Fragment>
      ))}
    </>
  )
}

// ── try it ───────────────────────────────────────────────────────────────────

function Outro({ t, b, still, rise }: StageProps & { rise: (at: number, d?: number) => number }) {
  const ox = 60
  const oy = 44
  const xs = 36
  const v = still ? 0.68 : 0.58 + 0.14 * (0.5 + 0.5 * Math.sin(Math.max(0, t - b.drag) * 1.4 - Math.PI / 2))
  const p = enter(t, b.outro + 0.1, 0.6)
  return (
    <>
      <Svg>
        <g opacity={p}>
          <path d={`M${ox - 6} ${oy} H92 M${ox} ${oy + 3} V12`} />
          <path d={toPath(curvePts(siI, 0, 0.8, 80), ox, oy, xs)} stroke={AMP} strokeWidth={0.45} />
        </g>
        <circle cx={ox + v * xs} cy={oy - siI(v)} r={1} fill={VOLT} stroke="none" opacity={enter(t, b.drag, 0.4)} />
        <g opacity={enter(t, b.drag + 0.3)} transform={`translate(0 ${still ? 0 : Math.sin(t * 3.2) * 0.6})`} strokeWidth={0.45}>
          <path d="M24 38 V45 M21.6 42.6 L24 45 L26.4 42.6" />
        </g>
      </Svg>
      <T x={24} y={22} size={6} weight={600} dy={rise(b.outro + 0.15)} o={enter(t, b.outro + 0.15, 0.5)}>
        动手试试
      </T>
      <T x={24} y={31} size={2.8} color={MUTED} o={enter(t, b.drag)} dy={rise(b.drag, 1)}>
        拖动下面的电源电压
      </T>
      <T x={92} y={oy + 3.4} size={2.4} anchor="end" color={MUTED} o={p}>
        电压 <V c={VOLT}>V</V>
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "二极管",
  audio,
  timing,
  poster: 3.6,
  Stage,
}

export default function DiodesFilm() {
  return <FilmPlayer film={film} />
}

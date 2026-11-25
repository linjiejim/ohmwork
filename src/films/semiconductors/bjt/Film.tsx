import * as React from "react"
import { Bjt, Lamp, Resistor } from "@/lab/schematic"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, M, Scene, Svg, Sym, T, V, easeInOut, enter, glide, lerp, span, type FilmDef, type StageProps } from "../../kit"
import { AMP, FlowDots, HEAT, LINE, MUTED, Sb, VOLT, type Pt } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

/*
 * 三极管, 70 s. Scenes, each keyed to the words that introduce it:
 *   title → a pin that gives only a trickle, a big load, a "?" in between
 *   → the three legs labelled on the symbol → a trickle into the base, a flood through the collector
 *   → the numbers (0.1 mA → 20 mA, 200×) → a lamp switch: cutoff, active (warm), saturated (Vce 0.2 V)
 *   → deep saturation: I_B = I_C ÷ 10 → the worked base resistor (3.3 V, 100 mA, 270 Ω) → "try it below".
 */

const rise0 = (still: boolean, t: number, at: number, d = 1.6) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)

function Stage({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.6) => rise0(still, t, at, d)
  const lift = (at: number) => (still ? 0 : -easeInOut((t - at) / 0.45) * 2)

  const title = span(t, 0.25, b.pins - 0.15, 0.4, 0.3)
  const pins = span(t, b.pins - 0.3, b.small - 0.15, 0.3, 0.3)
  // the 200× numbers are gone before the lamp circuit draws
  const small = span(t, b.small - 0.3, b.circuit - 0.3, 0.3, 0.3)
  const sw = span(t, b.circuit - 0.1, b.deep - 0.15, 0.3, 0.3)
  const deep = span(t, b.deep - 0.3, b.rb - 0.15, 0.3, 0.3)
  const rb = span(t, b.rb - 0.3, b.outro - 0.15, 0.3, 0.3)
  const outro = enter(t, b.outro - 0.3, 0.4)

  return (
    <>
      <Scene o={title} dy={lift(b.pins - 0.45)}>
        <Title t={t} b={b} still={still} rise={rise} />
      </Scene>
      <Scene o={pins}>
        <Pins t={t} b={b} />
      </Scene>
      <Scene o={small}>
        <Small t={t} b={b} still={still} rise={rise} />
      </Scene>
      <Scene o={sw}>
        <SwitchScene t={t} b={b} still={still} rise={rise} />
      </Scene>
      <Scene o={deep}>
        <Deep t={t} b={b} rise={rise} />
      </Scene>
      <Scene o={rb}>
        <BaseResistor t={t} b={b} still={still} rise={rise} />
      </Scene>
      <Scene o={outro}>
        <Outro t={t} b={b} still={still} rise={rise} />
      </Scene>
    </>
  )
}

// ── title: a trickle can't drive a big load ──────────────────────────────────

function Title({ t, b, still, rise }: StageProps & { rise: (at: number, d?: number) => number }) {
  const parts = enter(t, b.intro + 0.2, 0.6)
  const wire = enter(t, b.intro + 0.4, 0.9)
  const phase = still ? 0 : Math.max(0, t - b.pin) * 6
  return (
    <>
      <T x={50} y={10} size={8} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
        三极管
      </T>
      <Svg>
        <g opacity={parts}>
          <rect x={5} y={22} width={16} height={20} rx={1} />
          <rect x={76} y={22} width={18} height={20} rx={1} />
        </g>
        <Draw d="M20 32 H42" p={wire} />
        <Draw d="M58 32 H76" p={wire} strokeDasharray="1 1.2" opacity={0.5} />
        <rect x={42} y={26} width={16} height={12} rx={1} strokeDasharray="1.4 1.2" opacity={enter(t, b.help - 0.2, 0.5)} stroke={MUTED} />
        <FlowDots pts={[[20, 32], [40, 32]]} phase={phase} gap={6} o={enter(t, b.pin, 0.4)} />
      </Svg>
      <T x={13} y={32} size={3} o={parts}>
        单片机
      </T>
      <T x={85} y={32} size={3.2} o={parts}>
        大负载
      </T>
      <T x={30} y={27.5} size={2.8} color={MUTED} o={enter(t, b.pin, 0.4)}>
        引脚
      </T>
      <T x={67} y={27.5} size={2.8} color={MUTED} o={enter(t, b.pin + 1.8, 0.5)}>
        推不动
      </T>
      <T x={50} y={32} size={4.4} weight={600} color={MUTED} o={enter(t, b.help - 0.2, 0.5)}>
        ?
      </T>
      <T x={50} y={43} size={3} weight={600} o={enter(t, b.help, 0.4)} dy={rise(b.help, 1)}>
        帮手
      </T>
    </>
  )
}

// ── the three legs ───────────────────────────────────────────────────────────

function Pins({ t, b }: Pick<StageProps, "t" | "b">) {
  const sym = enter(t, b.pins - 0.2, 0.7)
  const hl = (at: number) => enter(t, at, 0.3)
  return (
    <>
      <Svg>
        <Sym x={50} y={30} scale={0.55} opacity={sym}>
          <Bjt x={0} y={0} />
        </Sym>
        <Draw d="M14 30 H33.5" p={sym} />
        <Draw d="M57.7 13.5 V8" p={sym} />
        <Draw d="M57.7 46.5 V51" p={sym} />
        <g opacity={hl(b.base)} stroke={VOLT} strokeWidth={0.7}>
          <path d="M14 30 H33.5" />
        </g>
        <g opacity={hl(b.col)} stroke={AMP} strokeWidth={0.7}>
          <path d="M57.7 13.5 V8" />
        </g>
        <g opacity={hl(b.emit)} stroke={MUTED} strokeWidth={0.7}>
          <path d="M57.7 46.5 V51" />
        </g>
      </Svg>
      <T x={23} y={36} size={3.4} weight={600} o={enter(t, b.pins + 0.3)}>
        <span style={{ opacity: enter(t, b.base) }}>基极 </span>
        <V c={MUTED}>B</V>
      </T>
      <T x={62} y={9} size={3.4} weight={600} anchor="start" o={enter(t, b.pins + 0.6)}>
        <span style={{ opacity: enter(t, b.col) }}>集电极 </span>
        <V c={MUTED}>C</V>
      </T>
      <T x={62} y={51} size={3.4} weight={600} anchor="start" o={enter(t, b.pins + 0.9)}>
        <span style={{ opacity: enter(t, b.emit) }}>发射极 </span>
        <V c={MUTED}>E</V>
      </T>
      <T x={23} y={42} size={2.8} color={VOLT} o={enter(t, b.ctrl, 0.4)}>
        控制端
      </T>
    </>
  )
}

// ── a trickle in, a flood through ────────────────────────────────────────────

function Small({ t, b, still, rise }: StageProps & { rise: (at: number, d?: number) => number }) {
  const sym = enter(t, b.small - 0.2, 0.6)
  const ph1 = still ? 0 : Math.max(0, t - b.small) * 5
  const ph2 = still ? 0 : Math.max(0, t - b.small) * 15
  const flowBase = enter(t, b.small + 0.2, 0.5)
  const flowCol = enter(t, b.ic - 0.1, 0.5)
  const rows: { y: number; label: React.ReactNode; value: string; color?: string; at: number }[] = [
    { y: 17, label: <>基极电流 <V c={AMP}>I</V><Sb>B</Sb></>, value: "0.1 mA", color: AMP, at: b.e1 },
    { y: 29, label: <>集电极电流 <V c={AMP}>I</V><Sb>C</Sb></>, value: "20 mA", color: AMP, at: b.e2 },
    { y: 42, label: "放大", value: "200 倍", at: b.e3 },
  ]
  return (
    <>
      <Svg>
        <Sym x={32} y={30} scale={0.6} opacity={sym}>
          <Bjt x={0} y={0} />
        </Sym>
        <Draw d="M4 30 H14" p={sym} strokeWidth={0.3} />
        <Draw d="M40.4 4 V12" p={sym} strokeWidth={0.7} />
        <Draw d="M40.4 48 V53" p={sym} strokeWidth={0.7} />
        <FlowDots pts={[[4, 30], [14, 30]]} phase={ph1} gap={5} o={flowBase} />
        <FlowDots pts={[[40.4, 4], [40.4, 53]]} phase={ph2} gap={2.2} o={flowCol} skip={(_, y) => y > 14 && y < 46} r={0.6} />
        <g stroke={LINE} strokeWidth={0.15}>
          <path d="M62 23 H93" opacity={enter(t, b.e1)} />
          <path d="M62 35 H93" opacity={enter(t, b.e2)} />
        </g>
      </Svg>
      <T x={9} y={24.5} size={2.8} weight={600} color={AMP} o={enter(t, b.ib)}>
        小电流
      </T>
      <T x={45} y={9} size={2.8} weight={600} anchor="start" color={AMP} o={enter(t, b.many)} dy={rise(b.many, 1)}>
        大电流
      </T>
      {rows.map((r) => (
        <React.Fragment key={r.y}>
          <T x={62} y={r.y} size={2.5} anchor="start" color={MUTED} o={enter(t, r.at)}>
            {r.label}
          </T>
          <T x={93} y={r.y + 4.2} size={4.6} anchor="end" weight={600} color={r.color} o={enter(t, r.at, 0.4)} className="tabular" dy={rise(r.at, 1)}>
            <M>{r.value}</M>
          </T>
        </React.Fragment>
      ))}
    </>
  )
}

// ── the lamp switch ──────────────────────────────────────────────────────────

const CX = 42
const CY = 36
const S = 0.45
const BASE_X = CX - 30 * S
const COL_X = CX + 14 * S
const COL_Y = CY - 30 * S
const EMIT_Y = CY + 30 * S

const MAIN: Pt[] = [[COL_X, 4], [COL_X, EMIT_Y], [COL_X, 51.5]]
const BASEP: Pt[] = [[5, CY], [BASE_X, CY]]

/** The circuit: 12 V rail, lamp, transistor, ground; base resistor from the pin. */
function SwitchCircuit({
  p,
  lamp,
  heat,
  mainFlow,
  mainPhase,
  baseFlow,
  basePhase,
}: {
  p: number
  lamp: number
  heat: number
  mainFlow: number
  mainPhase: number
  baseFlow: number
  basePhase: number
}) {
  return (
    <>
      <Draw d={`M42 4 H55`} p={p} />
      <Draw d={`M${COL_X} 4 V13`} p={p} opacity={0} />
      <Draw d={`M${COL_X} 22 V${COL_Y}`} p={p} />
      <Draw d={`M${COL_X} ${EMIT_Y} V51.5`} p={p} />
      <Draw d={`M44.5 51.5 H${COL_X + 2.5} M45.7 52.6 H${COL_X + 1.3}`} p={p} />
      <Draw d={`M5 ${CY} H8`} p={p} />
      <Draw d={`M26 ${CY} H${BASE_X}`} p={p} />
      <circle cx={5} cy={CY} r={0.8} fill="var(--background)" opacity={p} />
      <Sym x={COL_X} y={13} scale={0.3} opacity={p}>
        <Lamp x={0} y={0} rot={90} brightness={lamp} />
      </Sym>
      <Sym x={17} y={CY} scale={0.3} opacity={p}>
        <Resistor x={0} y={0} />
      </Sym>
      <Sym x={CX} y={CY} scale={S} opacity={p}>
        <Bjt x={0} y={0} color={heat > 0.05 ? HEAT : undefined} />
      </Sym>
      <FlowDots pts={MAIN} phase={mainPhase} gap={3} o={mainFlow} skip={(_, y) => y > 26 && y < 46} />
      <FlowDots pts={BASEP} phase={basePhase} gap={4.5} o={baseFlow} skip={(x) => x > 8 && x < 26} />
    </>
  )
}

function SwitchScene({ t, b, still, rise }: StageProps & { rise: (at: number, d?: number) => number }) {
  const p = enter(t, b.circuit, 0.9)
  // 0 = cutoff, 1 = active, 2 = saturated
  const lampAt = (s: number) => (s < b.lin ? 0 : s < b.satw ? glide(s, b.lin, 0, 0.4, 0.8) : glide(s, b.satw, 0.4, 1, 0.8))
  const vceAt = (s: number) => (s < b.lin ? 12 : s < b.satw ? glide(s, b.lin, 12, 6, 0.8) : glide(s, b.satw, 6, 0.2, 0.8))
  const lamp = lampAt(t)
  const vce = vceAt(t)
  let ph = 0
  if (!still && t > b.cut) {
    const dt = 1 / 30
    for (let s = b.cut; s < t; s += dt) ph += lampAt(s) * 16 * Math.min(dt, t - s)
  }
  const heat = span(t, b.heat, b.satw - 0.1, 0.4, 0.4)
  const state = t < b.lin - 0.1 ? 0 : t < b.satw - 0.1 ? 1 : 2
  const names = ["截止", "放大", "饱和"]
  const likes = ["像断开的开关", "像拧到一半的阀门", "像闭合的开关"]
  const shown = [enter(t, b.cut, 0.4), enter(t, b.lin, 0.4), enter(t, b.satw, 0.4)]
  const chips = enter(t, b.three, 0.5)
  return (
    <>
      <Svg>
        <SwitchCircuit p={p} lamp={lamp} heat={heat} mainFlow={enter(t, b.lin, 0.4)} mainPhase={ph} baseFlow={enter(t, b.lin, 0.4)} basePhase={ph * 0.35} />
      </Svg>
      <T x={58} y={4} size={2.4} anchor="start" color={VOLT} o={p} className="tabular">
        <M>12 V</M>
      </T>
      <T x={5} y={41} size={2.4} anchor="start" color={MUTED} o={p}>
        引脚
      </T>
      <T x={40} y={13} size={2.6} anchor="end" color={MUTED} o={enter(t, b.lamp, 0.4)}>
        灯
      </T>
      {/* the three states */}
      {names.map((n, i) => (
        <T key={n} x={64 + i * 12} y={9} size={2.8} weight={state === i && shown[i] > 0.5 ? 600 : 400} color={state === i && shown[i] > 0.5 ? undefined : MUTED} o={chips} className="tabular">
          {n}
        </T>
      ))}
      <Svg>
        <path d={`M${58 + state * 12} 12 h12`} stroke={VOLT} strokeWidth={0.4} opacity={chips * (shown[state] > 0.05 ? 1 : 0)} />
      </Svg>
      {names.map((n, i) => (
        <T key={n} x={76} y={23} size={3.6} weight={600} o={shown[i] * (state === i ? 1 : 0)} dy={rise(i === 0 ? b.cut : i === 1 ? b.lin : b.satw, 1)}>
          {likes[i]}
        </T>
      ))}
      <T x={76} y={34} size={2.5} color={MUTED} o={shown[0]}>
        管子两端 <V c={VOLT}>V</V>
        <Sb>CE</Sb>
      </T>
      <T x={76} y={42} size={6} weight={600} color={VOLT} o={shown[0]} className="tabular">
        <M>{vce >= 10 ? Math.round(vce) : vce >= 1 ? vce.toFixed(1) : vce.toFixed(1)} V</M>
      </T>
      <T x={76} y={49.5} size={2.6} color={HEAT} o={heat}>
        管子自己在发热
      </T>
    </>
  )
}

// ── deep saturation ──────────────────────────────────────────────────────────

function Deep({ t, b, rise }: Pick<StageProps, "t" | "b"> & { rise: (at: number, d?: number) => number }) {
  const ic = enter(t, b.deep + 0.3, 0.8)
  const ibLabel = enter(t, b.deepw + 1.3, 0.5)
  const ib = enter(t, b.deepw + 1.6, 0.7)
  return (
    <>
      <T x={50} y={11} size={2.6} o={enter(t, b.deep, 0.4)} className="rounded-full border border-input px-[0.9em] py-[0.45em] text-muted-foreground" dy={rise(b.deep, 1)}>
        当开关用：深度饱和
      </T>
      <T x={14} y={23} size={3} anchor="start" color={MUTED} o={enter(t, b.deep + 0.3)}>
        负载电流 <V c={AMP}>I</V>
        <Sb>C</Sb>
      </T>
      <T x={14} y={37} size={3} anchor="start" color={MUTED} o={ibLabel}>
        基极电流 <V c={AMP}>I</V>
        <Sb>B</Sb>
      </T>
      <Svg>
        <rect x={14} y={26} width={72 * ic} height={5} rx={1} fill={AMP} fillOpacity={0.85} stroke="none" />
        <rect x={14} y={40} width={7.2 * ib} height={5} rx={1} fill={AMP} fillOpacity={0.85} stroke="none" />
        <g opacity={enter(t, b.tenth - 0.2, 0.5)} stroke={MUTED} strokeWidth={0.25} strokeDasharray="0.8 0.8">
          <path d="M21.2 38 V31 M86 31 V26" />
        </g>
      </Svg>
      <T x={30} y={43} size={5} weight={600} anchor="start" o={enter(t, b.tenth, 0.4)} dy={rise(b.tenth, 1)}>
        <M>= </M>
        <V c={AMP}>I</V>
        <Sb>C</Sb> <M>÷ 10</M>
      </T>
    </>
  )
}

// ── the worked base resistor ─────────────────────────────────────────────────

function BaseResistor({ t, b, still, rise }: StageProps & { rise: (at: number, d?: number) => number }) {
  const p = enter(t, b.rb - 0.2, 0.9)
  const ph = still ? 0 : Math.max(0, t - b.r2) * 16
  const on = enter(t, b.r2, 0.5)
  return (
    <>
      <Svg>
        <SwitchCircuit p={p} lamp={on} heat={0} mainFlow={on} mainPhase={ph} baseFlow={on} basePhase={ph * 0.4} />
      </Svg>
      <T x={5} y={41} size={2.8} anchor="start" weight={600} color={VOLT} o={enter(t, b.r1)} className="tabular">
        <M>3.3 V</M>
      </T>
      <T x={58} y={13} size={2.8} anchor="start" weight={600} color={AMP} o={enter(t, b.r2)} className="tabular">
        <M>100 mA</M>
      </T>
      <T x={17} y={28.5} size={2.8} weight={600} o={enter(t, b.r3)} className="tabular">
        <M>270 Ω</M>
      </T>
      <T x={80} y={20} size={2.5} color={MUTED} o={enter(t, b.r2 + 0.5)} dy={rise(b.r2 + 0.5, 1)} className="tabular">
        <M>
          <V c={AMP}>I</V>
          <Sb>B</Sb> = 100 mA ÷ 10 = 10 mA
        </M>
      </T>
      <T x={80} y={29} size={2.5} color={MUTED} o={enter(t, b.r3 - 0.8)} dy={rise(b.r3 - 0.8, 1)} className="tabular">
        <M>(3.3 V − 0.7 V) ÷ 10 mA</M>
      </T>
      <T x={80} y={38} size={4.4} o={enter(t, b.r3 - 0.3)} className="tabular">
        <M>= 260 Ω</M>
      </T>
      <T x={80} y={48} size={6} weight={600} o={enter(t, b.r3, 0.4)} scale={still ? 1 : lerp(1.15, 1, enter(t, b.r3, 0.5))} className="tabular">
        <M>取 270 Ω</M>
      </T>
    </>
  )
}

// ── try it ───────────────────────────────────────────────────────────────────

function Outro({ t, b, still, rise }: StageProps & { rise: (at: number, d?: number) => number }) {
  const p = enter(t, b.outro - 0.2, 0.6)
  const k = still ? 0.6 : 0.5 + 0.5 * Math.sin(Math.max(0, t - b.drag) * 1.5 - Math.PI / 2)
  const lamp = easeInOut((k - 0.15) / 0.7)
  const x0 = 60
  const x1 = 92
  return (
    <>
      <Svg>
        <Sym x={76} y={20} scale={0.55} opacity={p}>
          <Lamp x={0} y={0} brightness={lamp * enter(t, b.drag, 0.5)} />
        </Sym>
        <g opacity={p}>
          <path d={`M${x0} 40 H${x1}`} stroke={LINE} strokeWidth={0.8} />
          <circle cx={lerp(x0, x1, k)} cy={40} r={1.5} fill={VOLT} stroke="none" opacity={enter(t, b.drag, 0.4)} />
        </g>
        <g opacity={enter(t, b.drag + 0.3)} transform={`translate(0 ${still ? 0 : Math.sin(t * 3.2) * 0.6})`} strokeWidth={0.45}>
          <path d="M24 38 V45 M21.6 42.6 L24 45 L26.4 42.6" />
        </g>
      </Svg>
      <T x={24} y={22} size={6} weight={600} dy={rise(b.outro)} o={enter(t, b.outro - 0.1, 0.5)}>
        动手试试
      </T>
      <T x={24} y={31} size={2.8} color={MUTED} o={enter(t, b.drag)} dy={rise(b.drag, 1)}>
        拖动下面的引脚电压
      </T>
      <T x={76} y={46} size={2.6} color={MUTED} o={enter(t, b.drag + 0.2)}>
        引脚电压 <M>0 – 3.3 V</M>
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "三极管（BJT）",
  audio,
  timing,
  poster: 3.8,
  Stage,
}

export default function BjtFilm() {
  return <FilmPlayer film={film} />
}

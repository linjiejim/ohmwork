import { Capacitor, Chip, Crystal, Diode, Mosfet, Resistor, Source, Switch, Battery } from "@/lab/schematic"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, Scene, Svg, Sym, T, enter, span, type FilmDef, type StageProps } from "../../kit"
import { AMP, FG, GOOD, Hl, MUTED, POWER, VOLT, riseAt } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

/*
 * 常见单元电路, ~58 s. Scenes, each keyed to its line:
 *   title → decoupling capacitor (circuit, then the current spike and the voltage dip with / without it)
 *   → reset (R + C + button on one net) → crystal with two load capacitors
 *   → reverse protection (diode vs P-MOSFET) → BSS138 level shifter → "drag the capacitor out".
 */
function Stage({ t, b, still }: StageProps) {
  const title = span(t, 0.25, b.decap - 0.45)
  const decap = span(t, b.decap - 0.25, b.reset - 0.45)
  // the button is the last word of the line: let the finished circuit stay up into the gap
  const reset = span(t, b.reset - 0.25, b.xtal - 0.15)
  const xtal = span(t, b.xtal - 0.25, b.rev - 0.45)
  const rev = span(t, b.rev - 0.25, b.level - 0.45)
  const level = span(t, b.level - 0.25, b.outro - 0.45)
  const outro = enter(t, b.outro - 0.1, 0.5)
  const rise = (at: number, d = 1.6) => riseAt(t, at, still, d)

  return (
    <>
      <Scene o={title}>
        <T x={50} y={19} size={8} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
          常见单元电路
        </T>
        <T x={50} y={28.5} size={2.8} color={MUTED} o={enter(t, b.intro + 1.0)}>
          见到就认得
        </T>
        <Svg>
          <g opacity={enter(t, b.intro + 1.2)}>
            <Sym x={20} y={38} scale={0.2}>
              <Capacitor x={0} y={0} />
            </Sym>
            <Sym x={40} y={38} scale={0.2}>
              <Crystal x={0} y={0} />
            </Sym>
            <Sym x={60} y={38} scale={0.2}>
              <Switch x={0} y={0} />
            </Sym>
            <Sym x={80} y={38} scale={0.2}>
              <Resistor x={0} y={0} />
            </Sym>
          </g>
        </Svg>
      </Scene>

      <Scene o={decap}>
        <Decap t={t} b={b} still={still} />
      </Scene>
      <Scene o={reset}>
        <Reset t={t} b={b} still={still} />
      </Scene>
      <Scene o={xtal}>
        <Xtal t={t} b={b} still={still} />
      </Scene>
      <Scene o={rev}>
        <Reverse t={t} b={b} still={still} />
      </Scene>
      <Scene o={level}>
        <Level t={t} b={b} still={still} />
      </Scene>

      <Scene o={outro}>
        <T x={50} y={15} size={6} weight={600} dy={rise(b.outro)}>
          动手试试
        </T>
        <T x={50} y={23} size={2.8} color={MUTED} o={enter(t, b.drag)} dy={rise(b.drag, 1)}>
          把电容从「装上」拖到「不装」
        </T>
        <Svg>
          <g opacity={enter(t, b.outro + 0.3)}>
            <path d="M30 40 H70" stroke={MUTED} strokeWidth={0.2} />
            <path d={curve(30, 70, 40, 7, true, 0.55)} stroke={POWER} />
            <path d={curve(30, 70, 40, 1.4, false, 0.55)} stroke={GOOD} />
          </g>
          <g opacity={enter(t, b.drag + 0.3)} transform={`translate(0 ${still ? 0 : Math.sin(t * 3.2) * 0.6})`} strokeWidth={0.45}>
            <path d="M50 46 V52 M47.6 49.6 L50 52 L52.4 49.6" />
          </g>
        </Svg>
      </Scene>
    </>
  )
}

/** A dip in a flat supply line at baseline y0, starting a third of the way along; `ring` adds the ringing. */
function curve(x0: number, x1: number, y0: number, depth: number, ring: boolean, k = 1) {
  const pts: string[] = []
  const n = 70
  const start = x0 + (x1 - x0) * 0.33
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n
    const d = (x - start) / k
    let v = 0
    if (d > 0) v = depth * (1 - Math.exp(-d / (ring ? 0.8 : 1.2))) * Math.exp(-d / (ring ? 4 : 3)) * (ring ? Math.cos(d * 0.9) : 1)
    pts.push(`${i ? "L" : "M"}${x.toFixed(2)} ${(y0 + v).toFixed(2)}`)
  }
  return pts.join("")
}

const Dot = ({ x, y, o = 1, color = FG }: { x: number; y: number; o?: number; color?: string }) => <circle cx={x} cy={y} r={0.6} fill={color} stroke="none" opacity={o} />

// ── decoupling ───────────────────────────────────────────────────────────────

function Decap({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.2) => riseAt(t, at, still, d)
  const w = enter(t, b.decap, 1.0)
  const pin = enter(t, b.pin, 0.4)
  const cap = enter(t, b.cap, 0.4)
  const card = span(t, b.cap, b.why - 0.1, 0.4, 0.35)
  const plots = enter(t, b.why, 0.5)
  const spike = enter(t, b.spike - 0.1, 0.7)
  const fill = enter(t, b.fill - 0.1, 0.4)
  const without = enter(t, b.without, 0.9)
  const withIt = enter(t, b.with, 0.9)
  const capDim = 1 - 0.75 * enter(t, b.without, 0.3) * (1 - enter(t, b.with - 0.1, 0.3))
  const redFade = 1 - 0.7 * withIt
  const s = 0.26
  return (
    <>
      <Svg>
        {/* the circuit: supply rail, chip VDD pin, 100 nF across it */}
        <Draw d="M10 14 H46" p={w} stroke={VOLT} />
        <Draw d="M30 14 V20.2 M18 14 V21.2" p={w} />
        <Draw d="M30 37.8 V44 M18 36.8 V44" p={w} />
        <Draw d="M10 44 H46" p={w} stroke={MUTED} />
        <Dot x={18} y={14} o={w} color={VOLT} />
        <Dot x={30} y={14} o={w} color={VOLT} />
        <Dot x={18} y={44} o={w} />
        <Dot x={30} y={44} o={w} />
        <Sym x={30} y={29} scale={s} opacity={w}>
          <Chip x={0} y={0} w={36} h={40} top={[" "]} bottom={[" "]} label="MCU" />
        </Sym>
        <g opacity={capDim * cap}>
          <Sym x={18} y={29} scale={s}>
            <Capacitor x={0} y={0} rot={90} />
          </Sym>
        </g>
        <Hl x={14} y={19.5} w={8} h={19} o={cap * (1 - plots * 0.6)} color={AMP} />
        <g opacity={fill} stroke={AMP} strokeWidth={0.35}>
          <path d="M20 11.5 H28 M26 10.2 L28 11.5 L26 12.8" />
        </g>

        {/* right: what the current and the voltage do */}
        <g opacity={plots} stroke={MUTED} strokeWidth={0.2}>
          <path d="M60 24 H94 M60 38 H94" />
        </g>
        <Draw d="M60 24 H70 L71.5 15 H76 L77.5 24 H94" p={spike} stroke={AMP} strokeWidth={0.5} />
        <g opacity={redFade}>
          <Draw d={curve(60, 94, 38, 9.5, true)} p={without} stroke={POWER} strokeWidth={0.5} />
        </g>
        <Draw d={curve(60, 94, 38, 1.9, false)} p={withIt} stroke={GOOD} strokeWidth={0.5} />
      </Svg>
      <T x={12} y={10.4} size={2.4} weight={600} color={VOLT} anchor="start" o={w}>
        3V3
      </T>
      <T x={12} y={48} size={2.4} weight={600} anchor="start" o={w}>
        GND
      </T>
      <T x={32.5} y={17.4} size={2.4} weight={600} color={VOLT} anchor="start" o={pin} dy={rise(b.pin, 0.6)}>
        电源脚
      </T>
      <T x={77} y={25} size={8} weight={600} o={card} className="tabular" dy={rise(b.cap, 1)}>
        100 nF
      </T>
      <T x={77} y={35} size={3.6} weight={600} color={AMP} o={Math.min(card, enter(t, b.name, 0.4))} dy={rise(b.name, 1)}>
        去耦电容
      </T>
      <T x={60} y={11.5} size={2.4} color={AMP} weight={600} anchor="start" o={plots}>
        芯片电流
      </T>
      <T x={60} y={29.5} size={2.4} color={VOLT} weight={600} anchor="start" o={plots}>
        电源脚电压
      </T>
      <T x={58.5} y={38} size={2} color={MUTED} anchor="end" o={plots} className="tabular">
        3.3 V
      </T>
      <T x={77} y={51} size={2.5} weight={600} color={POWER} o={without * (1 - withIt)}>
        没有它：跌落 200 多 mV
      </T>
      <T x={77} y={51} size={2.5} weight={600} color={GOOD} o={withIt} dy={rise(b.with, 0.8)}>
        装上它：几乎是平的
      </T>
    </>
  )
}

// ── reset ────────────────────────────────────────────────────────────────────

function Reset({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.2) => riseAt(t, at, still, d)
  const w = enter(t, b.reset, 1.0)
  const r = enter(t, b.r, 0.4)
  const c = enter(t, b.c, 0.4)
  const sw = enter(t, b.sw - 0.6, 0.4)
  const s = 0.25
  return (
    <>
      <T x={50} y={6} size={2.6} color={MUTED} o={enter(t, b.reset + 0.1)}>
        复位电路
      </T>
      <Svg>
        <Draw d="M17 12 H27" p={w} stroke={VOLT} />
        <Draw d="M22 32.5 H67.7" p={w} stroke={AMP} />
        <g opacity={w}>
          <Sym x={76} y={32.5} scale={s}>
            <Chip x={0} y={0} w={36} h={40} left={[" "]} label="MCU" />
          </Sym>
        </g>
        <g opacity={r}>
          <Draw d="M22 12 V14.5 M22 29.5 V32.5" p={1} />
          <Sym x={22} y={22} scale={s}>
            <Resistor x={0} y={0} rot={90} />
          </Sym>
          <Dot x={22} y={12} color={VOLT} />
        </g>
        <g opacity={c}>
          <Sym x={36} y={40} scale={s}>
            <Capacitor x={0} y={0} rot={90} />
          </Sym>
          <Dot x={36} y={32.5} color={AMP} />
        </g>
        <g opacity={sw}>
          <Sym x={56} y={40} scale={s}>
            <Switch x={0} y={0} rot={90} />
          </Sym>
          <Dot x={56} y={32.5} color={AMP} />
        </g>
        <Draw d="M36 47.5 H56" p={Math.min(c, sw)} stroke={MUTED} />
        <Hl x={18} y={13} w={8} h={18} o={r * (1 - 0.65 * c)} color={VOLT} />
        <Hl x={32} y={31} w={8} h={18} o={c * (1 - 0.65 * sw)} color={AMP} />
        <Hl x={52} y={31} w={8} h={18} o={sw} color={AMP} />
      </Svg>
      <T x={22} y={9} size={2.4} weight={600} color={VOLT} o={w}>
        3V3
      </T>
      <T x={67} y={29} size={2.4} color={MUTED} anchor="end" o={w}>
        复位脚
      </T>
      <T x={62} y={20} size={2.8} color={MUTED} o={span(t, b.reset + 0.3, b.sw + 0.6, 0.4, 0.4)}>
        复位脚平时被拉高，按下按键才被拉低
      </T>
      <T x={27} y={22} size={2.8} weight={600} anchor="start" o={r} dy={rise(b.r, 0.8)} className="tabular">
        10 kΩ
      </T>
      <T x={41.5} y={40} size={2.8} weight={600} anchor="start" o={c} dy={rise(b.c, 0.8)} className="tabular">
        100 nF
      </T>
      <T x={61} y={40} size={2.8} weight={600} anchor="start" o={sw} dy={rise(b.sw - 0.6, 0.8)}>
        按键
      </T>
      <T x={46} y={51} size={2.4} color={MUTED} o={sw}>
        地
      </T>
    </>
  )
}

// ── crystal ──────────────────────────────────────────────────────────────────

function Xtal({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.2) => riseAt(t, at, still, d)
  const w = enter(t, b.xtal, 0.9)
  const x = enter(t, b.x + 0.1, 0.5)
  const load = enter(t, b.load, 0.5)
  return (
    <>
      <Svg>
        <g opacity={w}>
          <Sym x={24} y={28} scale={0.3}>
            <Chip x={0} y={0} w={44} h={60} right={[" ", " "]} pitch={36} label="MCU" />
          </Sym>
        </g>
        <Draw d="M34.8 22.6 H54 V19 H62" p={w} />
        <Draw d="M34.8 33.4 H54 V37 H62" p={w} />
        <g opacity={x}>
          <Sym x={62} y={28} scale={0.3}>
            <Crystal x={0} y={0} rot={90} />
          </Sym>
        </g>
        <g opacity={load}>
          <Draw d="M44 22.6 V20" p={1} />
          <Sym x={44} y={14} scale={0.2}>
            <Capacitor x={0} y={0} rot={90} />
          </Sym>
          <path d="M40.5 8 H47.5 M41.7 6.8 H46.3" />
          <Draw d="M44 33.4 V37" p={1} />
          <Sym x={44} y={43} scale={0.2}>
            <Capacitor x={0} y={0} rot={90} />
          </Sym>
          <path d="M40.5 49 H47.5 M41.7 50.2 H46.3" />
          <Dot x={44} y={22.6} />
          <Dot x={44} y={33.4} />
        </g>
        <Hl x={40} y={7} w={8} h={13.5} o={load} color={AMP} />
        <Hl x={40} y={36.5} w={8} h={13.5} o={load} color={AMP} />
        <Hl x={58} y={17.5} w={8} h={21} o={x * (1 - 0.6 * load)} color={VOLT} />
      </Svg>
      <T x={24} y={13} size={2.6} weight={600} o={w}>
        单片机
      </T>
      <T x={69} y={28} size={3.4} weight={600} anchor="start" color={VOLT} o={x} dy={rise(b.x + 0.1, 0.8)}>
        晶振
      </T>
      <T x={49.5} y={14} size={2.4} color={MUTED} anchor="start" o={load}>
        负载电容
      </T>
      <T x={49.5} y={43} size={2.4} color={MUTED} anchor="start" o={load}>
        负载电容
      </T>
      <T x={83} y={46} size={5} weight={600} color={AMP} o={load} dy={rise(b.load, 1)} className="tabular">
        10–22 pF
      </T>
    </>
  )
}

// ── reverse protection ───────────────────────────────────────────────────────

function Reverse({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.2) => riseAt(t, at, still, d)
  const w = enter(t, b.rev, 1.0)
  const d = enter(t, b.d, 0.45)
  const m = enter(t, b.pmos, 0.45)
  const s = 0.25
  return (
    <>
      <Svg>
        {/* left: a series diode */}
        <Draw d="M10 22.5 V16 H16.5 M31.5 16 H42 V22.5 M42 37.5 V44 H10 V37.5" p={w} />
        <Draw d="M16.5 16 H31.5" p={w * (1 - d)} />
        <g opacity={w}>
          <Sym x={10} y={30} scale={s}>
            <Battery x={0} y={0} rot={90} />
          </Sym>
          <Sym x={42} y={30} scale={s}>
            <Resistor x={0} y={0} rot={90} />
          </Sym>
        </g>
        <g opacity={d}>
          <Sym x={24} y={16} scale={s}>
            <Diode x={0} y={0} />
          </Sym>
        </g>
        <Hl x={13.5} y={11} w={21} h={10} o={d} color={AMP} />

        {/* right: a P-channel MOSFET */}
        <Draw d="M54 22.5 V16 H69.5 V22.5 M69.5 37.5 V40 H74.5 M89.5 40 H92 V46 H54 V37.5" p={w} />
        <Draw d="M69.5 22.5 V37.5" p={w * (1 - m)} />
        <g opacity={w}>
          <Sym x={54} y={30} scale={s}>
            <Battery x={0} y={0} rot={90} />
          </Sym>
          <Sym x={82} y={40} scale={s}>
            <Resistor x={0} y={0} />
          </Sym>
        </g>
        <g opacity={m}>
          <Draw d="M58.5 30 V46" p={m} />
          <Sym x={66} y={30} scale={s}>
            <Mosfet x={0} y={0} type="p" />
          </Sym>
          <Dot x={58.5} y={46} />
        </g>
        <Hl x={62} y={19} w={14} h={22} o={m} color={AMP} />
      </Svg>
      <T x={24} y={8} size={3.4} weight={600} o={d} dy={rise(b.d, 1)}>
        串一只二极管
      </T>
      <T x={24} y={50} size={2.6} color={POWER} weight={600} o={d}>
        压降 0.3–0.5 V
      </T>
      <T x={74} y={8} size={3.4} weight={600} o={m} dy={rise(b.pmos, 1)}>
        P 沟道 MOSFET
      </T>
      <T x={86} y={29} size={2.6} color={GOOD} weight={600} o={m}>
        压降约 0.05 V
      </T>
    </>
  )
}

// ── level shifter ────────────────────────────────────────────────────────────

function Level({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.2) => riseAt(t, at, still, d)
  const five = enter(t, b.five, 0.8)
  const three = enter(t, b.three, 0.8)
  const fet = enter(t, b.fet, 0.5)
  const s = 0.3
  return (
    <>
      <Svg>
        {/* 5 V side */}
        <Draw d="M64 8 H92" p={five} stroke={VOLT} />
        <Draw d="M74 8 V9 M74 21 H86" p={five} />
        <Draw d="M54.2 21 H86" p={five * (1 - 0.0)} />
        <g opacity={five}>
          <Sym x={74} y={15} scale={0.2}>
            <Resistor x={0} y={0} rot={90} />
          </Sym>
          <Dot x={74} y={21} />
          <circle cx={86} cy={21} r={0.9} fill="var(--background)" />
        </g>
        {/* 3.3 V side */}
        <Draw d="M18 12 H36" p={three} stroke={VOLT} />
        <Draw d="M26 12 V18 M26 30 V42 M54.2 39 V42 H14" p={three} />
        <g opacity={three}>
          <Sym x={26} y={24} scale={0.2}>
            <Resistor x={0} y={0} rot={90} />
          </Sym>
          <Dot x={26} y={42} />
          <circle cx={14} cy={42} r={0.9} fill="var(--background)" />
        </g>
        {/* the transistor between them */}
        <g opacity={fet}>
          <Draw d="M41 30 H36 V12" p={1} stroke={VOLT} />
          <Sym x={50} y={30} scale={s}>
            <Mosfet x={0} y={0} type="n" />
          </Sym>
        </g>
        <Hl x={39} y={16} w={22} h={28} o={fet} color={AMP} />
      </Svg>
      <T x={95.5} y={8} size={2.4} weight={600} color={VOLT} o={five}>
        5V
      </T>
      <T x={18} y={9} size={2.4} weight={600} color={VOLT} anchor="start" o={three}>
        3V3
      </T>
      <T x={86} y={26} size={2.6} weight={600} o={five} dy={rise(b.five, 0.8)}>
        5 V 器件
      </T>
      <T x={14} y={47} size={2.6} weight={600} anchor="start" o={three} dy={rise(b.three, 0.8)}>
        3.3 V 单片机
      </T>
      <T x={54} y={30} size={5} color={MUTED} o={(five + three) / 2 * (1 - fet)}>
        ?
      </T>
      <T x={66} y={38} size={3.6} weight={600} anchor="start" o={fet} dy={rise(b.fet, 1)}>
        BSS138
      </T>
      <T x={66} y={44} size={2.4} color={MUTED} anchor="start" o={enter(t, b.fet + 0.3)}>
        电平转换
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "常见单元电路",
  audio,
  timing,
  poster: 3.6,
  Stage,
}

export default function CommonBlocksFilm() {
  return <FilmPlayer film={film} />
}

void Source

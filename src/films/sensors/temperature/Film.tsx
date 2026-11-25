import { trace } from "@/lab/colors"
import { Resistor } from "@/lab/schematic"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, M, Scene, Svg, Sym, T, V, easeInOut, enter, glide, lerp, span, type FilmDef, type StageProps } from "../../kit"
import { AMP, Box, HArrow, HEAT, LINE, MUTED, Outro, VOLT, riseFn, sceneO } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

const RES = trace.second

/*
 * 温度传感器, ~57 s. Scenes, each keyed to the words that introduce it:
 *   title → a thermometer and a thermistor; heating it makes the reading (kΩ) fall
 *   → R(T) on a linear axis, then on a log axis → the divider with its midpoint voltage
 *   → the S-curve and where it is steepest → self-heating → a digital chip on one wire
 *   → thermocouple and platinum resistor → "try it below".
 */

/** NTC 10 kΩ, B = 3950: resistance in kΩ at T °C. */
const ntc = (c: number) => 10 * Math.exp(3950 * (1 / (c + 273.15) - 1 / 298.15))
const kfmt = (k: number) => (k >= 10 ? k.toFixed(0) : k.toFixed(1))

function Stage({ t, b, still }: StageProps) {
  const A = span(t, 0.25, b.curve - 0.15, 0.4, 0.3)
  const B = span(t, b.curve - 0.3, b.div + 0.05, 0.3, 0.3)
  const C = span(t, b.div + 0.1, b.pick - 0.15, 0.3, 0.3)
  const D = sceneO(t, b.pick, b.self)
  // self-heating draws its part where the S-curve was: let the curve go first
  const E = span(t, b.self, b.chip - 0.15, 0.3, 0.3)
  const F = sceneO(t, b.chip, b.hi)
  const G = sceneO(t, b.hi, b.outro)
  const outro = enter(t, b.outro - 0.3, 0.4)
  return (
    <>
      <Scene o={A}>
        <Heat t={t} b={b} still={still} />
      </Scene>
      <Scene o={B}>
        <RvsT t={t} b={b} />
      </Scene>
      <Scene o={C}>
        <Divider t={t} b={b} />
      </Scene>
      <Scene o={D}>
        <SCurve t={t} b={b} />
      </Scene>
      <Scene o={E}>
        <SelfHeat t={t} b={b} still={still} />
      </Scene>
      <Scene o={F}>
        <Chip t={t} b={b} still={still} />
      </Scene>
      <Scene o={G}>
        <Hot t={t} b={b} still={still} />
      </Scene>
      <Scene o={outro}>
        <Outro t={t} still={still} at={b.outro} hintAt={b.try} hint="拖动实验台里的温度，看分压的电压怎么变" />
      </Scene>
    </>
  )
}

// ── title: heat it, the resistance falls ─────────────────────────────────────

function Heat({ t, b, still }: StageProps) {
  const rise = riseFn(t, still)
  const temp = glide(t, b.hot, 25, 80, 1.6)
  const frac = (temp - 0) / 100
  const TOP = 17
  const BOT = 40
  const level = lerp(BOT, TOP, frac)
  const r = ntc(temp)
  const titleO = span(t, 0.3, b.ntc - 0.2, 0.6, 0.35)
  const th = enter(t, b.therm, 0.5)
  return (
    <>
      <T x={50} y={9} size={7} weight={600} o={titleO} dy={rise(0.3)}>
        温度传感器
      </T>
      <Svg>
        <g opacity={enter(t, 0.5, 0.6)}>
          <rect x={20} y={TOP - 2} width={4} height={BOT - TOP + 4} rx={2} />
          <circle cx={22} cy={43} r={3.6} />
          <path d={`M27 ${TOP + 2} h1.2 M27 ${(TOP + BOT) / 2} h1.2 M27 ${BOT - 2} h1.2`} strokeWidth={0.2} />
        </g>
        <rect x={21.2} y={level} width={1.6} height={BOT + 2 - level} fill={HEAT} stroke="none" opacity={enter(t, 0.6)} />
        <circle cx={22} cy={43} r={2.5} fill={HEAT} stroke="none" opacity={enter(t, 0.6)} />
        <g opacity={th}>
          <path d="M58 15 V19.5 M58 34.5 V39" />
          <Sym x={58} y={27} scale={0.25}>
            <Resistor x={0} y={0} rot={90} variable />
          </Sym>
        </g>
        <HArrow x0={31} x1={50} y={30} p={enter(t, b.hot - 0.2, 0.6)} color={HEAT} />
      </Svg>
      {["电池充电", "打印机喷头", "芯片防过热"].map((w, i) => (
        <T key={w} x={68} y={22 + i * 8} size={3} color={MUTED} o={span(t, 1.4 + i * 1.1, b.therm - 0.1, 0.5, 0.35)} dy={rise(1.4 + i * 1.1, 1)}>
          {w}
        </T>
      ))}
      <T x={22} y={49} size={3.4} weight={600} color={HEAT} o={enter(t, 0.7)} className="tabular">
        <M>{Math.round(temp)} °C</M>
      </T>
      <T x={58} y={45} size={2.6} o={th} dy={rise(b.therm, 1)}>
        热敏电阻
      </T>
      <T x={40.5} y={26} size={2.2} color={HEAT} o={enter(t, b.hot - 0.1, 0.5)}>
        加热
      </T>
      <T x={82} y={20} size={2.4} color={MUTED} o={th}>
        阻值
      </T>
      <T x={82} y={28} size={4.6} weight={600} color={RES} o={th} className="tabular">
        <M>{kfmt(r)} kΩ</M>
      </T>
      <T x={82} y={36} size={2.4} color={MUTED} o={enter(t, b.low, 0.5)}>
        越来越小
      </T>
      <T
        x={82}
        y={45}
        size={2.8}
        weight={600}
        o={enter(t, b.ntcw - 0.1, 0.5)}
        className="rounded-full border border-input px-[0.9em] py-[0.45em]"
      >
        NTC
      </T>
    </>
  )
}

// ── R(T): linear axis, then log ─────────────────────────────────────────────

const PX0 = 18
const PX1 = 78
const PY0 = 44
const PY1 = 10
const px = (c: number) => PX0 + ((c + 20) / 120) * (PX1 - PX0)

function RvsT({ t, b }: Pick<StageProps, "t" | "b">) {
  const k = easeInOut((t - (b.logw - 0.9)) / 1.2)
  const py = (r: number) => {
    const lin = PY0 - (r / 105) * (PY0 - PY1)
    const log = PY0 - ((Math.log10(r) - Math.log10(0.5)) / (Math.log10(150) - Math.log10(0.5))) * (PY0 - PY1)
    return lerp(lin, log, k)
  }
  const axes = enter(t, b.curve, 0.6)
  const draw = enter(t, b.curve + 0.6, 2.0)
  const N = 48
  let d = ""
  for (let i = 0; i <= N * draw; i++) {
    const c = -20 + (120 * i) / N
    d += `${i ? "L" : "M"}${px(c).toFixed(2)} ${py(ntc(c)).toFixed(2)}`
  }
  const c1 = enter(t, b.c1, 0.4)
  const c2 = enter(t, b.c2, 0.4)
  const times = enter(t, b.times, 0.5)
  return (
    <>
      <Svg>
        <Draw d={`M${PX0} ${PY0} H${PX1 + 3}`} p={axes} />
        <Draw d={`M${PX0} ${PY0} V${PY1 - 3}`} p={axes} />
        <path d={d} stroke={RES} strokeWidth={0.5} />
        <circle cx={px(-20)} cy={py(ntc(-20))} r={0.9} fill={RES} stroke="none" opacity={c1} />
        <circle cx={px(100)} cy={py(ntc(100))} r={0.9} fill={RES} stroke="none" opacity={c2} />
        <g stroke={LINE} strokeWidth={0.15} opacity={axes}>
          <path d={`M${px(-20)} ${PY0} v1 M${px(25)} ${PY0} v1 M${px(100)} ${PY0} v1`} />
        </g>
        <path d={`M${px(100)} ${py(ntc(100)) - 1.4} V24.5`} stroke={RES} strokeWidth={0.2} opacity={c2} />
        <g opacity={times * (1 - k)} stroke={HEAT} strokeWidth={0.3}>
          <path d={`M${px(100) + 4} ${py(ntc(-20))} V${py(ntc(100))}`} />
        </g>
      </Svg>
      <T x={PX0 - 1.5} y={PY1 - 1} size={2.4} anchor="end" color={MUTED} o={axes}>
        阻值 <V c={RES}>R</V>
      </T>
      <T x={PX1 + 3} y={PY1 - 4.5} size={2.4} anchor="end" color={MUTED} o={axes}>
        {k > 0.5 ? "纵轴：对数坐标" : "纵轴：线性坐标"}
      </T>
      <T x={50} y={PY0 + 7} size={2.4} color={MUTED} o={axes}>
        温度
      </T>
      {([-20, 25, 100] as const).map((c) => (
        <T key={c} x={px(c)} y={PY0 + 3.2} size={2} color={MUTED} o={axes} className="tabular">
          <M>{c < 0 ? `−${-c}` : c} °C</M>
        </T>
      ))}
      <T x={px(-20) + 2.5} y={py(ntc(-20)) - 3} size={2.8} anchor="start" weight={600} color={RES} o={c1} className="tabular">
        <M>−20 °C：105 kΩ</M>
      </T>
      <T x={px(100) + 1} y={22} size={2.8} anchor="end" weight={600} color={RES} o={c2} className="tabular">
        <M>100 °C：0.7 kΩ</M>
      </T>
      <T x={px(100) + 5.5} y={(py(ntc(-20)) + py(ntc(100))) / 2} size={3.2} anchor="start" weight={600} color={HEAT} o={times * (1 - k)}>
        差 150 倍
      </T>
    </>
  )
}

// ── the divider ─────────────────────────────────────────────────────────────

function Divider({ t, b }: Pick<StageProps, "t" | "b">) {
  const temp = glide(t, b.mid + 0.2, 25, 80, 1.0)
  const rt = ntc(temp)
  const vout = (3.3 * 10) / (rt + 10)
  const X = 34
  const parts = enter(t, b.div + 1.9, 0.5)
  const tap = enter(t, b.divw, 0.6)
  const mcu = enter(t, b.div + 0.25, 0.5)
  const volt = enter(t, b.mid - 0.2, 0.5)
  const g0 = enter(t, b.div + 0.35, 0.5) * (1 - enter(t, b.div + 1.6, 0.4))
  return (
    <>
      <Svg>
        <path d={`M${X - 5} 10.5 H${X + 5}`} opacity={parts} />
        <Draw d={`M${X} 10.5 V13.5`} p={parts} />
        <Sym x={X} y={21} scale={0.25} opacity={parts}>
          <Resistor x={0} y={0} rot={90} variable />
        </Sym>
        <Draw d={`M${X} 28.5 V31.5`} p={parts} />
        <Sym x={X} y={39} scale={0.25} opacity={parts}>
          <Resistor x={0} y={0} rot={90} />
        </Sym>
        <Draw d={`M${X} 46.5 V49 M${X - 3.5} 49 H${X + 3.5} M${X - 2} 50.4 H${X + 2} M${X - 0.8} 51.8 H${X + 0.8}`} p={parts} />
        <circle cx={X} cy={30} r={0.8} fill="currentColor" stroke="none" opacity={tap} />
        <Draw d={`M${X} 30 H58`} p={tap} stroke={VOLT} />
        <Box x={58} y={22} w={26} h={16} o={mcu} />
        <g opacity={g0}>
          <path d="M12 30 h4" />
          <Sym x={24} y={30} scale={0.2}>
            <Resistor x={0} y={0} />
          </Sym>
          <path d="M32 30 h4" />
          <HArrow x0={38} x1={56} y={30} p={g0} color={MUTED} />
          <path d="M44 27.5 l4 5 M48 27.5 l-4 5" stroke={HEAT} strokeWidth={0.45} />
        </g>
      </Svg>
      <T x={X} y={7.5} size={2.4} color={MUTED} o={parts}>
        <M>3.3 V</M>
      </T>
      <T x={X - 6} y={21} size={2.6} anchor="end" o={parts}>
        热敏电阻
      </T>
      <T x={X - 6} y={39} size={2.6} anchor="end" o={parts}>
        固定电阻
      </T>
      <T x={47} y={27.6} size={2.4} weight={600} color={VOLT} o={tap}>
        中点
      </T>
      <T x={71} y={27.5} size={2.8} weight={600} o={mcu}>
        单片机
      </T>
      <T x={71} y={33.5} size={2.4} color={MUTED} o={mcu}>
        {t < b.div + 1.9 ? "只认电压，读不了电阻" : "读这个电压"}
      </T>
      <T x={71} y={45} size={5} weight={600} color={VOLT} o={volt} className="tabular">
        <M>{vout.toFixed(2)} V</M>
      </T>
      <T x={71} y={13} size={2.6} color={HEAT} weight={600} o={enter(t, b.mid + 0.2, 0.5)} className="tabular">
        <M>{Math.round(temp)} °C</M>
      </T>
      <T x={71} y={17} size={2} color={MUTED} o={enter(t, b.mid + 0.2, 0.5)}>
        温度升高，电压升高
      </T>
    </>
  )
}

// ── the S-curve and where it is steepest ────────────────────────────────────

function SCurve({ t, b }: Pick<StageProps, "t" | "b">) {
  const X0 = 12
  const X1 = 64
  const Y0 = 44
  const Y1 = 11
  const sx = (c: number) => X0 + ((c + 20) / 120) * (X1 - X0)
  const sy = (v: number) => Y0 - (v / 3.3) * (Y0 - Y1)
  const vo = (c: number) => (3.3 * 10) / (ntc(c) + 10)
  const axes = enter(t, b.pick, 0.6)
  const draw = enter(t, b.pick + 0.4, 2.2)
  const N = 48
  let d = ""
  for (let i = 0; i <= N * draw; i++) {
    const c = -20 + (120 * i) / N
    d += `${i ? "L" : "M"}${sx(c).toFixed(2)} ${sy(vo(c)).toFixed(2)}`
  }
  const st = enter(t, b.steep, 0.5)
  return (
    <>
      <Svg>
        <Draw d={`M${X0} ${Y0} H${X1 + 3}`} p={axes} />
        <Draw d={`M${X0} ${Y0} V${Y1 - 3}`} p={axes} />
        <path d={d} stroke={VOLT} strokeWidth={0.5} />
        <g opacity={st} stroke={HEAT} strokeWidth={0.4}>
          <circle cx={sx(25)} cy={sy(vo(25))} r={1.2} fill={HEAT} stroke="none" />
        </g>
        <g stroke={LINE} strokeWidth={0.15} opacity={axes}>
          <path d={`M${sx(25)} ${Y0} V${sy(vo(25))}`} />
        </g>
      </Svg>
      <T x={X0 + 1} y={Y1 - 4} size={2.4} anchor="start" color={MUTED} o={axes}>
        中点电压 <V c={VOLT}>V</V>
      </T>
      <T x={X1 + 3} y={Y0 + 3.6} size={2.4} anchor="end" color={MUTED} o={axes}>
        温度
      </T>
      <T x={sx(25)} y={Y0 + 3.2} size={2} color={MUTED} o={axes} className="tabular">
        <M>25 °C</M>
      </T>
      <T x={sx(25) + 2.5} y={sy(vo(25)) + 4.5} size={2.6} anchor="start" weight={600} color={HEAT} o={st}>
        最灵敏
      </T>
      <T x={82} y={20} size={2.4} color={MUTED} o={enter(t, b.pickw, 0.5)}>
        固定电阻
      </T>
      <T x={82} y={27} size={5} weight={600} o={enter(t, b.pickw, 0.5)} className="tabular">
        <M>10 kΩ</M>
      </T>
      <T x={82} y={37} size={2.4} color={MUTED} o={st}>
        等于 25 °C 时
      </T>
      <T x={82} y={41} size={2.4} color={MUTED} o={st}>
        热敏电阻的阻值
      </T>
    </>
  )
}

// ── self-heating ────────────────────────────────────────────────────────────

function SelfHeat({ t, b, still }: StageProps) {
  const ph = still ? 0 : t * 2.2
  const parts = enter(t, b.self + 0.1, 0.5)
  const heat = enter(t, b.selfw, 0.6)
  return (
    <>
      <Svg>
        <g opacity={parts}>
          <path d="M26 24 H38 M62 24 H74 M26 24 V32 M74 24 V32" />
          <Sym x={50} y={24} scale={0.4} opacity={1}>
            <Resistor x={0} y={0} variable />
          </Sym>
        </g>
        <HArrow x0={28} x1={36} y={21.5} p={enter(t, b.self + 0.3, 0.6)} color={AMP} />
        {[-6, 0, 6].map((dx, i) => {
          let d = ""
          for (let j = 0; j <= 16; j++) {
            const y = 19 - j * 0.65
            d += `${j ? "L" : "M"}${(50 + dx + 1.1 * Math.sin(j * 0.9 + ph + i * 1.7)).toFixed(2)} ${y.toFixed(2)}`
          }
          return <path key={i} d={d} stroke={HEAT} opacity={heat * 0.85} />
        })}
      </Svg>
      <T x={50} y={31} size={2.6} o={parts}>
        热敏电阻
      </T>
      <T x={32} y={18.2} size={2.4} color={AMP} o={enter(t, b.self + 0.4, 0.5)}>
        电流
      </T>
      <T x={26} y={44} size={2.6} color={MUTED} o={enter(t, b.selfw, 0.5)}>
        周围
      </T>
      <T x={26} y={49.5} size={4.2} weight={600} o={enter(t, b.selfw, 0.5)} className="tabular">
        <M>25.0 °C</M>
      </T>
      <T x={74} y={44} size={2.6} color={MUTED} o={enter(t, b.selfw + 0.7, 0.5)}>
        读数
      </T>
      <T x={74} y={49.5} size={4.2} weight={600} color={HEAT} o={enter(t, b.selfw + 0.7, 0.5)} className="tabular">
        <M>25.4 °C</M>
      </T>
      <T x={50} y={44} size={2.6} color={HEAT} o={enter(t, b.selfw + 1.2, 0.5)}>
        偏高
      </T>
    </>
  )
}

// ── digital chip on one wire ────────────────────────────────────────────────

function Chip({ t, b, still }: StageProps) {
  const ph = still ? 0 : t * 6
  const formula = span(t, b.chip - 0.1, b.chipw - 0.35, 0.4, 0.35)
  const strike = enter(t, b.chip + 0.7, 0.4)
  const chip = enter(t, b.chipw, 0.5)
  const wire = enter(t, b.wire - 0.3, 0.6)
  const bits = [0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 1]
  return (
    <>
      <T x={50} y={30} size={5} color={MUTED} o={formula}>
        <span className="relative inline-block">
          <V>R</V> <M>=</M> <V>R</V>
          <span style={{ fontSize: "0.7em" }}>
            <M>25</M>
          </span>
          <M> · e</M>
          <span style={{ fontSize: "0.7em", verticalAlign: "0.5em" }}>
            <V>B</V>
            <M>(1/</M>
            <V>T</V>
            <M> − 1/298)</M>
          </span>
          <span className="absolute left-[-3%] top-1/2 h-[0.09em] bg-current" style={{ width: `${106 * strike}%`, backgroundColor: HEAT }} />
        </span>
      </T>
      <T x={50} y={21} size={2.4} color={MUTED} o={formula}>
        要算的 B 值公式
      </T>
      <Svg>
        <Box x={12} y={24} w={24} h={16} o={chip} />
        <Box x={64} y={24} w={24} h={16} o={chip} />
        <Draw d="M36 32 H64" p={wire} stroke={AMP} strokeWidth={0.45} />
        <g opacity={wire}>
          {Array.from({ length: 12 }, (_, i) => {
            const x = 38 + ((i * 2.2 + ph) % 26)
            return <circle key={i} cx={x} cy={32} r={0.45} fill={AMP} stroke="none" opacity={bits[i] ? 1 : 0.25} />
          })}
        </g>
      </Svg>
      <T x={24} y={30} size={2.8} weight={600} o={chip}>
        数字温度芯片
      </T>
      <T x={24} y={35.5} size={2.2} color={MUTED} o={chip}>
        DS18B20
      </T>
      <T x={76} y={32} size={2.8} weight={600} o={chip}>
        单片机
      </T>
      <T x={50} y={27.5} size={2.4} color={AMP} weight={600} o={wire}>
        一根线
      </T>
      <T x={24} y={46} size={2.6} color={MUTED} o={enter(t, b.wire + 0.6, 0.5)} className="tabular">
        <M>±0.5 °C</M>
      </T>
      <T x={76} y={46} size={2.6} color={MUTED} o={enter(t, b.wire + 0.9, 0.5)}>
        直接读出温度
      </T>
    </>
  )
}

// ── thermocouple and platinum resistor ──────────────────────────────────────

function Hot({ t, b, still }: StageProps) {
  const rise = riseFn(t, still)
  const tc = enter(t, b.tc, 0.5)
  const pt = enter(t, b.pt, 0.5)
  const glow = still ? 0.8 : 0.65 + 0.2 * Math.sin(t * 4)
  return (
    <>
      <T x={50} y={9} size={3.4} weight={600} o={enter(t, b.hi, 0.5)} dy={rise(b.hi, 1)}>
        更高温，更精密
      </T>
      <Svg>
        <Box x={8} y={16} w={40} h={26} o={enter(t, b.hi + 0.3, 0.5)} />
        <Box x={52} y={16} w={40} h={26} o={enter(t, b.hi + 0.3, 0.5)} />
        <g opacity={tc}>
          <path d="M16 22 L28 32" stroke={RES} strokeWidth={0.5} />
          <path d="M16 38 L28 32" stroke={trace.third} strokeWidth={0.5} />
          <circle cx={28} cy={32} r={2} fill={HEAT} stroke="none" opacity={glow} />
          <path d="M28 32 H40" stroke={LINE} />
        </g>
        <g opacity={pt}>
          <Sym x={72} y={32.5} scale={0.25}>
            <Resistor x={0} y={0} rot={90} />
          </Sym>
        </g>
      </Svg>
      <T x={28} y={21} size={3} weight={600} o={tc} dy={rise(b.tc, 1)}>
        热电偶
      </T>
      <T x={28} y={46.5} size={2.4} color={MUTED} o={enter(t, b.tc + 0.4, 0.5)}>
        炉子、窑：上千度
      </T>
      <T x={72} y={21} size={3} weight={600} o={pt} dy={rise(b.pt, 1)}>
        铂电阻
      </T>
      <T x={84} y={32.5} size={2.4} anchor="end" color={MUTED} o={enter(t, b.pt + 0.3, 0.5)} className="tabular">
        <M>100 Ω</M>
      </T>
      <T x={72} y={46.5} size={2.4} color={MUTED} o={enter(t, b.pt + 0.4, 0.5)}>
        几乎是直线，长期稳定
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "温度传感器",
  audio,
  timing,
  poster: 3.2,
  Stage,
}

export default function TemperatureFilm() {
  return <FilmPlayer film={film} />
}

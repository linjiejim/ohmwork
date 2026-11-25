import { trace, glow } from "@/lab/colors"
import { Resistor } from "@/lab/schematic"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, M, Scene, Svg, Sym, T, V, clamp01, easeInOut, enter, glide, lerp, span, type FilmDef, type StageProps } from "../../kit"
import { AMP, Box, GOOD, HArrow, HEAT, LINE, MUTED, Outro, VOLT, riseFn, sceneO } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

const RES = trace.second
const OUT = trace.second
const BACK = trace.third
const LIGHT = glow.amber

/*
 * 光与距离传感器, ~60 s. Scenes, each keyed to the words that introduce it:
 *   title → light as a quantity (sun on a sensor) and light as a tool (send out, see it return)
 *   → the photoresistor: brightness sets the kΩ reading → divider + comparator + lamp
 *   → photodiode (current ∝ light) into an op-amp → IR pair, light bounced off a pale surface
 *   → a 38 kHz flicker the receiver can pick out → ultrasonic ranging, a worked number
 *   → blind zone and range limit → "try it below".
 */

/** Short rays around a point, `o` scales their length and opacity. */
function Rays({ cx, cy, r, n = 10, len = 3.2, o, color = LIGHT }: { cx: number; cy: number; r: number; n?: number; len?: number; o: number; color?: string }) {
  if (o <= 0.01) return null
  return (
    <g stroke={color} opacity={o} strokeWidth={0.4}>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2
        const r0 = r + 1
        const r1 = r + 1 + len * (0.4 + 0.6 * o)
        return <path key={i} d={`M${cx + Math.cos(a) * r0} ${cy + Math.sin(a) * r0} L${cx + Math.cos(a) * r1} ${cy + Math.sin(a) * r1}`} />
      })}
    </g>
  )
}

function Stage({ t, b, still }: StageProps) {
  const A = span(t, 0.25, b.ldr - 0.15, 0.4, 0.3)
  const B = sceneO(t, b.ldr, b.lamp)
  const C = sceneO(t, b.lamp, b.pd)
  const D = sceneO(t, b.pd, b.ir)
  const E = sceneO(t, b.ir, b.rem)
  const F = sceneO(t, b.rem, b.us)
  const G = sceneO(t, b.us, b.lim)
  const H = sceneO(t, b.lim, b.outro)
  const outro = enter(t, b.outro - 0.3, 0.4)
  return (
    <>
      <Scene o={A}>
        <Title t={t} b={b} still={still} />
      </Scene>
      <Scene o={B}>
        <Ldr t={t} b={b} still={still} />
      </Scene>
      <Scene o={C}>
        <LampCircuit t={t} b={b} />
      </Scene>
      <Scene o={D}>
        <Photodiode t={t} b={b} />
      </Scene>
      <Scene o={E}>
        <IrPair t={t} b={b} />
      </Scene>
      <Scene o={F}>
        <Remote t={t} b={b} still={still} />
      </Scene>
      <Scene o={G}>
        <Ultrasonic t={t} b={b} />
      </Scene>
      <Scene o={H}>
        <Limits t={t} b={b} />
      </Scene>
      <Scene o={outro}>
        <Outro t={t} still={still} at={b.outro} hintAt={b.try} hint="拖动实验台里的光照，看灯什么时候亮" />
      </Scene>
    </>
  )
}

// ── title ────────────────────────────────────────────────────────────────────

function Title({ t, b, still }: StageProps) {
  const rise = riseFn(t, still)
  const ph = still ? 0 : t * 3
  const meas = enter(t, b.meas, 0.5)
  const tool = enter(t, b.tool, 0.5)
  // the pulse goes out and comes back
  const k = (t - b.tool - 0.6) / 2.4
  const cyc = still ? 0.5 : ((k % 1) + 1) % 1
  const out = clamp01(cyc * 2)
  const back = clamp01(cyc * 2 - 1)
  return (
    <>
      <T x={50} y={9} size={7} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
        光与距离传感器
      </T>
      <Svg>
        <Box x={6} y={17} w={40} h={28} o={enter(t, b.meas - 0.2, 0.5)} />
        <Box x={54} y={17} w={40} h={28} o={enter(t, b.tool - 0.2, 0.5)} />
        <g opacity={meas}>
          <circle cx={16} cy={32} r={3.2} fill={LIGHT} stroke="none" opacity={0.9} />
          <path d="M21 34 L34 38 M21 36.5 L29 38.5" stroke={LIGHT} strokeWidth={0.4} opacity={0.8 + 0.2 * Math.sin(ph)} />
          <rect x={33} y={38} width={8} height={4} rx={0.8} />
        </g>
        <Rays cx={16} cy={32} r={3.2} o={meas} />
        <g opacity={tool}>
          <rect x={58} y={28} width={6} height={9} rx={0.8} />
          <path d="M89 22 V42" strokeWidth={0.7} />
          <Draw d="M65 31 H88" p={out} stroke={OUT} />
          <Draw d="M88 34 H65" p={back} stroke={BACK} />
          <HArrow x0={80} x1={88} y={31} p={out > 0.2 ? 1 : 0} color={OUT} />
        </g>
      </Svg>
      <T x={26} y={21.5} size={2.8} weight={600} o={meas}>
        被测量
      </T>
      <T x={26} y={47.5} size={2.4} color={MUTED} o={enter(t, b.meas + 0.5, 0.5)}>
        现在有多亮
      </T>
      <T x={74} y={21.5} size={2.8} weight={600} o={tool}>
        工具
      </T>
      <T x={74} y={47.5} size={2.4} color={MUTED} o={enter(t, b.tool + 0.5, 0.5)}>
        发出去，看它回不回来
      </T>
    </>
  )
}

// ── photoresistor ───────────────────────────────────────────────────────────

const ldrOhm = (l: number) => 1e6 * Math.pow(10, -3.5 * l)
function ohmFmt(r: number) {
  if (r >= 9.5e5) return "1 MΩ 以上"
  if (r >= 1000) return `${(r / 1000).toFixed(r >= 1e4 ? 0 : 1)} kΩ`
  return `${Math.round(r / 10) * 10} Ω`
}

function Ldr({ t, b, still }: StageProps) {
  const rise = riseFn(t, still)
  const L = t < b.dark - 0.2 ? glide(t, b.strong, 0.35, 0.75, 1.0) : t < b.sun - 0.2 ? glide(t, b.dark, 0.75, 0, 0.8) : glide(t, b.sun, 0, 1, 0.9)
  const R = ldrOhm(L)
  const word = t < b.strong ? "室内灯光" : t < b.dark ? "光越强" : t < b.sun ? "全黑" : "阳光"
  const parts = enter(t, b.ldrw, 0.5)
  return (
    <>
      <Svg>
        <circle cx={16} cy={28} r={4} fill={LIGHT} stroke="none" opacity={0.2 + 0.8 * L} />
        <Rays cx={16} cy={28} r={4} n={12} len={5} o={L} />
        {[24, 28, 32].map((y) => (
          <HArrow key={y} x0={26} x1={38} y={y} p={L > 0.05 ? 1 : 0} color={LIGHT} />
        ))}
        <g opacity={parts}>
          <path d="M50 15 V19.5 M50 36.5 V41" />
          <Sym x={50} y={28} scale={0.3}>
            <Resistor x={0} y={0} rot={90} variable />
          </Sym>
        </g>
      </Svg>
      <T x={50} y={46} size={2.6} o={parts} dy={rise(b.ldrw, 1)}>
        光敏电阻
      </T>
      <T x={16} y={42} size={3} weight={600} o={enter(t, 0.1 + b.ldr, 0.5)} color={L < 0.1 ? MUTED : undefined}>
        {word}
      </T>
      <T x={80} y={21} size={2.4} color={MUTED} o={parts}>
        阻值
      </T>
      <T x={80} y={29} size={t > b.dark - 0.2 && t < b.sun ? 4.2 : 5} weight={600} color={RES} o={parts} className="tabular">
        <M>{ohmFmt(R)}</M>
      </T>
      <T x={80} y={37} size={2.4} color={MUTED} o={enter(t, b.strong, 0.5)}>
        光越强，阻值越小
      </T>
    </>
  )
}

// ── divider + comparator + lamp ─────────────────────────────────────────────

function LampCircuit({ t, b }: Pick<StageProps, "t" | "b">) {
  const X = 20
  const parts = enter(t, b.lamp, 0.6)
  const div = enter(t, b.div - 0.2, 0.5)
  const cmp = enter(t, b.cmp, 0.5)
  const on = enter(t, b.lampw, 0.5)
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
        <circle cx={X} cy={30} r={0.8} fill="currentColor" stroke="none" opacity={div} />
        <Draw d={`M${X} 30 H34 V26 H44`} p={div} stroke={VOLT} />
        <Draw d={`M32 34 H44`} p={cmp} />
        <g opacity={cmp}>
          <path d="M44 20 V40 L62 30 Z" />
          {/* dark → LDR up → midpoint down: the midpoint goes to −, the threshold to +, so the output goes high in the dark */}
          <path d="M46 26 h2.4 M46 34 h2.4 M47.2 32.8 v2.4" strokeWidth={0.25} />
        </g>
        <Draw d={`M62 30 H76`} p={on} />
        <circle cx={82} cy={30} r={5} fill={LIGHT} stroke="none" opacity={0.85 * on} />
        <circle cx={82} cy={30} r={5} opacity={Math.max(on, cmp * 0.5)} />
        <Rays cx={82} cy={30} r={5} n={12} len={4} o={on} />
      </Svg>
      <T x={X} y={7.2} size={2.2} color={MUTED} o={parts}>
        <M>3.3 V</M>
      </T>
      <T x={X - 6} y={21} size={2.6} anchor="end" o={parts}>
        光敏电阻
      </T>
      <T x={X - 6} y={39} size={2.6} anchor="end" o={parts}>
        固定电阻
      </T>
      <T x={38.5} y={23.6} size={2.2} weight={600} color={VOLT} o={div}>
        分压
      </T>
      <T x={30} y={37.5} size={2.2} color={MUTED} o={cmp}>
        阈值
      </T>
      <T x={53} y={45} size={2.6} o={cmp}>
        比较器
      </T>
      <T x={82} y={42} size={2.6} weight={600} o={on}>
        天黑，灯亮
      </T>
    </>
  )
}

// ── photodiode into an op-amp ───────────────────────────────────────────────

function Photodiode({ t, b }: Pick<StageProps, "t" | "b">) {
  const pd = enter(t, b.pdw - 0.05, 0.5)
  const prop = enter(t, b.prop, 0.9)
  const amp = enter(t, b.tia, 0.5)
  const intro = enter(t, b.pd, 0.5)
  const bars = span(t, b.pd + 0.1, b.pdw - 0.35, 0.4, 0.35)
  return (
    <>
      <T x={50} y={9} size={3.2} weight={600} o={intro}>
        要快、要准
      </T>
      <Svg>
        <g opacity={bars}>
          <rect x={38} y={19.5} width={44} height={4} rx={0.8} fill={RES} stroke="none" opacity={0.8} />
          <rect x={38} y={31.5} width={1.2} height={4} rx={0.4} fill={AMP} stroke="none" />
        </g>
        {/* the diode: a triangle and bar, with light arriving */}
        <g opacity={pd}>
          <path d="M12 30 H20 M20 23 V37 L32 30 Z M32 23 V37 M32 30 H40" />
          <path d="M14 13 L21 20 M19.6 20 H21 V18.6 M20 11 L27 18 M25.6 18 H27 V16.6" stroke={LIGHT} strokeWidth={0.4} />
        </g>
        {/* current ∝ light */}
        <Draw d="M48 44 H68" p={prop} />
        <Draw d="M48 44 V20" p={prop} />
        <Draw d="M48 44 L66 26" p={prop} stroke={AMP} strokeWidth={0.55} />
        {/* the op-amp */}
        <g opacity={amp}>
          <path d="M76 20 V40 L92 30 Z" />
          <path d="M78 26 h2.4 M78 34 h2.4 M79.2 24.8 v2.4" strokeWidth={0.25} />
          <path d="M70 26 H76 M70 34 H76 M92 30 H96" />
        </g>
      </Svg>
      <T x={34} y={21.5} size={2.6} anchor="end" o={bars}>
        光敏电阻
      </T>
      <T x={84} y={21.5} size={2.6} anchor="start" color={MUTED} o={bars}>
        几十毫秒
      </T>
      <T x={34} y={33.5} size={2.6} anchor="end" o={bars}>
        光电二极管
      </T>
      <T x={42} y={33.5} size={2.6} anchor="start" color={AMP} weight={600} o={bars}>
        微秒级
      </T>
      <T x={26} y={45} size={2.6} weight={600} o={pd}>
        光电二极管
      </T>
      <T x={58} y={47.5} size={2.2} color={MUTED} o={prop}>
        光强
      </T>
      <T x={48} y={17} size={2.2} color={AMP} o={prop}>
        电流
      </T>
      <T x={50} y={24} size={2.6} anchor="start" weight={600} color={AMP} o={prop}>
        成正比
      </T>
      <T x={84} y={45} size={2.6} weight={600} o={amp}>
        运放
      </T>
      <T x={84} y={50} size={2.2} color={MUTED} o={enter(t, b.tia + 0.4, 0.5)}>
        <M>1 μA × 1 MΩ = 1 V</M>
      </T>
    </>
  )
}

// ── infrared pair ───────────────────────────────────────────────────────────

function IrPair({ t, b }: Pick<StageProps, "t" | "b">) {
  const base = enter(t, b.ir, 0.5)
  const surface = enter(t, b.ir + 1.0, 0.5)
  const go = enter(t, b.ir + 2.0, 0.9)
  const ret = enter(t, b.refl - 0.5, 0.9)
  return (
    <>
      <T x={50} y={9} size={3.2} weight={600} o={base}>
        红外对管
      </T>
      <Svg>
        <path d="M18 20 H82" strokeWidth={0.9} opacity={surface} />
        <g opacity={base}>
          <rect x={42} y={38} width={6} height={7} rx={0.8} />
          <rect x={52} y={38} width={6} height={7} rx={0.8} />
        </g>
        <Draw d="M45 38 L50 20.8" p={go} stroke={VOLT} strokeWidth={0.45} />
        <Draw d="M50 20.8 L55 38" p={ret} stroke={VOLT} strokeWidth={0.45} />
        <circle cx={55} cy={41.5} r={4.2} fill={AMP} stroke="none" opacity={0.25 * ret} />
      </Svg>
      <T x={30} y={41.5} size={2.6} anchor="end" o={base}>
        红外发光管 · 发
      </T>
      <T x={70} y={41.5} size={2.6} anchor="start" o={enter(t, b.ir + 0.4, 0.5)}>
        光电三极管 · 收
      </T>
      <T x={82} y={25} size={2.6} anchor="end" color={MUTED} o={surface}>
        前面的浅色物体
      </T>
      <T x={72} y={30} size={2.8} weight={600} color={VOLT} anchor="start" o={enter(t, b.refl, 0.5)}>
        反射回来
      </T>
    </>
  )
}

// ── 38 kHz ──────────────────────────────────────────────────────────────────

function Remote({ t, b, still }: StageProps) {
  const ph = still ? 0 : t * 22
  const sq = (x: number, y: number, a: number) => {
    let d = ""
    for (let i = 0; i < 40; i++) {
      const xx = x + i * 0.9
      const up = Math.floor((i + ph / 4) / 1) % 2 === 0
      d += `${i ? "L" : "M"}${xx.toFixed(2)} ${(up ? y - a : y + a).toFixed(2)}H${(xx + 0.9).toFixed(2)}`
    }
    return d
  }
  const sun = enter(t, b.rem, 0.5)
  const rc = enter(t, b.blink - 0.3, 0.5)
  const ok = enter(t, b.pick, 0.5)
  const flat = (x: number, y: number) => `M${x} ${y + 0.6 * 0} q4 -1.8 8 0 t8 0 t8 0 t8 0 t8 0`
  return (
    <>
      <T x={12} y={12} size={2.6} anchor="start" color={MUTED} o={sun}>
        阳光、灯光里的红外线：恒定，缓慢变化
      </T>
      <Svg>
        <path d={flat(12, 22)} stroke={MUTED} opacity={sun} />
        <path d={sq(12, 38, 2.2)} stroke={VOLT} strokeLinecap="butt" opacity={rc} />
        <Box x={66} y={14} w={28} h={30} o={enter(t, b.rem + 0.5, 0.5)} />
        <g opacity={enter(t, b.rem + 0.8, 0.5)}>
          <HArrow x0={54} x1={65} y={22} p={1} color={MUTED} />
          <path d="M57 19.5 l4 5 M61 19.5 l-4 5" stroke={HEAT} strokeWidth={0.45} opacity={ok} />
        </g>
        <g opacity={rc}>
          <HArrow x0={54} x1={65} y={38} p={1} color={ok > 0.1 ? GOOD : MUTED} />
        </g>
      </Svg>
      <T x={12} y={30} size={2.6} anchor="start" color={VOLT} weight={600} o={rc}>
        遥控器：每秒闪 38000 次
      </T>
      <T x={80} y={26} size={2.8} weight={600} o={enter(t, b.rem + 0.5, 0.5)}>
        接收头
      </T>
      <T x={80} y={32} size={2.2} color={MUTED} o={enter(t, b.rem + 0.5, 0.5)}>
        只认这个节奏
      </T>
      <T x={80} y={40} size={2.8} weight={600} color={GOOD} o={ok}>
        认得出
      </T>
    </>
  )
}

// ── ultrasonic ranging ──────────────────────────────────────────────────────

function Ultrasonic({ t, b }: Pick<StageProps, "t" | "b">) {
  const SX = 20
  const WX = 82
  const out = clamp01((t - b.send) / 1.4)
  const back = clamp01((t - (b.send + 1.5)) / 1.4)
  const parts = enter(t, b.us, 0.5)
  const pulse = (x: number, color: string, dir: 1 | -1, o: number) => (
    <g stroke={color} opacity={o} strokeWidth={0.45}>
      {[0, 1.8, 3.6].map((d, i) => (
        <path key={i} d={`M${x - dir * d} 24 Q${x - dir * d + dir * 2.2} 30 ${x - dir * d} 36`} opacity={1 - i * 0.28} />
      ))}
    </g>
  )
  const showOut = out > 0 && out < 1
  const showBack = back > 0 && back < 1
  const f1 = enter(t, b.send, 0.5)
  const f2 = enter(t, b.half - 0.3, 0.5)
  return (
    <>
      <T x={50} y={11} size={3.4} o={enter(t, b.us, 0.5)}>
        <span style={{ opacity: f1 }}>
          <span className="text-muted-foreground">距离 = </span>
          <span style={{ color: OUT }}>声速</span>
          <span> × </span>
          <span style={{ color: BACK }}>时间</span>
        </span>
        <span style={{ opacity: f2 }}>
          <span> ÷ </span>
          <M>2</M>
        </span>
      </T>
      <Svg>
        <g opacity={parts}>
          <rect x={SX - 8} y={25} width={8} height={10} rx={0.8} />
          <path d={`M${WX} 20 V40`} strokeWidth={0.9} />
        </g>
        {showOut && pulse(lerp(SX + 2, WX - 3, easeInOut(out) * 0 + out), OUT, 1, 1)}
        {showBack && pulse(lerp(WX - 3, SX + 5, back), BACK, -1, 1)}
        <g opacity={enter(t, b.echo, 0.5)}>
          <path d={`M${SX} 43 H${WX}`} stroke={LINE} strokeWidth={0.25} />
          <path d={`M${SX} 43 H${lerp(SX, WX, out)}`} stroke={OUT} strokeWidth={0.5} />
          <path d={`M${WX} 45.5 H${lerp(WX, SX, back)}`} stroke={BACK} strokeWidth={0.5} />
        </g>
      </Svg>
      <T x={SX - 4} y={39} size={2.4} o={parts}>
        超声波模块
      </T>
      <T x={WX} y={16.5} size={2.4} color={MUTED} o={parts}>
        障碍物
      </T>
      <T x={50} y={50} size={3.4} weight={600} o={enter(t, b.ms, 0.5)} className="tabular">
        <M>
          <span style={{ color: OUT }}>343 m/s</span> × <span style={{ color: BACK }}>5.83 ms</span> ÷ 2 ={" "}
        </M>
        <span style={{ opacity: enter(t, b.m, 0.4), fontWeight: 600 }}>
          <M>1 m</M>
        </span>
      </T>
      <T x={50} y={17} size={2.2} color={MUTED} o={enter(t, b.echo, 0.5) * (1 - enter(t, b.ex, 0.4))}>
        <V>声音来回一趟，要走多久？</V>
      </T>
    </>
  )
}

// ── blind zone and range ────────────────────────────────────────────────────

function Limits({ t, b }: Pick<StageProps, "t" | "b">) {
  const base = enter(t, b.lim, 0.5)
  const blind = enter(t, b.blind, 0.5)
  const far = enter(t, b.far, 0.5)
  return (
    <>
      <T x={50} y={12} size={3.2} weight={600} o={base}>
        它能测多近、多远
      </T>
      <Svg>
        <g opacity={base}>
          <rect x={8} y={25} width={6} height={10} rx={0.8} />
        </g>
        <Draw d="M14 30 H20" p={blind} stroke={HEAT} strokeWidth={1.2} />
        <Draw d="M20 30 H82" p={enter(t, b.lim + 0.4, 1.2)} stroke={GOOD} strokeWidth={1.2} />
        <path d="M82 25 V35" opacity={far} />
        <path d="M82 30 H92" opacity={far * 0.5} strokeDasharray="1 1.2" />
        <path d="M86 27 l4 6 M90 27 l-4 6" stroke={HEAT} strokeWidth={0.45} opacity={far} />
      </Svg>
      <T x={17} y={39} size={2.8} weight={600} color={HEAT} o={blind}>
        盲区
      </T>
      <T x={17} y={44} size={2.4} color={MUTED} o={blind} className="tabular">
        <M>2 cm 以内</M>
      </T>
      <T x={82} y={39} size={2.8} weight={600} o={far} className="tabular">
        <M>4 m</M>
      </T>
      <T x={89} y={44} size={2.4} color={MUTED} o={far}>
        没有回声
      </T>
      <T x={50} y={26} size={2.4} color={GOOD} o={enter(t, b.lim + 1.0, 0.5)}>
        正常测距范围
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "光与距离传感器",
  audio,
  timing,
  poster: 4.5,
  Stage,
}

export default function LightDistanceFilm() {
  return <FilmPlayer film={film} />
}

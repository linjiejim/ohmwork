import { trace } from "@/lab/colors"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, M, Scene, Svg, T, V, clamp01, easeInOut, enter, glide, lerp, span, type FilmDef, type StageProps } from "../../kit"
import { AMP, LINE, MUTED, POWER, VOLT, Readout } from "../../basics/shared"
import { Outro, StepChip } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

const GOOD = trace.good
const SECOND = trace.second

/*
 * 线性稳压器, ~60 s. Scenes, each keyed to the words that introduce it:
 *   title → a wobbling input wave goes through a box and comes out a flat 3.3 V line
 *   → a loop with a variable resistor in series: input goes up, the resistor grows; down, it shrinks; the output never moves
 *   → the excess voltage lands on the resistor and turns to heat (a red readout, shimmer)
 *   → the formula, drawn as one voltage bar split into "used" and "burnt"
 *   → 12 V → 3.3 V at 0.5 A: the same bar in watts, then the 27.5 % efficiency
 *   → dropout: the input ramps down, the output follows once the gap is gone; a low-dropout part holds longer
 *   → big gap, big current: switch to a switching supply → "try it below".
 */

function Stage({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.6) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)
  const lift = (at: number) => (still ? 0 : -easeInOut((t - at) / 0.45) * 2)

  const title = span(t, 0.25, b.idea - 0.15, 0.4, 0.3)
  const loop = span(t, b.idea - 0.3, b.formula - 0.15, 0.3, 0.3)
  const formula = span(t, b.formula - 0.3, b.example - 0.15, 0.3, 0.3)
  const example = span(t, b.example - 0.3, b.drop - 0.6, 0.3, 0.35)
  const drop = span(t, b.drop - 0.3, b.switch - 0.15, 0.3, 0.3)
  const swap = span(t, b.switch - 0.3, b.outro - 0.15, 0.3, 0.3)
  const outro = enter(t, b.outro - 0.3, 0.4)

  return (
    <>
      <Scene o={title} dy={lift(b.idea - 0.45)}>
        <Title t={t} b={b} still={still} rise={rise} />
      </Scene>
      <Scene o={loop}>
        <Loop t={t} b={b} still={still} />
      </Scene>
      <Scene o={formula}>
        <Formula t={t} b={b} still={still} />
      </Scene>
      <Scene o={example}>
        <Example t={t} b={b} still={still} />
      </Scene>
      <Scene o={drop}>
        <Dropout t={t} b={b} still={still} />
      </Scene>
      <Scene o={swap}>
        <Swap t={t} b={b} still={still} rise={rise} />
      </Scene>
      <Scene o={outro}>
        <Outro t={t} b={b} still={still} hint="把实验台里的输入电压往下拖" />
      </Scene>
    </>
  )
}

/** The input is never steady: a few slow sines on top of each other. */
const wobble = (x: number) => 0.6 * Math.sin(x * 0.4) + 0.3 * Math.sin(x * 0.85 + 1) + 0.1 * Math.sin(x * 1.7)

function Title({ t, b, still, rise }: StageProps & { rise: (at: number, d?: number) => number }) {
  const flow = still ? 0 : t * 3
  const inO = enter(t, b.wob - 0.3, 0.6)
  const boxO = enter(t, b.wob + 0.2, 0.6)
  const outO = enter(t, b.flat - 0.3, 0.6)
  const pts: string[] = []
  for (let x = 6; x <= 38; x += 0.5) pts.push(`${pts.length ? "L" : "M"}${x} ${(31 - 9 * wobble(x + flow)).toFixed(2)}`)
  return (
    <>
      <T x={50} y={13} size={7.5} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
        线性稳压器
      </T>
      <Svg>
        <g opacity={inO}>
          <path d="M6 31 H38" stroke={LINE} strokeWidth={0.15} />
          <path d={pts.join("")} stroke={VOLT} strokeWidth={0.5} />
        </g>
        <g opacity={boxO}>
          <rect x={42} y={24} width={16} height={14} rx={1.4} strokeWidth={0.35} />
          <path d="M38.5 31 H42 M58 31 H61.5" />
        </g>
        <g opacity={outO}>
          <path d="M62 31 H94" stroke={VOLT} strokeWidth={0.65} />
        </g>
      </Svg>
      <T x={50} y={31} size={2.8} weight={600} o={boxO}>
        稳压器
      </T>
      <T x={22} y={42} size={2.6} color={MUTED} o={inO}>
        输入：忽高忽低
      </T>
      <T x={78} y={42} size={2.6} color={MUTED} o={outO}>
        输出：稳稳的
      </T>
      <T x={78} y={25} size={3.6} weight={600} color={VOLT} o={outO} className="tabular">
        <M>3.3 V</M>
      </T>
    </>
  )
}

// ── the loop with a variable resistor ───────────────────────────────────────

const LEFT = 14
const RIGHT = 48
const TOP = 14
const BOTTOM = 46
const RX0 = 24 // where the variable resistor may stretch from / to
const RX1 = 40
const LY0 = 24 // the load
const LY1 = 36
const PERIM = 2 * (RIGHT - LEFT) + 2 * (BOTTOM - TOP)

function onLoop(d: number): [number, number] {
  const w = RIGHT - LEFT
  const h = BOTTOM - TOP
  const s = ((d % PERIM) + PERIM) % PERIM
  if (s < w) return [LEFT + s, TOP]
  if (s < w + h) return [RIGHT, TOP + (s - w)]
  if (s < 2 * w + h) return [RIGHT - (s - w - h), BOTTOM]
  return [LEFT, BOTTOM - (s - 2 * w - h)]
}

/** A horizontal zigzag with a fixed tooth pitch centred on cx: a longer resistor grows more teeth. */
function hzig(cx: number, len: number, y: number, amp = 1.6, pitch = 1.1) {
  const x0 = cx - len / 2
  const n = Math.max(1, Math.floor(len / pitch))
  const step = len / n
  let d = `M${RX0 - 2} ${y} H${x0}`
  for (let i = 0; i < n; i++) d += ` L${x0 + step * (i + 0.5)} ${y + (i % 2 ? -amp : amp)}`
  d += ` L${x0 + len} ${y} H${RX1 + 2}`
  return d
}

function Loop({ t, b, still }: StageProps) {
  const vin = t < b.down - 0.3 ? glide(t, b.up - 0.3, 9, 12, 0.9) : glide(t, b.down - 0.3, 12, 6, 1.0)
  const extra = vin - 3.3
  const len = 3 + extra * 1.35
  const wires = enter(t, b.idea, 0.8)
  const res = enter(t, b.reg - 0.2, 0.5)
  const heat = enter(t, b.extra - 0.1, 0.6)
  const phase = still ? 0 : t * 9
  const resColor = heat > 0.01 ? POWER : undefined
  const shimmer = (i: number) => (still ? 0 : Math.sin(t * 4 + i * 2.1))
  return (
    <>
      <Svg>
        <Draw d={`M${LEFT} 27 V${TOP} H${RX0 - 2}`} p={wires} />
        <Draw d={`M${RX1 + 2} ${TOP} H${RIGHT} V${LY0 - 2.5}`} p={wires} />
        <Draw d={`M${RIGHT} ${LY1 + 2.5} V${BOTTOM} H${LEFT} V29.4`} p={wires} />
        <g opacity={res} stroke={resColor} strokeWidth={heat > 0.01 ? 0.5 : 0.32}>
          <path d={hzig((RX0 + RX1) / 2, len, TOP)} />
        </g>
        {/* the arrow through it: "variable" */}
        <g opacity={res} strokeWidth={0.3}>
          <path d={`M${(RX0 + RX1) / 2 - 3} ${TOP - 4.5} L${(RX0 + RX1) / 2 + 3} ${TOP + 4.5}`} />
        </g>
        <g opacity={enter(t, b.ser - 0.2, 0.5)}>
          <path d={`M${RIGHT} ${LY0 - 2.5} V${LY0} L${RIGHT + 1.6} ${LY0 + 1} L${RIGHT - 1.6} ${LY0 + 3} L${RIGHT + 1.6} ${LY0 + 5} L${RIGHT - 1.6} ${LY0 + 7} L${RIGHT + 1.6} ${LY0 + 9} L${RIGHT} ${LY0 + 10} V${LY1 + 2.5}`} />
        </g>
        <g opacity={wires}>
          <path d={`M${LEFT - 3.4} 27 H${LEFT + 3.4}`} />
          <path d={`M${LEFT - 1.6} 29.4 H${LEFT + 1.6}`} strokeWidth={0.75} />
        </g>
        {wires > 0.5 &&
          Array.from({ length: Math.floor(PERIM / 4) }, (_, i) => {
            const [x, y] = onLoop(i * 4 + phase)
            const hidden = (y === TOP && x > RX0 - 2.2 && x < RX1 + 2.2) || (x === RIGHT && y > LY0 - 2.5 && y < LY1 + 2.5) || (x === LEFT && y > 26 && y < 30.5)
            return hidden ? null : <circle key={i} cx={x} cy={y} r={0.55} fill={AMP} stroke="none" opacity={wires} />
          })}
        {/* heat shimmer above the resistor */}
        {heat > 0.05 &&
          [0, 1, 2, 3].map((i) => {
            const x = (RX0 + RX1) / 2 - 4.5 + i * 3
            const y0 = TOP + 2.2
            return <path key={i} d={`M${x} ${y0} q1 1.2 0 2.4 t0 2.4`} stroke={POWER} strokeWidth={0.35} opacity={heat * (0.5 + 0.5 * shimmer(i))} transform={`translate(${shimmer(i) * 0.4} 0)`} />
          })}
        <g stroke="var(--border)" strokeWidth={0.12}>
          <path d="M62 23 H90" opacity={wires} />
          <path d="M62 33 H90" opacity={enter(t, b.idea + 0.4)} />
          <path d="M62 43 H90" opacity={heat} />
        </g>
      </Svg>
      <T x={LEFT - 5} y={28} size={3.2} anchor="end" font="var" color={VOLT} o={wires}>
        V
        <sub style={{ fontSize: "0.6em" }}>in</sub>
      </T>
      <T x={(RX0 + RX1) / 2} y={TOP - 7.6} size={2.4} color={heat > 0.3 ? POWER : MUTED} o={res} className="font-medium">
        可变电阻
      </T>
      <T x={RIGHT + 4.5} y={30} size={2.4} anchor="start" color={MUTED} o={enter(t, b.ser - 0.2, 0.5)}>
        负载
      </T>
      <T x={(RX0 + RX1) / 2} y={TOP + 6.4} size={2.5} weight={600} color={VOLT} o={span(t, b.up - 0.1, b.down - 0.5, 0.25, 0.25)}>
        调大 ↑
      </T>
      <T x={(RX0 + RX1) / 2} y={TOP + 6.4} size={2.5} weight={600} color={VOLT} o={span(t, b.down - 0.1, b.extra - 0.6, 0.25, 0.25)}>
        调小 ↓
      </T>
      <Readout y={18} label="输入电压" letter="" color={VOLT} o={wires} value={`${vin.toFixed(1)} V`} />
      <Readout y={28} label="输出电压" letter="" color={VOLT} o={enter(t, b.idea + 0.4)} value="3.3 V" />
      <Readout y={38} label="压在电阻上" letter="" color={POWER} o={heat} value={`${extra.toFixed(1)} V`} />
      <T x={62} y={47} size={2.5} anchor="start" color={POWER} o={enter(t, b.heatw - 0.1, 0.5)}>
        多出来的电压，全变成了热
      </T>
    </>
  )
}

// ── the formula ─────────────────────────────────────────────────────────────

function Formula({ t, b }: StageProps) {
  const x0 = 14
  const x1 = 86
  const split = lerp(x0, x1, 3.3 / 12)
  const bar = enter(t, b.formula + 0.1, 0.7)
  const gapO = enter(t, b.diff - 0.2, 0.5)
  return (
    <>
      <StepChip o={enter(t, b.formula - 0.1)}>发热怎么算</StepChip>
      <T x={50} y={22} size={6.4}>
        <span className="inline-flex items-center gap-[0.3em]">
          <span style={{ opacity: enter(t, b.formula + 0.2) }}>
            <V c={POWER}>P</V>
            <M> = </M>
          </span>
          <span style={{ opacity: enter(t, b.diff - 0.1) }}>
            <M>(</M>
            <V c={VOLT}>V</V>
            <sub style={{ fontSize: "0.55em" }}>
              <M>in</M>
            </sub>
            <M> − </M>
            <V c={VOLT}>V</V>
            <sub style={{ fontSize: "0.55em" }}>
              <M>out</M>
            </sub>
            <M>)</M>
          </span>
          <span style={{ opacity: enter(t, b.cur - 0.1) }}>
            <M> × </M>
            <V c={AMP}>I</V>
          </span>
        </span>
      </T>
      <Svg>
        <g opacity={bar}>
          <rect x={x0} y={34} width={split - x0} height={6} fill={VOLT} stroke="none" opacity={0.3} />
          <rect x={split} y={34} width={(x1 - split) * bar} height={6} fill={POWER} stroke="none" opacity={0.32 * gapO} />
          <rect x={x0} y={34} width={x1 - x0} height={6} strokeWidth={0.25} />
          <path d={`M${split} 33 V41`} strokeWidth={0.25} />
        </g>
      </Svg>
      <T x={(x0 + split) / 2} y={44.5} size={2.4} color={VOLT} o={bar}>
        输出 3.3 V
      </T>
      <T x={(split + x1) / 2} y={44.5} size={2.4} color={POWER} o={gapO}>
        电压差：压在稳压器上
      </T>
      <T x={50} y={30} size={2.4} color={MUTED} o={bar}>
        输入电压
      </T>
    </>
  )
}

// ── 12 V → 3.3 V at 0.5 A ───────────────────────────────────────────────────

function Example({ t, b, still }: StageProps) {
  const x0 = 12
  const x1 = 88
  const split = lerp(x0, x1, 1.65 / 6)
  const bar = enter(t, b.example + 0.3, 0.6)
  const heatO = enter(t, b.e435 - 0.2, 0.5)
  const calcO = 1 - enter(t, b.eff - 0.1, 0.4)
  const eff = enter(t, b.eff, 0.6)
  const shimmer = (i: number) => (still ? 0 : Math.sin(t * 4 + i * 1.7))
  return (
    <>
      <T x={50} y={9} size={2.6} color={MUTED} o={enter(t, b.example) * calcO}>
        <M className="tabular">12 V → 3.3 V · 0.5 A</M>
      </T>
      <T x={50} y={19} size={5.2} o={calcO}>
        <span className="inline-flex items-center gap-[0.3em]">
          <span style={{ opacity: enter(t, b.e12 - 0.1) }}>
            <M>(</M>
            <M c={VOLT}>12 − 3.3</M>
            <M>)</M>
          </span>
          <span style={{ opacity: enter(t, b.e05 - 0.1) }}>
            <M>×</M>
            <M c={AMP}> 0.5</M>
          </span>
          <span style={{ opacity: heatO }}>
            <M>=</M>
            <M c={POWER} className="font-semibold"> 4.35 W</M>
          </span>
        </span>
      </T>
      <T x={50} y={13} size={9} weight={600} color={POWER} o={eff} className="tabular">
        <M>效率 27.5%</M>
      </T>
      <Svg>
        <g opacity={bar}>
          <rect x={x0} y={30} width={split - x0} height={7} fill={GOOD} stroke="none" opacity={0.4} />
          <rect x={split} y={30} width={(x1 - split) * heatO} height={7} fill={POWER} stroke="none" opacity={0.35} />
          <rect x={x0} y={30} width={x1 - x0} height={7} strokeWidth={0.25} />
          <path d={`M${split} 29 V38`} strokeWidth={0.25} />
        </g>
        {heatO > 0.05 &&
          [0, 1, 2, 3, 4].map((i) => {
            const x = split + 7 + i * 11
            return <path key={i} d={`M${x} 27.5 q1 -1.2 0 -2.4 t0 -2.4`} stroke={POWER} strokeWidth={0.4} opacity={heatO * (0.5 + 0.5 * shimmer(i)) * (eff > 0.5 ? 0.6 : 1)} transform={`translate(${shimmer(i) * 0.4} 0)`} />
          })}
      </Svg>
      <T x={(x0 + split) / 2} y={42} size={2.5} color={GOOD} o={bar} className="tabular">
        <span className="inline-flex flex-col items-center gap-[0.4em]">
          <span>有用的</span>
          <M>1.65 W</M>
        </span>
      </T>
      <T x={(split + x1) / 2} y={42} size={2.5} color={POWER} o={heatO} className="tabular">
        <span className="inline-flex flex-col items-center gap-[0.4em]">
          <span>变成热</span>
          <M>4.35 W</M>
        </span>
      </T>
      <T x={50} y={49.5} size={2.4} color={MUTED} o={enter(t, b.rest - 0.2, 0.5)}>
        <M className="tabular">1.65 ÷ 6 = 27.5%</M>
      </T>
    </>
  )
}

// ── dropout ────────────────────────────────────────────────────────────────

function Dropout({ t, b }: StageProps) {
  const OX = 14
  const OY = 46
  const XE = 78
  const VS = 5.8 // stage units per volt
  const y = (v: number) => OY - v * VS
  const inV = (p: number) => lerp(5.6, 2.4, p)
  const P = clamp01((t - b.dropw) / (b.lose - b.dropw + 0.8))
  const axes = enter(t, b.drop - 0.1, 0.6)
  const N = 60
  const path = (f: (p: number) => number, upto: number) => {
    const pts: string[] = []
    for (let i = 0; i <= N; i++) {
      const p = i / N
      if (p > upto) break
      pts.push(`${pts.length ? "L" : "M"}${(OX + p * (XE - OX)).toFixed(2)} ${y(f(p)).toFixed(2)}`)
    }
    return pts.join("")
  }
  const reg1 = (p: number) => Math.min(3.3, inV(p) - 1.1)
  const reg2 = (p: number) => Math.min(3.3, inV(p) - 0.2)
  const P2 = easeInOut((t - b.ldow) / 1.4)
  const pStuck = (5.6 - 4.4) / (5.6 - 2.4) // where reg1 stops holding
  const gapA = enter(t, b.gap - 0.1, 0.5)
  const stuck = enter(t, b.lose - 0.2, 0.5)
  const gx = OX + pStuck * (XE - OX) // the gap is exactly the dropout where the output starts to sag
  return (
    <>
      <Svg>
        <g opacity={axes}>
          <path d={`M${OX} ${OY} H${XE + 2} M${OX} ${OY} V10`} />
          <path d={`M${OX} ${y(3.3)} H${XE}`} stroke={LINE} strokeWidth={0.15} strokeDasharray="0.6 0.6" />
        </g>
        <path d={path(inV, P)} stroke={VOLT} strokeWidth={0.55} />
        <path d={path(reg1, P)} stroke={SECOND} strokeWidth={0.55} />
        <path d={path(reg2, P2)} stroke={GOOD} strokeWidth={0.55} opacity={P2 > 0 ? 1 : 0} />
        {/* the dropout gap */}
        <g opacity={gapA * (1 - enter(t, b.lose + 0.8, 0.4))} stroke={POWER} strokeWidth={0.4}>
          <path d={`M${gx} ${y(4.4)} V${y(3.3)} M${gx - 0.8} ${y(4.4)} H${gx + 0.8} M${gx - 0.8} ${y(3.3)} H${gx + 0.8}`} />
        </g>
        <g opacity={stuck}>
          <circle cx={OX + pStuck * (XE - OX)} cy={y(3.3)} r={1.1} stroke={POWER} />
        </g>
      </Svg>
      <T x={OX - 1.5} y={y(3.3)} size={2.4} anchor="end" color={MUTED} o={axes} className="tabular">
        <M>3.3 V</M>
      </T>
      <T x={OX} y={7.5} size={2.4} color={MUTED} o={axes}>
        电压
      </T>
      <T x={XE + 2} y={OY + 3} size={2.4} anchor="end" color={MUTED} o={axes}>
        输入慢慢下降 →
      </T>
      <T x={gx - 1.6} y={(y(4.4) + y(3.3)) / 2} size={2.5} anchor="end" weight={600} color={POWER} o={gapA * (1 - enter(t, b.lose + 0.8, 0.4))}>
        压差
      </T>
      <T x={OX + pStuck * (XE - OX) - 2} y={y(3.3) + 3.6} size={2.4} anchor="end" color={POWER} o={stuck} className="font-medium">
        稳不住了
      </T>
      <T x={XE + 1} y={y(inV(1)) - 2.4} size={2.4} anchor="start" weight={600} color={VOLT} o={enter(t, b.dropw + 0.8)}>
        输入
      </T>
      <T x={XE + 1} y={y(reg1(1)) + 0.5} size={2.4} anchor="start" weight={600} color={SECOND} o={enter(t, b.dropw + 0.8)}>
        普通 · 压差 1.1 V
      </T>
      <T x={XE + 1} y={y(inV(1)) + 2.2} size={2.4} anchor="start" weight={600} color={GOOD} o={P2}>
        LDO · 压差 0.2 V
      </T>
    </>
  )
}

// ── when to switch ──────────────────────────────────────────────────────────

function Swap({ t, b, still, rise }: StageProps & { rise: (at: number, d?: number) => number }) {
  const grow = enter(t, b.big - 0.1, 0.9)
  const sw = enter(t, b.sw - 0.2, 0.6)
  const shimmer = (i: number) => (still ? 0 : Math.sin(t * 4 + i * 1.9))
  return (
    <>
      <T x={26} y={10} size={3} weight={600} o={enter(t, b.switch - 0.1)}>
        压差大，电流大
      </T>
      <Svg>
        <g opacity={enter(t, b.switch - 0.1)}>
          <rect x={18} y={20} width={16} height={24} rx={1} strokeWidth={0.3} />
          <rect x={18.2} y={20 + 24 * (1 - grow)} width={15.6} height={Math.max(0, 24 * grow - 0.2)} fill={POWER} stroke="none" opacity={0.35} />
        </g>
        {grow > 0.3 &&
          [0, 1, 2].map((i) => (
            <path key={i} d={`M${21 + i * 5} 18.5 q1 -1.2 0 -2.4`} stroke={POWER} strokeWidth={0.4} opacity={grow * (0.5 + 0.5 * shimmer(i))} transform="translate(0 0)" />
          ))}
        <g opacity={sw} strokeWidth={0.5}>
          <path d="M39 30 H53 M50.6 28.4 L53 30 L50.6 31.6" />
        </g>
      </Svg>
      <T x={26} y={48} size={2.6} color={POWER} o={grow}>
        发热太大
      </T>
      <T x={76} y={30} size={3.4} color={MUTED} o={enter(t, b.switch, 0.5) * (1 - sw)}>
        怎么办？
      </T>
      <T x={76} y={22} size={4.4} weight={600} color={GOOD} o={sw} dy={rise(b.sw - 0.2, 1)}>
        开关电源
      </T>
      <T x={76} y={31} size={2.6} color={MUTED} o={sw}>
        用高速开关降压，发热少得多
      </T>
      <T x={76} y={38} size={2.6} color={MUTED} o={enter(t, b.sw + 0.5)}>
        下一课讲它
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "线性稳压器",
  audio,
  timing,
  poster: 6.2,
  Stage,
}

export default function LinearRegulatorsFilm() {
  return <FilmPlayer film={film} />
}

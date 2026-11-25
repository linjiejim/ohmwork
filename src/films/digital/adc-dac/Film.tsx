import { trace } from "@/lab/colors"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, M, Scene, Svg, T, V, enter, glide, lerp, span, type FilmDef, type StageProps } from "../../kit"
import { DownArrow, FG, HI, LINE, MUTED, makeLift, makeRise } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

/*
 * ADC 与 DAC, ~60 s. Scenes, each keyed to the words that introduce it:
 *   title (a smooth wave, then its digits) → wave → ADC → number → DAC → wave
 *   → sample (a dot every fixed interval) and quantise (dots snap to the nearest step, a staircase appears)
 *   → finer steps (2 → 3 → 12 bits) → one step's height: 3.3 V ÷ 4096 ≈ 0.8 mV
 *   → 900 Hz sampled at 1000 Hz looks like 100 Hz → fs > 2 f_max, a low-pass filter in front → "try it below".
 */

const SEC = trace.second
const PX0 = 12
const PX1 = 88
const Y0 = 44 // bottom level of the staircase
const Y1 = 18 // top level

/** A smooth signal in [-1, 1] over u in [0, 1]. */
const sig = (u: number) => 0.72 * Math.sin(2 * Math.PI * 1.3 * u + 0.6) + 0.28 * Math.sin(2 * Math.PI * 3.1 * u)
const sy = (u: number) => 31 - 11 * sig(u)
const sx = (u: number) => PX0 + (PX1 - PX0) * u

function curve(f: (u: number) => number, n = 160) {
  let d = ""
  for (let i = 0; i <= n; i++) d += `${i ? "L" : "M"}${sx(i / n).toFixed(2)} ${f(i / n).toFixed(2)}`
  return d
}

/** y of the level nearest to signal height y, with `levels` steps between Y0 and Y1. */
const snapY = (y: number, levels: number) => {
  const step = (Y0 - Y1) / (levels - 1)
  const j = Math.max(0, Math.min(levels - 1, Math.round((Y0 - y) / step)))
  return Y0 - j * step
}

function stairs(levels: number, m: number) {
  let d = ""
  for (let i = 0; i < m; i++) {
    const u0 = i / m
    const u1 = (i + 1) / m
    const y = snapY(sy((u0 + u1) / 2), levels)
    d += i ? `V${y}H${sx(u1)}` : `M${sx(u0)} ${y}H${sx(u1)}`
  }
  return d
}

function Stage({ t, b, still }: StageProps) {
  const rise = makeRise(t, still)
  const lift = makeLift(t, still)
  const sc = (a: number, z: number) => span(t, a - 0.3, z - 0.15, 0.3, 0.3)

  return (
    <>
      <Scene o={span(t, 0.25, b.pair - 0.15, 0.4, 0.3)} dy={lift(b.pair - 0.45)}>
        <T x={50} y={16} size={7} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
          ADC 与 DAC
        </T>
        <Svg>
          <Draw d={curve((u) => 33 + 5.5 * Math.sin(2 * Math.PI * 1.5 * u + 0.4) + 2 * Math.sin(2 * Math.PI * 4 * u), 120).replace(/^M/, "M")} p={enter(t, b.wave - 0.4, 1.8)} stroke={HI} strokeWidth={0.5} />
        </Svg>
        <T x={50} y={44} size={3.4} weight={600} color={MUTED} o={enter(t, b.num, 0.5)} dy={rise(b.num, 1)} className="tabular">
          <M>1 0 1 1 0 1 0 0 1 1</M>
        </T>
      </Scene>

      <Scene o={sc(b.pair, b.sampleL)}>
        <Pair t={t} b={b} />
      </Scene>
      <Scene o={sc(b.sampleL, b.res)}>
        <SampleQuant t={t} b={b} />
      </Scene>
      <Scene o={sc(b.res, b.lsb)}>
        <Resolution t={t} b={b} />
      </Scene>
      <Scene o={span(t, b.lsb - 0.3, b.alias - 0.4, 0.3, 0.3)}>
        <Lsb t={t} b={b} />
      </Scene>
      <Scene o={sc(b.alias, b.fix)}>
        <Alias t={t} b={b} />
      </Scene>
      <Scene o={span(t, b.fix - 0.3, b.outro - 0.4, 0.3, 0.25)}>
        <Fix t={t} b={b} />
      </Scene>

      <Scene o={enter(t, b.outro - 0.3, 0.4)}>
        <T x={50} y={22} size={6} weight={600} dy={rise(b.outro)}>
          动手试试
        </T>
        <T x={50} y={31} size={2.8} color={MUTED} o={enter(t, b.drag, 0.5)} dy={rise(b.drag, 1)}>
          拖动位数和采样率
        </T>
        <Svg>
          <DownArrow t={t} at={b.drag + 0.3} still={still} y={37} />
        </Svg>
      </Scene>
    </>
  )
}

// ── ADC and DAC ─────────────────────────────────────────────────────────────

function miniWave(x0: number, w: number, y: number, ph: number) {
  let d = ""
  for (let i = 0; i <= 50; i++) {
    const u = i / 50
    d += `${i ? "L" : "M"}${(x0 + w * u).toFixed(2)} ${(y - 4 * Math.sin(2 * Math.PI * 1.5 * u + ph) - 1.4 * Math.sin(2 * Math.PI * 4 * u)).toFixed(2)}`
  }
  return d
}

function Pair({ t, b }: Pick<StageProps, "t" | "b">) {
  const a = enter(t, b.pair, 0.5)
  const adc = enter(t, b.adc - 0.1, 0.5)
  const dac = enter(t, b.dac - 0.1, 0.5)
  // wave → ADC → number sits in the middle on its own, then slides left to make room for → DAC → wave
  const dx = glide(t, b.dac - 0.75, 20, 0, 0.65)
  return (
    <>
      <Svg>
        <g transform={`translate(${dx} 0)`}>
          <Draw d={miniWave(6, 14, 26, 0.4)} p={a} stroke={HI} strokeWidth={0.45} />
          <g opacity={adc} strokeWidth={0.4}>
            <path d="M21.5 26 H25 M23.6 24.6 L25 26 L23.6 27.4" />
            <rect x={25} y={19} width={15} height={14} rx={1.6} />
            <path d="M40 26 H44.2 M42.8 24.6 L44.2 26 L42.8 27.4" />
          </g>
          <g opacity={dac} strokeWidth={0.4}>
            <path d="M55.8 26 H60 M58.6 24.6 L60 26 L58.6 27.4" />
            <rect x={60} y={19} width={15} height={14} rx={1.6} />
            <path d="M75 26 H79 M77.6 24.6 L79 26 L77.6 27.4" />
          </g>
          <Draw d={miniWave(80, 14, 26, 0.4)} p={dac} stroke={HI} strokeWidth={0.45} />
        </g>
      </Svg>
      <T x={13 + dx} y={15} size={2.6} color={MUTED} o={a}>
        电压
      </T>
      <T x={32.5 + dx} y={26} size={3.6} weight={600} o={adc}>
        ADC
      </T>
      <T x={32.5 + dx} y={38} size={2.4} color={MUTED} o={adc}>
        模数转换器
      </T>
      <T x={50 + dx} y={15} size={2.6} color={MUTED} o={adc}>
        数
      </T>
      <T x={50 + dx} y={26} size={3.6} weight={600} o={adc} className="tabular">
        <M>1011</M>
      </T>
      <T x={67.5 + dx} y={26} size={3.6} weight={600} o={dac}>
        DAC
      </T>
      <T x={67.5 + dx} y={38} size={2.4} color={MUTED} o={dac}>
        数模转换器
      </T>
      <T x={87 + dx} y={15} size={2.6} color={MUTED} o={dac}>
        电压
      </T>
    </>
  )
}

// ── sampling and quantising ─────────────────────────────────────────────────

const NS = 12
const su = (i: number) => (i + 0.5) / NS

function SampleQuant({ t, b }: Pick<StageProps, "t" | "b">) {
  const base = 46
  const wave = enter(t, b.sampleL, 0.8)
  const snap = enter(t, b.snap - 0.1, 0.6)
  const grid = enter(t, b.quant, 0.5)
  const L = 8
  const stairP = enter(t, b.snap + 0.5, 1.3)
  return (
    <>
      <T x={12} y={8.5} size={3} weight={600} anchor="start" o={enter(t, b.sampleL, 0.4) * (1 - enter(t, b.quant - 0.1, 0.3))}>
        采样：每隔一段时间看一眼
      </T>
      <T x={12} y={8.5} size={3} weight={600} anchor="start" o={enter(t, b.quant - 0.1, 0.4)}>
        量化：归到最近的台阶
      </T>
      <Svg>
        <g stroke={LINE} strokeDasharray="1 1" strokeWidth={0.2} opacity={grid}>
          {Array.from({ length: L }, (_, j) => (
            <path key={j} d={`M${PX0 - 1} ${Y0 - (j * (Y0 - Y1)) / (L - 1)} H${PX1 + 1}`} />
          ))}
        </g>
        <path d={`M${PX0 - 1} ${base} H${PX1 + 1}`} stroke={LINE} strokeWidth={0.3} opacity={wave} />
        <Draw d={curve(sy)} p={wave} stroke={HI} strokeWidth={0.5} opacity={1 - 0.65 * snap} />
        <Draw d={stairs(L, NS)} p={stairP} stroke={FG} strokeWidth={0.4} />
        {Array.from({ length: NS }, (_, i) => {
          const at = lerp(b.sample, b.every + 1.6, i / (NS - 1))
          const o = enter(t, at, 0.3)
          const yq = snapY(sy(su(i)), L)
          const y = lerp(sy(su(i)), yq, snap)
          return (
            <g key={i} opacity={o}>
              <path d={`M${sx(su(i))} ${base} V${y}`} stroke={MUTED} strokeWidth={0.2} />
              <circle cx={sx(su(i))} cy={y} r={0.9} fill={HI} stroke="none" />
            </g>
          )
        })}
      </Svg>
    </>
  )
}

// ── resolution: finer steps ─────────────────────────────────────────────────

function Resolution({ t, b }: Pick<StageProps, "t" | "b">) {
  const M2 = 30
  const s1 = enter(t, b.res, 0.5) * (1 - enter(t, b.b3 - 0.4, 0.25))
  const s2 = enter(t, b.b3 - 0.15, 0.3) * (1 - enter(t, b.b12 - 0.4, 0.25))
  const s3 = enter(t, b.b12 - 0.15, 0.3)
  const states = [
    { o: s1, levels: 4, label: "2 位 · 4 级", color: FG },
    { o: s2, levels: 8, label: "3 位 · 8 级", color: FG },
    { o: s3, levels: 400, label: "12 位 · 4096 级", color: HI },
  ]
  return (
    <>
      <Svg>
        <path d={curve(sy)} stroke={HI} strokeWidth={0.3} opacity={0.35 * enter(t, b.res, 0.5)} />
        {states.map((s, i) => (
          <path key={i} d={stairs(s.levels, M2 * (i === 2 ? 3 : 1))} stroke={s.color} strokeWidth={i === 2 ? 0.5 : 0.4} opacity={s.o} />
        ))}
      </Svg>
      {states.map((s, i) => (
        <T key={i} x={50} y={9} size={4.6} weight={600} color={s.color} o={s.o} className="tabular">
          {s.label}
        </T>
      ))}
      <T x={50} y={50} size={2.6} color={MUTED} o={enter(t, b.fine, 0.5)}>
        台阶越细，越接近原来的波形
      </T>
    </>
  )
}

// ── one step: 3.3 V ÷ 4096 ──────────────────────────────────────────────────

function Lsb({ t, b }: Pick<StageProps, "t" | "b">) {
  const o = enter(t, b.lsb, 0.5)
  const pts = [0, 1, 2, 3, 4]
  const d = "M8 44 " + pts.map((i) => `H${8 + 8.5 * (i + 1)}${i < 4 ? `V${44 - 6 * (i + 1)}` : ""}`).join("")
  const step = enter(t, b.step - 0.1, 0.5)
  const calc = enter(t, b.calc, 0.5)
  const mv = enter(t, b.mv, 0.5)
  return (
    <>
      <Svg>
        <Draw d={d} p={enter(t, b.lsb, 1.2)} stroke={FG} strokeWidth={0.45} />
        <g opacity={step} strokeWidth={0.28}>
          <path d="M42.5 32 H48.5 M42.5 26 H48.5" stroke={MUTED} strokeDasharray="0.8 0.8" strokeWidth={0.2} />
          <path d="M47 26 V32 M45.8 27.4 L47 26 L48.2 27.4 M45.8 30.6 L47 32 L48.2 30.6" stroke={HI} />
        </g>
      </Svg>
      <T x={49.5} y={29} size={2.8} anchor="start" weight={600} color={HI} o={step}>
        一级
      </T>
      <T x={76} y={18} size={4.6} o={calc} className="tabular">
        <M>3.3 V ÷ 4096</M>
      </T>
      <T x={76} y={30} size={7} weight={600} color={HI} o={mv} className="tabular">
        <M>≈ 0.8 mV</M>
      </T>
      <T x={76} y={40} size={2.6} color={MUTED} o={mv}>
        能分辨的最小电压变化
      </T>
      <T x={26} y={50} size={2.4} color={MUTED} o={o}>
        台阶越细，每一级越矮
      </T>
    </>
  )
}

// ── aliasing ────────────────────────────────────────────────────────────────

const fast = (u: number) => Math.sin(2 * Math.PI * 9 * u)
const slow = (u: number) => -Math.sin(2 * Math.PI * u)
const ay = (v: number) => 30 - 10 * v

function Alias({ t, b }: Pick<StageProps, "t" | "b">) {
  const N = 10
  const ticks = Array.from({ length: N + 1 }, (_, i) => i / N)
  const tickAt = (i: number) => lerp(b.alias, b.sig - 0.5, i / N)
  const fastP = enter(t, b.alias - 0.05, 1.8)
  const slowP = enter(t, b.fake - 0.2, 1.4)
  const dotsO = enter(t, b.fs - 0.2, 0.5)
  return (
    <>
      <Svg>
        <path d={`M${PX0} 46 H${PX1}`} stroke={LINE} strokeWidth={0.3} opacity={enter(t, b.alias, 0.5)} />
        {ticks.map((u, i) => (
          <path key={i} d={`M${sx(u)} 46 v1.6`} stroke={MUTED} strokeWidth={0.3} opacity={enter(t, tickAt(i), 0.3) * (1 - 0.5 * dotsO)} />
        ))}
        <Draw d={curve((u) => ay(fast(u)), 400)} p={fastP} stroke={HI} strokeWidth={0.4} opacity={0.85} />
        <Draw d={curve((u) => ay(slow(u)), 120)} p={slowP} stroke={SEC} strokeWidth={0.55} strokeDasharray="1.6 1" />
        {ticks.map((u, i) => (
          <g key={i} opacity={enter(t, b.fs + i * 0.12, 0.3)}>
            <path d={`M${sx(u)} 46 V${ay(fast(u))}`} stroke={MUTED} strokeWidth={0.18} />
            <circle cx={sx(u)} cy={ay(fast(u))} r={0.9} fill={FG} stroke="none" />
          </g>
        ))}
      </Svg>
      <T x={12} y={9} size={3} anchor="start" weight={600} color={HI} o={enter(t, b.sig, 0.5)} className="tabular">
        真实：900 Hz
      </T>
      <T x={88} y={9} size={3} anchor="end" weight={600} color={SEC} o={enter(t, b.fake, 0.5)} className="tabular">
        读出来：100 Hz
      </T>
      <T x={50} y={51.5} size={2.6} color={MUTED} o={enter(t, b.sig - 0.5, 0.5) * (1 - dotsO)}>
        采样点太稀了
      </T>
      <T x={50} y={51.5} size={2.6} color={MUTED} o={dotsO}>
        每 1 ms 看一次（1000 Hz）
      </T>
    </>
  )
}

// ── the rule and the filter ─────────────────────────────────────────────────

function Fix({ t, b }: Pick<StageProps, "t" | "b">) {
  const f = enter(t, b.fix, 0.5)
  const two = enter(t, b.two, 0.4)
  const ch = enter(t, b.filter - 0.2, 0.5)
  const ends = enter(t, b.fix + 1.2, 0.5)
  const sub = (s: string) => <span style={{ fontFamily: "KaTeX_Main, serif", fontSize: "0.6em", position: "relative", top: "0.3em", marginLeft: "0.05em", fontStyle: "normal" }}>{s}</span>
  return (
    <>
      <T x={50} y={17} size={6.4} o={f} className="tabular">
        <span className="inline-flex items-baseline gap-[0.3em]">
          <span>
            <V>f</V>
            {sub("s")}
          </span>
          <M>&gt;</M>
          <span style={{ opacity: 0.35 + 0.65 * two, color: two > 0.5 ? HI : undefined }}>
            <M>2</M>
          </span>
          <span>
            <V>f</V>
            {sub("max")}
          </span>
        </span>
      </T>
      <T x={50} y={26} size={2.8} color={MUTED} o={f}>
        采样率 &gt; 信号最高频率的两倍
      </T>
      <Svg>
        <g opacity={ends} strokeWidth={0.4}>
          <rect x={10} y={36} width={22} height={9} rx={1.4} />
          <rect x={68} y={36} width={22} height={9} rx={1.4} />
        </g>
        <g opacity={ends * (1 - ch)} strokeWidth={0.4}>
          <path d="M32 40.5 H68 M66.6 39.1 L68 40.5 L66.6 41.9" />
        </g>
        <g opacity={ch} strokeWidth={0.4}>
          <rect x={39} y={36} width={22} height={9} rx={1.4} stroke={HI} />
          <path d="M32 40.5 H39 M37.6 39.1 L39 40.5 L37.6 41.9 M61 40.5 H68 M66.6 39.1 L68 40.5 L66.6 41.9" />
        </g>
      </Svg>
      <T x={21} y={40.5} size={2.8} o={ends}>
        模拟信号
      </T>
      <T x={50} y={40.5} size={2.8} weight={600} color={HI} o={ch}>
        低通滤波
      </T>
      <T x={79} y={40.5} size={2.8} weight={600} o={ends}>
        ADC
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "ADC 与 DAC",
  audio,
  timing,
  poster: 3.6,
  Stage,
}

export default function AdcDacFilm() {
  return <FilmPlayer film={film} />
}

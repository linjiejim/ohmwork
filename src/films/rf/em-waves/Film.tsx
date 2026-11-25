import * as React from "react"
import { trace } from "@/lab/colors"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, M, Scene, Svg, T, V, easeInOut, easeOut, enter, glide, lerp, span, type FilmDef, type StageProps } from "../../kit"
import { MUTED, Outro, riseOf, sinePath } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

const VOLT = trace.voltage
const AMP = trace.current
const FG = "var(--foreground)"

/*
 * 电磁波与无线电频谱, ~60 s. Scenes, each keyed to the words that introduce it:
 *   title (a wire turns into a travelling wave) → an antenna throws rings of field outward
 *   → the wave runs at the speed of light → wavelength, and how it shrinks with frequency
 *   → 2.45 GHz is 12.2 cm → antenna size follows wavelength (tower vs chip)
 *   → the spectrum in seven decades → low frequencies go around walls, high ones are blocked
 *   → licence-free bands → "drag the slider".
 */
function Stage({ t, b, still }: StageProps) {
  const rise = riseOf(t, still)
  // the old scene has faded out by the time the next line starts and the new one fades in from there,
  // so two scenes never sit on top of each other
  const sc = (a: number, z: number) => span(t, a - 0.05, z - 0.3, 0.35, 0.3)
  const ph = (rate: number) => (still ? 0 : t * rate)

  const title = span(t, 0.25, b.shake - 0.3, 0.4, 0.3)
  const shake = sc(b.shake, b.light)
  const light = sc(b.light, b.wl)
  const wl = sc(b.wl, b.calc)
  // "12.2 cm" is said near the end of the line: let it stay up into the next one
  const calc = span(t, b.calc - 0.05, b.size + 0.3, 0.35, 0.4)
  const size = sc(b.size, b.bands)
  const bands = sc(b.bands, b.trade)
  const trade = span(t, b.trade - 0.05, b.ism, 0.35, 0.4)
  const ism = sc(b.ism, b.outro)

  return (
    <>
      <Scene o={title}>
        <T x={50} y={13} size={8} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
          电磁波
        </T>
        <T x={50} y={22} size={3} color={MUTED} o={enter(t, b.intro + 1.1)} dy={rise(b.intro + 1.1, 1)}>
          信号离开导线之后
        </T>
        <Svg>
          <path d="M6 34 H30" opacity={enter(t, 0.6, 0.6)} />
          <circle cx={6} cy={34} r={0.8} fill={AMP} stroke="none" opacity={enter(t, 0.6, 0.6)} />
          <path
            d={sinePath(30, 30 + 64 * enter(t, b.intro + 1.2, 1.4), 34, (x) => 5.5 * easeOut((x - 30) / 14), 17, ph(0.4))}
            stroke={VOLT}
            strokeWidth={0.45}
          />
        </Svg>
        <T x={18} y={41} size={2.2} color={MUTED} o={enter(t, b.intro + 0.4)}>
          导线
        </T>
        <T x={62} y={41} size={2.2} color={MUTED} o={enter(t, b.intro + 2.2)}>
          空中
        </T>
      </Scene>

      <Scene o={shake}>
        <Shake t={t} b={b} still={still} />
      </Scene>

      <Scene o={light}>
        <Light t={t} b={b} still={still} />
      </Scene>

      <Scene o={wl}>
        <Wavelength t={t} b={b} still={still} />
      </Scene>

      <Scene o={calc}>
        <Calc t={t} b={b} still={still} />
      </Scene>

      <Scene o={size}>
        <Sizes t={t} b={b} still={still} />
      </Scene>

      <Scene o={bands}>
        <Bands t={t} b={b} still={still} />
      </Scene>

      <Scene o={trade}>
        <Trade t={t} b={b} still={still} />
      </Scene>

      <Scene o={ism}>
        <Ism t={t} b={b} still={still} />
      </Scene>

      <Outro t={t} b={b} still={still} hint="拖动下面的频率滑块，看波长怎么变" />
    </>
  )
}

// ── an antenna throws the field out ──────────────────────────────────────────

function Shake({ t, b, still }: StageProps) {
  const rise = riseOf(t, still)
  const cx = 22
  const cy = 28
  const flow = enter(t, b.shake - 0.1, 0.4)
  const alt = enter(t, b.shk - 0.2, 0.4)
  const P = 0.9
  const start = b.out - 0.2
  const rings = Array.from({ length: 8 }, (_, k) => {
    const age = still ? 6 + k * 3 : t - start - k * P
    if (age <= 0) return null
    const live = still ? 1 : 1
    const r = age * 11
    const fade = Math.max(0, 1 - r / 70) * Math.min(1, age / 0.3) * live
    if (fade <= 0.01) return null
    const a = 0.95
    const x0 = cx + r * Math.cos(a)
    const x1 = x0
    const y0 = cy - r * Math.sin(a)
    const y1 = cy + r * Math.sin(a)
    return <path key={k} d={`M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}`} stroke={VOLT} strokeWidth={0.4} opacity={0.75 * fade} />
  })
  // charge slosh up and down the mast: still before "来回变化"
  const dots = [0, 1, 2, 3].map((i) => {
    const swing = still ? 0 : Math.sin(t * 6.5) * 4.5 * alt
    return <circle key={i} cx={cx} cy={cy - 6 + i * 4 + swing} r={0.6} fill={AMP} stroke="none" opacity={flow} />
  })
  return (
    <>
      <Svg>
        <path d={`M${cx} ${cy - 12} V${cy + 12}`} strokeWidth={0.6} opacity={enter(t, b.shake - 0.2)} />
        <path d={`M${cx - 6} ${cy + 18} H${cx + 6} M${cx} ${cy + 12} V${cy + 18}`} opacity={enter(t, b.shake - 0.2)} />
        {dots}
        {rings}
      </Svg>
      <T x={cx} y={cy + 23} size={2.4} color={MUTED} o={flow}>
        天线
      </T>
      <T x={cx} y={cy - 19} size={2.6} color={AMP} o={enter(t, b.shk)} dy={rise(b.shk, 1)}>
        电流来回变化
      </T>
      <T x={62} y={10} size={3.4} weight={600} o={enter(t, b.emw)} dy={rise(b.emw, 1)}>
        电磁波
      </T>
    </>
  )
}

// ── the speed of light ───────────────────────────────────────────────────────

function Light({ t, b, still }: StageProps) {
  const rise = riseOf(t, still)
  const lane = 16
  const front = still ? 0.5 : ((t - b.fast) / 1.4) % 1
  const fx = 6 + 88 * (t > b.fast ? front : 0)
  const o = enter(t, b.light, 0.5)
  return (
    <>
      <Svg>
        <path d={sinePath(6, 94, lane, 4.2, 14, still ? 0 : t * 1.8)} stroke={VOLT} strokeWidth={0.42} opacity={o} />
        <path d={`M6 ${lane + 9} H94`} strokeWidth={0.15} stroke="var(--border)" opacity={o} />
        {t > b.fast && !still && (
          <g>
            <circle cx={fx} cy={lane + 9} r={1.3} fill={FG} stroke="none" />
            <path d={`M${fx - 7} ${lane + 9} H${fx - 1.6}`} strokeWidth={0.5} opacity={0.5} />
          </g>
        )}
        {still && <circle cx={60} cy={lane + 9} r={1.3} fill={FG} stroke="none" opacity={enter(t, b.fast)} />}
      </Svg>
      <T x={50} y={35} size={5.6} weight={600} o={enter(t, b.fast - 0.1)} dy={rise(b.fast - 0.1, 1)} className="tabular">
        每秒 30 万公里
      </T>
      <T x={50} y={45} size={3.6} color={MUTED} o={enter(t, b.lightc)} dy={rise(b.lightc, 1)}>
        光速 <V c={VOLT}>c</V> <M>≈ 3×10⁸ m/s</M>
      </T>
    </>
  )
}

// ── wavelength ───────────────────────────────────────────────────────────────

function Wavelength({ t, b, still }: StageProps) {
  const rise = riseOf(t, still)
  const lam = glide(t, b.hi, 20, 10, b.short - b.hi + 0.3)
  const phase = still ? 0 : t * 0.3
  const x0 = 6
  const amp = 7
  // the first crest at or after x = 16 (crests sit where the cycle reaches a quarter)
  const k = Math.ceil((16 - x0) / lam - 0.25 - phase)
  const xc = x0 + lam * (k + 0.25 + phase)
  const br = enter(t, b.wlen - 0.1, 0.5)
  const y = 28
  const f = enter(t, b.hi)
  const l = enter(t, b.short - 0.3)
  return (
    <>
      <Svg>
        <path d={sinePath(x0, 94, y, amp, lam, phase)} stroke={VOLT} strokeWidth={0.45} opacity={enter(t, b.wl, 0.5)} />
        <g opacity={br} stroke={VOLT} strokeWidth={0.35}>
          <path d={`M${xc} ${y - amp - 1} V${y - amp - 5.5} M${xc + lam} ${y - amp - 1} V${y - amp - 5.5} M${xc} ${y - amp - 3.2} H${xc + lam}`} />
        </g>
      </Svg>
      <T x={xc + lam / 2} y={y - amp - 8.4} size={3} color={VOLT} o={br}>
        波长 <V>λ</V>
      </T>
      <T x={30} y={46} size={4} color={AMP} weight={600} o={f} dy={rise(b.hi, 1)}>
        频率 <V>f</V> 越高
      </T>
      <T x={70} y={46} size={4} color={VOLT} weight={600} o={l} dy={rise(b.short - 0.3, 1)}>
        波长 <V>λ</V> 越短
      </T>
    </>
  )
}

// ── 2.45 GHz → 12.2 cm ───────────────────────────────────────────────────────

function Calc({ t, b, still }: StageProps) {
  const rise = riseOf(t, still)
  const lam = 31.2
  const y = 30
  const phase = still ? 0 : t * 0.25
  const bxs = 14.5
  return (
    <>
      <T x={50} y={9} size={3.4} color={MUTED} o={enter(t, b.calc)} dy={rise(b.calc, 1)}>
        <V c={VOLT}>λ</V> <M>=</M> <V>c</V> <M>÷</M> <V c={AMP}>f</V>
      </T>
      <T x={50} y={17} size={5} weight={600} color={AMP} o={enter(t, b.f)} dy={rise(b.f, 1)} className="tabular">
        2.45 GHz
      </T>
      <Svg>
        <path d={sinePath(11, 89, y, 6, lam, phase)} stroke={VOLT} strokeWidth={0.45} opacity={enter(t, b.f, 0.5)} />
        <g opacity={enter(t, b.l - 0.4, 0.5)} stroke={VOLT} strokeWidth={0.35}>
          <path d={`M${bxs} 38.5 V41.5 M${bxs + lam} 38.5 V41.5 M${bxs} 40 H${bxs + lam}`} />
        </g>
      </Svg>
      <T x={bxs + lam / 2} y={47} size={5} weight={600} color={VOLT} o={enter(t, b.l)} dy={rise(b.l, 1)} className="tabular">
        12.2 cm
      </T>
    </>
  )
}

// ── antenna size follows wavelength ──────────────────────────────────────────

function Sizes({ t, b, still }: StageProps) {
  const rise = riseOf(t, still)
  const head = enter(t, b.size + 0.7, 0.5)
  // the tower draws from "中波电台", the board antenna from "二点四吉赫"
  const move = easeInOut((t - (b.tower - 1.5)) / 0.6)
  const tower = enter(t, b.tower - 1.2, 1.2)
  const chip = enter(t, b.chip - 1.4, 0.7)
  const tx = 28
  const legs = `M${tx - 5} 44 L${tx - 0.7} 14 M${tx + 5} 44 L${tx + 0.7} 14`
  const rungs = [22, 30, 38].map((yy) => {
    const half = lerp(0.7, 5, (yy - 14) / 30)
    return `M${tx - half} ${yy} H${tx + half}`
  })
  const diag = [14, 22, 30].map((yy, i) => {
    const y2 = yy + (i === 2 ? 8 : 8)
    const h1 = lerp(0.7, 5, (yy - 14) / 30)
    const h2 = lerp(0.7, 5, (y2 - 14) / 30)
    return i % 2 ? `M${tx - h1} ${yy} L${tx + h2} ${y2}` : `M${tx + h1} ${yy} L${tx - h2} ${y2}`
  })
  return (
    <>
      <T x={50} y={lerp(24, 8, move)} size={lerp(5.4, 2.8, move)} weight={600} color={move > 0.5 ? MUTED : undefined} o={head} dy={rise(b.size + 0.7, 1.2)}>
        天线 ≈ 波长
      </T>
      <Svg>
        <Draw d={legs} p={tower} />
        <Draw d={rungs.join("")} p={tower} strokeWidth={0.22} />
        <Draw d={diag.join("")} p={tower} strokeWidth={0.22} />
        <Draw d={`M${tx} 14 V10.5`} p={tower} />
        <path d="M18 44 H38" opacity={tower} />
        <g opacity={chip}>
          <rect x={60} y={34} width={22} height={12} rx={0.8} />
          <path d="M62 36.5 H64 V39 H66 V36.5 H68 V39 H70 V36.5" stroke={VOLT} strokeWidth={0.45} />
          <rect x={72} y={40} width={7} height={4} rx={0.4} strokeWidth={0.2} />
        </g>
      </Svg>
      <T x={tx} y={50} size={2.6} color={MUTED} o={enter(t, b.tower - 0.2)}>
        中波电台 · 上百米
      </T>
      <T x={71} y={50} size={2.6} color={MUTED} o={enter(t, b.chip - 0.4)}>
        <M>2.4 GHz</M> · <M>3 cm</M>
      </T>
      <T x={71} y={28} size={2.6} color={MUTED} o={chip}>
        板上的天线
      </T>
    </>
  )
}

// ── the spectrum ─────────────────────────────────────────────────────────────

const BANDS: [string, string, string][] = [
  ["长波", "导航授时", "30 kHz"],
  ["中波", "广播", "300 kHz"],
  ["短波", "短波电台", "3 MHz"],
  ["甚高频", "调频·对讲", "30 MHz"],
  ["特高频", "手机·无线网", "300 MHz"],
  ["超高频", "卫星·雷达", "3 GHz"],
  ["极高频", "毫米波", "30 GHz"],
]

function Bands({ t, b, still }: StageProps) {
  const rise = riseOf(t, still)
  const x0 = 6
  const w = 88 / 7
  const axis = enter(t, b.bands, 0.8)
  return (
    <>
      <T x={x0 + 88} y={16.5} size={1.9} color={MUTED} o={enter(t, b.bands + 0.3 + 7 * 0.12, 0.4)} className="tabular">
        300 GHz
      </T>
      <T x={50} y={9} size={3} color={MUTED} o={enter(t, b.bands)} dy={rise(b.bands, 1)}>
        无线电频谱：每一格是十倍频率
      </T>
      <Svg>
        <Draw d={`M${x0} 38 H${x0 + 88}`} p={axis} strokeWidth={0.25} />
        {BANDS.map(([, , ], i) => {
          const o = enter(t, b.bands + 0.3 + i * 0.12, 0.4)
          return (
            <g key={i} opacity={o}>
              <rect x={x0 + i * w} y={21} width={w} height={11} rx={0.6} fill={i === 4 ? "color-mix(in srgb, var(--foreground) 8%, transparent)" : "none"} />
            </g>
          )
        })}
      </Svg>
      {BANDS.map(([name, use, edge], i) => {
        const o = enter(t, b.seg + i * 0.2, 0.4)
        const cx = x0 + (i + 0.5) * w
        return (
          <React.Fragment key={name}>
            <T x={cx} y={26.5} size={2.6} weight={500} o={o} dy={rise(b.seg + i * 0.2, 1)}>
              {name}
            </T>
            <T x={cx} y={43} size={1.9} color={MUTED} o={o}>
              {use}
            </T>
            <T x={x0 + i * w} y={16.5} size={1.9} color={MUTED} o={enter(t, b.bands + 0.3 + i * 0.12, 0.4)} className="tabular">
              {edge}
            </T>
          </React.Fragment>
        )
      })}
    </>
  )
}

// ── low frequencies go around, high ones are blocked ─────────────────────────

function Trade({ t, b, still }: StageProps) {
  const rise = riseOf(t, still)
  const rows = [
    { y: 18, lam: 26, at: b.trade, pass: 0.85 },
    { y: 40, lam: 7, at: b.high - 0.1, pass: 0 },
  ]
  const wallX = 44
  const wallW = 8
  return (
    <>
      <Svg>
        {rows.map((r, i) => {
          const o = enter(t, r.at, 0.5)
          const amp = (x: number) => (x < wallX ? 4.2 : x < wallX + wallW ? 4.2 * (0.35 + 0.65 * r.pass) : 4.2 * r.pass)
          const ph = still ? 0 : t * (i ? 1.6 : 0.5)
          return (
            <g key={i} opacity={o}>
              <path d={sinePath(6, 94, r.y, amp, r.lam, ph)} stroke={i ? AMP : VOLT} strokeWidth={0.42} />
              <rect x={wallX} y={r.y - 8} width={wallW} height={16} rx={0.4} stroke="none" fill="color-mix(in srgb, var(--foreground) 14%, transparent)" />
              <path d={`M${wallX} ${r.y - 8} V${r.y + 8} M${wallX + wallW} ${r.y - 8} V${r.y + 8}`} strokeWidth={0.2} />
              {!r.pass && <path d={`M${wallX + wallW + 1} ${r.y} H94`} strokeWidth={0.15} stroke="var(--border)" strokeDasharray="0.6 0.9" />}
            </g>
          )
        })}
      </Svg>
      <T x={6} y={5.5} size={3} anchor="start" weight={600} color={VOLT} o={enter(t, b.low)} dy={rise(b.low, 1)}>
        频率低
      </T>
      <T x={86} y={5.5} size={2.8} anchor="end" color={MUTED} o={enter(t, b.far)}>
        绕得远、能穿墙
      </T>
      <T x={6} y={27.5} size={3} anchor="start" weight={600} color={AMP} o={enter(t, b.high)} dy={rise(b.high, 1)}>
        频率高
      </T>
      <T x={86} y={27.5} size={2.8} anchor="end" color={MUTED} o={enter(t, b.bandw)}>
        速率快
      </T>
      <T x={86} y={51.5} size={2.8} anchor="end" color={MUTED} o={enter(t, b.block)}>
        怕遮挡
      </T>
    </>
  )
}

// ── licence-free bands ───────────────────────────────────────────────────────

const CHIPS: [string, number][] = [
  ["13.56 MHz", 12],
  ["433 MHz", 30],
  ["915 MHz", 50],
  ["2.4 GHz", 70],
  ["5.8 GHz", 88],
]

function Ism({ t, b, still }: StageProps) {
  const rise = riseOf(t, still)
  const cards = [
    { cx: 30, at: b.f433, lam: 28, ph: 0.35, head: "遥控器、门铃", len: "λ ≈ 69 cm" },
    { cx: 70, at: b.f24, lam: 5, ph: 1.2, head: "无线网、蓝牙", len: "λ ≈ 12 cm" },
  ]
  return (
    <>
      <T x={50} y={7} size={3} color={MUTED} o={enter(t, b.ism + 0.2)} dy={rise(b.ism + 0.2, 1)}>
        免执照 · ISM 频段
      </T>
      {CHIPS.map(([s, x], i) => {
        const hi = (x === 30 ? enter(t, b.f433 - 0.1, 0.3) : x === 70 ? enter(t, b.f24 - 0.1, 0.3) : 0) as number
        return (
          <T key={s} x={x} y={15} size={2.8} weight={hi > 0.5 ? 600 : 400} color={hi > 0.5 ? VOLT : MUTED} o={enter(t, b.ism + 0.45 + i * 0.12, 0.4)} className="tabular">
            {s}
          </T>
        )
      })}
      <Svg>
        {cards.map((c) => (
          <g key={c.cx} opacity={enter(t, c.at, 0.5)}>
            <rect x={c.cx - 19} y={22} width={38} height={28} rx={1.2} strokeWidth={0.2} stroke="var(--border)" />
            <path d={sinePath(c.cx - 16, c.cx + 16, 37, 4.5, c.lam, still ? 0 : t * (c.lam > 10 ? 0.4 : 1.3) + c.ph)} stroke={VOLT} strokeWidth={0.4} />
          </g>
        ))}
      </Svg>
      {cards.map((c) => (
        <React.Fragment key={c.cx}>
          <T x={c.cx} y={27} size={3.2} weight={500} o={enter(t, c.at + 0.1)}>
            {c.head}
          </T>
          <T x={c.cx} y={45.5} size={2.6} color={VOLT} o={enter(t, c.at + 0.3)}>
            <M>{c.len}</M>
          </T>
        </React.Fragment>
      ))}
    </>
  )
}

export const film: FilmDef = {
  title: "电磁波与无线电频谱",
  audio,
  timing,
  poster: 4.2,
  Stage,
}

export default function EmWavesFilm() {
  return <FilmPlayer film={film} />
}

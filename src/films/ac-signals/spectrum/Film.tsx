import { Fragment } from "react"
import { trace } from "@/lab/colors"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, M, Scene, Svg, T, V, easeInOut, enter, glide, lerp, span, type FilmDef, type StageProps } from "../../kit"
import { TAU, curve, hArrow } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

const VOLT = trace.voltage
const AMP = trace.current
const HEAT = trace.power
const MUTED = "var(--muted-foreground)"
const BORDER = "var(--border)"
const FAINT = "var(--faint-foreground)"

/*
 * 频谱与分贝, ~70 s. Scenes, each keyed to its words:
 *   one signal two ways (wave beside its bars) → harmonics stack up into a square wave while the
 *   bars grow (1, 1/3, 1/5 …) → fewer harmonics round the edges off → a rise time sets the highest
 *   frequency → linear bars versus decibel bars → +6 dB and +20 dB → "try it below".
 */
function Stage({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.6) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)
  // each scene holds until its last result has been seen; the next one draws in as it goes
  const intro = span(t, 0.25, b.ln_sum + 0.3)
  const build = span(t, b.ln_sum + 0.3, b.edge - 0.45)
  const edge = span(t, b.edge - 0.2, b.rise - 0.15)
  const rt = span(t, b.rise - 0.1, b.ln_db - 0.1)
  const dbs = span(t, b.ln_db - 0.05, b.rule + 0.4)
  const rule = span(t, b.rule + 0.4, b.outro - 0.2)
  const outro = enter(t, b.outro - 0.1, 0.5)
  const p = { t, b, still, rise }
  return (
    <>
      <Scene o={intro}>
        <Intro {...p} />
      </Scene>
      <Scene o={build}>
        <Build {...p} />
      </Scene>
      <Scene o={edge}>
        <Edge {...p} />
      </Scene>
      <Scene o={rt}>
        <RiseTime {...p} />
      </Scene>
      <Scene o={dbs}>
        <Decibels {...p} />
      </Scene>
      <Scene o={rule}>
        <Rule {...p} />
      </Scene>
      <Scene o={outro}>
        <T x={50} y={24} size={6} weight={600} dy={rise(b.outro)}>
          动手试试
        </T>
        <T x={50} y={32.5} size={2.8} color={MUTED} o={enter(t, b.drag)} dy={rise(b.drag, 1)}>
          拖动下面实验台的谐波滑块
        </T>
        <Svg>
          <g opacity={enter(t, b.drag + 0.3)} transform={`translate(0 ${still ? 0 : Math.sin(t * 3.2) * 0.6})`} strokeWidth={0.45}>
            <path d="M50 38 V45 M47.6 42.6 L50 45 L52.4 42.6" />
          </g>
        </Svg>
      </Scene>
    </>
  )
}

type P = StageProps & { rise: (at: number, d?: number) => number }

/** The square wave's Fourier sum: odd harmonics up to `n`, each weighted by w(k) in 0..1. */
function squareSum(theta: number, n: number, w: (k: number) => number = () => 1) {
  let s = 0
  for (let k = 1; k <= n; k += 2) s += (w(k) * Math.sin(k * theta)) / k
  return (4 / Math.PI) * s
}

// ── one signal, two ways ────────────────────────────────────────────────────

function Intro({ t, b, still, rise }: P) {
  const mv = still ? 0 : t
  const o1 = enter(t, b.intro + 0.6, 0.6)
  const o2 = enter(t, b.freq - 0.3, 0.6)
  const bars = [1, 3, 5, 7]
  return (
    <>
      <T x={50} y={9} size={5} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
        同一个信号
      </T>
      <Svg>
        <g stroke={BORDER} opacity={o1}>
          <path d="M6 24 V46 H46 M6 35 H46" />
        </g>
        <Draw d={curve(160, (u) => [6 + 40 * u, 35 - 8 * squareSum(TAU * (2 * u - mv * 0.05), 7)])} p={enter(t, b.time - 0.8, 1.8)} stroke={VOLT} strokeWidth={0.55} />
        <g stroke={BORDER} opacity={o2}>
          <path d="M58 24 V46 H94" />
        </g>
        {bars.map((k, i) => {
          const h = (22 / k) * enter(t, b.freq + i * 0.2, 0.5)
          return <rect key={k} x={63 + i * 7.5} y={46 - h} width={3.4} height={Math.max(h, 0.01)} fill={AMP} stroke="none" />
        })}
        <g opacity={enter(t, b.freq + 0.2, 0.5)} stroke={MUTED} strokeWidth={0.3}>
          <path d="M49 35 H55 M53.4 33.6 L55 35 L53.4 36.4" />
        </g>
      </Svg>
      <T x={26} y={18} size={3.6} weight={600} color={VOLT} o={o1}>
        按时间看
      </T>
      <T x={76} y={18} size={3.6} weight={600} color={AMP} o={o2}>
        按频率看
      </T>
      <T x={26} y={50} size={2.2} color={MUTED} o={o1}>
        时间 <V>t</V>
      </T>
      <T x={76} y={50} size={2.2} color={MUTED} o={o2}>
        频率 <V>f</V>
      </T>
    </>
  )
}

// ── harmonics build the square wave ─────────────────────────────────────────

const HK = [1, 3, 5, 7, 9, 11, 13]

function Build({ t, b, still, rise }: P) {
  const mv = still ? 0 : t
  const at: Record<number, number> = {
    1: b.ln_sum + 0.8,
    3: b.h3,
    5: b.h5,
    7: b.ln_odd + 0.1,
    9: b.ln_odd + 0.6,
    11: b.ln_odd + 1.1,
    13: b.ln_odd + 1.6,
  }
  const w = (k: number) => enter(t, at[k] ?? 1e9, 0.6)
  const wx0 = 6
  const wx1 = 56
  const WY = 33
  const A = 8.5
  const bx = (i: number) => 66 + i * 4.2
  const newest = HK.filter((k) => t >= at[k] && t < at[k] + 1.6).pop()
  return (
    <>
      <Svg>
        <g stroke={BORDER} opacity={enter(t, b.ln_sum + 0.4, 0.5)}>
          <path d={`M${wx0} 20 V47 M${wx0} ${WY} H${wx1}`} />
          <path d="M62 14 V47 H94" />
        </g>
        <Draw d={curve(200, (u) => [wx0 + (wx1 - wx0) * u, WY - A * squareSum(TAU * (2 * u - mv * 0.04), 13, w)])} p={enter(t, b.ln_sum + 0.6, 1)} stroke={VOLT} strokeWidth={0.6} />
        {newest !== undefined && (
          <path
            d={curve(120, (u) => [wx0 + (wx1 - wx0) * u, 13 - 3 * Math.sin(newest * TAU * (2 * u - mv * 0.04))])}
            stroke={AMP}
            strokeWidth={0.4}
            opacity={Math.min(1, w(newest)) * (1 - enter(t, at[newest] + 1.2, 0.4))}
          />
        )}
        {HK.map((k, i) => {
          const h = (30 / k) * w(k)
          return <rect key={k} x={bx(i) - 1.1} y={47 - h} width={2.2} height={Math.max(h, 0.01)} fill={AMP} stroke="none" />
        })}
      </Svg>
      <T x={wx0 + 1} y={49} size={2.2} anchor="start" color={MUTED} o={enter(t, b.ln_sum + 0.4)}>
        电压 <V c={VOLT}>V</V>
      </T>
      {HK.map((k, i) => (
        <T key={k} x={bx(i)} y={50.3} size={2} color={MUTED} o={enter(t, at[k] + 0.2)} className="tabular">
          {k}
        </T>
      ))}
      <T x={bx(0)} y={47 - 30 - 3} size={2.4} weight={600} color={AMP} o={enter(t, b.fund)}>
        基波
      </T>
      <T x={bx(1)} y={47 - 10 - 3} size={2.4} weight={600} color={AMP} o={enter(t, b.h3 + 0.1)}>
        三倍
      </T>
      <T x={bx(2)} y={47 - 6 - 3} size={2.4} weight={600} color={AMP} o={enter(t, b.h5 + 0.1)}>
        五倍
      </T>
      <T x={78} y={12} size={2.6} color={MUTED} o={enter(t, b.odd)}>
        没有偶数次
      </T>
      <T x={84} y={19} size={2.6} weight={600} color={AMP} o={enter(t, b.inv)} dy={rise(b.inv, 1)}>
        <M>1, 1/3, 1/5, 1/7 …</M>
      </T>
      <T x={62.5} y={50.3} size={2.2} anchor="end" color={MUTED} o={enter(t, b.pos)}>
        位置 = 频率
      </T>
      <T x={92} y={26} size={2.2} anchor="end" color={MUTED} o={enter(t, b.hgt)}>
        高度 = 幅度
      </T>
    </>
  )
}

// ── fewer harmonics, rounder edges ──────────────────────────────────────────

function Edge({ t, b, still, rise }: P) {
  const mv = still ? 0 : t
  const n = Math.round(glide(t, b.bw - 0.3, 31, 3, 2.4))
  const nOdd = n % 2 ? n : n + 1
  const X0 = 10
  const X1 = 90
  const YC = 27
  const A = 10
  const keep = 56 * (nOdd / 31)
  return (
    <>
      <Svg>
        <path d={`M${X0} ${YC} H${X1}`} stroke={BORDER} />
        <Draw d={curve(400, (u) => [X0 + (X1 - X0) * u, YC - A * Math.sign(Math.sin(TAU * (2 * u - mv * 0.02)))].map((v) => v) as [number, number])} p={enter(t, b.edge + 0.1, 0.7)} stroke={FAINT} strokeWidth={0.3} strokeDasharray="0.8 0.8" />
        <path d={curve(400, (u) => [X0 + (X1 - X0) * u, YC - A * ((squareSum(TAU * (2 * u - mv * 0.02), nOdd) * Math.PI) / 4)])} stroke={VOLT} strokeWidth={0.6} opacity={enter(t, b.edge, 0.4)} />
        <g opacity={enter(t, b.bw - 0.5, 0.6)}>
          <path d="M22 47 H78" stroke={BORDER} />
          <path d={`M22 47 H${22 + keep}`} stroke={VOLT} strokeWidth={0.8} />
          <circle cx={22 + keep} cy={47} r={0.9} fill={VOLT} stroke="none" />
        </g>
      </Svg>
      <T x={36} y={11} size={2.8} weight={600} anchor="start" color={HEAT} o={enter(t, b.steep - 0.2)} dy={rise(b.steep, 1)}>
        边沿越陡，高频越多
      </T>
      <T x={20} y={47} size={2.4} anchor="end" color={MUTED} o={enter(t, b.bw - 0.5)}>
        带宽
      </T>
      <T x={50} y={51.2} size={2.4} color={MUTED} o={enter(t, b.bw - 0.2)} className="tabular">
        只留到第 {nOdd} 次谐波
      </T>
      <T x={84} y={9} size={3.4} weight={600} color={VOLT} o={enter(t, b.round) * (n < 15 ? 1 : 0)} dy={rise(b.round, 1)}>
        方波不方了
      </T>
    </>
  )
}

// ── rise time sets the highest frequency ────────────────────────────────────

function RiseTime({ t, b, rise }: P) {
  const edge = enter(t, b.rise, 0.8)
  const bars = Array.from({ length: 26 }, (_, i) => i)
  const reach = enter(t, b.r350 - 0.4, 1.4)
  return (
    <>
      <Svg>
        <g stroke={BORDER} opacity={edge}>
          <path d="M6 24 V46 H46 M58 46 H94 M58 24 V46" />
        </g>
        <Draw d="M8 44 H18 L26 26 H44" p={edge} stroke={VOLT} strokeWidth={0.6} />
        <Draw d={hArrow(18, 26, 21.5)} p={enter(t, b.r1 - 0.2, 0.5)} stroke={HEAT} strokeWidth={0.35} />
        <path d="M18 21.5 v3 M26 21.5 v-3" stroke={HEAT} strokeWidth={0.25} opacity={enter(t, b.r1 - 0.2, 0.5)} />
        <g opacity={edge} stroke={MUTED} strokeWidth={0.3}>
          <path d="M49 35 H55 M53.4 33.6 L55 35 L53.4 36.4" />
        </g>
        {bars.map((i) => {
          const h = Math.max(0.3, 21 / (0.35 * i + 1)) * enter(t, b.r1 + 0.4 + i * 0.1, 0.5)
          return <rect key={i} x={59.5 + i * 1.3} y={46 - h} width={0.8} height={h} fill={AMP} stroke="none" />
        })}
        <Draw d="M59.5 21 H92.5 M59.5 19.8 V22.2 M92.5 19.8 V22.2" p={reach} stroke={HEAT} strokeWidth={0.3} />
      </Svg>
      <T x={26} y={13} size={3.2} weight={600} o={edge} dy={rise(b.rise, 1)}>
        一个陡峭的边沿
      </T>
      <T x={22} y={50.2} size={2.6} weight={600} color={HEAT} o={enter(t, b.r1)} className="tabular">
        <M>
          上升时间 <V>t</V>
          <sub style={{ fontSize: "0.6em" }}>r</sub> = 1 ns
        </M>
      </T>
      <T x={76} y={14} size={3.2} weight={600} color={AMP} o={edge}>
        高频成分
      </T>
      <T x={76} y={50.2} size={2.6} weight={600} color={HEAT} o={enter(t, b.r350)} className="tabular">
        <M>延伸到 350 MHz</M>
      </T>
      <T x={76} y={27} size={3.4} o={enter(t, b.r350 + 0.2)} dy={rise(b.r350 + 0.2, 1)}>
        <span className="inline-flex items-center gap-[0.25em]">
          <V c={AMP}>f</V>
          <M>
            <sub style={{ fontSize: "0.6em" }}>max</sub> ≈ 0.35 /
          </M>
          <V c={HEAT}>t</V>
          <M>
            <sub style={{ fontSize: "0.6em" }}>r</sub>
          </M>
        </span>
      </T>
    </>
  )
}

// ── linear bars become decibel bars ─────────────────────────────────────────

function Decibels({ t, b, rise }: P) {
  const vals = [1, 10, 100, 1000, 10000]
  const sw = easeInOut((t - (b.db - 0.2)) / 0.8)
  const X = [18, 34, 50, 66, 82]
  const BASE = 45
  const MAXH = 30
  const lin = (v: number) => (v / 10000) * MAXH
  const dB = (v: number) => (20 * Math.log10(v) / 80) * MAXH
  return (
    <>
      <T x={50} y={9} size={3.4} weight={600} o={enter(t, b.ln_db + 0.1) * (1 - sw)} dy={rise(b.ln_db, 1)}>
        线性刻度
      </T>
      <T x={50} y={9} size={3.4} weight={600} color={VOLT} o={sw}>
        分贝刻度
      </T>
      <Svg>
        <path d={`M8 ${BASE} H92`} stroke={BORDER} opacity={enter(t, b.ln_db, 0.5)} />
        {vals.map((v, i) => {
          const h = Math.max(0.4, lerp(lin(v), dB(v) || 0.4, sw)) * enter(t, b.ln_db + 0.3 + i * 0.2, 0.5)
          return <rect key={v} x={X[i] - 3} y={BASE - h} width={6} height={h} fill={VOLT} stroke="none" opacity={0.9} />
        })}
      </Svg>
      {vals.map((v, i) => {
        const h = Math.max(0.4, lerp(lin(v), dB(v) || 0.4, sw))
        return (
          <T key={v} x={X[i]} y={BASE - h - 2.8} size={2.6} weight={600} color={VOLT} o={enter(t, b.ln_db + 0.4 + i * 0.2, 0.5)} className="tabular">
            <span style={{ opacity: 1 - sw, position: sw > 0.5 ? "absolute" : "static" }}>
              <M>{v}</M>
            </span>
            <span style={{ opacity: sw, position: sw > 0.5 ? "static" : "absolute", left: 0, right: 0, textAlign: "center" }}>
              <M>{(20 * Math.log10(v)).toFixed(0)}</M>
            </span>
          </T>
        )
      })}
      <T x={50} y={50.5} size={2.6} color={MUTED} o={enter(t, b.big) * (1 - sw)}>
        相差上万倍：小的几乎看不见
      </T>
      <T x={50} y={50.5} size={2.6} color={MUTED} o={sw}>
        每高一格是 20 分贝
      </T>
    </>
  )
}

// ── +6 dB and +20 dB ────────────────────────────────────────────────────────

function Rule({ t, b, rise }: P) {
  const rows = [
    { y: 20, label: "电压翻倍", times: "× 2", db: 6, at: b.d6 },
    { y: 38, label: "放大十倍", times: "× 10", db: 20, at: b.d20 },
  ]
  const K = 2.0
  return (
    <>
      <T x={50} y={8} size={3} color={MUTED} o={enter(t, b.rule + 0.8)}>
        电压的变化，换成分贝
      </T>
      {rows.map((r) => (
        <Fragment key={r.label}>
          <T x={8} y={r.y - 3} size={3.2} anchor="start" weight={600} o={enter(t, r.at - 0.8)} dy={rise(r.at - 0.8, 1)}>
            {r.label}
          </T>
          <T x={8} y={r.y + 4} size={3.6} anchor="start" weight={600} color={VOLT} o={enter(t, r.at - 0.5)} className="tabular">
            <M>{r.times}</M>
          </T>
          <T x={38 + r.db * K * enter(t, r.at, 0.8) + 2} y={r.y + 0.5} size={4.4} anchor="start" weight={600} color={AMP} o={enter(t, r.at, 0.4)} className="tabular">
            <M>+{r.db} dB</M>
          </T>
        </Fragment>
      ))}
      <Svg>
        {rows.map((r) => (
          <g key={r.db}>
            <path d={`M38 ${r.y - 5} V${r.y + 6}`} stroke={BORDER} opacity={enter(t, r.at - 0.8, 0.4)} />
            <rect x={38} y={r.y - 2} width={Math.max(0.01, r.db * K * enter(t, r.at, 0.8))} height={5} rx={0.8} fill={AMP} stroke="none" opacity={0.85} />
          </g>
        ))}
      </Svg>
    </>
  )
}

export const film: FilmDef = {
  title: "频谱与分贝",
  audio,
  timing,
  poster: 5.2,
  Stage,
}

export default function SpectrumFilm() {
  return <FilmPlayer film={film} />
}

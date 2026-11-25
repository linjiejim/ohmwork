import { trace } from "@/lab/colors"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, Frac, M, Scene, Svg, T, V, easeInOut, enter, glide, lerp, leave, span, type FilmDef, type StageProps } from "../../kit"
import { Pill, TAU, hArrow, sinePath, vArrow } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

const VOLT = trace.voltage
const AMP = trace.current
const HEAT = trace.power
const BIAS = trace.second
const MUTED = "var(--muted-foreground)"
const BORDER = "var(--border)"

/*
 * 波形与它的参数, ~65 s. Scenes, each keyed to its words:
 *   title (a sine draws on axes) → DC beside AC → one cycle = the period → 2 Hz and 5 Hz in a
 *   one-second window → 50 Hz = 20 ms → amplitude, peak-to-peak, RMS on one wave → the wave lifts
 *   (DC bias) → two waves slide 90° apart and a dial turns 360° → "try it below".
 */
function Stage({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.6) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)
  const mv = still ? 0 : t

  const title = span(t, 0.25, b.dcac - 0.45)
  // each scene holds until its last label has been read, and the next one draws as soon as it has gone
  const dcac = span(t, b.dcac - 0.2, b.ln_sine - 0.25)
  const period = span(t, b.ln_sine - 0.25, b.ln_freq + 0.25)
  const freq = span(t, b.ln_freq + 0.25, b.mains + 0.05)
  const mains = span(t, b.mains + 0.05, b.ln_amp - 0.1)
  const levels = span(t, b.ln_amp - 0.05, b.ln_bias - 0.45)
  const bias = span(t, b.ln_bias - 0.2, b.phase - 0.45)
  const outro = enter(t, b.outro - 0.1, 0.5)
  const phase = enter(t, b.phase - 0.2) * (1 - 0.86 * outro)

  return (
    <>
      {/* ── title: a sine draws itself on a pair of axes ── */}
      <Scene o={title}>
        <T x={50} y={11} size={7} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
          波形
        </T>
        <Svg>
          <Draw d="M10 34 H90" p={enter(t, b.intro + 0.9, 0.7)} stroke={BORDER} />
          <Draw d="M10 20 V48" p={enter(t, b.intro + 0.9, 0.7)} stroke={BORDER} />
          <Draw d={sinePath(10, 90, 34, 8, 3, mv * 0.08)} p={enter(t, b.intro + 1.4, 3.6)} stroke={VOLT} strokeWidth={0.5} />
        </Svg>
        <T x={9} y={17.5} size={2.4} anchor="start" color={MUTED} o={enter(t, b.intro + 1.1)}>
          电压 <V c={VOLT}>V</V>
        </T>
        <T x={90} y={43} size={2.4} anchor="end" color={MUTED} o={enter(t, b.intro + 1.1)}>
          时间 <V>t</V>
        </T>
      </Scene>

      {/* ── DC beside AC ── */}
      <Scene o={dcac}>
        <Svg>
          <g stroke={BORDER}>
            <path d="M30 22 H92" opacity={enter(t, b.dcac + 0.1)} />
            <path d="M30 44 H92" opacity={enter(t, b.dcac + 0.1)} />
          </g>
          <Draw d="M30 14 H92" p={enter(t, b.dc - 0.9, 1.2)} stroke={VOLT} strokeWidth={0.55} />
          <Draw d={sinePath(30, 92, 44, 8, 3, mv * 0.25)} p={enter(t, b.ac - 0.2, 1.4)} stroke={VOLT} strokeWidth={0.55} />
        </Svg>
        <T x={8} y={16} size={4.4} weight={600} anchor="start" o={enter(t, b.dc)} dy={rise(b.dc, 1)}>
          直流
        </T>
        <T x={8} y={22} size={2.4} anchor="start" color={MUTED} o={enter(t, b.dc + 0.2)}>
          方向不变
        </T>
        <T x={8} y={38} size={4.4} weight={600} anchor="start" o={enter(t, b.ac)} dy={rise(b.ac, 1)}>
          交流
        </T>
        <T x={8} y={44} size={2.4} anchor="start" color={MUTED} o={enter(t, b.ac + 0.2)}>
          正负交替
        </T>
        <T x={27} y={36.5} size={2.4} anchor="end" color={MUTED} o={enter(t, b.ac + 0.3)} className="tabular">
          +
        </T>
        <T x={27} y={51.5} size={2.4} anchor="end" color={MUTED} o={enter(t, b.ac + 0.3)} className="tabular">
          −
        </T>
      </Scene>

      {/* ── one cycle is the period ── */}
      <Scene o={period}>
        <T x={50} y={8} size={4.4} weight={600} o={enter(t, b.sine)} dy={rise(b.sine, 1)}>
          正弦波
        </T>
        <Svg>
          <Draw d="M10 26 H90" p={enter(t, b.ln_sine - 0.15, 0.6)} stroke={BORDER} />
          <Draw d={sinePath(10, 90, 26, 11, 2)} p={enter(t, b.ln_sine, 1.5)} stroke={VOLT} strokeWidth={0.55} />
          <Draw d="M10 41 V44 H50 V41" p={enter(t, b.period - 0.1, 0.7)} stroke={AMP} />
          <Draw d={sinePath(10, 50, 26, 11, 1)} p={enter(t, b.period, 0.7)} stroke={AMP} strokeWidth={0.8} />
        </Svg>
        <T x={30} y={49.5} size={3.2} color={AMP} o={enter(t, b.period + 0.1)} dy={rise(b.period + 0.1, 1)}>
          周期 <V>T</V>
        </T>
      </Scene>

      {/* ── frequency: how many cycles fit in one second ── */}
      <Scene o={freq}>
        <FreqScene t={t} b={b} still={still} />
      </Scene>

      {/* ── 50 Hz → 20 ms ── */}
      <Scene o={mains}>
        <Pill x={50} y={8} o={enter(t, b.mains + 0.3)}>
          市电
        </Pill>
        <T x={50} y={20} size={7}>
          <span className="inline-flex items-center gap-[0.3em]" style={{ opacity: enter(t, b.mains + 0.4) }}>
            <V>T</V>
            <M>=</M>
            <Frac top={<M>1</M>} bottom={<V c={VOLT}>f</V>} />
            <span className="inline-flex items-center gap-[0.3em]" style={{ opacity: enter(t, b.f50) }}>
              <M>=</M>
              <Frac top={<M>1</M>} bottom={<M c={VOLT}>50 Hz</M>} />
            </span>
          </span>
        </T>
        <T x={50} y={32} size={6.4} weight={600} color={AMP} o={enter(t, b.t20)} scale={still ? 1 : lerp(1.15, 1, enter(t, b.t20, 0.5))} className="tabular">
          <M>= 20 ms</M>
        </T>
        <Svg>
          <Draw d={sinePath(14, 86, 45, 4.5, 3.6)} p={enter(t, b.f50 - 0.3, 1.2)} stroke={VOLT} strokeWidth={0.45} />
          <Draw d={sinePath(14, 34, 45, 4.5, 1)} p={enter(t, b.t20, 0.7)} stroke={AMP} strokeWidth={0.8} />
        </Svg>
      </Scene>

      {/* ── amplitude, peak-to-peak, RMS on one wave ── */}
      <Scene o={levels}>
        <Levels t={t} b={b} still={still} />
      </Scene>

      {/* ── DC bias lifts the wave ── */}
      <Scene o={bias}>
        <Bias t={t} b={b} still={still} />
      </Scene>

      {/* ── phase: two waves, one turn is 360° ── */}
      <Scene o={phase}>
        <Phase t={t} b={b} still={still} />
      </Scene>

      <Scene o={outro}>
        <T x={50} y={24} size={6} weight={600} dy={rise(b.outro)}>
          动手试试
        </T>
        <T x={50} y={32.5} size={2.8} color={MUTED} o={enter(t, b.drag)} dy={rise(b.drag, 1)}>
          拖动下面实验台的滑块
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

// ── frequency ───────────────────────────────────────────────────────────────

function FreqScene({ t, b, still }: StageProps) {
  const X0 = 16
  const X1 = 84
  const s0 = b.ln_freq + 0.25
  const sweep = still ? 0 : ((t - s0) / 3.2) % 1
  const cx = X0 + (X1 - X0) * (sweep < 0 ? 0 : sweep)
  return (
    <>
      <T x={30} y={8} size={3.6} o={enter(t, b.freq)}>
        频率 <V c={VOLT}>f</V>
      </T>
      <T x={70} y={8} size={3.2} color={MUTED} o={enter(t, b.hz)}>
        单位：赫兹 <M>Hz</M>
      </T>
      <Svg>
        <g stroke={BORDER} opacity={enter(t, s0 + 0.1)}>
          <path d={`M${X0} 18 V50 M${X1} 18 V50`} strokeDasharray="0.8 0.8" />
          <path d={`M${X0} 22 H${X1} M${X0} 42 H${X1}`} />
        </g>
        <Draw d={sinePath(X0, X1, 22, 4.5, 2)} p={enter(t, s0 + 0.1, 1.3)} stroke={VOLT} strokeWidth={0.5} />
        <Draw d={sinePath(X0, X1, 42, 4.5, 5)} p={enter(t, s0 + 0.5, 1.4)} stroke={AMP} strokeWidth={0.5} />
        {!still && t > s0 + 1.5 && <path d={`M${cx} 16 V50`} stroke={MUTED} strokeWidth={0.22} opacity={enter(t, s0 + 1.5)} />}
        <Draw d={hArrow(X0, X1, 16.2)} p={enter(t, s0 + 0.3, 0.8)} stroke={MUTED} strokeWidth={0.22} />
      </Svg>
      <T x={50} y={13} size={2.2} color={MUTED} o={enter(t, s0 + 0.6)}>
        1 秒
      </T>
      <T x={X0 - 2} y={22} size={3.2} anchor="end" weight={600} color={VOLT} o={enter(t, b.hz)} className="tabular">
        <M>2 Hz</M>
      </T>
      <T x={X0 - 2} y={42} size={3.2} anchor="end" weight={600} color={AMP} o={enter(t, b.hz + 0.3)} className="tabular">
        <M>5 Hz</M>
      </T>
      <T x={X1 + 2} y={22} size={2.2} anchor="start" color={MUTED} o={enter(t, b.hz + 0.2)}>
        2 次
      </T>
      <T x={X1 + 2} y={42} size={2.2} anchor="start" color={MUTED} o={enter(t, b.hz + 0.5)}>
        5 次
      </T>
    </>
  )
}

// ── amplitude, peak-to-peak, RMS ────────────────────────────────────────────

const LC = 28 // centre line
const LA = 12 // amplitude

function Levels({ t, b, still }: StageProps) {
  const mv = still ? 0 : t
  const ampO = span(t, b.amp, b.rms + 0.1, 0.4, 0.3)
  const ppO = span(t, b.pp, b.rms + 0.1, 0.4, 0.3)
  const rmsO = enter(t, b.rms)
  const rmsY = LC - LA * 0.7071
  const sweep = still ? 0 : 0
  void sweep
  return (
    <>
      <Svg>
        <path d={`M8 ${LC} H70`} stroke={BORDER} />
        <g stroke={BORDER} strokeDasharray="0.8 0.8" opacity={ppO}>
          <path d={`M8 ${LC - LA} H66 M8 ${LC + LA} H66`} />
        </g>
        <Draw d={sinePath(8, 68, LC, LA, 2, mv * 0.02)} p={enter(t, b.ln_amp + 0.2, 1.2)} stroke={VOLT} strokeWidth={0.55} />
        <g opacity={ampO} stroke={VOLT}>
          <path d={vArrow(17.5, LC, LC - LA)} />
        </g>
        <g opacity={ppO} stroke={AMP}>
          <path d={vArrow(62.5, LC + LA, LC - LA)} />
        </g>
        <Draw d={`M8 ${rmsY} H70`} p={rmsO} stroke={HEAT} strokeWidth={0.55} strokeDasharray="none" />
      </Svg>
      <T x={17.5} y={LC - LA - 3.5} size={2.6} color={VOLT} o={ampO}>
        幅度
      </T>
      <T x={74} y={LC - 3} size={2.8} anchor="start" color={AMP} o={ppO}>
        峰峰值
      </T>
      <T x={74} y={LC + 3} size={2.8} anchor="start" color={MUTED} o={ppO * enter(t, b.pp + 0.5)}>
        <M>
          <span className="whitespace-nowrap">
            2 × 幅度
          </span>
        </M>
      </T>
      <T x={74} y={rmsY - 3} size={2.8} anchor="start" weight={600} color={HEAT} o={rmsO}>
        有效值
      </T>
      <T x={74} y={rmsY + 2.6} size={2.4} anchor="start" color={MUTED} o={rmsO * enter(t, b.rms + 0.6)}>
        和它发热相同的直流
      </T>
      <T x={50} y={48} size={5} o={enter(t, b.k)} scale={still ? 1 : lerp(1.12, 1, enter(t, b.k, 0.5))}>
        <span className="inline-flex items-center gap-[0.3em]">
          <M c={HEAT}>有效值</M>
          <M>≈</M>
          <M className="tabular">0.707</M>
          <M>×</M>
          <M c={VOLT}>幅度</M>
        </span>
      </T>
    </>
  )
}

// ── DC bias ─────────────────────────────────────────────────────────────────

function Bias({ t, b, still }: StageProps) {
  const mv = still ? 0 : t
  const zero = 41
  const lift = glide(t, b.lift, 0, 15, 0.9)
  const cy = zero - lift
  const arrow = enter(t, b.bias - 0.1, 0.6)
  return (
    <>
      <Svg>
        <path d={`M8 ${zero} H84`} stroke={BORDER} strokeDasharray="0.8 0.8" />
        <path d={sinePath(8, 74, cy, 8, 2.2, mv * 0.06)} stroke={VOLT} strokeWidth={0.55} />
        {lift > 0.3 && <path d={`M8 ${cy} H76`} stroke={BIAS} strokeWidth={0.3} strokeDasharray="0.8 0.8" opacity={0.9} />}
        {lift > 0.5 && <path d={vArrow(80, zero, cy)} stroke={BIAS} opacity={arrow} />}
      </Svg>
      <T x={6.5} y={zero} size={2.2} anchor="end" color={MUTED} o={enter(t, b.ln_bias + 0.3)}>
        0
      </T>
      <T x={83} y={(zero + cy) / 2} size={3} anchor="start" weight={600} color={BIAS} o={arrow}>
        直流偏置
      </T>
      <T x={50} y={8} size={3.4} color={MUTED} o={enter(t, b.ln_bias + 0.3)}>
        整个波形抬高了
      </T>
    </>
  )
}

// ── phase ───────────────────────────────────────────────────────────────────

function Phase({ t, b }: StageProps) {
  const L = 30 // one cycle, stage units
  const X0 = 8
  const YC = 32
  const shift = glide(t, b.two, 0, 0.25, 1.2) // cycles
  const second = enter(t, b.two - 0.1, 0.5)
  const crest1 = X0 + L / 4
  const crest2 = crest1 + shift * L
  const bracket = enter(t, b.two + 1.1, 0.5)
  // the dial: one full turn while "360°" is spoken
  const turn = easeInOut((t - (b.p360 - 0.2)) / 1.2)
  const ang = -Math.PI / 2 + turn * TAU
  const DX = 82
  const DY = 32
  const R = 9
  const dial = enter(t, b.p360 - 0.2)
  return (
    <>
      <Svg>
        <path d={`M${X0} ${YC} H68`} stroke={BORDER} />
        <Draw d={sinePath(X0, 68, YC, 10, 2)} p={enter(t, b.phase, 1.2)} stroke={VOLT} strokeWidth={0.55} />
        {second > 0.01 && <path d={sinePath(X0, 68, YC, 10, 2, shift)} stroke={AMP} strokeWidth={0.55} opacity={second} />}
        <g opacity={bracket} stroke={MUTED} strokeWidth={0.25}>
          <path d={`M${crest1} 17 V13 H${crest2} V17`} />
        </g>
        <g opacity={dial} stroke={BORDER}>
          <circle cx={DX} cy={DY} r={R} />
        </g>
        {dial > 0.01 && (
          <g opacity={dial}>
            <path d={`M${DX} ${DY} L${DX + R * Math.cos(ang)} ${DY + R * Math.sin(ang)}`} stroke={VOLT} strokeWidth={0.5} />
            <Draw d={`M${DX} ${DY - R} A${R} ${R} 0 ${turn > 0.5 ? 1 : 0} 1 ${DX + R * Math.cos(ang)} ${DY + R * Math.sin(ang)}`} p={turn > 0.001 ? 1 : 0} stroke={VOLT} strokeWidth={0.3} />
          </g>
        )}
      </Svg>
      <T x={(crest1 + crest2) / 2} y={10} size={3} weight={600} o={bracket} className="tabular">
        <M>90°</M>
      </T>
      <T x={DX} y={DY - R - 3.2} size={2.6} color={MUTED} o={dial}>
        一个周期
      </T>
      {/* under the dial, clear of the hand */}
      <T x={DX} y={DY + R + 3.8} size={3.6} weight={600} o={enter(t, b.p360 + 0.9, 0.4)} className="tabular">
        <M>360°</M>
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "波形与它的参数",
  audio,
  timing,
  poster: 5.2,
  Stage,
}

export default function WaveformsFilm() {
  return <FilmPlayer film={film} />
}

void leave

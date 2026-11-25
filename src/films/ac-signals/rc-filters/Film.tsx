import type { ReactNode } from "react"
import { trace } from "@/lab/colors"
import { Capacitor, Resistor } from "@/lab/schematic"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, Frac, M, Scene, Svg, Sym, T, V, Sub, easeInOut, enter, glide, lerp, span, type FilmDef, type StageProps } from "../../kit"
import { TAU, curve, hArrow, logX, sinePath, vArrow } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

const VOLT = trace.voltage
const AMP = trace.current
const CAP = trace.second
const GOOD = trace.good
const HEAT = trace.power
const MUTED = "var(--muted-foreground)"
const BORDER = "var(--border)"
const FAINT = "var(--faint-foreground)"

/*
 * RC 滤波器, ~70 s. Scenes, each keyed to its words:
 *   one persistent bench (circuit left, input and output waves right): the circuit appears, becomes
 *   a divider, a frequency sweep shrinks the output (low-pass), then R and C swap (high-pass) →
 *   the gain curve with the cutoff and 0.707 → fc = 1 / 2πRC → the worked 1 kΩ-ish example →
 *   the Bode plot with the ×10 / ÷10 steps → "try it below".
 */
function Stage({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.6) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)
  const bench = span(t, 0.25, b.ln_fc - 0.45)
  const curveS = span(t, b.ln_fc - 0.2, b.ln_form - 0.45)
  const form = span(t, b.ln_form - 0.2, b.ex - 0.45)
  const ex = span(t, b.ex - 0.2, b.ln_roll - 0.15)
  const bode = span(t, b.ln_roll - 0.05, b.outro - 0.45)
  const outro = enter(t, b.outro - 0.1, 0.5)
  return (
    <>
      <Scene o={bench}>
        <Bench t={t} b={b} still={still} rise={rise} />
      </Scene>
      <Scene o={curveS}>
        <Cutoff t={t} b={b} still={still} rise={rise} />
      </Scene>
      <Scene o={form}>
        <Formula t={t} b={b} still={still} rise={rise} />
      </Scene>
      <Scene o={ex}>
        <Example t={t} b={b} still={still} rise={rise} />
      </Scene>
      <Scene o={bode}>
        <Bode t={t} b={b} still={still} />
      </Scene>
      <Scene o={outro}>
        <T x={50} y={24} size={6} weight={600} dy={rise(b.outro)}>
          动手试试
        </T>
        <T x={50} y={32.5} size={2.8} color={MUTED} o={enter(t, b.drag)} dy={rise(b.drag, 1)}>
          拖动下面实验台的频率滑块
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

// ── the bench: circuit + input / output waves ───────────────────────────────

const lpGain = (r: number) => 1 / Math.sqrt(1 + r * r)
const hpGain = (r: number) => r / Math.sqrt(1 + r * r)

function Bench({ t, b, still, rise }: P) {
  const mv = still ? 0 : t
  const ox = glide(t, b.ln_div - 0.1, 50, 27, 0.9)
  const swap = enter(t, b.swap, 0.7) // 0 = low-pass, 1 = high-pass
  // the frequency, as a log ratio to the cutoff: parked low, swept up for the low-pass, parked high, swept down for the high-pass
  const sweepUp = glide(t, b.block - 0.8, -1, 1.3, 2.6)
  const sweepDown = glide(t, b.hp - 0.3, 1.3, -1, 1.9)
  const logr = t < b.swap ? sweepUp : sweepDown
  const r = Math.pow(10, logr)
  const gain = lerp(lpGain(r), hpGain(r), swap)
  const cycles = 2 + (3 * (logr + 1)) / 2
  const lag = lerp(-Math.atan(r), Math.PI / 2 - Math.atan(r), swap) / TAU
  const wavesO = enter(t, b.vary - 0.3, 0.6)
  const circ = enter(t, b.intro + 0.8, 0.6)
  const bat = 26

  const wires = enter(t, b.r - 0.2, 0.9)
  const nodeX = ox + 13
  const shuntTop = 29
  const dim = (k: number) => k // readability

  const rO = enter(t, b.r, 0.5)
  const cO = enter(t, b.c, 0.5)
  // series part: R then (after the swap) C. shunt part: C then R.
  const seriesR = rO * (1 - swap)
  const seriesC = cO * swap
  const shuntC = cO * (1 - swap)
  const shuntR = rO * swap
  const shortO = enter(t, b.gnd, 0.5) * (1 - swap) * (1 - enter(t, b.ln_swap - 0.3, 0.4))
  void dim

  return (
    <>
      <T x={50} y={9} size={5.6} weight={600} o={enter(t, 0.3, 0.6) * (1 - enter(t, b.ln_div - 0.3, 0.3))} dy={rise(0.3)}>
        RC 滤波器
      </T>

      <Svg>
        <Draw d={`M${ox - 20} ${bat} H${ox - 14} M${ox + 4} ${bat} H${ox + 20}`} p={wires} />
        <Draw d={`M${nodeX} ${bat} V${shuntTop}`} p={wires} />
        <Draw d={`M${nodeX} 47 V48.4 M${nodeX - 2.4} 48.4 H${nodeX + 2.4} M${nodeX - 1.5} 49.6 H${nodeX + 1.5}`} p={enter(t, b.c, 0.6)} />
        <g opacity={circ}>
          <circle cx={ox - 20} cy={bat} r={0.8} />
          <circle cx={ox + 20} cy={bat} r={0.8} />
          <circle cx={nodeX} cy={bat} r={0.55} fill="currentColor" />
        </g>
        <Sym x={ox - 5} y={bat} scale={0.3} opacity={seriesR}>
          <Resistor x={0} y={0} />
        </Sym>
        <Sym x={ox - 5} y={bat} scale={0.3} opacity={seriesC} color={CAP}>
          <Capacitor x={0} y={0} />
        </Sym>
        <Sym x={nodeX} y={38} scale={0.3} opacity={shuntC} color={CAP}>
          <Capacitor x={0} y={0} rot={90} />
        </Sym>
        <Sym x={nodeX} y={38} scale={0.3} opacity={shuntR}>
          <Resistor x={0} y={0} rot={90} />
        </Sym>
        {/* the short to ground: the capacitor's path lights up at high frequency */}
        <g opacity={shortO * 0.9} stroke={HEAT} strokeWidth={0.55}>
          <path d={`M${nodeX - 5} ${bat + 2.5} V${44.5} M${nodeX - 6.3} ${42.4} L${nodeX - 5} ${44.5} L${nodeX - 3.7} ${42.4}`} />
        </g>

        {/* waves */}
        <g opacity={wavesO}>
          <path d="M56 20 H94 M56 40 H94" stroke={BORDER} />
        </g>
        {wavesO > 0.01 && (
          <>
            <path d={sinePath(56, 94, 20, 5.5, cycles, mv * 0.5)} stroke={FAINT} strokeWidth={0.5} opacity={wavesO} />
            <path d={sinePath(56, 94, 40, 5.5 * gain + 0.01, cycles, mv * 0.5 + lag)} stroke={VOLT} strokeWidth={0.6} opacity={wavesO} />
          </>
        )}
      </Svg>

      <T x={ox - 20} y={bat - 4.8} size={2.2} color={MUTED} o={circ}>
        输入
      </T>
      <T x={ox + 20} y={bat - 4.8} size={2.2} color={MUTED} o={circ}>
        输出
      </T>
      <T x={ox - 5} y={bat - 6.4} size={2.6} o={seriesR}>
        电阻
      </T>
      <T x={ox - 5} y={bat - 6.4} size={2.6} color={CAP} o={seriesC}>
        电容
      </T>
      <T x={nodeX + 4.5} y={38} size={2.6} anchor="start" color={CAP} o={shuntC}>
        电容
      </T>
      <T x={nodeX + 4.5} y={38} size={2.6} anchor="start" o={shuntR}>
        电阻
      </T>
      <T x={nodeX - 6.5} y={bat + 6.5} size={2.4} anchor="end" weight={600} color={HEAT} o={shortO}>
        短路
      </T>

      <T x={27} y={14} size={3.2} o={enter(t, b.div, 0.5) * (1 - enter(t, b.lp - 0.4, 0.3))} dy={rise(b.div, 1)}>
        <span className="inline-flex items-center gap-[0.35em]">
          <M>输出</M>
          <M>=</M>
          <M>输入</M>
          <M>×</M>
          <M c={VOLT}>分压比</M>
        </span>
      </T>

      {/* the filter's name, from the words that give it */}
      <Tag t={t} at={b.lp} off={b.ln_swap - 0.3} x={27} y={14}>
        低通：低频通过，高频被挡
      </Tag>
      <Tag t={t} at={b.hp} off={b.ln_fc - 0.45} x={27} y={14}>
        高通：高频通过，低频被挡
      </Tag>

      <T x={75} y={11} size={2.4} color={MUTED} o={wavesO}>
        输入
      </T>
      <T x={75} y={30} size={2.4} color={VOLT} o={wavesO}>
        输出
      </T>
      <T x={75} y={50.5} size={3.2} o={wavesO} className="tabular">
        <M>输出 ÷ 输入 = </M>
        <M c={VOLT} className="font-semibold">
          {gain.toFixed(2)}
        </M>
      </T>
    </>
  )
}

/** A line of text that swaps in at `at` and out at `off`. */
function Tag({ t, at, off, x, y, children }: { t: number; at: number; off: number; x: number; y: number; children: ReactNode }) {
  return (
    <T x={x} y={y} size={3.2} weight={600} o={span(t, at, off, 0.4, 0.3)}>
      {children}
    </T>
  )
}

// ── the gain curve with its cutoff ──────────────────────────────────────────

const GX0 = 12
const GX1 = 88
const GY0 = 46
const GY1 = 12
const gx = (r: number) => logX(r, 0.01, 100, GX0, GX1)
const gy = (g: number) => GY0 - (GY0 - GY1) * g

function Cutoff({ t, b, still, rise }: P) {
  const base = b.ln_fc
  const drawn = enter(t, base + 0.2, 1.6)
  void still
  const path = curve(80, (u) => {
    const r = 0.01 * Math.pow(1e4, u * drawn)
    return [gx(r), gy(lpGain(r))]
  })
  return (
    <>
      <Svg>
        <g stroke={BORDER} opacity={enter(t, base, 0.5)}>
          <path d={`M${GX0} ${GY1 - 2} V${GY0} H${GX1 + 1}`} />
        </g>
        <Draw d={path} p={drawn > 0.002 ? 1 : 0} stroke={VOLT} strokeWidth={0.6} />
        <Draw d={`M${gx(1)} ${GY1 - 1} V${GY0}`} p={enter(t, b.fc - 0.1, 0.6)} stroke={AMP} strokeWidth={0.35} strokeDasharray="0.9 0.9" />
        <g opacity={enter(t, b.k - 0.2, 0.4)}>
          <circle cx={gx(1)} cy={gy(0.7071)} r={0.9} fill={AMP} stroke="none" />
          <path d={`M${GX0} ${gy(0.7071)} H${gx(1)}`} stroke={AMP} strokeWidth={0.25} strokeDasharray="0.8 0.8" />
        </g>
      </Svg>
      <T x={GX0 - 1} y={gy(1)} size={2.2} anchor="end" color={MUTED} o={enter(t, base)} className="tabular">
        1
      </T>
      <T x={GX0 - 1} y={GY0} size={2.2} anchor="end" color={MUTED} o={enter(t, base)} className="tabular">
        0
      </T>
      <T x={GX0 + 1} y={GY1 - 4.2} size={2.2} anchor="start" color={MUTED} o={enter(t, base)}>
        输出 ÷ 输入
      </T>
      <T x={GX1} y={GY0 + 3.4} size={2.2} anchor="end" color={MUTED} o={enter(t, base)}>
        频率 <V>f</V>
      </T>
      <T x={26} y={17} size={2.8} weight={600} color={GOOD} o={enter(t, base + 0.6)} dy={rise(base + 0.6, 1)}>
        通过
      </T>
      <T x={76} y={39} size={2.8} weight={600} color={HEAT} o={enter(t, base + 1.2)} dy={rise(base + 1.2, 1)}>
        被挡
      </T>
      <T x={gx(1)} y={GY0 + 3.4} size={2.8} weight={600} color={AMP} o={enter(t, b.fc)}>
        截止频率 <V>f</V>
        <M>
          <sub style={{ fontSize: "0.6em" }}>c</sub>
        </M>
      </T>
      <T x={gx(1) + 2.5} y={gy(0.7071) - 3} size={3.4} weight={600} anchor="start" color={AMP} o={enter(t, b.k)} className="tabular">
        <M>0.707</M>
      </T>
    </>
  )
}

// ── fc = 1 / 2πRC ───────────────────────────────────────────────────────────

function Formula({ t, b, rise }: P) {
  const base = b.ln_form
  return (
    <>
      <T x={50} y={22} size={8}>
        <span className="inline-flex items-center gap-[0.3em]">
          <span className="relative inline-block" style={{ opacity: enter(t, base + 0.1) }}>
            <V c={AMP}>f</V>
            <M c={AMP}>
              <sub style={{ fontSize: "0.55em" }}>c</sub>
            </M>
          </span>
          <span style={{ opacity: enter(t, base + 0.3) }}>
            <M>=</M>
          </span>
          <Frac
            top={<M>1</M>}
            bottom={
              <span className="inline-flex items-center gap-[0.2em]">
                <M>2π</M>
                <span className="relative inline-block" style={{ opacity: enter(t, b.form + 1.0) }}>
                  <V>R</V>
                  <Sub>电阻</Sub>
                </span>
                <span className="relative inline-block" style={{ opacity: enter(t, b.form + 1.5), marginLeft: "0.1em" }}>
                  <V c={CAP}>C</V>
                  <Sub>电容</Sub>
                </span>
              </span>
            }
            bar={enter(t, b.form, 0.5)}
          />
        </span>
      </T>
      <T x={50} y={42} size={3} color={MUTED} o={enter(t, b.form + 2.0)} dy={rise(b.form + 2.0, 1)}>
        <V>R</V> 或 <V c={CAP}>C</V> 越大，截止频率越低
      </T>
    </>
  )
}

// ── the worked example ──────────────────────────────────────────────────────

function Example({ t, b, still, rise }: P) {
  return (
    <>
      <Svg>
        <Sym x={28} y={18} scale={0.3} opacity={enter(t, b.e1, 0.4)}>
          <Resistor x={0} y={0} />
        </Sym>
        <Sym x={72} y={18} scale={0.3} opacity={enter(t, b.e2, 0.4)} color={CAP}>
          <Capacitor x={0} y={0} />
        </Sym>
        <Draw d="M50 29 V34 M48.3 32.2 L50 34 L51.7 32.2" p={enter(t, b.e3 - 0.5, 0.5)} stroke={MUTED} strokeWidth={0.35} />
      </Svg>
      <T x={28} y={26.5} size={3.6} weight={600} o={enter(t, b.e1 + 0.1)} dy={rise(b.e1, 1)}>
        <M>1.5 kΩ</M>
      </T>
      <T x={72} y={26.5} size={3.6} weight={600} color={CAP} o={enter(t, b.e2 + 0.1)} dy={rise(b.e2, 1)}>
        <M>100 nF</M>
      </T>
      <T x={50} y={42} size={7} o={enter(t, b.e3)} scale={still ? 1 : lerp(1.12, 1, easeInOut((t - b.e3) / 0.5))}>
        <span className="inline-flex items-center gap-[0.3em]">
          <span>
            <V c={AMP}>f</V>
            <M c={AMP}>
              <sub style={{ fontSize: "0.55em" }}>c</sub>
            </M>
          </span>
          <M>≈</M>
          <M c={AMP} className="font-semibold tabular">
            1 kHz
          </M>
        </span>
      </T>
    </>
  )
}

// ── the Bode plot ───────────────────────────────────────────────────────────

const bx = (r: number) => logX(r, 0.01, 100, GX0, GX1)
const by = (db: number) => 12 - db * 0.85

function Bode({ t, b, still }: StageProps) {
  void still
  const drawn = enter(t, b.ln_roll + 0.3, 1.6)
  const path = curve(90, (u) => {
    const r = 0.01 * Math.pow(1e4, u * drawn)
    return [bx(r), by(-10 * Math.log10(1 + r * r))]
  })
  const axes = enter(t, b.ln_roll + 0.15, 0.5)
  const stepO = enter(t, b.roll - 0.1, 0.5)
  const dropO = enter(t, b.tenth - 0.6, 0.6)
  return (
    <>
      <Svg>
        <g stroke={BORDER} opacity={axes}>
          <path d={`M${GX0} ${by(5)} V${by(-40) + 1} H${GX1 + 1}`} />
          <path d={`M${GX0} ${by(-20)} H${GX1} M${GX0} ${by(-40)} H${GX1}`} strokeDasharray="0.6 1" strokeWidth={0.2} />
        </g>
        <Draw d={path} p={drawn > 0.002 ? 1 : 0} stroke={VOLT} strokeWidth={0.6} />
        <g opacity={stepO} stroke={AMP} strokeWidth={0.4}>
          <path d={hArrow(bx(1), bx(10), 13.2)} />
        </g>
        <g opacity={dropO} stroke={HEAT} strokeWidth={0.4}>
          <path d={vArrow(bx(10), 14.6, by(-20.04) - 0.5)} />
        </g>
        <g opacity={dropO}>
          <circle cx={bx(10)} cy={by(-20.04)} r={0.8} fill={HEAT} stroke="none" />
        </g>
      </Svg>
      <T x={(bx(1) + bx(10)) / 2} y={9.6} size={3} weight={600} color={AMP} o={stepO} className="tabular">
        <M>× 10</M>
      </T>
      <T x={bx(10) + 3} y={22} size={3} anchor="start" weight={600} color={HEAT} o={enter(t, b.tenth)} className="tabular">
        <M>÷ 10</M>
      </T>
      <T x={bx(10) + 3} y={26.5} size={2.2} anchor="start" color={MUTED} o={enter(t, b.tenth + 0.5)} className="tabular">
        <M>−20 dB</M>
      </T>
      <T x={GX0 - 1} y={by(0)} size={2.2} anchor="end" color={MUTED} o={enter(t, b.ln_roll + 0.9)} className="tabular">
        <M>0</M>
      </T>
      <T x={GX0 - 1} y={by(-20)} size={2.2} anchor="end" color={MUTED} o={enter(t, b.ln_roll + 0.9)} className="tabular">
        <M>−20</M>
      </T>
      <T x={GX0 - 1} y={by(-40)} size={2.2} anchor="end" color={MUTED} o={enter(t, b.ln_roll + 0.9)} className="tabular">
        <M>−40</M>
      </T>
      <T x={GX0 + 1} y={5.5} size={2.4} anchor="start" color={MUTED} o={enter(t, b.bode + 1.8)}>
        增益 <M>dB</M>
      </T>
      <T x={GX1} y={by(-40) + 3.6} size={2.4} anchor="end" color={MUTED} o={enter(t, b.ln_roll + 0.9)}>
        频率（对数刻度）
      </T>
      <T x={bx(1)} y={by(-40) + 3.6} size={2.2} color={AMP} o={enter(t, b.bode + 1.0)}>
        <V>f</V>
        <M>
          <sub style={{ fontSize: "0.6em" }}>c</sub>
        </M>
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "RC 滤波器",
  audio,
  timing,
  poster: 5,
  Stage,
}

export default function RcFiltersFilm() {
  return <FilmPlayer film={film} />
}

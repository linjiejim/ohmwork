import { trace } from "@/lab/colors"
import { Capacitor, Inductor, Resistor } from "@/lab/schematic"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, M, Scene, Svg, Sym, T, V, easeOut, enter, lerp, span, type FilmDef, type StageProps } from "../../kit"
import { Pill, TAU, curve, hArrow, logX, sinePath } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

const VOLT = trace.voltage
const AMP = trace.current
const XC = trace.second
const XL = trace.third
const HEAT = trace.power
const MUTED = "var(--muted-foreground)"
const BORDER = "var(--border)"

/*
 * 容抗、感抗与阻抗, ~70 s. Scenes, each keyed to its words:
 *   title (R, C, L with a tiny |Z|-versus-frequency sketch under each) → the reactance chart
 *   (Xc falls, XL rises, two worked points) → DC / AC through a capacitor and an inductor →
 *   current leads / lags voltage by 90° → power lobes that cancel → Z = R + X, size and phase →
 *   the right triangle with 1 kΩ, 1.59 kΩ, 1.88 kΩ → "try it below".
 */
function Stage({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.6) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)

  const title = span(t, 0.25, b.ln_xc - 0.45)
  const react = span(t, b.ln_xc - 0.2, b.rule - 0.45)
  const rule = span(t, b.rule - 0.2, b.phase - 0.45)
  // the phase and power scenes hold until their last words have been read
  const phase = span(t, b.phase - 0.2, b.ln_store - 0.15)
  const store = span(t, b.ln_store - 0.1, b.ln_z - 0.05)
  const zed = span(t, b.ln_z - 0.05, b.ln_tri - 0.45)
  const tri = span(t, b.ln_tri - 0.2, b.outro - 0.45)
  const outro = enter(t, b.outro - 0.1, 0.5)

  return (
    <>
      <Scene o={title}>
        <Title t={t} b={b} still={still} rise={rise} />
      </Scene>
      <Scene o={react}>
        <Reactance t={t} b={b} still={still} />
      </Scene>
      <Scene o={rule}>
        <Rule t={t} b={b} still={still} />
      </Scene>
      <Scene o={phase}>
        <PhaseScene t={t} b={b} still={still} />
      </Scene>
      <Scene o={store}>
        <Store t={t} b={b} still={still} />
      </Scene>
      <Scene o={zed}>
        <Zed t={t} b={b} still={still} rise={rise} />
      </Scene>
      <Scene o={tri}>
        <Triangle t={t} b={b} still={still} rise={rise} />
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

type Rise = (at: number, d?: number) => number
type P = StageProps & { rise?: Rise }

// ── title: three parts, three sketches ──────────────────────────────────────

function Title({ t, b, rise }: P) {
  const cols = [
    { x: 20, name: "电阻", at: b.res, color: undefined as string | undefined },
    { x: 50, name: "电容", at: b.cl, color: XC },
    { x: 80, name: "电感", at: b.cl + 0.55, color: XL },
  ]
  const GY0 = 41
  const GY1 = 51
  return (
    <>
      <T x={50} y={9} size={5} weight={600} o={enter(t, 0.3, 0.6)} dy={rise?.(0.3)}>
        阻力，随频率变吗？
      </T>
      <Svg>
        <Sym x={20} y={25} scale={0.3} opacity={enter(t, b.res)}>
          <Resistor x={0} y={0} />
        </Sym>
        <Sym x={50} y={25} scale={0.3} opacity={enter(t, b.cl)} color={XC}>
          <Capacitor x={0} y={0} />
        </Sym>
        <Sym x={80} y={25} scale={0.3} opacity={enter(t, b.cl + 0.55)} color={XL}>
          <Inductor x={0} y={0} />
        </Sym>
        {cols.map((c) => (
          <g key={c.x} opacity={enter(t, c.at + 0.2)} stroke={BORDER}>
            <path d={`M${c.x - 11} ${GY0 - 1} V${GY1} H${c.x + 11}`} />
          </g>
        ))}
        <Draw d={`M9 ${(GY0 + GY1) / 2} H31`} p={enter(t, b.res + 0.4, 0.8)} stroke="var(--foreground)" strokeWidth={0.5} />
        <Draw d={curve(40, (u) => [39 + 22 * u, GY1 - 1 - 8 * Math.exp(-3 * u)])} p={enter(t, b.cl + 0.4, 0.8)} stroke={XC} strokeWidth={0.5} />
        <Draw d={curve(40, (u) => [69 + 22 * u, GY0 + 1 + 8 * Math.exp(-3 * u)])} p={enter(t, b.cl + 0.95, 0.8)} stroke={XL} strokeWidth={0.5} />
      </Svg>
      {cols.map((c) => (
        <T key={c.name} x={c.x} y={33} size={3.2} weight={600} color={c.color} o={enter(t, c.at)}>
          {c.name}
        </T>
      ))}
      <T x={50} y={38} size={2.2} color={MUTED} o={enter(t, b.cl + 0.9)}>
        阻力随频率的变化
      </T>
    </>
  )
}

// ── the reactance chart ─────────────────────────────────────────────────────

const PX0 = 56
const PX1 = 93
const PY0 = 47
const PY1 = 14
const F0 = 10
const F1 = 1e7
const xOf = (f: number) => logX(f, F0, F1, PX0, PX1)
const yOf = (ohm: number) => PY0 - ((Math.log10(ohm) + 1.5) / 7.5) * (PY0 - PY1)
const xc = (f: number) => 1 / (TAU * f * 100e-9)
const xl = (f: number) => TAU * f * 10e-3

function Reactance({ t, b, still }: StageProps) {
  const cLine = enter(t, b.cup - 0.2, 2.2)
  const lLine = enter(t, b.lup - 0.2, 2.2)
  const path = (fn: (f: number) => number, p: number) =>
    curve(60, (u) => {
      const f = F0 * Math.pow(F1 / F0, u * p)
      return [xOf(f), yOf(fn(f))]
    })
  const fOf = (p: number) => F0 * Math.pow(F1 / F0, p)
  const leftOut = span(t, 0, b.nums - 0.15, 0.01, 0.3)
  void leftOut
  const forms = 1 - enter(t, b.nums - 0.15, 0.4)
  const nums = enter(t, b.nums + 0.1)
  const showDots = enter(t, b.n50, 0.4)
  return (
    <>
      <Svg>
        <g opacity={enter(t, b.ln_xc + 0.2, 0.6)} stroke={BORDER}>
          <path d={`M${PX0} ${PY1 - 1} V${PY0} H${PX1 + 1}`} />
        </g>
        {cLine > 0.01 && <path d={path(xc, cLine)} stroke={XC} strokeWidth={0.55} />}
        {lLine > 0.01 && <path d={path(xl, lLine)} stroke={XL} strokeWidth={0.55} />}
        {cLine > 0.01 && <circle cx={xOf(fOf(cLine))} cy={yOf(xc(fOf(cLine)))} r={0.7} fill={XC} stroke="none" opacity={1 - showDots} />}
        {lLine > 0.01 && <circle cx={xOf(fOf(lLine))} cy={yOf(xl(fOf(lLine)))} r={0.7} fill={XL} stroke="none" opacity={1 - showDots} />}
        <g opacity={showDots}>
          <circle cx={xOf(50)} cy={yOf(xc(50))} r={0.9} fill={XC} stroke="none" />
        </g>
        <g opacity={enter(t, b.n1m, 0.4)}>
          <circle cx={xOf(1e6)} cy={yOf(xc(1e6))} r={0.9} fill={XC} stroke="none" />
        </g>
      </Svg>
      <T x={PX0 - 0.5} y={PY1 - 3.5} size={2.2} anchor="start" color={MUTED} o={enter(t, b.ln_xc + 0.3)}>
        阻力 <M>Ω</M>
      </T>
      <T x={PX1} y={PY0 + 3.2} size={2.2} anchor="end" color={MUTED} o={enter(t, b.ln_xc + 0.3)}>
        频率 <V>f</V>
      </T>
      <T x={PX1} y={35.5} size={2.6} anchor="end" weight={600} color={XC} o={enter(t, b.cup + 1.2)}>
        容抗
      </T>
      <T x={PX1} y={PY1 - 3.2} size={2.6} anchor="end" weight={600} color={XL} o={enter(t, b.lup + 1.2)}>
        感抗
      </T>
      <T x={xOf(50) + 1.5} y={yOf(xc(50)) - 3} size={2.1} anchor="start" color={XC} o={showDots} className="tabular">
        <M>50 Hz</M>
      </T>
      <T x={xOf(1e6) - 1} y={yOf(xc(1e6)) + 3} size={2.1} anchor="end" color={XC} o={enter(t, b.n1m, 0.4)} className="tabular">
        <M>1 MHz</M>
      </T>

      {/* the formulas, then the two worked points */}
      <T x={27} y={22} size={5} o={enter(t, b.ln_xc + 0.1) * forms} dy={still ? 0 : (1 - enter(t, b.ln_xc + 0.1, 0.5)) * 1.2}>
        <span className="inline-flex items-center gap-[0.25em]">
          <V c={XC}>X</V>
          <M c={XC}>
            <sub style={{ fontSize: "0.6em" }}>C</sub>
          </M>
          <M>= 1 / 2π</M>
          <V>fC</V>
        </span>
      </T>
      <T x={27} y={36} size={5} o={enter(t, b.xl) * forms} dy={still ? 0 : (1 - enter(t, b.xl, 0.5)) * 1.2}>
        <span className="inline-flex items-center gap-[0.25em]">
          <V c={XL}>X</V>
          <M c={XL}>
            <sub style={{ fontSize: "0.6em" }}>L</sub>
          </M>
          <M>= 2π</M>
          <V>fL</V>
        </span>
      </T>
      <T x={27} y={15} size={2.8} color={MUTED} o={nums}>
        100 nF 的电容
      </T>
      <T x={27} y={25} size={4.4} o={enter(t, b.n50)} className="tabular">
        <M>
          50 Hz → <span style={{ color: XC }}>32 kΩ</span>
        </M>
      </T>
      <T x={27} y={36} size={4.4} o={enter(t, b.n1m)} className="tabular">
        <M>
          1 MHz → <span style={{ color: XC }}>1.6 Ω</span>
        </M>
      </T>
    </>
  )
}

// ── DC and AC through a capacitor and an inductor ───────────────────────────

function Rule({ t, b, still }: StageProps) {
  const mv = still ? 0 : t
  const R1 = 23 // DC row
  const R2 = 41 // AC row
  const panels = [
    { name: "电容", cx: 31, in0: 11, out0: 38, color: XC, at: b.cap, word: "隔直通交", dc: false, acAmp: 4.2, part: "C" },
    { name: "电感", cx: 74, in0: 54, out0: 81, color: XL, at: b.ind, word: "通直阻交", dc: true, acAmp: 1.1, part: "L" },
  ]
  const base = enter(t, b.rule + 0.2)
  return (
    <>
      <T x={4} y={R1} size={2.4} anchor="start" color={MUTED} o={base}>
        直流
      </T>
      <T x={4} y={R2} size={2.4} anchor="start" color={MUTED} o={base}>
        交流
      </T>
      <Svg>
        <path d="M52.5 8 V52" stroke={BORDER} strokeWidth={0.25} strokeDasharray="0.8 0.8" opacity={base} />
        {panels.map((p) => {
          const outO = enter(t, p.at - 0.1, 0.5)
          return (
            <g key={p.name}>
              <g opacity={base} stroke={BORDER}>
                <path d={`M${p.in0} ${R1 + 4} h13 M${p.in0} ${R2 + 6} h13`} strokeDasharray="0.6 0.8" />
                <path d={`M${p.out0} ${R1 + 4} h13 M${p.out0} ${R2 + 6} h13`} strokeDasharray="0.6 0.8" opacity={outO} />
              </g>
              <Draw d={`M${p.in0} ${R1} h13`} p={enter(t, b.rule + 0.3, 0.7)} stroke={VOLT} strokeWidth={0.5} />
              <Draw d={sinePath(p.in0, p.in0 + 13, R2, 4.2, 1.5, mv * 0.4)} p={enter(t, b.rule + 0.6, 0.7)} stroke={VOLT} strokeWidth={0.5} />
              <Draw d={`M${p.out0} ${p.dc ? R1 : R1 + 4} h13`} p={outO} stroke={p.dc ? VOLT : "var(--faint-foreground)"} strokeWidth={0.5} />
              <Draw d={sinePath(p.out0, p.out0 + 13, R2, p.acAmp, 1.5, mv * 0.4)} p={outO} stroke={VOLT} strokeWidth={0.5} />
              <Sym x={p.cx} y={32} scale={0.22} opacity={enter(t, b.rule + 0.1)} color={p.color}>
                {p.part === "C" ? <Capacitor x={0} y={0} /> : <Inductor x={0} y={0} />}
              </Sym>
            </g>
          )
        })}
      </Svg>
      {panels.map((p) => (
        <T key={p.name} x={p.cx} y={12} size={3.6} weight={600} color={p.color} o={enter(t, b.rule + 0.1)}>
          {p.name}
        </T>
      ))}
      {panels.map((p) => (
        <T key={p.word} x={p.cx} y={50.5} size={3.4} weight={600} o={enter(t, p.at)} dy={still ? 0 : (1 - enter(t, p.at, 0.5)) * 1}>
          {p.word}
        </T>
      ))}
    </>
  )
}

// ── current leads / lags voltage ────────────────────────────────────────────

function PhaseScene({ t, b }: StageProps) {
  const X0 = 22
  const X1 = 78
  const rows = [
    { y: 20, name: "电容", color: XC, shift: -0.25, at: b.lead - 0.6, note: "电流超前", bx: [50, 57] as const, nat: b.lead },
    { y: 43, name: "电感", color: XL, shift: 0.25, at: b.lag - 0.6, note: "电流滞后", bx: [57, 64] as const, nat: b.lag },
  ]
  return (
    <>
      <T x={4} y={8} size={2.4} anchor="start" color={VOLT} o={enter(t, b.phase + 0.2)}>
        电压
      </T>
      <T x={14} y={8} size={2.4} anchor="start" color={AMP} o={enter(t, b.phase + 0.4)}>
        电流
      </T>
      <Svg>
        {rows.map((r) => (
          <g key={r.name}>
            <path d={`M${X0} ${r.y} H${X1}`} stroke={BORDER} opacity={enter(t, r.at)} />
            <Draw d={sinePath(X0, X1, r.y, 5, 2)} p={enter(t, r.at, 1)} stroke={VOLT} strokeWidth={0.5} />
            <Draw d={sinePath(X0, X1, r.y, 5, 2, r.shift)} p={enter(t, r.at + 0.2, 1)} stroke={AMP} strokeWidth={0.5} />
            <g opacity={enter(t, r.nat + 0.2, 0.5)} stroke={MUTED} strokeWidth={0.25}>
              <path d={`M${r.bx[0]} ${r.y - 7.5} V${r.y - 10} H${r.bx[1]} V${r.y - 7.5}`} />
            </g>
          </g>
        ))}
      </Svg>
      {rows.map((r) => (
        <T key={r.name} x={4} y={r.y} size={3.2} weight={600} anchor="start" color={r.color} o={enter(t, r.at)}>
          {r.name}
        </T>
      ))}
      {rows.map((r) => (
        <T key={r.note} x={(r.bx[0] + r.bx[1]) / 2} y={r.y - 12.6} size={2.6} weight={600} o={enter(t, r.nat + 0.2, 0.5)} className="tabular">
          <M>90°</M>
        </T>
      ))}
      {rows.map((r) => (
        <T key={r.name + "n"} x={96} y={r.y} size={2.8} weight={600} anchor="end" color={AMP} o={enter(t, r.nat + 0.4, 0.5)}>
          {r.note}
        </T>
      ))}
    </>
  )
}

// ── power lobes ─────────────────────────────────────────────────────────────

function Store({ t, b, still }: StageProps) {
  const X0 = 10
  const X1 = 70
  const YC = 30
  const A = 9
  /** The power: v = sin, i = cos, so p = ½ sin 2θ, at twice the frequency of either. */
  const AP = 7
  const pw = (u: number) => YC - AP * Math.sin(TAU * 4 * u)
  const lobes = [0, 1, 2, 3, 4, 5, 6, 7]
  const p = enter(t, b.ln_store + 0.1, 1.6)
  const lobePath = (i: number) => `${curve(20, (k) => {
    const u = lerp(i / 8, (i + 1) / 8, k)
    return [X0 + (X1 - X0) * u, pw(u)]
  })} Z`
  void still
  return (
    <>
      <Svg>
        <path d={`M${X0} ${YC} H${X1}`} stroke={BORDER} />
        <Draw d={sinePath(X0, X1, YC, A, 2)} p={enter(t, b.ln_store, 1)} stroke={VOLT} strokeWidth={0.3} opacity={0.5} />
        <Draw d={sinePath(X0, X1, YC, A, 2, -0.25)} p={enter(t, b.ln_store + 0.2, 1)} stroke={AMP} strokeWidth={0.3} opacity={0.5} />
        {lobes.map((i) => (
          <path key={i} d={lobePath(i)} fill={HEAT} fillOpacity={0.22 * enter(t, b.store + i * 0.15, 0.5)} stroke="none" />
        ))}
        <Draw d={curve(160, (u) => [X0 + (X1 - X0) * u, pw(u)])} p={p} stroke={HEAT} strokeWidth={0.55} />
      </Svg>
      {[0, 1].map((i) => (
        <T key={i} x={X0 + (X1 - X0) * ((i + 0.5) / 8)} y={i === 0 ? YC - A - 3.2 : YC + A + 3.2} size={2.4} color={HEAT} o={enter(t, b.store + i * 0.15 + 0.2, 0.5)}>
          {i === 0 ? "吸收" : "归还"}
        </T>
      ))}
      <T x={84} y={YC - 6} size={2.6} color={MUTED} o={enter(t, b.ln_store + 0.6)}>
        功率
      </T>
      <T x={84} y={YC + 1} size={4.6} weight={600} color={HEAT} o={enter(t, b.heat)} scale={still ? 1 : lerp(1.15, 1, enter(t, b.heat, 0.5))}>
        平均 0
      </T>
      <T x={84} y={YC + 8} size={3} color={MUTED} o={enter(t, b.heat + 0.3)}>
        不发热
      </T>
    </>
  )
}

// ── Z = R + X: size and phase ───────────────────────────────────────────────

function Zed({ t, b, rise }: P) {
  const r = enter(t, b.ln_z + 0.3)
  return (
    <>
      <T x={26} y={14} size={4.4} o={r} dy={rise?.(b.ln_z + 0.3, 1)}>
        电阻 <V>R</V>
      </T>
      <T x={50} y={14} size={4.4} color={MUTED} o={enter(t, b.ln_z + 0.5)}>
        <M>+</M>
      </T>
      <T x={74} y={14} size={4.4} color={XC} o={enter(t, b.ln_z + 0.8)} dy={rise?.(b.ln_z + 0.8, 1)}>
        电抗 <V>X</V>
      </T>
      <Svg>
        <Draw d="M26 20 V25 H50 M74 20 V25 H50 M50 25 V29" p={enter(t, b.z - 0.5, 0.6)} stroke={MUTED} strokeWidth={0.25} />
      </Svg>
      <T x={50} y={35} size={6.4} weight={600} o={enter(t, b.z)} scale={rise ? lerp(1.12, 1, enter(t, b.z, 0.5)) : 1}>
        阻抗 <V>Z</V>
      </T>
      <Svg>
        <Draw d={hArrow(22, 38, 47)} p={enter(t, b.size, 0.6)} stroke={HEAT} strokeWidth={0.4} />
        <Draw d={sinePath(60, 78, 47, 2.6, 1.5)} p={enter(t, b.ph, 0.8)} stroke={VOLT} strokeWidth={0.4} />
        <Draw d={sinePath(60, 78, 47, 2.6, 1.5, 0.15)} p={enter(t, b.ph + 0.2, 0.8)} stroke={AMP} strokeWidth={0.4} />
      </Svg>
      <T x={30} y={42} size={3} o={enter(t, b.size)}>
        大小 <M>|</M>
        <V>Z</V>
        <M>|</M>
      </T>
      <T x={69} y={42} size={3} o={enter(t, b.ph)}>
        相位
      </T>
    </>
  )
}

// ── the right triangle ──────────────────────────────────────────────────────

function Triangle({ t, b, rise }: P) {
  const S = 20 // units per kΩ
  const O: [number, number] = [14, 48]
  const P1: [number, number] = [O[0] + 1 * S, O[1]]
  const Q: [number, number] = [P1[0], O[1] - 1.59 * S]
  const k = enter(t, b.nosum + 0.1, 1)
  const nums = (at: number) => enter(t, at, 0.4)
  return (
    <>
      <T x={70} y={11} size={4} o={enter(t, b.nosum)} dy={rise?.(b.nosum, 1)}>
        <span className="inline-flex items-center gap-[0.3em]">
          <M>|</M>
          <V>Z</V>
          <M>|</M>
          <M c={HEAT}>≠</M>
          <V>R</V>
          <M>+</M>
          <V>X</V>
        </span>
      </T>
      <Svg>
        <Draw d={`M${O[0]} ${O[1]} H${P1[0]}`} p={k} stroke="var(--foreground)" strokeWidth={0.5} />
        <Draw d={`M${P1[0]} ${P1[1]} V${Q[1]}`} p={enter(t, b.nosum + 0.8, 0.8)} stroke={XC} strokeWidth={0.5} />
        <Draw d={`M${O[0]} ${O[1]} L${Q[0]} ${Q[1]}`} p={enter(t, b.tri, 0.9)} stroke={AMP} strokeWidth={0.6} />
        <path d={`M${P1[0] - 2} ${P1[1]} v-2 h2`} opacity={enter(t, b.tri + 0.9)} strokeWidth={0.22} />
      </Svg>
      <T x={(O[0] + P1[0]) / 2} y={O[1] + 3.6} size={2.8} o={enter(t, b.nosum + 0.4) * (1 - nums(b.ex1))}>
        电阻 <V>R</V>
      </T>
      <T x={(O[0] + P1[0]) / 2} y={O[1] + 3.6} size={2.8} weight={600} o={nums(b.ex1)}>
        <M>1 kΩ</M>
      </T>
      <T x={P1[0] + 1.8} y={(P1[1] + Q[1]) / 2} size={2.8} anchor="start" color={XC} o={enter(t, b.nosum + 1.0) * (1 - nums(b.ex2))}>
        容抗 <V>X</V>
      </T>
      <T x={P1[0] + 1.8} y={(P1[1] + Q[1]) / 2} size={2.8} anchor="start" weight={600} color={XC} o={nums(b.ex2)}>
        <M>1.59 kΩ</M>
      </T>
      <T x={(O[0] + Q[0]) / 2 - 2} y={(O[1] + Q[1]) / 2 - 1.5} size={2.8} anchor="end" color={AMP} o={enter(t, b.tri + 0.3) * (1 - nums(b.exz))}>
        阻抗 <V>Z</V>
      </T>
      <T x={(O[0] + Q[0]) / 2 - 2} y={(O[1] + Q[1]) / 2 - 1.5} size={2.8} anchor="end" weight={600} color={AMP} o={nums(b.exz)}>
        <M>1.88 kΩ</M>
      </T>

      <T x={70} y={25} size={4.2} o={enter(t, b.tri + 0.8)} dy={rise?.(b.tri + 0.8, 1)}>
        <span className="inline-flex items-center gap-[0.25em]">
          <M>|</M>
          <V c={AMP}>Z</V>
          <M>| =</M>
          <M>√(</M>
          <V>R</V>
          <M>
            <sup style={{ fontSize: "0.6em" }}>2</sup>+
          </M>
          <V c={XC}>X</V>
          <M>
            <sup style={{ fontSize: "0.6em" }}>2</sup>)
          </M>
        </span>
      </T>
      <T x={70} y={36} size={3.2} color={MUTED} o={enter(t, b.ex2 + 0.4)} className="tabular">
        <M>
          1 + 1.59 = <span style={{ textDecoration: "line-through", textDecorationColor: "var(--muted-foreground)" }}>2.59</span> kΩ
        </M>
      </T>
      <T x={70} y={44.5} size={5.6} weight={600} color={AMP} o={nums(b.exz)} scale={rise ? lerp(1.12, 1, easeOut((t - b.exz) / 0.5)) : 1} className="tabular">
        <M>≈ 1.88 kΩ</M>
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "容抗、感抗与阻抗",
  audio,
  timing,
  poster: 5,
  Stage,
}

export default function ImpedanceFilm() {
  return <FilmPlayer film={film} />
}

void Pill

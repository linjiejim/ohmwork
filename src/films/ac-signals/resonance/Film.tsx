import { trace } from "@/lab/colors"
import { Capacitor, Inductor } from "@/lab/schematic"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, Frac, M, Scene, Svg, Sym, T, V, easeInOut, enter, glide, lerp, span, type FilmDef, type StageProps } from "../../kit"
import { TAU, curve, logX } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

const VOLT = trace.voltage
const AMP = trace.current
const CAP = trace.second
const IND = trace.third
const GOOD = trace.good
const MUTED = "var(--muted-foreground)"
const BORDER = "var(--border)"
const FAINT = "var(--faint-foreground)"

/*
 * LC 谐振, ~72 s. Scenes, each keyed to its words:
 *   a tank (L and C in a loop) whose two energy bars trade places and whose current dots turn round
 *   → f0 = 1 / 2π√LC with the worked 1 mH / 10 nF → XL and XC cross at f0 → impedance dips and
 *   current peaks (a band) → three R values, three peak widths (Q) → a radio dial and a crystal →
 *   a step edge rings through parasitic L and C → "try it below".
 */
function Stage({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.6) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)
  const tank = span(t, 0.25, b.ln_f0 - 0.45)
  const formula = span(t, b.ln_f0 - 0.2, b.ln_eq - 0.45)
  const eq = span(t, b.ln_eq - 0.2, b.series - 0.45)
  // the pass band holds until the Q line starts; the ringing holds until the outro
  const series = span(t, b.series - 0.2, b.ln_q - 0.1)
  const q = span(t, b.ln_q - 0.05, b.use - 0.45)
  const use = span(t, b.use - 0.2, b.ln_ring - 0.45)
  const ring = span(t, b.ln_ring - 0.2, b.outro - 0.2)
  const outro = enter(t, b.outro - 0.1, 0.5)
  const p = { t, b, still, rise }
  return (
    <>
      <Scene o={tank}>
        <Tank {...p} />
      </Scene>
      <Scene o={formula}>
        <Formula {...p} />
      </Scene>
      <Scene o={eq}>
        <Cross {...p} />
      </Scene>
      <Scene o={series}>
        <Series {...p} />
      </Scene>
      <Scene o={q}>
        <QScene {...p} />
      </Scene>
      <Scene o={use}>
        <Use {...p} />
      </Scene>
      <Scene o={ring}>
        <Ring {...p} />
      </Scene>
      <Scene o={outro}>
        <T x={50} y={24} size={6} weight={600} dy={rise(b.outro)}>
          动手试试
        </T>
        <T x={50} y={32.5} size={2.8} color={MUTED} o={enter(t, b.drag)} dy={rise(b.drag, 1)}>
          拖动下面实验台的电感和电容滑块
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

// ── the tank ────────────────────────────────────────────────────────────────

const TL = 28
const TR = 72
const TT = 22
const TB = 46
const PER = 2 * (TR - TL) + 2 * (TB - TT)

function onTank(d: number): [number, number] {
  const w = TR - TL
  const h = TB - TT
  const s = ((d % PER) + PER) % PER
  if (s < w) return [TL + s, TT]
  if (s < w + h) return [TR, TT + (s - w)]
  if (s < 2 * w + h) return [TR - (s - w - h), TB]
  return [TL, TB - (s - 2 * w - h)]
}

function Tank({ t, b, still, rise }: P) {
  const circ = enter(t, b.ind - 0.6, 0.8)
  const cO = enter(t, b.cap, 0.5)
  const lO = enter(t, b.ind, 0.5)
  const tau = still ? 0 : Math.max(0, t - b.disc)
  const W = TAU / 3.2
  const eC = still ? 1 : Math.cos(W * tau) ** 2
  const eL = still ? 0 : Math.sin(W * tau) ** 2
  const run = enter(t, b.disc - 0.2, 0.5)
  const shift = 0.5 * (PER / 3) * (1 - Math.cos(W * tau))
  const bars = enter(t, b.disc - 0.3, 0.6)
  return (
    <>
      <T x={50} y={9} size={5.6} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
        LC 谐振
      </T>
      <Svg>
        <Draw d={`M${TL} 25 V${TT} H${TR} V25`} p={circ} />
        <Draw d={`M${TL} 43 V${TB} H${TR} V43`} p={circ} />
        <Sym x={TL} y={34} scale={0.3} opacity={cO} color={CAP}>
          <Capacitor x={0} y={0} rot={90} />
        </Sym>
        <Sym x={TR} y={34} scale={0.3} opacity={lO} color={IND}>
          <Inductor x={0} y={0} rot={90} />
        </Sym>
        {run > 0.01 &&
          Array.from({ length: Math.floor(PER / 8) }, (_, i) => {
            const [x, y] = onTank(i * 8 + shift)
            const hidden = (x === TL || x === TR) && y > 24.2 && y < 43.8
            return hidden ? null : <circle key={i} cx={x} cy={y} r={0.55} fill={AMP} stroke="none" opacity={run} />
          })}
        <g opacity={bars} stroke="none">
          <rect x={17.5} y={44 - 16} width={3.2} height={16} fill="var(--muted)" />
          <rect x={17.5} y={44 - 16 * eC} width={3.2} height={16 * eC} fill={VOLT} />
          <rect x={79.3} y={44 - 16} width={3.2} height={16} fill="var(--muted)" />
          <rect x={79.3} y={44 - 16 * eL} width={3.2} height={16 * eL} fill={AMP} />
        </g>
      </Svg>
      <T x={TL} y={17} size={3} weight={600} color={CAP} o={cO}>
        电容
      </T>
      <T x={TR} y={17} size={3} weight={600} color={IND} o={lO}>
        电感
      </T>
      <T x={19} y={50.5} size={2.2} color={MUTED} o={bars}>
        电场能量
      </T>
      <T x={81} y={50.5} size={2.2} color={MUTED} o={bars}>
        磁场能量
      </T>
      <T x={50} y={34} size={3.2} weight={600} color={MUTED} o={enter(t, b.sing, 0.6) * (1 - bars)}>
        唱歌
      </T>
    </>
  )
}

// ── f0 ──────────────────────────────────────────────────────────────────────

function Formula({ t, b, still, rise }: P) {
  const base = b.ln_f0
  const fy = glide(t, b.e1 - 0.6, 25, 15, 0.8)
  return (
    <>
      <T x={50} y={fy} size={7}>
        <span className="inline-flex items-center gap-[0.3em]">
          <span className="relative inline-block" style={{ opacity: enter(t, base + 0.2) }}>
            <V c={AMP}>f</V>
            <M c={AMP}>
              <sub style={{ fontSize: "0.55em" }}>0</sub>
            </M>
          </span>
          <span style={{ opacity: enter(t, base + 0.4) }}>
            <M>=</M>
          </span>
          <span className="inline-flex items-center gap-[0.15em]" style={{ opacity: enter(t, b.only - 0.9) }}>
            <Frac
              top={<M>1</M>}
              bottom={
                <span className="inline-flex items-center gap-[0.1em]">
                  <M>2π</M>
                  <M>√(</M>
                  <V c={IND}>L</V>
                  <span style={{ opacity: enter(t, b.only - 0.3) }}>
                    <V c={CAP}>C</V>
                  </span>
                  <M>)</M>
                </span>
              }
              bar={enter(t, b.only - 0.8, 0.5)}
            />
          </span>
        </span>
      </T>
      <T x={50} y={fy + 12.5} size={2.6} color={MUTED} o={enter(t, b.f0)} dy={rise(b.f0, 1)}>
        谐振频率
      </T>
      <Svg>
        <Sym x={26} y={37} scale={0.3} opacity={enter(t, b.e1, 0.4)} color={IND}>
          <Inductor x={0} y={0} />
        </Sym>
        <Sym x={74} y={37} scale={0.3} opacity={enter(t, b.e2, 0.4)} color={CAP}>
          <Capacitor x={0} y={0} />
        </Sym>
      </Svg>
      <T x={26} y={44} size={3.4} weight={600} color={IND} o={enter(t, b.e1 + 0.1)} dy={rise(b.e1, 1)}>
        <M>1 mH</M>
      </T>
      <T x={74} y={44} size={3.4} weight={600} color={CAP} o={enter(t, b.e2 + 0.1)} dy={rise(b.e2, 1)}>
        <M>10 nF</M>
      </T>
      <T x={50} y={41} size={5.6} o={enter(t, b.e3)} scale={still ? 1 : lerp(1.12, 1, easeInOut((t - b.e3) / 0.5))}>
        <span className="inline-flex items-center gap-[0.3em]">
          <M c={AMP}>≈</M>
          <M c={AMP} className="font-semibold tabular">
            50 kHz
          </M>
        </span>
      </T>
    </>
  )
}

// ── XL and XC cross ─────────────────────────────────────────────────────────

const PX0 = 12
const PX1 = 88
const F_LO = 5e3
const F_HI = 5e5
const px = (f: number) => logX(f, F_LO, F_HI, PX0, PX1)
const L0 = 1e-3
const C0 = 10e-9
const xlOf = (f: number) => TAU * f * L0
const xcOf = (f: number) => 1 / (TAU * f * C0)
const py = (ohm: number) => 46 - ((Math.log10(ohm) - 1) / 3) * 34
const f0 = 1 / (TAU * Math.sqrt(L0 * C0))

function Cross({ t, b, still, rise }: P) {
  void still
  const d = enter(t, b.ln_eq + 0.1, 1.8)
  const path = (fn: (f: number) => number) =>
    curve(70, (u) => {
      const f = F_LO * Math.pow(F_HI / F_LO, u * d)
      return [px(f), py(fn(f))]
    })
  const cross = enter(t, b.eq, 0.5)
  const can = enter(t, b.cancel, 0.5)
  return (
    <>
      <Svg>
        <g stroke={BORDER} opacity={enter(t, b.ln_eq, 0.5)}>
          <path d={`M${PX0} 10 V46 H${PX1 + 1}`} />
        </g>
        <Draw d={path(xlOf)} p={d > 0.002 ? 1 : 0} stroke={IND} strokeWidth={0.6} />
        <Draw d={path(xcOf)} p={d > 0.002 ? 1 : 0} stroke={CAP} strokeWidth={0.6} />
        <g opacity={cross}>
          <path d={`M${px(f0)} ${py(xlOf(f0))} V46`} stroke={AMP} strokeWidth={0.3} strokeDasharray="0.9 0.9" />
          <circle cx={px(f0)} cy={py(xlOf(f0))} r={1} fill={AMP} stroke="none" />
        </g>
        <g opacity={can} strokeWidth={0.4}>
          <path d={`M${px(f0) + 5} ${py(xlOf(f0)) + 5.5} V${py(xlOf(f0)) - 0.5} M${px(f0) + 3.9} ${py(xlOf(f0)) + 0.7} L${px(f0) + 5} ${py(xlOf(f0)) - 0.6} L${px(f0) + 6.1} ${py(xlOf(f0)) + 0.7}`} stroke={IND} />
          <path d={`M${px(f0) - 5} ${py(xlOf(f0)) - 5.5} V${py(xlOf(f0)) + 0.5} M${px(f0) - 6.1} ${py(xlOf(f0)) - 0.7} L${px(f0) - 5} ${py(xlOf(f0)) + 0.6} L${px(f0) - 3.9} ${py(xlOf(f0)) - 0.7}`} stroke={CAP} />
        </g>
      </Svg>
      <T x={PX0 + 1} y={7} size={2.2} anchor="start" color={MUTED} o={enter(t, b.ln_eq)}>
        阻力 <M>Ω</M>
      </T>
      <T x={PX1} y={49.5} size={2.2} anchor="end" color={MUTED} o={enter(t, b.ln_eq)}>
        频率 <V>f</V>
      </T>
      <T x={PX1 - 1} y={14} size={2.8} weight={600} anchor="end" color={IND} o={enter(t, b.ln_eq + 1.4)}>
        感抗
      </T>
      <T x={PX0 + 6} y={14} size={2.8} weight={600} anchor="start" color={CAP} o={enter(t, b.ln_eq + 1.4)}>
        容抗
      </T>
      <T x={px(f0)} y={49.5} size={2.8} weight={600} color={AMP} o={cross}>
        <V>f</V>
        <M>
          <sub style={{ fontSize: "0.6em" }}>0</sub>
        </M>
      </T>
      <T x={px(f0)} y={py(xlOf(f0)) - 9} size={2.8} weight={600} o={cross}>
        <M>X</M>
        <M>
          <sub style={{ fontSize: "0.6em" }}>L</sub>
        </M>
        <M> = X</M>
        <M>
          <sub style={{ fontSize: "0.6em" }}>C</sub>
        </M>
      </T>
      <T x={50} y={10.5} size={3} weight={600} o={can} dy={rise(b.cancel, 1)}>
        互相抵消
      </T>
    </>
  )
}

// ── series resonance: Z dips, I peaks ───────────────────────────────────────

const R_SERIES = 33
const zOf = (f: number, r = R_SERIES) => Math.hypot(r, xlOf(f) - xcOf(f))

function Series({ t, b, still }: P) {
  void still
  const AX0 = 20
  const AX1 = 90
  const sx = (f: number) => logX(f, F_LO, F_HI, AX0, AX1)
  const zy = (z: number) => 25 - ((Math.log10(z) - 1) / 3) * 17
  const zPeak = 1 / zOf(f0)
  const iy = (i: number) => 50 - 17 * (i / zPeak)
  const dz = enter(t, b.series + 0.3, 2.2)
  const di = enter(t, b.imax - 0.6, 1.6)
  const path = (fn: (f: number) => [number, number], d: number) =>
    curve(80, (u) => fn(F_LO * Math.pow(F_HI / F_LO, u * d)))
  const band = enter(t, b.door - 0.2, 0.6)
  return (
    <>
      <Svg>
        <g stroke={BORDER} opacity={enter(t, b.series, 0.5)}>
          <path d={`M${AX0} 7 V25.5 H${AX1 + 1} M${AX0} 31 V50.5 H${AX1 + 1}`} />
        </g>
        <rect x={sx(f0 * 0.82)} y={7} width={sx(f0 * 1.22) - sx(f0 * 0.82)} height={43.5} fill={GOOD} fillOpacity={0.16 * band} stroke="none" />
        <Draw d={path((f) => [sx(f), zy(zOf(f))], dz)} p={dz > 0.002 ? 1 : 0} stroke={VOLT} strokeWidth={0.6} />
        <Draw d={path((f) => [sx(f), iy(1 / zOf(f))], di)} p={di > 0.002 ? 1 : 0} stroke={AMP} strokeWidth={0.6} />
        <g opacity={enter(t, b.zmin + 0.2, 0.4)}>
          <circle cx={sx(f0)} cy={zy(zOf(f0))} r={0.9} fill={VOLT} stroke="none" />
        </g>
        <g opacity={enter(t, b.imax + 0.2, 0.4)}>
          <circle cx={sx(f0)} cy={iy(zPeak)} r={0.9} fill={AMP} stroke="none" />
        </g>
      </Svg>
      <T x={AX0 - 1.5} y={13} size={2.6} anchor="end" color={VOLT} weight={600} o={enter(t, b.series + 0.2)}>
        阻抗
      </T>
      <T x={AX0 - 1.5} y={40} size={2.6} anchor="end" color={AMP} weight={600} o={enter(t, b.imax - 0.6)}>
        电流
      </T>
      <T x={sx(f0)} y={zy(zOf(f0)) - 6} size={2.8} weight={600} color={VOLT} o={enter(t, b.zmin + 0.2)}>
        最小
      </T>
      <T x={sx(f0) + 2.5} y={iy(zPeak) + 3} size={2.8} anchor="start" weight={600} color={AMP} o={enter(t, b.imax + 0.2)}>
        最大
      </T>
      <T x={sx(f0 * 1.22) + 1.5} y={28.2} size={2.8} anchor="start" weight={600} color={GOOD} o={band}>
        只放行这一段
      </T>
    </>
  )
}

// ── Q: three resistances ────────────────────────────────────────────────────

function QScene({ t, b, still }: P) {
  void still
  const AX0 = 10
  const AX1 = 70
  const qx = (ratio: number) => AX0 + ((ratio - 0.7) / 0.6) * (AX1 - AX0)
  const qy = (g: number) => 46 - 34 * g
  const sqL = Math.sqrt(L0 / C0)
  const curves = [
    { r: 100, color: FAINT, at: b.ln_q + 0.35 },
    { r: 33, color: AMP, at: b.q + 0.6 },
    { r: 10, color: CAP, at: b.rsmall + 0.2 },
  ]
  const gain = (ratio: number, q: number) => 1 / Math.sqrt(1 + q * q * (ratio - 1 / ratio) ** 2)
  return (
    <>
      <Svg>
        <g stroke={BORDER} opacity={enter(t, b.ln_q + 0.2, 0.5)}>
          <path d={`M${AX0} 9 V46 H${AX1 + 1}`} />
        </g>
        {curves.map((c) => {
          const d = enter(t, c.at, 1.2)
          const q = sqL / c.r
          return <Draw key={c.r} d={curve(120, (u) => [qx(0.7 + 0.6 * u * d), qy(gain(0.7 + 0.6 * u * d, q))])} p={d > 0.002 ? 1 : 0} stroke={c.color} strokeWidth={c.r === 10 ? 0.7 : 0.55} />
        })}
        <path d={`M${qx(1)} 9 V46`} stroke={BORDER} strokeDasharray="0.8 0.8" opacity={enter(t, b.ln_q + 0.2, 0.5)} strokeWidth={0.2} />
      </Svg>
      <T x={AX0 + 1} y={6} size={2.2} anchor="start" color={MUTED} o={enter(t, b.ln_q + 0.2)}>
        电流
      </T>
      <T x={qx(1)} y={49.5} size={2.6} color={MUTED} o={enter(t, b.ln_q + 0.2)}>
        <V>f</V>
        <M>
          <sub style={{ fontSize: "0.6em" }}>0</sub>
        </M>
      </T>
      <T x={85} y={9.5} size={3.4} weight={600} o={enter(t, b.q)}>
        品质因数 <V>Q</V>
      </T>
      {curves.map((c, i) => (
        <T key={c.r} x={75} y={20 + i * 8} size={2.8} anchor="start" weight={600} color={c.color === FAINT ? MUTED : c.color} o={enter(t, c.at + 0.5)} className="tabular">
          <M>
            {c.r} Ω · <V>Q</V> ≈ {Math.round(sqL / c.r)}
          </M>
        </T>
      ))}
      <T x={86} y={44} size={2.8} weight={600} color={CAP} o={enter(t, b.rsmall + 0.3)}>
        电阻越小，峰越尖
      </T>
    </>
  )
}

// ── a radio dial and a crystal ──────────────────────────────────────────────

function Use({ t, b, still }: P) {
  const ticks = [10, 17, 24, 31, 38, 45]
  const dial = glide(t, b.radio, 14, 31, 2.6)
  const lock = enter(t, b.radio + 2.4, 0.4)
  const vib = still ? 0 : Math.sin((t - b.xtal) * 16) * 0.9
  const bump = (x: number) => 1 / (1 + ((x - dial) / 3) ** 2)
  return (
    <>
      <T x={27} y={10} size={4} weight={600} o={enter(t, b.radio)}>
        收音机
      </T>
      <T x={73} y={10} size={4} weight={600} o={enter(t, b.xtal)}>
        晶振
      </T>
      <Svg>
        <g opacity={enter(t, b.radio + 0.2)}>
          <path d="M8 40 H46" stroke={BORDER} />
          {ticks.map((x, i) => (
            <path key={x} d={`M${x} 40 v${i % 2 ? 1.4 : 2.2}`} />
          ))}
          <path d={Array.from({ length: 39 }, (_, i) => `${i ? "L" : "M"}${8 + i} ${40 - 14 * bump(8 + i)}`).join(" ")} stroke={AMP} strokeWidth={0.55} />
          <path d={`M${dial} 40 V43.5`} stroke={VOLT} strokeWidth={0.5} />
        </g>
        <circle cx={31} cy={40} r={1.1} fill={GOOD} stroke="none" opacity={lock} />
        <g opacity={enter(t, b.xtal + 0.1)}>
          <rect x={65} y={22} width={16} height={12} stroke={CAP} strokeWidth={0.5} />
          <path d="M62 24 V32 M84 24 V32 M62 28 H58 M84 28 H88" stroke="var(--foreground)" strokeWidth={0.4} />
          <g stroke={CAP} strokeWidth={0.35}>
            <path d={`M${68 - vib} 28 H${78 + vib}`} />
            <path d={`M${68 - vib} 26.8 v2.4 M${78 + vib} 26.8 v2.4`} />
          </g>
        </g>
      </Svg>
      <T x={27} y={46.5} size={2.4} color={MUTED} o={enter(t, b.radio + 0.5)}>
        转动旋钮，改变电容
      </T>
      <T x={27} y={21} size={2.6} weight={600} color={GOOD} o={lock} dy={0}>
        只留下这个电台
      </T>
      <T x={73} y={42} size={2.6} color={MUTED} o={enter(t, b.xtal + 0.6)}>
        石英的机械谐振
      </T>
    </>
  )
}

// ── parasitic ringing ───────────────────────────────────────────────────────

function Ring({ t, b, still, rise }: P) {
  void still
  void rise
  const par = enter(t, b.par, 0.6)
  const wires = enter(t, b.ln_ring + 0.1, 0.8)
  const WX0 = 56
  const WX1 = 94
  const base = 44
  const hi = 24
  const edge = 60
  const drawn = enter(t, b.ring - 1.6, 1.4)
  const wave = (x: number) => {
    if (x < edge) return base
    const u = (x - edge) / 4
    return base - (base - hi) * (1 - Math.exp(-u * 0.55) * Math.cos(u * 2.1))
  }
  return (
    <>
      <Svg>
        <Draw d="M6 24 H13 M31 24 H36 V25 M36 43 V46 M33.6 46 H38.4 M34.5 47.2 H37.5" p={wires} />
        <g opacity={par} strokeDasharray="1 0.8">
          <Sym x={22} y={24} scale={0.3} color={IND}>
            <Inductor x={0} y={0} />
          </Sym>
          <Sym x={36} y={34} scale={0.3} color={CAP}>
            <Capacitor x={0} y={0} rot={90} />
          </Sym>
        </g>
        <path d={`M${WX0} ${base} H${WX1}`} stroke={BORDER} opacity={wires} />
        <Draw d={`M${WX0} ${base} H${edge} V${hi} H${WX1}`} p={enter(t, b.ln_ring + 0.3, 1.2)} stroke={FAINT} strokeWidth={0.4} />
        {drawn > 0.002 && <Draw d={curve(100, (u) => [edge + (WX1 - edge) * u * drawn, wave(edge + (WX1 - edge) * u * drawn)])} p={1} stroke={VOLT} strokeWidth={0.6} />}
        <Draw d={`M${WX0} ${base} H${edge}`} p={enter(t, b.ln_ring + 0.5, 0.5)} stroke={VOLT} strokeWidth={0.6} />
      </Svg>
      <T x={22} y={17.5} size={2.4} weight={600} color={IND} o={par}>
        寄生电感
      </T>
      <T x={41} y={34} size={2.4} weight={600} anchor="start" color={CAP} o={par}>
        寄生电容
      </T>
      <T x={22} y={50} size={2.4} color={MUTED} o={wires}>
        一段普通的导线
      </T>
      <T x={78} y={14} size={3.4} weight={600} color={VOLT} o={enter(t, b.ring - 0.2, 0.5)}>
        振铃
      </T>
      <T x={75} y={50} size={2.4} color={MUTED} o={enter(t, b.ln_ring + 1.0)}>
        陡峭的边沿
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "LC 谐振",
  audio,
  timing,
  poster: 6,
  Stage,
}

export default function ResonanceFilm() {
  return <FilmPlayer film={film} />
}

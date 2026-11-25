import * as React from "react"
import { trace } from "@/lab/colors"
import { OpAmp, Resistor } from "@/lab/schematic"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, M, Scene, Svg, Sym, T, V, easeInOut, enter, glide, lerp, span, type FilmDef, type StageProps } from "../../kit"
import { clamp, poly, pop, sample } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

const VOLT = trace.voltage
const AMP = trace.current
const MUTED = "var(--muted-foreground)"
const LINE = "var(--border)"

/*
 * 运放的常用电路, ~52 s. Scenes, each keyed to the words that introduce it:
 *   title → "two resistors" decide the gain
 *   → inverting amplifier: virtual earth, the current through Rin and Rf, the output wave upside down and 4.7 times bigger
 *   → the same drawing becomes the non-inverting amplifier (5.7 times, in phase); a bigger input is clipped at the rails
 *   → gain × bandwidth: the open-loop line and the closed-loop plateaus that cut it
 *   → "try it below".
 */
function Stage({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.6) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)
  const title = span(t, 0.25, b.inv - 0.15, 0.4, 0.3)
  const amp = span(t, b.inv - 0.3, b.gbw - 0.15, 0.3, 0.3)
  const gbw = span(t, b.gbw - 0.3, b.outro - 0.15, 0.3, 0.3)
  const outro = enter(t, b.outro - 0.3, 0.4)
  return (
    <>
      <Scene o={title}>
        <Title t={t} b={b} rise={rise} />
      </Scene>
      <Scene o={amp}>
        <Amplifier t={t} b={b} still={still} />
      </Scene>
      <Scene o={gbw}>
        <Bandwidth t={t} b={b} />
      </Scene>
      <Scene o={outro}>
        <T x={50} y={24} size={6} weight={600} dy={rise(b.outro - 0.3)}>
          动手试试
        </T>
        <T x={50} y={32.5} size={2.8} color={MUTED} o={enter(t, b.drag)} dy={rise(b.drag, 1)}>
          改动下面实验台的两只电阻
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

function Rn({ sub }: { sub: string }) {
  return (
    <>
      <V>R</V>
      <span style={{ fontFamily: "KaTeX_Main, serif", fontStyle: "normal", fontSize: "0.65em" }}>{sub}</span>
    </>
  )
}

function Title({ t, b, rise }: { t: number; b: StageProps["b"]; rise: (at: number, d?: number) => number }) {
  const chip = "rounded-full border border-input px-[0.9em] py-[0.45em] text-muted-foreground"
  return (
    <>
      <T x={50} y={13} size={6.4} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
        运放的常用电路
      </T>
      <T x={38} y={25} size={2.6} className={chip} o={enter(t, b.intro + 0.9)}>
        虚短
      </T>
      <T x={62} y={25} size={2.6} className={chip} o={enter(t, b.intro + 1.5)}>
        虚断
      </T>
      <Svg>
        <g opacity={enter(t, b.two, 0.5)}>
          <Sym x={34} y={37} scale={0.22}>
            <Resistor x={0} y={0} />
          </Sym>
        </g>
        <g opacity={enter(t, b.two + 0.5, 0.5)}>
          <Sym x={66} y={37} scale={0.22}>
            <Resistor x={0} y={0} />
          </Sym>
        </g>
      </Svg>
      <T x={34} y={43} size={3} o={enter(t, b.two)}>
        <Rn sub="in" />
      </T>
      <T x={66} y={43} size={3} o={enter(t, b.two + 0.5)}>
        <Rn sub="f" />
      </T>
      <T x={50} y={37} size={3} color={MUTED} o={enter(t, b.two + 1.0)}>
        <M>+</M>
      </T>
    </>
  )
}

// ── the amplifier ───────────────────────────────────────────────────────────

const CX = 38
const CY = 30
const S = 0.5
const MY = CY - 14 * S // minus pin y = 23
const PY = CY + 14 * S // plus pin y = 37
const PX = CX - 40 * S // pin x = 18
const JX = 17.5
const FB = [
  [2, MY],
  [JX, MY],
  [JX, 10],
  [64, 10],
  [64, CY],
  [60, CY],
] as const
const PATH_LEN = FB.slice(1).reduce((s, p, i) => s + Math.abs(p[0] - FB[i][0]) + Math.abs(p[1] - FB[i][1]), 0)

function along(d: number): [number, number] {
  let s = ((d % PATH_LEN) + PATH_LEN) % PATH_LEN
  for (let i = 1; i < FB.length; i++) {
    const [x0, y0] = FB[i - 1]
    const [x1, y1] = FB[i]
    const len = Math.abs(x1 - x0) + Math.abs(y1 - y0)
    if (s <= len) return [lerp(x0, x1, s / len), lerp(y0, y1, s / len)]
    s -= len
  }
  return FB[FB.length - 1] as unknown as [number, number]
}

/** The circuit is drawn in its own coordinates and shifted right by OFF, clear of the stage's left edge. */
const OFF = 3
const PX0 = 72.5 // scope panel
const PX1 = 95.5
const KV = 2.1 // stage units per volt on the scope
const YIN = 18
const YOUT = 35

function Ground({ x, y, o }: { x: number; y: number; o: number }) {
  return (
    <path d={`M${x} ${y} v2 M${x - 1.6} ${y + 2} h3.2 M${x - 1} ${y + 3} h2 M${x - 0.4} ${y + 4} h0.8`} opacity={o} />
  )
}

function Amplifier({ t, b, still }: StageProps) {
  const k = enter(t, b.non - 0.1, 0.6) // 0 = inverting, 1 = non-inverting
  const inv = 1 - k
  const wires = enter(t, b.inv + 0.2, 0.7)
  const rin = enter(t, b.rin, 0.5)
  const gnd = enter(t, b.gndw, 0.5)
  const vg = pop(t, b.vg)
  const cur = enter(t, b.curw, 0.4) * inv
  const rfHi = enter(t, b.rf, 0.4) * inv

  // current dots drifting along Rin → Rf → the output
  let phase = 0
  if (!still && t > b.curw) phase = (t - b.curw) * 5
  const dots: React.ReactNode[] = []
  if (cur > 0.01) {
    for (let i = 0; i < PATH_LEN / 3.6; i++) {
      const [x, y] = along(i * 3.6 + phase)
      const inRin = y === MY && x > 6.5 && x < 16.5
      const inRf = y === 10 && x > 33.8 && x < 46.2
      if (!inRin && !inRf) dots.push(<circle key={i} cx={x} cy={y} r={0.5} fill={AMP} stroke="none" opacity={cur} />)
    }
  }

  // the scope
  const mt = still ? b.x57 + 0.5 : t
  const grow = glide(t, b.grow, 0.5, 1.4, 2.2)
  const A = still ? 0.5 : grow
  const gain = lerp(-4.7, 5.7, easeInOut((t - b.non - 0.3) / 0.8))
  const wave = (x: number) => Math.sin(0.5 * (x - PX0) - 3.2 * mt)
  const vin = (x: number) => YIN - A * KV * wave(x)
  const outV = (x: number) => clamp(gain * A * wave(x), -5, 5)
  const vout = (x: number) => YOUT - KV * outV(x)
  const scope = enter(t, b.gainw, 0.5)
  const outDraw = easeInOut((t - b.neg) / 0.9)
  const xEnd = PX0 + (PX1 - PX0) * outDraw
  const rails = enter(t, b.grow - 0.4, 0.5)
  const headInv = inv
  const flipTag = enter(t, b.flip)
  const inphTag = enter(t, b.inph)

  return (
    <>
      <Svg>
        <g transform={`translate(${OFF} 0)`}>
        {/* shared parts */}
        <g opacity={enter(t, b.inv - 0.1, 0.5)}>
          <Sym x={CX} y={CY} scale={S}>
            <OpAmp x={0} y={0} />
          </Sym>
        </g>
        {/* inverting: signal through Rin to the minus pin, plus pin to ground */}
        <g opacity={inv}>
          <Draw d={`M2 ${MY} H6.7`} p={wires} />
          <Draw d={`M12 ${PY} H${PX} M12 ${PY} V41`} p={gnd} />
          <Ground x={12} y={41} o={gnd} />
        </g>
        {/* non-inverting: signal straight into the plus pin, Rin down to ground */}
        <g opacity={k}>
          <Draw d={`M2 ${PY} H${PX}`} p={k} />
          <Draw d={`M6.7 ${MY} H5 V27`} p={k} />
          <Ground x={5} y={27} o={k} />
        </g>
        <g opacity={rin}>
          <Sym x={11.5} y={MY} scale={0.16}>
            <Resistor x={0} y={0} />
          </Sym>
          <path d={`M16.3 ${MY} H${PX}`} />
        </g>
        <Draw d={`M${JX} ${MY} V10 H34`} p={rin} />
        <g opacity={rin}>
          <Sym x={40} y={10} scale={0.2} color={rfHi > 0.5 ? AMP : undefined}>
            <Resistor x={0} y={0} />
          </Sym>
        </g>
        <Draw d={`M46 10 H64 V${CY} H60`} p={enter(t, b.curw - 0.4, 0.7)} />
        <circle cx={JX} cy={MY} r={1.6 * vg * inv} stroke={VOLT} strokeDasharray="0.6 0.5" strokeWidth={0.25} />
        {dots}
        </g>
        {/* scope */}
        <g opacity={scope}>
          <path d={`M${PX0} ${YIN} H${PX1}`} stroke={LINE} strokeWidth={0.15} />
          <path d={`M${PX0} ${YOUT} H${PX1}`} stroke={LINE} strokeWidth={0.15} />
          <path d={sample(vin, PX0, PX1, 80)} stroke={VOLT} strokeWidth={0.4} />
        </g>
        <g opacity={rails * k} stroke={VOLT} strokeWidth={0.2} strokeDasharray="0.7 0.6">
          <path d={`M${PX0} ${YOUT - 5 * KV} H${PX1} M${PX0} ${YOUT + 5 * KV} H${PX1}`} />
        </g>
        {outDraw > 0.01 && <path d={sample(vout, PX0, xEnd, 80)} stroke="var(--foreground)" strokeWidth={0.5} />}
      </Svg>

      {/* labels */}
      <T x={2.5 + OFF} y={headInv > 0.5 ? 19.4 : 33.2} size={2.4} anchor="start" font="var" color={VOLT} o={wires}>
        Vin
      </T>
      <T x={11.5 + OFF} y={MY + 3.6} size={2} color={MUTED} o={rin} className="tabular">
        10 kΩ
      </T>
      <T x={40 + OFF} y={6.4} size={2.2} color={MUTED} o={rin}>
        <Rn sub="f" /> 47 kΩ
      </T>
      <T x={11.5 + OFF} y={MY - 3.4} size={2.2} o={rin}>
        <Rn sub="in" />
      </T>
      <T x={9 + OFF} y={32} size={2.4} weight={600} color={VOLT} o={vg * inv} className="tabular">
        虚地 0 V
      </T>
      <T x={60 + OFF} y={34.5} size={2.4} font="var" o={wires}>
        Vout
      </T>
      <T x={84} y={8} size={3.2} weight={600} o={inv * enter(t, b.inv)}>
        反相放大器
      </T>
      <T x={84} y={8} size={3.2} weight={600} o={k}>
        同相放大器
      </T>
      <T x={PX0} y={YIN - 4.6} size={2.2} anchor="start" font="var" color={VOLT} o={scope}>
        Vin
      </T>
      <T x={PX1} y={YIN - 4.6} size={2} anchor="end" color={MUTED} o={scope} className="tabular">
        {A.toFixed(1)} V
      </T>
      <T x={PX0} y={YOUT - 12.6} size={2.2} anchor="start" font="var" o={enter(t, b.neg)}>
        Vout
      </T>
      <T x={PX1} y={YOUT - 12.6} size={2.2} anchor="end" weight={600} o={enter(t, b.neg) * inv * flipTag}>
        反相
      </T>
      <T x={PX1} y={YOUT - 12.6} size={2.2} anchor="end" weight={600} o={k * inphTag}>
        同相
      </T>
      <T x={PX0 - 0.8} y={YOUT - 5 * KV} size={1.8} anchor="end" color={VOLT} o={rails * k}>
        +5 V
      </T>
      <T x={PX0 - 0.8} y={YOUT + 5 * KV} size={1.8} anchor="end" color={VOLT} o={rails * k}>
        −5 V
      </T>
      <T x={81.5} y={50.5} size={2.6} o={enter(t, b.gainw + 0.3) * inv}>
        <M>增益 = −R</M>
        <M>
          <sub>f</sub>
        </M>
        <M> ÷ R</M>
        <M>
          <sub>in</sub>
        </M>
        <M> = </M>
        <M c={VOLT} className="font-semibold">
          −4.7
        </M>
      </T>
      <T x={81.5} y={50.5} size={2.6} o={enter(t, b.x57 - 0.2) * k}>
        <M>增益 = 1 + R</M>
        <M>
          <sub>f</sub>
        </M>
        <M> ÷ R</M>
        <M>
          <sub>in</sub>
        </M>
        <M> = </M>
        <M c={VOLT} className="font-semibold">
          5.7
        </M>
      </T>
      <T x={26 + OFF} y={50.5} size={2.4} color={MUTED} o={enter(t, b.clipw) * k}>
        输出碰到电源，就被削平
      </T>
    </>
  )
}

// ── gain × bandwidth ────────────────────────────────────────────────────────

const GX0 = 16
const GX1 = 88
const DX = 14 // units per decade of frequency
const GY0 = 12
const DY = 6.8 // units per decade of gain
const fx = (log10f: number) => GX0 + (log10f - 1) * DX
const gy = (log10g: number) => GY0 + (5 - log10g) * DY

function Bandwidth({ t, b }: Pick<StageProps, "t" | "b">) {
  const axes = enter(t, b.gbw - 0.2, 0.6)
  const open = easeInOut((t - (b.gbw + 0.2)) / 1.2)
  const l10 = easeInOut((t - b.hg) / 0.8)
  const l100 = easeInOut((t - (b.hg + 1.0)) / 0.8)
  const drop = enter(t, b.lf, 0.5)
  const openPath = poly([
    [fx(1), gy(5)],
    [fx(1), gy(5)],
    [fx(6), gy(0)],
  ])
  const hit = (g: number) => fx(6 - g) // frequency where the open-loop line reaches gain 10^g
  return (
    <>
      <Svg>
        <Draw d={`M${GX0} 47 H${GX1}`} p={axes} />
        <Draw d={`M${GX0} 47 V${GY0 - 2}`} p={axes} />
        <Draw d={openPath} p={open} stroke={MUTED} strokeWidth={0.45} />
        <Draw d={`M${GX0} ${gy(1)} H${hit(1)}`} p={l10} stroke={VOLT} strokeWidth={0.45} />
        <Draw d={`M${GX0} ${gy(2)} H${hit(2)}`} p={l100} stroke={AMP} strokeWidth={0.45} />
        <g opacity={drop} strokeDasharray="0.7 0.6" strokeWidth={0.22}>
          <path d={`M${hit(1)} ${gy(1)} V47`} stroke={VOLT} />
          <path d={`M${hit(2)} ${gy(2)} V47`} stroke={AMP} />
        </g>
      </Svg>
      <T x={GX1} y={50.2} size={2.2} anchor="end" color={MUTED} o={axes}>
        频率
      </T>
      <T x={GX0} y={7.6} size={2.2} color={MUTED} o={axes}>
        增益
      </T>
      <T x={50} y={19} size={2.2} anchor="start" color={MUTED} o={open}>
        开环增益
      </T>
      <T x={GX0 - 1.6} y={gy(1)} size={2.2} anchor="end" weight={600} color={VOLT} o={l10} className="tabular">
        10
      </T>
      <T x={GX0 - 1.6} y={gy(2)} size={2.2} anchor="end" weight={600} color={AMP} o={l100} className="tabular">
        100
      </T>
      <T x={hit(1)} y={50.2} size={2.4} weight={600} color={VOLT} o={drop} className="tabular">
        100 kHz
      </T>
      <T x={hit(2)} y={50.2} size={2.4} weight={600} color={AMP} o={drop} className="tabular">
        10 kHz
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "运放的常用电路",
  audio,
  timing,
  poster: 4.2,
  Stage,
}

export default function OpampCircuitsFilm() {
  return <FilmPlayer film={film} />
}

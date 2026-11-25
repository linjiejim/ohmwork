import * as React from "react"
import { Battery, Diode, Led, Resistor } from "@/lab/schematic"
import { glow, type GlowColor } from "@/lab/colors"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, Frac, M, Scene, Svg, Sym, T, V, easeInOut, enter, glide, lerp, leave, span, type FilmDef, type StageProps } from "../../kit"
import { AMP, Arrow, FlowDots, HEAT, LINE, MUTED, Sb, VOLT, curvePts, polyD, type Pt } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

/*
 * LED 与稳压二极管, 62 s. Scenes, each keyed to the words that introduce it:
 *   title → an LED and a zener, the first one lights up
 *   → current sets the brightness → colours and their forward drops (bars)
 *   → no resistor: the current runs away and the LED dies → with a resistor it is fine
 *   → R = (Vs − Vf) / I: the resistor takes what the LED does not → worked example, the LED lights
 *   → the zener in reverse (current swings, voltage stays) → the 9 V → 5.1 V circuit
 *   → the limit: output sags once the load takes too much → "try it below".
 */

function Stage({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.6) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)
  const lift = (at: number) => (still ? 0 : -easeInOut((t - at) / 0.45) * 2)

  // the title is gone before the circuit draws; the colour bars hold until 3 V has been read
  const title = span(t, 0.25, b.light - 0.55, 0.4, 0.3)
  const light = span(t, b.light - 0.3, b.colors - 0.15, 0.3, 0.3)
  const colors = span(t, b.colors - 0.3, b.burn + 0.3, 0.3, 0.3)
  const burn = span(t, b.burn + 0.3, b.formula - 0.15, 0.3, 0.3)
  const formula = span(t, b.formula - 0.3, b.example - 0.15, 0.3, 0.3)
  const example = span(t, b.example - 0.3, b.zener - 0.15, 0.3, 0.3)
  const zener = span(t, b.zener - 0.3, b.circ + 0.2, 0.3, 0.3)
  const circ = span(t, b.circ + 0.2, b.limit - 0.15, 0.3, 0.3)
  const limit = span(t, b.limit - 0.3, b.outro - 0.15, 0.3, 0.3)
  const outro = enter(t, b.outro - 0.3, 0.4)

  return (
    <>
      <Scene o={title} dy={lift(b.light - 0.85)}>
        <Title t={t} b={b} still={still} rise={rise} />
      </Scene>
      <Scene o={light}>
        <Light t={t} b={b} still={still} rise={rise} />
      </Scene>
      <Scene o={colors}>
        <Colors t={t} b={b} rise={rise} />
      </Scene>
      <Scene o={burn}>
        <Burn t={t} b={b} still={still} rise={rise} />
      </Scene>
      <Scene o={formula}>
        <Formula t={t} b={b} />
      </Scene>
      <Scene o={example}>
        <Example t={t} b={b} still={still} rise={rise} />
      </Scene>
      <Scene o={zener}>
        <ZenerCurve t={t} b={b} still={still} />
      </Scene>
      <Scene o={circ}>
        <ZenerCircuit t={t} b={b} still={still} />
      </Scene>
      <Scene o={limit}>
        <Limit t={t} b={b} still={still} />
      </Scene>
      <Scene o={outro}>
        <Outro t={t} b={b} still={still} rise={rise} />
      </Scene>
    </>
  )
}

/** The integral of a speed over time, for dots whose speed changes. */
function integ(f: (s: number) => number, a: number, b: number) {
  let p = 0
  const dt = 1 / 30
  for (let s = a; s < b; s += dt) p += f(s) * Math.min(dt, b - s)
  return p
}

// ── title ────────────────────────────────────────────────────────────────────

function Title({ t, b, still, rise }: StageProps & { rise: (at: number, d?: number) => number }) {
  const lit = enter(t, b.led, 0.7)
  const pulse = still ? 1 : 0.85 + 0.15 * Math.sin(t * 3)
  return (
    <>
      <T x={50} y={12} size={7.4} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
        LED 与稳压二极管
      </T>
      <Svg>
        <Sym x={27} y={34} scale={0.5} opacity={enter(t, b.intro + 0.2, 0.6)}>
          <Led x={0} y={0} brightness={lit * pulse} />
        </Sym>
        <Sym x={73} y={34} scale={0.5} opacity={enter(t, b.intro + 0.5, 0.6)}>
          <Diode x={0} y={0} variant="zener" />
        </Sym>
      </Svg>
      <T x={27} y={44} size={3.6} weight={600} o={enter(t, b.led, 0.4)} dy={rise(b.led, 1)}>
        会发光
      </T>
      <T x={73} y={44} size={3.6} weight={600} o={enter(t, b.zen, 0.4)} dy={rise(b.zen, 1)}>
        会稳压
      </T>
    </>
  )
}

// ── the loop used by several scenes ──────────────────────────────────────────

const RING: Pt[] = [[12, 19], [12, 12], [44, 12], [44, 44], [12, 44], [12, 37], [12, 19]]

function Loop({
  wires = 1,
  bat = 1,
  res = 0,
  led = 1,
  bright = 0,
  color = "red",
  burnt = 0,
  flow = 0,
  phase = 0,
}: {
  wires?: number
  bat?: number
  res?: number
  led?: number
  bright?: number
  color?: GlowColor
  burnt?: number
  flow?: number
  phase?: number
}) {
  const hide = (x: number, y: number) => (res > 0.5 && y === 12 && x > 18 && x < 38) || (x === 44 && y > 18 && y < 38) || (x === 12 && y > 18 && y < 38)
  return (
    <>
      <Draw d="M12 19 V12 H19" p={wires} />
      <Draw d="M37 12 H44 V19" p={wires} />
      <Draw d="M19 12 H37" p={wires} opacity={1 - res} />
      <Draw d="M44 37 V44 H12 V37" p={wires} />
      <Sym x={12} y={28} scale={0.3} opacity={bat}>
        <Battery x={0} y={0} rot={90} />
      </Sym>
      <Sym x={28} y={12} scale={0.3} opacity={res}>
        <Resistor x={0} y={0} />
      </Sym>
      <Sym x={44} y={28} scale={0.3} opacity={led * (1 - burnt * 0.65)}>
        <Led x={0} y={0} rot={90} color={color} brightness={bright} />
      </Sym>
      {burnt > 0.01 && (
        <g stroke={HEAT} strokeWidth={0.5} opacity={burnt}>
          <path d="M41.8 25.8 L46.2 30.2 M46.2 25.8 L41.8 30.2" />
        </g>
      )}
      <FlowDots pts={RING} phase={phase} gap={3.6} closed o={flow} skip={hide} />
    </>
  )
}

// ── current sets the brightness ──────────────────────────────────────────────

function Light({ t, b, still, rise }: StageProps & { rise: (at: number, d?: number) => number }) {
  const wires = enter(t, b.light - 0.1, 0.8)
  const mA = glide(t, b.cur, 5, 20, 1.6)
  const speed = (s: number) => glide(s, b.cur, 5, 20, 1.6) * 0.6
  const phase = still ? 0 : integ(speed, b.light, Math.max(t, b.light))
  const bright = 0.15 + 0.85 * ((mA - 5) / 15) * enter(t, b.cur - 0.1, 0.01) + 0.25 * (1 - enter(t, b.cur - 0.1, 0.01))
  return (
    <>
      <Svg>
        <Loop wires={wires} res={1} bright={bright} flow={enter(t, b.light + 0.4, 0.5)} phase={phase} />
        {/* brightness bar */}
        <g stroke={LINE} strokeWidth={0.25} opacity={enter(t, b.light + 0.6)}>
          <rect x={64} y={36} width={26} height={3} rx={1.5} />
        </g>
        <rect x={64.3} y={36.3} width={Math.max(0.1, 25.4 * ((mA - 3) / 17))} height={2.4} rx={1.2} fill={glow.red} stroke="none" opacity={enter(t, b.light + 0.6)} />
      </Svg>
      <T x={77} y={13} size={2.8} color={MUTED} o={enter(t, b.light + 0.3)} dy={rise(b.light + 0.3, 1)}>
        电能变成光
      </T>
      <T x={77} y={22} size={2.6} color={MUTED} o={enter(t, b.light + 0.5)}>
        电流 <V c={AMP}>I</V>
      </T>
      <T x={77} y={29} size={6.4} weight={600} color={AMP} o={enter(t, b.light + 0.5)} className="tabular">
        <M>{Math.round(mA)} mA</M>
      </T>
      <T x={77} y={43} size={2.6} color={MUTED} o={enter(t, b.light + 0.6)}>
        亮度
      </T>
    </>
  )
}

// ── colours and forward drops ────────────────────────────────────────────────

function Colors({ t, b, rise }: Pick<StageProps, "t" | "b"> & { rise: (at: number, d?: number) => number }) {
  const cols: { x: number; name: string; v: number; color: GlowColor; at: number; vAt: number; show: number }[] = [
    { x: 14, name: "红光", v: 2.0, color: "red", at: b.red, vAt: b.r2, show: b.colors - 0.1 },
    { x: 38, name: "黄光", v: 2.1, color: "amber", at: b.red + 0.2, vAt: b.r2 + 0.15, show: b.colors + 0.05 },
    { x: 62, name: "蓝光", v: 3.0, color: "blue", at: b.blue, vAt: b.b3, show: b.colors + 0.2 },
    { x: 86, name: "白光", v: 3.0, color: "white", at: b.blue + 0.7, vAt: b.b3 + 0.15, show: b.colors + 0.35 },
  ]
  const BASE = 48
  const YS = 3.6
  return (
    <>
      <T x={50} y={5.5} size={2.6} color={MUTED} o={enter(t, b.colors + 0.1)} dy={rise(b.colors)}>
        正向压降 <V c={VOLT}>V</V>
        <Sb>f</Sb>
      </T>
      <Svg>
        {cols.map((c) => (
          <g key={c.name}>
            <Sym x={c.x} y={19} scale={0.34} opacity={enter(t, c.show, 0.5)}>
              <Led x={0} y={0} color={c.color} brightness={(c.color === "white" ? 0.45 : 0.85) * enter(t, c.at, 0.5)} />
            </Sym>
            <rect x={c.x - 3.5} y={BASE - c.v * YS * enter(t, c.vAt, 0.6)} width={7} height={c.v * YS * enter(t, c.vAt, 0.6)} fill={VOLT} fillOpacity={0.85} stroke="none" />
          </g>
        ))}
        <path d={`M4 ${BASE} H96`} stroke={LINE} strokeWidth={0.25} opacity={enter(t, b.colors + 0.3, 0.5)} />
      </Svg>
      {cols.map((c) => (
        <React.Fragment key={c.name}>
          <T x={c.x} y={29.5} size={3} weight={600} o={enter(t, c.show + 0.2)} dy={rise(c.show, 1)}>
            {c.name}
          </T>
          <T x={c.x} y={BASE - c.v * YS - 2.6} size={2.8} weight={600} color={VOLT} o={enter(t, c.vAt + 0.3)} className="tabular">
            <M>{c.v.toFixed(1)} V</M>
          </T>
        </React.Fragment>
      ))}
    </>
  )
}

// ── no resistor, then a resistor ─────────────────────────────────────────────

function Burn({ t, b, still, rise }: StageProps & { rise: (at: number, d?: number) => number }) {
  const s0 = b.burn + 0.35
  const d0 = b.direct + 0.7 // the runaway starts with "电流不受控制"
  const wires = enter(t, s0, 0.8)
  const res = enter(t, b.rr - 0.1, 0.5)
  const speed = (s: number) => (s < d0 ? 8 : s < b.boom ? 8 + 55 * enter(s, d0, 1.8) : s < b.rr ? 0 : 9)
  const phase = still ? 0 : integ(speed, s0, Math.max(t, s0))
  const runaway = t < b.rr
  const bright = runaway ? (t < b.boom ? 0.35 + 0.65 * enter(t, d0, 1.8) : 0) : 0.5 * enter(t, b.rr + 0.5, 0.5)
  const burnt = enter(t, b.boom, 0.15) * (1 - enter(t, b.rr - 0.1, 0.3))
  const flash = still ? 0 : Math.max(0, 1 - (t - b.boom) / 0.35) * enter(t, b.boom - 0.05, 0.05)
  const flow = enter(t, s0 + 0.4, 0.5) * (t >= b.boom && t < b.rr + 0.3 ? leave(t, b.boom + 0.1, 0.4) : 1)
  return (
    <>
      <Svg>
        <Loop wires={wires} res={res} bright={bright} burnt={burnt} flow={flow} phase={phase} />
        {flash > 0.01 && <circle cx={44} cy={28} r={9} fill={glow.white} stroke="none" opacity={flash * 0.6} />}
      </Svg>
      <T x={77} y={17} size={2.6} color={MUTED} o={enter(t, s0 + 0.3)}>
        电流 <V c={AMP}>I</V>
      </T>
      <T x={77} y={27} size={6.4} weight={600} color={HEAT} o={span(t, d0, b.rr - 0.2, 0.4, 0.3)} scale={still ? 1 : lerp(0.9, 1.15, enter(t, d0, 1.8))}>
        失控
      </T>
      <T x={77} y={27} size={6.4} weight={600} color={AMP} o={enter(t, b.rr + 0.5, 0.5)} className="tabular">
        <M>10 mA</M>
      </T>
      <T x={77} y={38} size={2.8} color={HEAT} o={span(t, b.boom, b.rr - 0.2, 0.3, 0.3)}>
        LED 烧坏了
      </T>
      <T x={77} y={38} size={2.8} color={MUTED} o={enter(t, b.dec, 0.4)} dy={rise(b.dec, 1)}>
        电流由电阻决定
      </T>
      <T x={28} y={6.5} size={2.8} o={enter(t, b.rr + 0.1)} color={MUTED}>
        限流电阻
      </T>
      <T x={7.5} y={28} size={3.2} anchor="end" weight={600} color={VOLT} o={enter(t, s0 + 0.2)} className="tabular">
        <M>5 V</M>
      </T>
    </>
  )
}

// ── the formula ──────────────────────────────────────────────────────────────

function Formula({ t, b }: Pick<StageProps, "t" | "b">) {
  const BX = 82
  const TOP = 14
  const BOT = 48
  const split = TOP + (BOT - TOP) * 0.6
  const full = enter(t, b.fVs - 0.2, 0.7)
  const lower = enter(t, b.fVf, 0.6)
  const rows: { y: number; letter: React.ReactNode; word: string; at: number }[] = [
    { y: 34, letter: <V>R</V>, word: "限流电阻", at: b.formula + 0.3 },
    { y: 39.5, letter: <><V c={VOLT}>V</V><Sb>S</Sb></>, word: "电源电压", at: b.fVs },
    { y: 45, letter: <><V c={VOLT}>V</V><Sb>f</Sb></>, word: "LED 压降", at: b.fVf },
    { y: 50.5, letter: <><V c={AMP}>I</V><Sb>f</Sb></>, word: "想要的电流", at: b.fI },
  ]
  return (
    <>
      <T x={36} y={20} size={7.2}>
        <span className="inline-flex items-center gap-[0.28em]">
          <span style={{ opacity: enter(t, b.formula + 0.3) }}>
            <V>R</V>
          </span>
          <span style={{ opacity: enter(t, b.formula + 0.5) }}>
            <M>=</M>
          </span>
          <Frac
            top={
              <span className="inline-flex items-baseline gap-[0.2em]">
                <span style={{ opacity: enter(t, b.fVs) }}>
                  <V c={VOLT}>V</V>
                  <Sb>S</Sb>
                </span>
                <span style={{ opacity: enter(t, b.fVf) }}>
                  &thinsp;<M>−</M>&thinsp;<V c={VOLT}>V</V>
                  <Sb>f</Sb>
                </span>
              </span>
            }
            bottom={
              <span style={{ opacity: enter(t, b.fI) }}>
                <V c={AMP}>I</V>
                <Sb>f</Sb>
              </span>
            }
            bar={enter(t, b.fVs - 0.1, 0.5)}
          />
        </span>
      </T>
      {rows.map((r) => (
        <T key={r.word} x={10} y={r.y} size={2.9} anchor="start" o={enter(t, r.at + 0.1)}>
          <span className="inline-flex items-baseline gap-[0.7em]">
            <span style={{ minWidth: "2.4em" }}>{r.letter}</span>
            <span style={{ color: MUTED, fontSize: "0.9em" }}>{r.word}</span>
          </span>
        </T>
      ))}
      {/* the supply splits: the LED keeps V_f, the resistor takes the rest */}
      <Svg>
        <rect x={BX - 4} y={TOP} width={8} height={BOT - TOP} stroke={VOLT} strokeWidth={0.3} opacity={full} />
        <rect x={BX - 4} y={split} width={8} height={BOT - split} fill={VOLT} fillOpacity={0.55} stroke="none" opacity={lower} />
        <path d={`M${BX - 4} ${split} H${BX + 4}`} stroke={VOLT} strokeWidth={0.3} opacity={lower} />
      </Svg>
      <T x={BX - 6} y={(TOP + BOT) / 2} size={3} anchor="end" font="var" color={VOLT} o={full}>
        V<Sb>S</Sb>
      </T>
      <T x={BX + 6} y={(TOP + split) / 2} size={2.6} anchor="start" color={MUTED} o={enter(t, b.fVf + 0.2)}>
        归电阻
      </T>
      <T x={BX + 6} y={(split + BOT) / 2} size={2.6} anchor="start" color={VOLT} o={enter(t, b.fVf + 0.1)} font="var">
        V<Sb>f</Sb>
      </T>
    </>
  )
}

// ── worked example ───────────────────────────────────────────────────────────

function Example({ t, b, still, rise }: StageProps & { rise: (at: number, d?: number) => number }) {
  const wires = enter(t, b.example - 0.1, 0.8)
  const on = enter(t, b.eS + 0.1, 0.5)
  const phase = still ? 0 : Math.max(0, t - b.eS) * 12
  return (
    <>
      <Svg>
        <Loop wires={wires} res={enter(t, b.example + 0.3, 0.5)} bright={0.9 * on} flow={on} phase={phase} />
      </Svg>
      <T x={7.5} y={28} size={3.2} anchor="end" weight={600} color={VOLT} o={enter(t, b.eV)} className="tabular">
        <M>5 V</M>
      </T>
      <T x={28} y={6.5} size={2.8} o={enter(t, b.example + 0.5) * (1 - enter(t, b.eS, 0.3))} color={MUTED}>
        <V>R</V> ?
      </T>
      <T x={28} y={6.5} size={2.8} o={enter(t, b.eS, 0.3)} className="tabular">
        <M>330 Ω</M>
      </T>
      <T x={77} y={14} size={3} color={MUTED} o={enter(t, b.eV + 0.1)} dy={rise(b.eV, 1)} className="tabular">
        <M>
          5 V − 2.0 V = <span style={{ color: VOLT }}>3 V</span>
        </M>
      </T>
      <T x={77} y={25} size={3} color={MUTED} o={enter(t, b.eD + 0.1)} dy={rise(b.eD, 1)} className="tabular">
        <M>3 V ÷ 10 mA</M>
      </T>
      <T x={77} y={33.5} size={4.6} o={enter(t, b.eR, 0.4)} className="tabular">
        <M>= 300 Ω</M>
      </T>
      <T x={77} y={44} size={6.4} weight={600} o={enter(t, b.eS, 0.4)} scale={still ? 1 : lerp(1.15, 1, enter(t, b.eS, 0.5))} className="tabular">
        <M>330 Ω</M>
      </T>
    </>
  )
}

// ── the zener in reverse ─────────────────────────────────────────────────────

const OX = 14
const OY = 42
const XS = 9
const HZ = 28
const VZ = 5.1
const zI = (v: number) => HZ * Math.exp((v - 5.4) / 0.12)
const Z_PATH = polyD(curvePts(zI, 0, 5.4, 90).map(([v, i]) => [OX + v * XS, OY - i] as Pt))

function ZenerCurve({ t, b }: StageProps) {
  const axes = enter(t, b.zener + 0.1, 0.7)
  const curveP = 0.58 * easeInOut((t - (b.zener + 0.8)) / 1.4) + 0.42 * easeInOut((t - (b.brk - 0.2)) / 0.9)
  const zx = OX + VZ * XS
  const sym = enter(t, b.rev - 0.1, 0.5)
  return (
    <>
      <Svg>
        <Draw d={`M12 ${OY} H88`} p={axes} />
        <Draw d={`M${OX} 46 V8`} p={axes} />
        <g opacity={enter(t, b.zener + 0.6)}>
          <path d={`M86.6 ${OY - 1.1} L88 ${OY} L86.6 ${OY + 1.1} M${OX - 1.1} 9.4 L${OX} 8 L${OX + 1.1} 9.4`} />
        </g>
        <Sym x={34} y={19} scale={0.4} opacity={sym}>
          <Diode x={0} y={0} rot={180} variant="zener" />
        </Sym>
        <Draw d={Z_PATH} p={curveP} stroke={AMP} strokeWidth={0.5} />
        <g opacity={enter(t, b.brk + 0.5, 0.4)} stroke={MUTED} strokeWidth={0.2} strokeDasharray="0.8 0.8">
          <path d={`M${zx} ${OY + 2} V${OY - zI(VZ) - 1}`} />
        </g>
        {/* the current swings widely ... */}
        <Arrow x1={73} y1={34} x2={73} y2={13} p={enter(t, b.wide, 0.7)} color={AMP} width={0.4} />
        <Arrow x1={73} y1={13} x2={73} y2={34} p={enter(t, b.wide, 0.7)} color={AMP} width={0.4} />
        {/* ... while the voltage barely moves */}
        <g opacity={enter(t, b.flat, 0.5)} stroke={VOLT} strokeWidth={0.45}>
          <path d={`M${zx - 1} 10.5 H${zx + 4.6} M${zx - 1} 9 V12 M${zx + 4.6} 9 V12`} />
        </g>
      </Svg>
      <T x={88} y={OY + 4} size={2.4} anchor="end" color={MUTED} o={axes}>
        反向电压 <V c={VOLT}>V</V>
      </T>
      <T x={OX} y={5.2} size={2.4} color={MUTED} o={axes}>
        电流 <V c={AMP}>I</V>
      </T>
      <T x={34} y={27} size={2.8} color={MUTED} o={sym}>
        反着接
      </T>
      <T x={zx - 7.5} y={OY + 4} size={2.6} weight={600} color={VOLT} o={enter(t, b.brk + 0.5)} className="tabular">
        <M>5.1 V</M>
      </T>
      <T x={58} y={28} size={2.8} anchor="end" color={HEAT} o={enter(t, b.brk, 0.5)}>
        击穿
      </T>
      <T x={77} y={24} size={2.8} anchor="start" color={AMP} o={enter(t, b.wide + 0.2)}>
        电流变化很大
      </T>
      <T x={zx - 3} y={10.5} size={2.6} anchor="end" color={VOLT} o={enter(t, b.flat + 0.2)}>
        电压几乎不动
      </T>
    </>
  )
}

// ── the 9 V → 5.1 V circuit ──────────────────────────────────────────────────

const ZRING: Pt[] = [[12, 19], [12, 12], [50, 12], [50, 44], [12, 44], [12, 37], [12, 19]]

function ZenerCircuit({ t, b, still }: StageProps) {
  const wires = enter(t, b.circ + 0.4, 0.8)
  const r = enter(t, b.zr, 0.5)
  const z = enter(t, b.zz, 0.5)
  const out = enter(t, b.zz + 0.2, 0.6)
  const flow = enter(t, b.zz + 0.3, 0.5)
  const phase = still ? 0 : Math.max(0, t - b.zz) * 11
  const hide = (x: number, y: number) => (y === 12 && x > 18 && x < 38) || (x === 50 && y > 18 && y < 38) || (x === 12 && y > 18 && y < 38)
  return (
    <>
      <Svg>
        <Draw d="M12 19 V12 H19" p={wires} />
        <Draw d="M19 12 H37" p={wires} opacity={1 - r} />
        <Draw d="M37 12 H50 V19" p={wires} />
        <Draw d="M50 37 V44 H12 V37" p={wires} />
        <Draw d="M50 12 H70" p={out} />
        <Draw d="M50 44 H70" p={out} />
        <circle cx={70} cy={12} r={0.8} fill="var(--background)" opacity={out} />
        <circle cx={70} cy={44} r={0.8} fill="var(--background)" opacity={out} />
        <Sym x={12} y={28} scale={0.3} opacity={enter(t, b.circ + 0.45, 0.5)}>
          <Battery x={0} y={0} rot={90} />
        </Sym>
        <Sym x={28} y={12} scale={0.3} opacity={r}>
          <Resistor x={0} y={0} />
        </Sym>
        <Sym x={50} y={28} scale={0.3} opacity={z}>
          <Diode x={0} y={0} rot={270} variant="zener" />
        </Sym>
        <FlowDots pts={ZRING} phase={phase} gap={3.6} closed o={flow} skip={hide} />
        <Arrow x1={76} y1={44} x2={76} y2={12} p={enter(t, b.zo, 0.6)} color={VOLT} width={0.4} />
        <Arrow x1={76} y1={12} x2={76} y2={44} p={enter(t, b.zo, 0.6)} color={VOLT} width={0.4} />
      </Svg>
      <T x={7.5} y={28} size={3.2} anchor="end" weight={600} color={VOLT} o={enter(t, b.circ + 0.45, 0.4)} className="tabular">
        <M>9 V</M>
      </T>
      <T x={28} y={6.5} size={2.8} color={MUTED} o={enter(t, b.zr + 0.1)}>
        串一只电阻
      </T>
      <T x={54.5} y={28} size={2.8} anchor="start" color={MUTED} o={enter(t, b.zz + 0.2)}>
        稳压管
      </T>
      <T x={79} y={28} size={7} weight={600} anchor="start" color={VOLT} o={enter(t, b.zo, 0.4)} scale={still ? 1 : lerp(1.12, 1, enter(t, b.zo, 0.5))} className="tabular">
        <M>5.1 V</M>
      </T>
      <T x={70} y={50} size={2.6} color={MUTED} o={out}>
        输出
      </T>
    </>
  )
}

// ── the limit ────────────────────────────────────────────────────────────────

const LX = 14
const LY = 44
const LXS = 8
const LYS = 6

const vOut = (il: number) => (il <= 3.9 ? VZ : Math.max(0, 9 - il))

function Limit({ t, b, still }: StageProps) {
  const axes = enter(t, b.limit, 0.7)
  const il = still ? 2 : t < b.load ? glide(t, b.small, 1, 3.4, 2) : glide(t, b.load, 3.4, 8.6, b.drop - b.load + 1.4)
  const v = vOut(il)
  const dot: [number, number] = [LX + il * LXS, LY - v * LYS]
  const bad = il > 3.9
  const path = polyD([[LX, LY - VZ * LYS], [LX + 3.9 * LXS, LY - VZ * LYS], [LX + 9 * LXS, LY]] as Pt[])
  return (
    <>
      <Svg>
        <Draw d={`M12 ${LY} H90`} p={axes} />
        <Draw d={`M${LX} ${LY + 2} V8`} p={axes} />
        <Draw d={path} p={enter(t, b.limit + 0.4, 1)} stroke={VOLT} strokeWidth={0.5} />
        <g opacity={enter(t, b.small, 0.5)} stroke={MUTED} strokeWidth={0.25}>
          <path d={`M${LX} ${LY + 3.4} V${LY + 4.6} H${LX + 3.9 * LXS} V${LY + 3.4}`} />
        </g>
        <circle cx={dot[0]} cy={dot[1]} r={1} fill={bad ? HEAT : AMP} stroke="none" opacity={enter(t, b.small, 0.4)} />
      </Svg>
      <T x={90} y={LY + 4} size={2.4} anchor="end" color={MUTED} o={axes}>
        负载电流
      </T>
      <T x={LX} y={5.2} size={2.4} color={MUTED} o={axes}>
        输出电压
      </T>
      <T x={LX + 1.95 * LXS} y={LY + 7.6} size={2.6} color={MUTED} o={enter(t, b.small + 0.2)}>
        毫安级的小电流
      </T>
      <T x={48} y={LY - VZ * LYS - 3} size={2.8} color={VOLT} o={enter(t, b.limit + 0.8) * (1 - enter(t, b.drop - 0.6, 0.4))}>
        稳在 <M>5.1 V</M>
      </T>
      <T x={78} y={26} size={2.8} color={HEAT} o={enter(t, b.drop, 0.5)}>
        稳压失效
      </T>
      <T x={82} y={12} size={4} weight={600} anchor="end" color={bad ? HEAT : VOLT} o={enter(t, b.small + 0.2)} className="tabular">
        <M>{v.toFixed(1)} V</M>
      </T>
      <T x={82} y={17.5} size={2.4} anchor="end" color={MUTED} o={enter(t, b.small + 0.2)} className="tabular">
        <M>负载 {il.toFixed(1)} mA</M>
      </T>
    </>
  )
}

// ── try it ───────────────────────────────────────────────────────────────────

function Outro({ t, b, still, rise }: StageProps & { rise: (at: number, d?: number) => number }) {
  const p = enter(t, b.outro - 0.2, 0.6)
  const bright = still ? 0.7 : 0.55 + 0.4 * (0.5 + 0.5 * Math.sin(Math.max(0, t - b.drag) * 1.6 - Math.PI / 2))
  return (
    <>
      <Svg>
        <Draw d="M44 28 H47 M69 28 H75" p={p} />
        <Sym x={58} y={28} scale={0.36} opacity={p}>
          <Resistor x={0} y={0} variable />
        </Sym>
        <Sym x={86} y={28} scale={0.36} opacity={p}>
          <Led x={0} y={0} brightness={bright * enter(t, b.drag, 0.5)} />
        </Sym>
        <g opacity={enter(t, b.drag + 0.3)} transform={`translate(0 ${still ? 0 : Math.sin(t * 3.2) * 0.6})`} strokeWidth={0.45}>
          <path d="M24 38 V45 M21.6 42.6 L24 45 L26.4 42.6" />
        </g>
      </Svg>
      <T x={24} y={22} size={6} weight={600} dy={rise(b.outro)} o={enter(t, b.outro - 0.1, 0.5)}>
        动手试试
      </T>
      <T x={24} y={31} size={2.8} color={MUTED} o={enter(t, b.drag)} dy={rise(b.drag, 1)}>
        拖动下面的电阻
      </T>
      <T x={58} y={19} size={2.6} color={MUTED} o={enter(t, b.drag + 0.2)}>
        限流电阻
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "LED 与稳压二极管",
  audio,
  timing,
  poster: 3.6,
  Stage,
}

export default function LedsZenersFilm() {
  return <FilmPlayer film={film} />
}

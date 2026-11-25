import * as React from "react"
import { trace } from "@/lab/colors"
import { Bjt, Resistor } from "@/lab/schematic"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, M, Scene, Svg, Frac, Sym, T, V, easeInOut, enter, glide, span, type FilmDef, type StageProps } from "../../kit"
import { clamp, poly, pop, sample } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

const VOLT = trace.voltage
const AMP = trace.current
const MUTED = "var(--muted-foreground)"
const LINE = "var(--border)"

/*
 * 三极管放大电路, ~53 s. Scenes, each keyed to the words that introduce it:
 *   title → a small wave goes into a transistor, a big upside-down one comes out
 *   → the I–V curve: a tiny signal at zero bias does nothing; bias moves the dot to the steep middle
 *   → the load line: Q at the middle swings widest; slid to either end it flattens the output
 *   → the schematic with its emitter resistor: the loop that holds Q steady
 *   → gain ≈ −Rc / Re → the three configurations → "try it below".
 */
function Stage({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.6) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)
  const title = span(t, 0.25, b.small - 0.15, 0.4, 0.3)
  const curve = span(t, b.small - 0.3, b.line - 0.15, 0.3, 0.3)
  const load = span(t, b.line - 0.3, b.re - 0.15, 0.3, 0.3)
  const bias = span(t, b.re - 0.3, b.gain - 0.15, 0.3, 0.3)
  // the gain result holds into the next line, so "= −10" is not gone a second after it lands
  const gain = span(t, b.gain - 0.3, b.cfg + 0.2, 0.3, 0.3)
  const cfg = span(t, b.cfg + 0.2, b.outro - 0.15, 0.3, 0.3)
  const outro = enter(t, b.outro - 0.3, 0.4)
  return (
    <>
      <Scene o={title}>
        <T x={50} y={8.5} size={5.2} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
          三极管放大电路
        </T>
        <Demo t={t} still={still} growAt={b.amp - 0.8} inLabel="输入" outLabel="输出" show={enter(t, b.intro + 0.8)} />
      </Scene>
      <Scene o={curve}>
        <Curve t={t} b={b} still={still} />
      </Scene>
      <Scene o={load}>
        <LoadLine t={t} b={b} still={still} />
      </Scene>
      <Scene o={bias}>
        <Biasing t={t} b={b} />
      </Scene>
      <Scene o={gain}>
        <Gain t={t} b={b} still={still} />
      </Scene>
      <Scene o={cfg}>
        <Configs t={t} b={b} />
      </Scene>
      <Scene o={outro}>
        <T x={50} y={24} size={6} weight={600} dy={rise(b.outro - 0.3)}>
          动手试试
        </T>
        <T x={50} y={32.5} size={2.8} color={MUTED} o={enter(t, b.drag)} dy={rise(b.drag, 1)}>
          拖动下面实验台的偏置电压
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

function Ground({ x, y, o = 1 }: { x: number; y: number; o?: number }) {
  return <path d={`M${x} ${y} v2 M${x - 1.6} ${y + 2} h3.2 M${x - 1} ${y + 3} h2 M${x - 0.4} ${y + 4} h0.8`} opacity={o} />
}

// ── a small wave in, a big one out ──────────────────────────────────────────

function Demo({ t, still, growAt, inLabel, outLabel, show, outAmp = 11 }: { t: number; still: boolean; growAt: number; inLabel: string; outLabel: string; show: number; outAmp?: number }) {
  const mt = still ? 3 : t
  const k = enter(t, growAt, 1.0)
  const vin = (x: number) => 28 - 1.4 * Math.sin(0.5 * (x - 6) - 3 * mt)
  const vout = (x: number) => 28 + outAmp * k * Math.sin(0.5 * (x - 70) - 3 * mt)
  return (
    <>
      <Svg>
        <g opacity={show}>
          <path d={sample(vin, 6, 32, 60)} stroke={VOLT} strokeWidth={0.4} />
          <path d="M32 28 H38" />
          <Sym x={50} y={28} scale={0.4}>
            <Bjt x={0} y={0} />
          </Sym>
          <path d="M55.6 16 H66 V28 H70" opacity={k} />
          <path d="M55.6 40 V44" />
          <Ground x={55.6} y={44} />
        </g>
        <path d={sample(vout, 70, 96, 80)} stroke="var(--foreground)" strokeWidth={0.5} opacity={show * k} />
      </Svg>
      <T x={19} y={22} size={2.4} color={MUTED} o={show}>
        {inLabel}
      </T>
      <T x={83} y={11.5} size={2.4} color={MUTED} o={show * k}>
        {outLabel}
      </T>
    </>
  )
}

// ── the I–V curve and the bias ──────────────────────────────────────────────

const CX0 = 14
const CY0 = 45
const XV = 52 // units per volt of Vbe
const YI = 12.5 // units per mA
const ic = (v: number) => Math.min(2.6, 1.2 * Math.exp((v - 0.65) / 0.05))
const cx = (v: number) => CX0 + XV * v
const cy = (i: number) => CY0 - YI * i

function Curve({ t, b, still }: StageProps) {
  const axes = enter(t, b.small - 0.1, 0.6)
  const cv = easeInOut((t - (b.small + 0.5)) / 1.2)
  const sig = enter(t, b.tiny, 0.4)
  const vq = still ? 0.655 : glide(t, b.biasw - 0.3, 0, 0.655, 1.3)
  const mt = still ? 3 : t
  const VA = 0.02
  const s = (x: number) => Math.sin(0.5 * (x - 62) - 3 * mt)
  const v0 = vq + VA * s(62)
  const dotOn = enter(t, b.tiny, 0.4)
  const lo = vq - VA
  const hi = vq + VA
  const curvePts: [number, number][] = []
  for (let i = 0; i <= 60; i++) {
    const v = (0.69 * i) / 60
    curvePts.push([cx(v), cy(ic(v))])
  }
  const midPop = pop(t, b.mid)
  const outFlat = enter(t, b.ignore, 0.5)
  const outShow = enter(t, b.tiny + 0.6, 0.5)
  return (
    <>
      <Svg>
        <Draw d={`M${CX0} ${CY0} H55`} p={axes} />
        <Draw d={`M${CX0} ${CY0} V10`} p={axes} />
        <Draw d={poly(curvePts)} p={cv} stroke={AMP} strokeWidth={0.5} />
        {/* the swing on the curve, and its guide to the axis */}
        <g opacity={dotOn}>
          <path d={`M${cx(v0)} ${CY0} V${cy(ic(v0))}`} stroke={LINE} strokeWidth={0.2} />
          <path d={poly([...Array(13)].map((_, i) => [cx(lo + ((hi - lo) * i) / 12), cy(ic(lo + ((hi - lo) * i) / 12))] as [number, number]))} stroke={VOLT} strokeWidth={0.8} />
          <circle cx={cx(v0)} cy={cy(ic(v0))} r={0.9} fill="var(--foreground)" stroke="none" />
          {midPop > 0.01 && <circle cx={cx(vq)} cy={cy(ic(vq))} r={2.6 * midPop} stroke={VOLT} strokeWidth={0.25} opacity={1 - 0.6 * midPop} />}
        </g>
        {/* the two waves */}
        <g opacity={sig}>
          <path d="M62 17 H97" stroke={LINE} strokeWidth={0.15} />
          <path d={sample((x) => 17 - 2 * s(x), 62, 97, 70)} stroke={VOLT} strokeWidth={0.4} />
        </g>
        <g opacity={outShow}>
          <path d={`M62 ${cy(0)} H97`} stroke={LINE} strokeWidth={0.15} />
          <path d={sample((x) => cy(ic(vq + VA * s(x))), 62, 97, 80)} stroke={AMP} strokeWidth={0.5} />
        </g>
      </Svg>
      <T x={55} y={CY0 + 3.4} size={2.2} anchor="end" color={MUTED} o={axes}>
        基极电压
      </T>
      <T x={CX0} y={7.6} size={2.2} color={MUTED} o={axes}>
        集电极电流
      </T>
      <T x={cx(0.655) - 3.5} y={cy(1.2)} size={2.2} anchor="end" weight={600} color={VOLT} o={enter(t, b.biasw, 0.4)} className="tabular">
        偏置 0.65 V
      </T>
      <T x={97} y={11.5} size={2.2} anchor="end" color={MUTED} o={sig}>
        输入 几十毫伏
      </T>
      <T x={97} y={cy(0) + 3.4} size={2.2} anchor="end" color={MUTED} o={outShow}>
        输出电流
      </T>
      <T x={80} y={cy(0) - 3} size={2.4} color={MUTED} o={outFlat * (1 - enter(t, b.biasw, 0.4))}>
        几乎没有变化
      </T>
    </>
  )
}

// ── the load line ───────────────────────────────────────────────────────────

const LX0 = 14
const LY0 = 46
const LXV = 40 / 12 // units per volt of Vce
const LYI = 12.5
const ISAT = 2.3
const lx = (v: number) => LX0 + LXV * v
const ly = (i: number) => LY0 - LYI * i
const vce = (i: number) => 12 - 5.17 * i
const WY0 = 46 // output wave: 0 V at the bottom, 12 V at the top
const WYV = 2.7
const wy = (v: number) => WY0 - WYV * v

function LoadLine({ t, b, still }: StageProps) {
  const axes = enter(t, b.line - 0.1, 0.6)
  const ln = easeInOut((t - (b.line + 0.1)) / 1.1)
  const ends = enter(t, b.loadw + 0.9, 0.5)
  const q1 = still ? 1.15 : glide(t, b.edge, 1.15, 1.95, 1.2)
  const q = still ? 1.15 : t < b.edge + 2.6 ? q1 : glide(t, b.edge + 2.6, 1.95, 0.35, 1.3)
  const mt = still ? 3 : t
  const AI = 0.95
  const wave = (x: number) => 12 - 5.17 * clamp(q + AI * Math.sin(0.5 * (x - 62) - 3 * mt), 0, ISAT)
  const swing = (ph: number) => clamp(q + AI * ph, 0, ISAT)
  // the extremes of the swing along the line
  const iLo = swing(-1)
  const iHi = swing(1)
  const i0 = swing(Math.sin(-3 * mt))
  const live = enter(t, b.mid2, 0.5)
  const panel = enter(t, b.mid2 + 0.2, 0.5)
  const clipTag = enter(t, b.clipw, 0.4)
  return (
    <>
      <Svg>
        <Draw d={`M${LX0} ${LY0} H57`} p={axes} />
        <Draw d={`M${LX0} ${LY0} V10`} p={axes} />
        <Draw d={`M${lx(12)} ${ly(0)} L${lx(0.2)} ${ly(ISAT)}`} p={ln} stroke="var(--foreground)" strokeWidth={0.5} />
        <g opacity={live}>
          <path d={`M${lx(vce(iLo))} ${ly(iLo)} L${lx(vce(iHi))} ${ly(iHi)}`} stroke={AMP} strokeWidth={1} />
          <circle cx={lx(vce(i0))} cy={ly(i0)} r={0.95 * pop(t, b.mid2)} fill="var(--foreground)" stroke="none" />
        </g>
        <g opacity={panel}>
          <path d={`M62 ${wy(12)} H97 M62 ${wy(0.1)} H97`} stroke={LINE} strokeWidth={0.15} strokeDasharray="0.6 0.6" />
          <path d={sample((x) => wy(wave(x)), 62, 97, 100)} stroke={VOLT} strokeWidth={0.5} />
        </g>
      </Svg>
      <T x={34} y={LY0 + 3.4} size={2.2} color={MUTED} o={axes}>
        集射电压
      </T>
      <T x={LX0} y={7.6} size={2.2} color={MUTED} o={axes}>
        集电极电流
      </T>
      <T x={lx(12)} y={LY0 + 3.4} size={2.4} weight={600} o={ends}>
        截止
      </T>
      <T x={lx(0.2) + 2.2} y={ly(ISAT) - 3} size={2.4} weight={600} anchor="start" o={ends}>
        饱和
      </T>
      <T x={97} y={wy(12) - 3.4} size={2.2} anchor="end" color={MUTED} o={panel}>
        输出电压
      </T>
      <T x={97} y={wy(0) + 4.2} size={2.2} anchor="end" weight={600} color={VOLT} o={clipTag * panel}>
        波形被削平
      </T>
    </>
  )
}

// ── the schematic with its emitter resistor ─────────────────────────────────

function Biasing({ t, b }: Pick<StageProps, "t" | "b">) {
  const S = 0.22
  const wires = enter(t, b.re - 0.2, 0.9)
  const parts = enter(t, b.re, 0.5)
  const rew = enter(t, b.rew, 0.4)
  const rows = [
    { y: 18, text: "温度升高，电流变大", at: b.stable - 1.6 },
    { y: 31, text: "发射极电压升高，基极电压不变", at: b.stable },
    { y: 44, text: "电流被压了回去", at: b.stable + 0.9 },
  ]
  return (
    <>
      <Svg>
        <Draw d="M14 7 H33.08" p={wires} />
        <Draw d={`M14 ${20.2} V33.4 M14 26.8 H23.4`} p={wires} />
        <Draw d="M6 26.8 H14" p={wires} />
        <Draw d="M33.08 20.2 H44" p={wires} />
        <g opacity={parts}>
          <Sym x={30} y={26.8} scale={S}>
            <Bjt x={0} y={0} />
          </Sym>
          <Sym x={33.08} y={13.6} scale={S}>
            <Resistor x={0} y={0} rot={90} />
          </Sym>
          <Sym x={14} y={13.6} scale={S}>
            <Resistor x={0} y={0} rot={90} />
          </Sym>
          <Sym x={14} y={40} scale={S}>
            <Resistor x={0} y={0} rot={90} />
          </Sym>
          <Sym x={33.08} y={40} scale={S} color={rew > 0.5 ? AMP : undefined}>
            <Resistor x={0} y={0} rot={90} />
          </Sym>
          <path d="M14 46.6 V47.5 M33.08 46.6 V47.5" />
          <Ground x={14} y={47.5} />
          <Ground x={33.08} y={47.5} />
        </g>
        <circle cx={14} cy={26.8} r={0.6} fill="currentColor" opacity={parts} />
        {/* the loop on the right */}
        <g stroke={AMP} strokeWidth={0.3}>
          {[0, 1].map((i) => (
            <path key={i} d={`M76 ${rows[i].y + 3} V${rows[i + 1].y - 3} M74.6 ${rows[i + 1].y - 4.4} L76 ${rows[i + 1].y - 3} L77.4 ${rows[i + 1].y - 4.4}`} opacity={enter(t, rows[i + 1].at, 0.4)} />
          ))}
        </g>
      </Svg>
      <T x={12} y={7} size={2.2} anchor="end" color={MUTED} o={parts}>
        电源
      </T>
      <T x={6} y={23.6} size={2.2} anchor="start" color={MUTED} o={parts}>
        输入
      </T>
      <T x={45.5} y={20.2} size={2.2} anchor="start" color={MUTED} o={parts}>
        输出
      </T>
      <T x={9.4} y={13.6} size={2.4} anchor="end" o={parts}>
        <V>R</V>
        <M>1</M>
      </T>
      <T x={9.4} y={40} size={2.4} anchor="end" o={parts}>
        <V>R</V>
        <M>2</M>
      </T>
      <T x={38} y={13.6} size={2.4} anchor="start" o={parts}>
        <V>R</V>
        <M>c</M>
      </T>
      <T x={38} y={40} size={2.8} anchor="start" weight={600} color={rew > 0.5 ? AMP : undefined} o={parts}>
        <V>R</V>
        <M>e</M>
      </T>
      <T x={76} y={9} size={2.6} o={rew} className="rounded-full border border-input px-[0.9em] py-[0.45em] text-muted-foreground">
        负反馈
      </T>
      {rows.map((r) => (
        <T key={r.y} x={76} y={r.y} size={2.5} o={enter(t, r.at, 0.4)}>
          {r.text}
        </T>
      ))}
    </>
  )
}

// ── gain ≈ −Rc / Re ─────────────────────────────────────────────────────────

function Gain({ t, b, still }: StageProps) {
  const frac = enter(t, b.gain - 0.1, 0.5)
  const rc = enter(t, b.rcre, 0.4)
  const re = enter(t, b.rcre + 1.2, 0.4)
  const num = enter(t, b.rcre + 1.6, 0.5)
  return (
    <>
      <T x={50} y={8.8} size={4.2} o={frac}>
        <span className="inline-flex items-center gap-[0.3em]">
          <V>A</V>
          <M>≈ −</M>
          <Frac
            top={
              <span style={{ opacity: rc }}>
                <V>R</V>
                <M>c</M>
              </span>
            }
            bottom={
              <span style={{ opacity: re }}>
                <V>R</V>
                <M>e</M>
              </span>
            }
            bar={enter(t, b.rcre + 0.8, 0.4)}
          />
          <span style={{ opacity: num }}>
            <M>= −10</M>
          </span>
        </span>
      </T>
      <Demo t={t} still={still} growAt={b.rcre + 1.4} inLabel="输入 20 mV" outLabel="输出 200 mV" show={enter(t, b.gain + 0.2)} outAmp={11} />
      <T x={83} y={46.5} size={2.4} color={MUTED} o={enter(t, b.rcre + 1.9)}>
        反相，放大十倍
      </T>
    </>
  )
}

// ── three configurations ────────────────────────────────────────────────────

function Configs({ t, b }: Pick<StageProps, "t" | "b">) {
  const S = 0.36
  const CY = 29
  const cols = [
    { x: 20, name: "共射", sub: "增益大 · 反相", at: b.ce, inP: [-30, 0], outP: [14, -30] },
    { x: 50, name: "共集", sub: "增益约 1 · 同相", at: b.cc, inP: [-30, 0], outP: [14, 30] },
    { x: 80, name: "共基", sub: "高频 · 同相", at: b.cb, inP: [14, 30], outP: [14, -30] },
  ] as const
  return (
    <>
      <Svg>
        {cols.map((c) => {
          const o = enter(t, b.cfg + 0.45, 0.6)
          const pin = (p: readonly [number, number], color: string, at: number, k: number) => (
            <circle cx={c.x + p[0] * S} cy={CY + p[1] * S} r={1.1 * pop(t, at + k)} fill={color} stroke="none" />
          )
          return (
            <g key={c.name}>
              <g opacity={o}>
                <Sym x={c.x} y={CY} scale={S}>
                  <Bjt x={0} y={0} />
                </Sym>
              </g>
              {pin(c.inP, VOLT, c.at, 0.3)}
              {pin(c.outP, "var(--foreground)", c.at, 0.6)}
            </g>
          )
        })}
      </Svg>
      {cols.map((c) => (
        <React.Fragment key={c.name}>
          <T x={c.x} y={11} size={3.6} weight={600} o={enter(t, c.at, 0.4)}>
            {c.name}
          </T>
          <T x={c.x} y={45} size={2.5} color={MUTED} o={enter(t, c.at + 0.7, 0.4)}>
            {c.sub}
          </T>
        </React.Fragment>
      ))}
      <T x={50} y={51} size={2.2} color={MUTED} o={enter(t, b.cfg + 1.0, 0.4)}>
        <span style={{ color: VOLT }}>●</span> 信号进　<span style={{ color: "var(--foreground)" }}>●</span> 信号出
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "三极管放大电路",
  audio,
  timing,
  poster: 5.6,
  Stage,
}

export default function TransistorAmplifierFilm() {
  return <FilmPlayer film={film} />
}

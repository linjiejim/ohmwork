import * as React from "react"
import { trace } from "@/lab/colors"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, Frac, M, Scene, Sub, Svg, T, V, easeInOut, enter, glide, lerp, span, type FilmDef, type StageProps } from "../../kit"
import { AMP, Flow, Ground, LINE, MUTED, VOLT, integ, zig } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

const GOOD = trace.good
const BAD = trace.power

/** R with a subscript digit, for inline use. */
function Rn({ n, c }: { n: string; c?: string }) {
  return (
    <span>
      <V c={c}>R</V>
      <sub style={{ fontSize: "0.6em" }}>
        <M>{n}</M>
      </sub>
    </span>
  )
}

/*
 * 分压器, 58 s. Scenes, each keyed to the words that introduce it:
 *   title → 5 V in, a pin that takes 3.3 V, two resistors between
 *   → the divider: R1 over R2, a tap, Vout is the voltage on R2
 *   → Vout = Vin × R2 / (R1 + R2), with a proportion bar
 *   → 5 V, 10 k, 20 k → 3.33 V
 *   → KVL as bars: 5 V up = 1.67 V + 3.33 V down
 *   → KCL at a node: 5 mA in = 3 + 2 mA out
 *   → a load in parallel with R2 pulls Vout from 3.33 V to 2 V
 *   → Vout against load size: 10× is enough → ADC yes, power supply no → the labs.
 */
function Stage({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.6) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)
  // a scene has faded out by the time the next line starts, and the next fades in from there:
  // two scenes are never on the stage at once
  const sc = (a: number, z: number) => span(t, a - 0.05, z - 0.3, 0.35, 0.3)
  const title = span(t, 0.25, b.build - 0.3, 0.4, 0.3)
  const build = sc(b.build, b.form)
  const form = sc(b.form, b.ex)
  const ex = sc(b.ex, b.kvl)
  const kvl = sc(b.kvl, b.kcl)
  const kcl = sc(b.kcl, b.ld)
  const ld = sc(b.ld, b.ten)
  const ten = sc(b.ten, b.use)
  const use = sc(b.use, b.outro)
  const outro = enter(t, b.outro - 0.05, 0.4)
  return (
    <>
      <Scene o={title}>
        <Title t={t} b={b} rise={rise} />
      </Scene>
      <Scene o={build}>
        <Build t={t} b={b} still={still} />
      </Scene>
      <Scene o={form}>
        <Formula t={t} b={b} />
      </Scene>
      <Scene o={ex}>
        <Example t={t} b={b} still={still} />
      </Scene>
      <Scene o={kvl}>
        <Kvl t={t} b={b} />
      </Scene>
      <Scene o={kcl}>
        <Kcl t={t} b={b} still={still} />
      </Scene>
      <Scene o={ld}>
        <Load t={t} b={b} still={still} />
      </Scene>
      <Scene o={ten}>
        <Ten t={t} b={b} />
      </Scene>
      <Scene o={use}>
        <Use t={t} b={b} />
      </Scene>
      <Scene o={outro}>
        <Outro t={t} b={b} still={still} rise={rise} />
      </Scene>
    </>
  )
}

// ── title ────────────────────────────────────────────────────────────────────

function Title({ t, b, rise }: { t: number; b: Record<string, number>; rise: (at: number, d?: number) => number }) {
  const pair = enter(t, b.two, 0.5)
  return (
    <>
      <T x={50} y={12} size={6.6} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
        分压器与基尔霍夫定律
      </T>
      <T x={17} y={31} size={6.4} weight={600} color={VOLT} o={enter(t, b.v5, 0.4)} dy={rise(b.v5, 1)} className="tabular">
        <M>5 V</M>
      </T>
      <T x={17} y={38.5} size={2.8} color={MUTED} o={enter(t, b.v5 + 0.1, 0.4)}>
        电源
      </T>
      <T x={83} y={31} size={6.4} weight={600} color={VOLT} o={enter(t, b.v33, 0.4)} dy={rise(b.v33, 1)} className="tabular">
        <M>3.3 V</M>
      </T>
      <T x={83} y={38.5} size={2.8} color={MUTED} o={enter(t, b.v33 + 0.1, 0.4)}>
        引脚最多承受
      </T>
      <Svg>
        <Draw d={`M30 31 H36 ${zig(36, 31, 48, 31, 5, 1.6)} ${zig(52, 31, 64, 31, 5, 1.6)} M48 31 H52 M64 31 H70`} p={pair} />
        <path d="M32 29.4 L34.8 31 L32 32.6" stroke={MUTED} opacity={enter(t, b.v33 + 0.2, 0.4) * (1 - pair)} />
      </Svg>
    </>
  )
}

// ── the divider drawing, shared by several scenes ────────────────────────────

const TY = 10
const R1A = 14
const R1B = 27
const NODE = 29.5
const R2A = 31
const R2B = 44

function DividerPic({ x, wires, tap, phase = 0, dots = 0, tapEnd = 26 }: { x: number; wires: number; tap: number; phase?: number; dots?: number; tapEnd?: number }) {
  return (
    <>
      <Draw d={`M${x} ${TY} V${R1A} ${zig(x, R1A, x, R1B, 6, 1.6)} M${x} ${R1B} V${R2A} ${zig(x, R2A, x, R2B, 6, 1.6)}`} p={wires} />
      <circle cx={x} cy={TY} r={0.9} fill="var(--background)" opacity={wires} />
      <Ground x={x} y={R2B} o={wires} />
      <Flow x0={x} y0={TY} x1={x} y1={R2B} phase={phase} o={dots} skip={[[2.4, 15.6], [19, 32.6]]} spacing={3.4} />
      <Draw d={`M${x} ${NODE} H${x + tapEnd}`} p={tap} />
      <circle cx={x} cy={NODE} r={0.8} fill="var(--foreground)" stroke="none" opacity={tap} />
      <circle cx={x + tapEnd} cy={NODE} r={0.9} fill="var(--background)" opacity={tap} />
    </>
  )
}

// ── build ────────────────────────────────────────────────────────────────────

function Build({ t, b, still }: StageProps) {
  const wires = enter(t, b.build - 0.3, 0.8)
  const phase = still ? 0 : integ((s) => 7 * enter(s, b.ser, 0.6), b.ser, Math.max(t, b.ser))
  const x = 36
  const tap = enter(t, b.tap, 0.6)
  const low = enter(t, b.low, 0.6)
  return (
    <>
      <Svg>
        <DividerPic x={x} wires={wires} tap={tap} phase={phase} dots={enter(t, b.ser, 0.4)} tapEnd={30} />
        <g stroke={VOLT} strokeWidth={0.4}>
          <Draw d={`M${x + 7} ${R2A + 0.5} V${R2B - 0.5}`} p={low} />
          <Draw d={`M${x + 5.6} ${R2A + 2.4} L${x + 7} ${R2A + 0.5} L${x + 8.4} ${R2A + 2.4} M${x + 5.6} ${R2B - 2.4} L${x + 7} ${R2B - 0.5} L${x + 8.4} ${R2B - 2.4}`} p={low} />
        </g>
      </Svg>
      <T x={x - 5} y={TY} size={3} anchor="end" o={wires}>
        <V c={VOLT}>V</V>
        <sub style={{ fontSize: "0.6em" }}>in</sub>
      </T>
      <T x={x - 6} y={(R1A + R1B) / 2} size={3.6} anchor="end" o={enter(t, b.ser - 0.2, 0.4)}>
        <Rn n="1" />
      </T>
      <T x={x - 6} y={(R2A + R2B) / 2} size={3.6} anchor="end" o={enter(t, b.ser, 0.4)}>
        <Rn n="2" />
      </T>
      <T x={x + 38} y={NODE} size={4.6} anchor="start" o={enter(t, b.out, 0.45)}>
        <V c={VOLT}>V</V>
        <sub style={{ fontSize: "0.6em" }}>out</sub>
      </T>
      <T x={x + 38} y={NODE + 6} size={2.6} anchor="start" color={MUTED} o={enter(t, b.out, 0.45)}>
        输出
      </T>
      <T x={x + 10.5} y={(R2A + R2B) / 2} size={2.8} anchor="start" color={VOLT} o={low}>
        <Rn n="2" c={VOLT} /> 上的电压
      </T>
    </>
  )
}

// ── Vout = Vin × R2 / (R1 + R2) ──────────────────────────────────────────────

function Formula({ t, b }: Pick<StageProps, "t" | "b">) {
  const barP = enter(t, b.ratio, 0.8)
  return (
    <>
      <T x={50} y={21} size={7}>
        <span className="inline-flex items-center gap-[0.28em]">
          <span className="relative" style={{ opacity: enter(t, b.vo - 0.1, 0.4) }}>
            <V c={VOLT}>V</V>
            <sub style={{ fontSize: "0.6em" }}>out</sub>
            <Sub>输出电压</Sub>
          </span>
          <span style={{ opacity: enter(t, b.vo + 0.3, 0.4) }}>
            <M>=</M>
          </span>
          <span className="relative" style={{ opacity: enter(t, b.vi, 0.4) }}>
            <V c={VOLT}>V</V>
            <sub style={{ fontSize: "0.6em" }}>in</sub>
            <Sub>输入电压</Sub>
          </span>
          <span style={{ opacity: enter(t, b.vi + 0.3, 0.4) }}>
            <M>×</M>
          </span>
          <span className="relative" style={{ opacity: enter(t, b.ratio - 0.1, 0.4) }}>
            <Frac top={<Rn n="2" />} bottom={<span><Rn n="1" /> <M>+</M> <Rn n="2" /></span>} bar={enter(t, b.ratio, 0.5)} />
          </span>
        </span>
      </T>
      <Svg>
        <rect x={25} y={40} width={50 / 3} height={4} rx={0.6} fill={MUTED} stroke="none" opacity={0.45 * barP} />
        <rect x={25 + 50 / 3} y={40} width={(100 / 3) * barP} height={4} rx={0.6} fill={VOLT} stroke="none" opacity={0.85 * barP} />
      </Svg>
      <T x={25 + 25 / 3} y={36.5} size={2.8} color={MUTED} o={barP}>
        <Rn n="1" />
      </T>
      <T x={25 + 50 / 3 + 50 / 3} y={36.5} size={2.8} color={VOLT} o={barP}>
        <Rn n="2" c={VOLT} />
      </T>
      <T x={50} y={48.5} size={2.8} color={MUTED} o={enter(t, b.ratio + 0.9, 0.5)}>
        <Rn n="2" /> 占总电阻的比例
      </T>
    </>
  )
}

// ── 5 V, 10 k, 20 k → 3.33 V ─────────────────────────────────────────────────

function Example({ t, b, still }: StageProps) {
  const x = 26
  const wires = enter(t, b.ex - 0.3, 0.8)
  const phase = still ? 0 : integ(() => 7, b.ex, Math.max(t, b.ex))
  const tap = enter(t, b.ex, 0.6)
  const e = (at: number) => enter(t, at, 0.4)
  return (
    <>
      <Svg>
        <DividerPic x={x} wires={wires} tap={tap} phase={phase} dots={enter(t, b.ex, 0.4)} tapEnd={20} />
      </Svg>
      <T x={x} y={6} size={3.4} weight={600} color={VOLT} o={e(b.e5)} className="tabular">
        <M>5 V</M>
      </T>
      <T x={x - 5} y={(R1A + R1B) / 2} size={3} anchor="end" o={e(b.e1)} className="tabular">
        <M>10 kΩ</M>
      </T>
      <T x={x - 5} y={(R2A + R2B) / 2} size={3} anchor="end" o={e(b.e2)} className="tabular">
        <M>20 kΩ</M>
      </T>
      <T x={x + 22} y={NODE} size={4.4} anchor="start" weight={600} color={VOLT} o={e(b.e33)} className="tabular">
        <M>3.33 V</M>
      </T>
      <T x={72} y={20} size={3.6}>
        <span className="inline-flex items-center gap-[0.3em] tabular">
          <span style={{ opacity: e(b.e5) }}>
            <M c={VOLT}>5 V</M>
          </span>
          <span style={{ opacity: e(b.e1) }}>
            <M>×</M>
          </span>
          <Frac
            top={
              <M>
                <span style={{ opacity: e(b.e2) }}>20</span>
              </M>
            }
            bottom={
              <M>
                <span style={{ opacity: e(b.e1) }}>10</span>
                <span style={{ opacity: e(b.e2) }}> + 20</span>
              </M>
            }
            bar={enter(t, b.e1, 0.5)}
          />
        </span>
      </T>
      <T x={72} y={36} size={6} weight={600} color={VOLT} o={e(b.e33)} className="tabular">
        <span className="inline-block" style={{ transform: `scale(${lerp(1.15, 1, enter(t, b.e33, 0.5))})` }}>
          <M>≈ 3.33 V</M>
        </span>
      </T>
    </>
  )
}

// ── KVL ──────────────────────────────────────────────────────────────────────

const BASE = 46
const VS = 5.4 // stage units per volt

function Kvl({ t, b }: Pick<StageProps, "t" | "b">) {
  const up = easeInOut((t - b.lap) / 0.7)
  const s1 = easeInOut((t - b.k167) / 0.6)
  const s2 = easeInOut((t - b.k333) / 0.6)
  const h1 = 1.67 * VS
  const h2 = 3.33 * VS
  return (
    <>
      <T x={50} y={9} size={2.8} color={MUTED} o={enter(t, b.kvl - 0.1, 0.5)}>
        沿回路走一圈
      </T>
      <Svg>
        <path d={`M12 ${BASE} H88`} stroke={LINE} strokeWidth={0.25} opacity={enter(t, b.kvl - 0.1, 0.5)} />
        <rect x={23} y={BASE - 5 * VS * up} width={10} height={Math.max(0.01, 5 * VS * up)} rx={0.8} fill={VOLT} stroke="none" opacity={0.9} />
        {/* the right column: R1's share on top, R2's below it */}
        <path d={`M${20} ${BASE - 5 * VS} H80`} stroke={MUTED} strokeWidth={0.2} strokeDasharray="1 0.8" opacity={up} />
        <rect x={63} y={BASE - 5 * VS} width={10} height={Math.max(0.01, h1 * s1)} rx={0.8} fill={VOLT} stroke="none" opacity={0.4 * enter(t, b.k167, 0.2)} />
        <rect x={63} y={BASE - 5 * VS + h1} width={10} height={Math.max(0.01, h2 * s2)} rx={0.8} fill={VOLT} stroke="none" opacity={0.85 * enter(t, b.k333, 0.2)} />
        <g stroke={VOLT} strokeWidth={0.4} opacity={enter(t, b.lap + 0.3, 0.4)}>
          <path d="M38 40 V22 M36.4 24.2 L38 22 L39.6 24.2" />
        </g>
        <g stroke={VOLT} strokeWidth={0.4} opacity={enter(t, b.k167, 0.4)}>
          <path d="M58 22 V40 M56.4 37.8 L58 40 L59.6 37.8" />
        </g>
      </Svg>
      <T x={28} y={BASE + 3.4} size={3.4} weight={600} color={VOLT} o={enter(t, b.k5, 0.4)} className="tabular">
        <M>5 V</M>
      </T>
      <T x={28} y={15} size={3} color={MUTED} o={enter(t, b.lap + 0.3, 0.4)}>
        电池升高
      </T>
      <T x={78} y={BASE - 5 * VS + h1 / 2} size={3} anchor="start" color={VOLT} weight={600} o={enter(t, b.k167, 0.4)} className="tabular">
        <span className="inline-flex items-center gap-[0.3em]">
          <Rn n="1" c={VOLT} /> <M>1.67 V</M>
        </span>
      </T>
      <T x={78} y={BASE - 5 * VS + h1 + h2 / 2} size={3} anchor="start" color={VOLT} weight={600} o={enter(t, b.k333, 0.4)} className="tabular">
        <span className="inline-flex items-center gap-[0.3em]">
          <Rn n="2" c={VOLT} /> <M>3.33 V</M>
        </span>
      </T>
      <T x={68} y={15} size={3} color={MUTED} o={enter(t, b.k167, 0.4)}>
        电阻降低
      </T>
      <T x={48} y={32} size={7} o={enter(t, b.k5 - 0.1, 0.4)}>
        <M>=</M>
      </T>
    </>
  )
}

// ── KCL ──────────────────────────────────────────────────────────────────────

function Kcl({ t, b, still }: StageProps) {
  const base = still ? 0 : integ((s) => enter(s, b.inn, 0.6), b.inn, Math.max(t, b.inn))
  const outBase = still ? 0 : integ((s) => enter(s, b.outc, 0.6), b.outc, Math.max(t, b.outc))
  const w = enter(t, b.kcl - 0.3, 0.8)
  const nodeX = 46
  return (
    <>
      <Svg>
        <Draw d={`M10 30 H${nodeX}`} p={w} />
        <Draw d={`M${nodeX} 30 V19 H90`} p={enter(t, b.node, 0.7)} />
        <Draw d={`M${nodeX} 30 V41 H90`} p={enter(t, b.node + 0.2, 0.7)} />
        <circle cx={nodeX} cy={30} r={1.3} fill="var(--foreground)" stroke="none" opacity={enter(t, b.node, 0.4)} />
        <circle cx={nodeX} cy={30} r={3.4} stroke={VOLT} strokeWidth={0.35} opacity={span(t, b.node, b.node + 1.4, 0.2, 0.8) * 0.9} />
        <Flow x0={10} y0={30} x1={nodeX} y1={30} phase={base * 5 * 1.2} o={enter(t, b.inn, 0.4)} />
        <Flow x0={nodeX} y0={30} x1={nodeX} y1={19} phase={outBase * 3 * 1.2} o={enter(t, b.outc, 0.4)} />
        <Flow x0={nodeX} y0={19} x1={90} y1={19} phase={outBase * 3 * 1.2 + 11} o={enter(t, b.outc, 0.4)} />
        <Flow x0={nodeX} y0={30} x1={nodeX} y1={41} phase={outBase * 2 * 1.2} o={enter(t, b.outc, 0.4)} />
        <Flow x0={nodeX} y0={41} x1={90} y1={41} phase={outBase * 2 * 1.2 + 11} o={enter(t, b.outc, 0.4)} />
      </Svg>
      <T x={nodeX} y={36} size={2.8} anchor="start" color={MUTED} o={enter(t, b.node, 0.4)} dy={0}>
        <span style={{ marginLeft: "3.5cqw" }}>节点</span>
      </T>
      <T x={28} y={24.5} size={4} weight={600} color={AMP} o={enter(t, b.inn, 0.4)} className="tabular">
        <M>5 mA</M>
      </T>
      <T x={70} y={13.5} size={4} weight={600} color={AMP} o={enter(t, b.outc, 0.4)} className="tabular">
        <M>3 mA</M>
      </T>
      <T x={70} y={47} size={4} weight={600} color={AMP} o={enter(t, b.outc + 0.3, 0.4)} className="tabular">
        <M>2 mA</M>
      </T>
      <T x={22} y={44} size={4.6} o={enter(t, b.outc + 1.0, 0.5)} className="tabular">
        <M>
          <span style={{ color: AMP }}>5</span> = <span style={{ color: AMP }}>3</span> + <span style={{ color: AMP }}>2</span>
        </M>
      </T>
    </>
  )
}

// ── a load pulls the output down ─────────────────────────────────────────────

function Load({ t, b, still }: StageProps) {
  const x = 26
  const wires = enter(t, b.ld - 0.3, 0.8)
  const phase = still ? 0 : integ(() => 7, b.ld - 0.3, Math.max(t, b.ld - 0.3))
  const tap = enter(t, b.ld - 0.2, 0.6)
  const loadP = enter(t, b.load, 0.7)
  const vout = glide(t, b.drop, 3.33, 2, 0.8)
  const par = enter(t, b.par, 0.5)
  return (
    <>
      <Svg>
        <DividerPic x={x} wires={wires} tap={tap} phase={phase} dots={enter(t, b.ld, 0.4)} tapEnd={30} />
        {/* the load hangs off the tap and goes to ground */}
        <Draw d={`M${x + 30} ${NODE} V${R2A} ${zig(x + 30, R2A, x + 30, R2B, 6, 1.6)} M${x + 30} ${R2B} H${x}`} p={loadP} />
        <rect x={x - 3} y={R2A - 1.6} width={30 + 6} height={R2B - R2A + 3.2 + 2} rx={2} stroke={VOLT} strokeWidth={0.3} strokeDasharray="1 0.8" opacity={par} />
      </Svg>
      <T x={x} y={6} size={3.4} weight={600} color={VOLT} o={wires} className="tabular">
        <M>5 V</M>
      </T>
      <T x={x - 5} y={(R1A + R1B) / 2} size={3} anchor="end" o={wires} className="tabular">
        <M>10 kΩ</M>
      </T>
      <T x={x - 5} y={(R2A + R2B) / 2} size={3} anchor="end" o={wires} className="tabular">
        <M>20 kΩ</M>
      </T>
      <T x={x + 34} y={(R2A + R2B) / 2 - 2.8} size={2.8} anchor="start" o={loadP}>
        负载 <V>R</V>
        <sub style={{ fontSize: "0.6em" }}>L</sub>
      </T>
      <T x={x + 34} y={(R2A + R2B) / 2 + 2.8} size={2.8} anchor="start" o={loadP} className="tabular">
        <M>10 kΩ</M>
      </T>
      <T x={x + 17} y={51} size={2.8} color={MUTED} o={par} className="tabular">
        <M>20 kΩ ∥ 10 kΩ ≈ 6.67 kΩ</M>
      </T>
      <T x={78} y={15} size={2.6} anchor="start" color={MUTED} o={enter(t, b.ld, 0.5)}>
        输出 <V c={VOLT}>V</V>
        <sub style={{ fontSize: "0.6em" }}>out</sub>
      </T>
      <T x={95} y={24} size={5.4} anchor="end" weight={600} color={VOLT} o={enter(t, b.ld, 0.5)} className="tabular">
        <M>{vout.toFixed(2)} V</M>
      </T>
      <T x={95} y={31} size={3} anchor="end" weight={600} color={BAD} o={enter(t, b.drop + 0.4, 0.5)}>
        <M>↓</M> 被拉低
      </T>
    </>
  )
}

// ── how big must the load be ─────────────────────────────────────────────────

const GX = 16
const GY = 46
const gx = (r: number) => GX + 20 * (Math.log10(r) + 1)
const gy = (v: number) => GY - 8.5 * v
const vOut = (r: number) => {
  const r2 = (20 * r) / (1 + r)
  return (5 * r2) / (10 + r2)
}

function Ten({ t, b }: Pick<StageProps, "t" | "b">) {
  const axes = enter(t, b.ten - 0.3, 0.7)
  const curve = enter(t, b.ten - 0.1, 1.2)
  const pts: string[] = []
  const n = Math.round(curve * 60)
  for (let i = 0; i <= n; i++) {
    const r = 0.1 * 10 ** ((3 * i) / 60)
    pts.push(`${i ? "L" : "M"}${gx(r)} ${gy(vOut(r))}`)
  }
  const mark = enter(t, b.tenx, 0.5)
  const band = enter(t, b.stable, 0.6)
  return (
    <>
      <Svg>
        <rect x={gx(10)} y={gy(4)} width={gx(100) - gx(10) + 2} height={GY - gy(4)} fill={GOOD} stroke="none" opacity={band * 0.12} />
        <Draw d={`M${GX} ${GY} H${gx(100) + 4}`} p={axes} />
        <Draw d={`M${GX} ${GY} V${gy(4) - 2}`} p={axes} />
        <g opacity={axes} strokeWidth={0.2}>
          <path d={`M${gx(1)} ${GY} v0.9 M${gx(10)} ${GY} v0.9 M${gx(100)} ${GY} v0.9 M${GX} ${gy(3.33)} h-0.9`} />
        </g>
        <path d={`M${GX} ${gy(3.33)} H${gx(100) + 4}`} stroke={MUTED} strokeWidth={0.25} strokeDasharray="1 0.8" opacity={enter(t, b.ten, 0.5)} />
        {n > 0 && <path d={pts.join(" ")} stroke={VOLT} strokeWidth={0.5} />}
        <path d={`M${gx(10)} ${gy(vOut(10))} V${GY}`} stroke={MUTED} strokeWidth={0.25} strokeDasharray="1 0.8" opacity={mark} />
        <circle cx={gx(10)} cy={gy(vOut(10))} r={1} fill={VOLT} stroke="none" opacity={mark} />
      </Svg>
      <T x={GX - 1.6} y={gy(3.33)} size={2.2} anchor="end" color={MUTED} o={axes} className="tabular">
        3.33 V
      </T>
      <T x={GX + 1} y={gy(4) - 4} size={2.4} anchor="start" color={MUTED} o={axes}>
        输出 <V c={VOLT}>V</V>
        <sub style={{ fontSize: "0.6em" }}>out</sub>
      </T>
      {([1, 10, 100] as const).map((r) => (
        <T key={r} x={gx(r)} y={GY + 3} size={2.2} color={MUTED} o={axes} className="tabular">
          {r}×
        </T>
      ))}
      <T x={gx(100) + 6} y={GY} size={2.4} anchor="start" color={MUTED} o={axes}>
        负载 ÷ <Rn n="2" />
      </T>
      <T x={gx(1)} y={gy(3.33) - 3} size={2.4} color={MUTED} o={enter(t, b.ten, 0.5)}>
        空载
      </T>
      <T x={gx(10) + 1.5} y={gy(vOut(10)) + 11} size={3} weight={600} anchor="start" o={mark}>
        十倍
      </T>
      <T x={90} y={22} size={4.2} weight={600} color={GOOD} o={band}>
        基本稳住
      </T>
      <T x={90} y={29} size={2.8} color={MUTED} o={enter(t, b.tenx + 0.3, 0.5)} className="tabular">
        只低 3%
      </T>
    </>
  )
}

// ── ADC yes, power supply no ─────────────────────────────────────────────────

function Use({ t, b }: Pick<StageProps, "t" | "b">) {
  const cards = [
    { x: 27, ok: true, title: "给读数的引脚", sub: "12 V 电池 → 3 V，送进 ADC", at: b.adc, text: b.use - 0.1 },
    { x: 73, ok: false, title: "给模块供电", sub: "耗电一变，输出就乱跳", at: b.nopow - 0.3, text: b.nopow - 1.2 },
  ]
  return (
    <>
      <Svg>
        {cards.map((c) => (
          <g key={c.x}>
            <rect x={c.x - 21} y={14} width={42} height={30} rx={1.6} stroke={LINE} strokeWidth={0.25} opacity={enter(t, b.use - 0.2, 0.5)} />
            <g opacity={enter(t, c.at, 0.4)} stroke={c.ok ? GOOD : BAD} strokeWidth={0.7}>
              {c.ok ? <path d={`M${c.x - 3.5} 24 l3 3.2 l5.5 -6.4`} /> : <path d={`M${c.x - 3} 21 l6 6 M${c.x + 3} 21 l-6 6`} />}
            </g>
          </g>
        ))}
      </Svg>
      {cards.map((c) => (
        <React.Fragment key={c.x}>
          <T x={c.x} y={34} size={3.4} weight={600} o={enter(t, c.text, 0.4)}>
            {c.title}
          </T>
          <T x={c.x} y={39.5} size={2.5} color={MUTED} o={enter(t, c.text + 0.2, 0.4)}>
            {c.sub}
          </T>
        </React.Fragment>
      ))}
    </>
  )
}

// ── outro ────────────────────────────────────────────────────────────────────

function Outro({ t, b, still, rise }: { t: number; b: Record<string, number>; still: boolean; rise: (at: number, d?: number) => number }) {
  const chip = "rounded-full border border-input px-[1em] py-[0.5em]"
  return (
    <>
      <T x={50} y={17} size={6} weight={600} o={enter(t, b.outro - 0.25, 0.5)} dy={rise(b.outro - 0.25)}>
        动手试试
      </T>
      <T x={50} y={26} size={2.8} color={MUTED} o={enter(t, b.outro + 0.4, 0.5)}>
        用下面的两个实验台
      </T>
      <T x={30} y={36} size={2.8} color={AMP} className={chip} o={enter(t, b.d1 - 0.1, 0.5)} dy={rise(b.d1, 1)}>
        节点实验台：电流定律
      </T>
      <T x={70} y={36} size={2.8} color={VOLT} className={chip} o={enter(t, b.d2 - 0.1, 0.5)} dy={rise(b.d2, 1)}>
        分压器实验台
      </T>
      <Svg>
        <g opacity={enter(t, b.d1 + 0.3)} transform={`translate(0 ${still ? 0 : Math.sin(t * 3.2) * 0.6})`} strokeWidth={0.45}>
          <path d="M50 42 V49 M47.6 46.6 L50 49 L52.4 46.6" />
        </g>
      </Svg>
    </>
  )
}

export const film: FilmDef = {
  title: "分压器与基尔霍夫定律",
  audio,
  timing,
  poster: 6.4,
  Stage,
}

export default function VoltageDividerFilm() {
  return <FilmPlayer film={film} />
}

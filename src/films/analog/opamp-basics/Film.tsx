import * as React from "react"
import { trace } from "@/lab/colors"
import { OpAmp } from "@/lab/schematic"
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
 * 运算放大器入门, ~54 s. Scenes, each keyed to the words that introduce it:
 *   title → the op-amp symbol, its pins named
 *   → the transfer curve: a huge gain, then the rails stop the output
 *   → open loop: a sine against a reference, the output a square wave (a comparator)
 *   → feedback: the output wired back, the two inputs pulled equal; no current into the inputs
 *   → the follower holds 2.5 V where a bare divider collapses under a load → "try the comparator".
 */
function Stage({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.6) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)
  // each scene clears before the next one's drawing arrives
  const sym = span(t, 0.25, b.diff + 0.05, 0.4, 0.3)
  const xfer = span(t, b.diff + 0.05, b.open - 0.15, 0.3, 0.3)
  const comp = span(t, b.open - 0.1, b.fb - 0.35, 0.3, 0.3)
  const loop = span(t, b.fb - 0.05, b.fol - 0.15, 0.3, 0.3)
  const buf = span(t, b.fol - 0.3, b.outro - 0.15, 0.3, 0.3)
  const outro = enter(t, b.outro - 0.3, 0.4)

  return (
    <>
      <Scene o={sym}>
        <Symbol t={t} b={b} rise={rise} />
      </Scene>
      <Scene o={xfer}>
        <Transfer t={t} b={b} still={still} />
      </Scene>
      <Scene o={comp}>
        <Comparator t={t} b={b} still={still} />
      </Scene>
      <Scene o={loop}>
        <Feedback t={t} b={b} still={still} />
      </Scene>
      <Scene o={buf}>
        <Buffer t={t} b={b} still={still} />
      </Scene>
      <Scene o={outro}>
        <T x={50} y={24} size={6} weight={600} dy={rise(b.outro - 0.3)}>
          动手试试
        </T>
        <T x={50} y={32.5} size={2.8} color={MUTED} o={enter(t, b.drag)} dy={rise(b.drag, 1)}>
          先拖动下面比较器的参考电压
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

// ── the symbol ──────────────────────────────────────────────────────────────

function Symbol({ t, b, rise }: { t: number; b: StageProps["b"]; rise: (at: number, d?: number) => number }) {
  const CX = 64
  const CY = 28
  const S = 0.55
  const inp = enter(t, b.inp)
  const out = enter(t, b.outp)
  const pwr = enter(t, b.pwr)
  const body = enter(t, b.intro + 1.0, 0.8)
  const dot = (x: number, y: number, o: number, at: number) => <circle cx={x} cy={y} r={0.9 * pop(t, at)} fill={VOLT} stroke="none" opacity={o} />
  const my = CY - 14 * S
  const py = CY + 14 * S
  const ix = CX - 40 * S
  const ox = CX + 44 * S
  return (
    <>
      <T x={19} y={26} size={8} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
        运放
      </T>
      <T x={19} y={34} size={2.6} color={MUTED} o={enter(t, b.intro + 1.2)} dy={rise(b.intro + 1.2, 1)}>
        运算放大器
      </T>
      <Svg>
        <g opacity={body}>
          <Sym x={CX} y={CY} scale={S}>
            <OpAmp x={0} y={0} />
          </Sym>
        </g>
        <Draw d={`M${CX} ${CY - 8.3} V${CY - 17}`} p={pwr} />
        <Draw d={`M${CX} ${CY + 8.3} V${CY + 17}`} p={pwr} />
        {dot(ix, my, inp, b.inp)}
        {dot(ix, py, inp, b.inp + 0.2)}
        {dot(ox, CY, out, b.outp)}
      </Svg>
      <T x={ix - 2.2} y={my} size={2.4} anchor="end" color={MUTED} o={inp}>
        反相输入
      </T>
      <T x={ix - 2.2} y={py} size={2.4} anchor="end" color={MUTED} o={inp}>
        同相输入
      </T>
      <T x={ox + 2.2} y={CY} size={2.4} anchor="start" color={MUTED} o={out}>
        输出
      </T>
      <T x={CX} y={CY - 20.2} size={2.4} color={MUTED} o={pwr}>
        正电源
      </T>
      <T x={CX} y={CY + 20.2} size={2.4} color={MUTED} o={pwr}>
        负电源
      </T>
    </>
  )
}

// ── gain, then the rails ────────────────────────────────────────────────────

const OX = 50
const OY = 29
const VS = 2.8 // units per volt
const XS = 30 // units per millivolt

function Transfer({ t, b, still }: StageProps) {
  const axes = enter(t, b.diff + 0.15, 0.7)
  const mt = still ? b.stop : t
  const xu = still ? 0 : (6 + 3 * enter(mt, b.stop, 1)) * Math.sin(1.5 * (mt - b.dif))
  const volts = clamp(xu * (100000 / (XS * 1000)), -5, 5)
  const inDot = enter(t, b.diff + 1.2, 0.4)
  const ideal = enter(t, b.big - 0.3, 0.6)
  const rails = enter(t, b.ceil - 0.2, 0.5)
  const curveP = easeInOut((t - b.ceil) / 0.9)
  const kx = 5 / (100000 / (XS * 1000)) // x at which the output reaches 5 V
  const topY = 11
  const ix = (topY - OY) / (-VS * (100000 / (XS * 1000))) // |x| where the ideal line leaves the plot
  const curve = poly([
    [14, OY + VS * 5],
    [OX - kx, OY + VS * 5],
    [OX + kx, OY - VS * 5],
    [86, OY - VS * 5],
  ])
  return (
    <>
      <Svg>
        <Draw d="M14 29 H86" p={axes} />
        <Draw d="M50 47 V11" p={axes} />
        <g opacity={enter(t, b.diff + 0.6)} strokeWidth={0.2}>
          <path d={`M${OX - XS} ${OY} v0.9 M${OX + XS} ${OY} v0.9`} />
        </g>
        <g opacity={ideal * (1 - 0.7 * rails)} stroke={MUTED} strokeDasharray="0.8 0.8">
          <path d={`M${OX - ix} ${OY + 18} L${OX + ix} ${OY - 18}`} />
        </g>
        <g opacity={rails} stroke={VOLT} strokeWidth={0.2} strokeDasharray="0.8 0.8">
          <path d={`M14 ${OY - VS * 5} H86 M14 ${OY + VS * 5} H86`} />
        </g>
        <Draw d={curve} p={curveP} strokeWidth={0.45} />
        <g opacity={inDot}>
          <path d={`M${OX + xu} ${OY} V${OY - VS * volts}`} stroke={LINE} strokeWidth={0.2} opacity={rails} />
          <circle cx={OX + xu} cy={OY} r={0.9 * pop(t, b.dif)} fill={VOLT} stroke="none" />
        </g>
        <circle cx={OX + xu} cy={OY - VS * volts} r={0.95 * pop(t, b.ceil + 0.3)} fill="var(--foreground)" stroke="none" opacity={rails} />
      </Svg>
      <T x={86} y={OY - 2.6} size={2.2} anchor="end" color={MUTED} o={enter(t, b.diff + 0.4)}>
        输入差 <V>V+ − V−</V>
      </T>
      <T x={50} y={8.2} size={2.2} color={MUTED} o={axes}>
        输出
      </T>
      <T x={OX - XS} y={OY + 3.3} size={2} color={MUTED} o={enter(t, b.diff + 0.7)} className="tabular">
        −1 mV
      </T>
      <T x={OX + XS} y={OY + 3.3} size={2} color={MUTED} o={enter(t, b.diff + 0.7)} className="tabular">
        +1 mV
      </T>
      <T x={58} y={13.5} size={2.4} anchor="start" color={MUTED} o={span(t, b.big, b.ceil - 0.1)}>
        差 1 mV，本该输出 100 V
      </T>
      <T x={87.5} y={OY - VS * 5} size={2.2} anchor="start" weight={600} color={VOLT} o={rails} className="tabular">
        +5 V
      </T>
      <T x={87.5} y={OY + VS * 5} size={2.2} anchor="start" weight={600} color={VOLT} o={rails} className="tabular">
        −5 V
      </T>
      <T x={70} y={OY - VS * 5 - 2.4} size={2.2} color={MUTED} o={enter(t, b.stop)}>
        顶到头：饱和
      </T>
    </>
  )
}

// ── open loop: a comparator ─────────────────────────────────────────────────

function Comparator({ t, b, still }: StageProps) {
  const X0 = 14
  const X1 = 86
  const YI = 18
  const AMPL = 7
  const HI = 36
  const LO = 47
  const mt = still ? b.hi : t
  const wave = (x: number) => Math.sin(0.2 * (x - X0) - 1.7 * (mt - b.open))
  const ref = still ? 0.3 : 0.4 * Math.sin(0.9 * (mt - b.open))
  const yw = (x: number) => YI - AMPL * wave(x)
  const yr = YI - AMPL * ref
  const outLine = enter(t, b.cmp - 0.2, 0.6)
  const shade = enter(t, b.hi - 0.3, 0.5)
  const n = 240
  const area: [number, number][] = [[X0, yr]]
  const sq: [number, number][] = []
  for (let i = 0; i <= n; i++) {
    const x = X0 + ((X1 - X0) * i) / n
    area.push([x, Math.min(yw(x), yr)])
    sq.push([x, wave(x) > ref ? HI : LO])
  }
  area.push([X1, yr])
  return (
    <>
      <Svg>
        <g opacity={enter(t, b.nofb + 0.1, 0.6)}>
          <path d={sample(yw, X0, X1, 120)} stroke={VOLT} strokeWidth={0.42} />
          <path d={`M${X0} ${yr} H${X1}`} stroke={MUTED} strokeDasharray="0.8 0.8" strokeWidth={0.28} />
        </g>
        <path d={poly(area) + "Z"} fill={VOLT} fillOpacity={0.16 * shade} stroke="none" />
        <g opacity={outLine}>
          <path d={`M${X0} ${HI} H${X1} M${X0} ${LO} H${X1}`} stroke={LINE} strokeWidth={0.15} />
          <path d={poly(sq)} strokeWidth={0.5} />
        </g>
      </Svg>
      <T x={X0 - 1.6} y={YI} size={3} anchor="end" font="var" color={VOLT} o={enter(t, b.nofb)}>
        V+
      </T>
      <T x={X1 + 1.6} y={yr} size={3} anchor="start" font="var" color={MUTED} o={enter(t, b.nofb + 0.2)}>
        V−
      </T>
      <T x={X1 + 1.6} y={yr + 3.6} size={2} anchor="start" color={MUTED} o={enter(t, b.nofb + 0.2)}>
        参考
      </T>
      <T x={X0 - 1.6} y={HI} size={2.2} anchor="end" color={MUTED} o={outLine} className="tabular">
        +5 V
      </T>
      <T x={X0 - 1.6} y={LO} size={2.2} anchor="end" color={MUTED} o={outLine} className="tabular">
        −5 V
      </T>
      <T x={50} y={31.2} size={2.4} color={MUTED} o={outLine}>
        输出
      </T>
    </>
  )
}

// ── feedback: the inputs pulled equal ───────────────────────────────────────

function Feedback({ t, b, still }: StageProps) {
  const CX = 38
  const CY = 32
  const S = 0.5
  const wire = enter(t, b.fb + 0.3, 0.7)
  const fbw = easeInOut((t - b.fbk) / 0.9)
  const t0 = b.fbk + 0.9
  const mt = still ? b.shortw + 1 : t
  const vin = (x: number) => 2 + (x > b.adj ? 1.1 * Math.sin(1.0 * (x - b.adj)) : 0)
  const s = mt - t0
  const settle = s <= 0 ? 0 : 1 - Math.exp(-s / 0.35) * Math.cos(s * 7)
  const vplus = vin(mt)
  const vminus = lerp(0, vin(mt - 0.1), clamp(settle, -0.3, 1.3))
  const YB = 47
  const K = 6.4
  const BX1 = 76
  const BX2 = 87
  const bars = enter(t, b.fb)
  const eq = enter(t, b.eq)
  const zero = enter(t, b.zero)
  const pb = (v: number) => YB - K * v
  return (
    <>
      <Svg>
        <Sym x={CX} y={CY} scale={S} opacity={enter(t, b.fb + 0.05, 0.5)}>
          <OpAmp x={0} y={0} />
        </Sym>
        <Draw d="M5 39 H18" p={wire} />
        <Draw d="M60 32 H65 V11 H10 V25 H18" p={fbw} stroke={VOLT} />
        {/* bars */}
        <g opacity={bars}>
          <path d={`M${BX1 - 6} ${YB} H${BX2 + 6}`} stroke={LINE} strokeWidth={0.2} />
          <rect x={BX1 - 2.5} y={pb(vplus)} width={5} height={YB - pb(vplus)} fill={VOLT} fillOpacity={0.85} stroke="none" />
          <rect x={BX2 - 2.5} y={pb(vminus)} width={5} height={Math.max(0, YB - pb(vminus))} fill={VOLT} fillOpacity={0.85} stroke="none" />
          <path d={`M${BX1} ${pb(vplus)} H${BX2}`} stroke={MUTED} strokeWidth={0.2} strokeDasharray="0.6 0.6" />
        </g>
      </Svg>
      <T x={7} y={35.5} size={2.4} font="var" color={VOLT} o={wire}>
        Vin
      </T>
      <T x={65.5} y={35.5} size={2.4} font="var" o={enter(t, b.fbk)}>
        Vout
      </T>
      <T x={BX1} y={50.6} size={2.6} font="var" o={bars}>
        V+
      </T>
      <T x={BX2} y={50.6} size={2.6} font="var" o={bars}>
        V−
      </T>
      <T x={81.5} y={14} size={4} o={eq}>
        <span className="inline-flex items-center gap-[0.3em]">
          <V c={VOLT}>V+</V>
          <M>=</M>
          <V c={VOLT}>V−</V>
        </span>
      </T>
      <T x={81.5} y={8.5} size={2.6} weight={600} color={MUTED} o={enter(t, b.shortw)}>
        虚短
      </T>
      <T x={13} y={42.6} size={2.4} color={AMP} o={zero} className="tabular">
        I ≈ 0
      </T>
      <T x={14} y={22} size={2.4} color={AMP} o={zero} className="tabular">
        I ≈ 0
      </T>
      <T x={38} y={6.5} size={2.6} weight={600} color={MUTED} o={enter(t, b.brkw)}>
        虚断
      </T>
    </>
  )
}

// ── the follower holds, the bare divider sags ───────────────────────────────

function Buffer({ t, b }: StageProps) {
  const YB = 44
  const K = 8
  const load = glide(t, b.load, 0, 1, 0.5)
  const left = lerp(2.5, 0.42, load)
  const cols = [
    { x: 27, head: "直接接负载", sub: "分压点 → 负载", v: left, sag: true },
    { x: 73, head: "接跟随器再带负载", sub: "分压点 → 跟随器 → 负载", v: 2.5, sag: false },
  ]
  return (
    <>
      <Svg>
        <path d={`M12 ${YB - 2.5 * K} H88`} stroke={MUTED} strokeWidth={0.2} strokeDasharray="0.8 0.8" opacity={enter(t, b.fol + 0.6)} />
        {cols.map((c) => (
          <g key={c.x}>
            <path d={`M${c.x - 9} ${YB} H${c.x + 9}`} stroke={LINE} strokeWidth={0.2} opacity={enter(t, b.fol)} />
            <rect x={c.x - 3.5} y={YB - K * c.v} width={7} height={K * c.v} fill={c.sag ? VOLT : VOLT} fillOpacity={0.85} stroke="none" opacity={enter(t, b.fol + 0.2)} />
          </g>
        ))}
      </Svg>
      {cols.map((c, i) => (
        <React.Fragment key={c.x}>
          <T x={c.x} y={10} size={3.2} weight={600} o={enter(t, b.fol + 0.1 * i)}>
            {c.head}
          </T>
          <T x={c.x} y={16} size={2.2} color={MUTED} o={enter(t, b.fol + 0.4 + 0.1 * i)}>
            {c.sub}
          </T>
          <T x={c.x + 6} y={c.v > 1 ? YB - (K * c.v) / 2 : YB - K * c.v - 2.4} size={4} anchor="start" weight={600} color={VOLT} o={enter(t, b.fol + 0.5)} className="tabular">
            {c.v.toFixed(c.sag && load > 0.02 ? 2 : 1)} V
          </T>
        </React.Fragment>
      ))}
      <T x={27} y={48.8} size={2.2} color={MUTED} o={enter(t, b.load)}>
        1 kΩ 负载 · 电压掉到 0.42 V
      </T>
      <T x={73} y={48.8} size={2.2} color={MUTED} o={enter(t, b.stable)}>
        同样的负载 · 电压不动
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "运算放大器入门",
  audio,
  timing,
  poster: 7,
  Stage,
}

export default function OpampBasicsFilm() {
  return <FilmPlayer film={film} />
}

import * as React from "react"
import { Bjt, Lamp, Mosfet, Resistor } from "@/lab/schematic"
import { trace } from "@/lab/colors"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, M, Scene, Svg, Sym, T, V, clamp01, easeInOut, enter, glide, lerp, span, type FilmDef, type StageProps } from "../../kit"
import { AMP, Arrow, FlowDots, HEAT, LINE, MUTED, Sb, VOLT, curvePts, polyD, type Pt } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

/*
 * MOSFET, 68 s. Scenes, each keyed to the words that introduce it:
 *   title → the BJT's trouble: the bigger the load, the more base current
 *   → a voltage, no current: the three legs → a cross-section: gate voltage opens a channel
 *   → the threshold on an I–V curve → "just a small resistor" (R_DS(on)) → P = I² R
 *   → 3.3 V on a logic-level part and a standard part → the two gate resistors → "try it below".
 */

const N_REGION = trace.third

function Stage({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.6) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)
  const lift = (at: number) => (still ? 0 : -easeInOut((t - at) / 0.45) * 2)

  const title = span(t, 0.25, b.idea - 0.15, 0.4, 0.3)
  const idea = span(t, b.idea - 0.3, b.channel - 0.15, 0.3, 0.3)
  const channel = span(t, b.channel - 0.3, b.thresh - 0.15, 0.3, 0.3)
  const thresh = span(t, b.thresh - 0.3, b.rds - 0.15, 0.3, 0.3)
  const rds = span(t, b.rds - 0.3, b.heat - 0.15, 0.3, 0.3)
  const heat = span(t, b.heat - 0.3, b.logic - 0.15, 0.3, 0.3)
  // the logic-level comparison holds until "烫得厉害" has been read
  const logic = span(t, b.logic - 0.3, b.gate + 0.3, 0.3, 0.3)
  const gate = span(t, b.gate + 0.3, b.outro - 0.15, 0.3, 0.3)
  const outro = enter(t, b.outro - 0.3, 0.4)

  return (
    <>
      <Scene o={title} dy={lift(b.idea - 0.45)}>
        <Title t={t} b={b} still={still} rise={rise} />
      </Scene>
      <Scene o={idea}>
        <Legs t={t} b={b} still={still} rise={rise} />
      </Scene>
      <Scene o={channel}>
        <Channel t={t} b={b} still={still} />
      </Scene>
      <Scene o={thresh}>
        <Threshold t={t} b={b} />
      </Scene>
      <Scene o={rds}>
        <Rds t={t} b={b} still={still} rise={rise} />
      </Scene>
      <Scene o={heat}>
        <Heat t={t} b={b} rise={rise} />
      </Scene>
      <Scene o={logic}>
        <Logic t={t} b={b} rise={rise} />
      </Scene>
      <Scene o={gate}>
        <GateResistors t={t} b={b} rise={rise} />
      </Scene>
      <Scene o={outro}>
        <Outro t={t} b={b} still={still} rise={rise} />
      </Scene>
    </>
  )
}

// ── title: the BJT's trouble ─────────────────────────────────────────────────

function Title({ t, b, still, rise }: StageProps & { rise: (at: number, d?: number) => number }) {
  const sym = enter(t, b.intro + 0.2, 0.7)
  const grow = glide(t, b.more - 0.2, 0.3, 1, 1.4)
  const ph = still ? 0 : Math.max(0, t - b.bjt) * (6 + 8 * enter(t, b.more, 0.8))
  const flow = enter(t, b.bjt + 0.3, 0.5)
  const bars = enter(t, b.bjt + 0.4, 0.5)
  return (
    <>
      <T x={50} y={8} size={7} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
        MOSFET
      </T>
      <Svg>
        <Sym x={30} y={34} scale={0.55} opacity={sym}>
          <Bjt x={0} y={0} />
        </Sym>
        <Draw d="M3 34 H13.5" p={sym} />
        {/* the collector lead, on the symbol's collector (x + 14 × scale) */}
        <Draw d="M37.7 13.5 V17.5" p={sym} />
        <FlowDots pts={[[3, 34], [13.5, 34]]} phase={ph} gap={2.6} o={flow} />
        <g stroke={LINE} strokeWidth={0.25} opacity={bars}>
          <rect x={58} y={26} width={36} height={4} rx={1} />
          <rect x={58} y={40} width={36} height={4} rx={1} />
        </g>
        <rect x={58.3} y={26.3} width={35.4 * grow} height={3.4} rx={0.8} fill={AMP} stroke="none" opacity={bars} />
        <rect x={58.3} y={40.3} width={35.4 * grow * 0.1 + 0.4} height={3.4} rx={0.8} fill={AMP} stroke="none" opacity={bars} />
      </Svg>
      <T x={58} y={22} size={2.6} anchor="start" color={MUTED} o={bars}>
        负载电流 <V c={AMP}>I</V>
        <Sb>C</Sb>
      </T>
      <T x={58} y={36} size={2.6} anchor="start" color={MUTED} o={bars}>
        基极电流 <V c={AMP}>I</V>
        <Sb>B</Sb>
      </T>
      <T x={8} y={41} size={2.6} color={MUTED} o={flow} anchor="start">
        基极
      </T>
      <T x={76} y={52} size={2.6} color={MUTED} o={enter(t, b.more, 0.5)}>
        负载越大，要喂得越多
      </T>
    </>
  )
}

// ── a voltage, three legs ────────────────────────────────────────────────────

function Legs({ t, b, rise }: StageProps & { rise: (at: number, d?: number) => number }) {
  const sym = enter(t, b.idea - 0.2, 0.7)
  return (
    <>
      <Svg>
        <Sym x={50} y={30} scale={0.55} opacity={sym}>
          <Mosfet x={0} y={0} />
        </Sym>
        <Draw d="M12 30 H33.5" p={sym} />
        <Draw d="M57.7 13.5 V8" p={sym} />
        <Draw d="M57.7 46.5 V51" p={sym} />
        <circle cx={12} cy={30} r={0.8} fill="var(--background)" opacity={sym} />
        <Arrow x1={6} y1={20} x2={6} y2={26} p={enter(t, b.volt, 0.5)} color={VOLT} width={0.4} />
        <g opacity={enter(t, b.g, 0.3)} stroke={VOLT} strokeWidth={0.7}>
          <path d="M12 30 H33.5" />
        </g>
        <g opacity={enter(t, b.d, 0.3)} stroke={AMP} strokeWidth={0.7}>
          <path d="M57.7 13.5 V8" />
        </g>
        <g opacity={enter(t, b.s, 0.3)} stroke={MUTED} strokeWidth={0.7}>
          <path d="M57.7 46.5 V51" />
        </g>
      </Svg>
      <T x={50} y={5} size={3.2} weight={600} o={enter(t, b.idea + 0.1)} dy={rise(b.idea, 1)}>
        场效应管
      </T>
      <T x={6} y={16} size={2.8} weight={600} color={VOLT} o={enter(t, b.volt)}>
        电压
      </T>
      <T x={23} y={24.5} size={3} weight={600} color={AMP} o={enter(t, b.zero, 0.4)} dy={rise(b.zero, 1)} className="tabular">
        <M>≈ 0 mA</M>
      </T>
      <T x={23} y={36} size={3.4} weight={600} o={enter(t, b.g)}>
        栅极 <V c={MUTED}>G</V>
      </T>
      <T x={62} y={9} size={3.4} weight={600} anchor="start" o={enter(t, b.d)}>
        漏极 <V c={MUTED}>D</V>
      </T>
      <T x={62} y={51} size={3.4} weight={600} anchor="start" o={enter(t, b.s)}>
        源极 <V c={MUTED}>S</V>
      </T>
      <T x={23} y={42} size={2.8} color={VOLT} o={enter(t, b.ctrl, 0.4)}>
        控制端
      </T>
    </>
  )
}

// ── cross-section: the gate opens a channel ─────────────────────────────────

function Channel({ t, b, still }: StageProps) {
  const parts = enter(t, b.channel - 0.2, 0.7)
  const vg = glide(t, b.vg, 0, 4, 1.8)
  const chan = clamp01(vg / 4)
  const ph = still ? 0 : Math.max(0, t - b.ch) * 10
  return (
    <>
      <Svg>
        <g opacity={parts}>
          <rect x={18} y={30} width={64} height={16} fill="var(--muted-foreground)" fillOpacity={0.08} stroke={LINE} strokeWidth={0.25} />
          <rect x={18} y={30} width={18} height={8} fill={N_REGION} fillOpacity={0.4} stroke="none" />
          <rect x={64} y={30} width={18} height={8} fill={N_REGION} fillOpacity={0.4} stroke="none" />
          <rect x={36} y={26} width={28} height={4} fill="var(--muted-foreground)" fillOpacity={0.16} stroke={MUTED} strokeWidth={0.2} />
          <rect x={36} y={19.6} width={28} height={6.4} fill="var(--foreground)" fillOpacity={0.05} />
          <path d="M27 30 V16 M73 30 V16 M50 19.6 V16" />
        </g>
        {/* the channel and the charge on the gate */}
        <rect x={36} y={30} width={28} height={3 * chan} fill={AMP} fillOpacity={0.55} stroke="none" />
        <g stroke={VOLT} strokeWidth={0.35} opacity={chan}>
          <path d="M42 21.7 v2.2 M40.9 22.8 h2.2 M50 21.7 v2.2 M48.9 22.8 h2.2 M58 21.7 v2.2 M56.9 22.8 h2.2" />
        </g>
        <FlowDots pts={[[36, 31.4], [64, 31.4]]} phase={ph} gap={4} o={clamp01((chan - 0.5) * 2)} r={0.5} />
      </Svg>
      <T x={27} y={12.5} size={3} weight={600} o={enter(t, b.channel + 0.2)}>
        源极 <V c={MUTED}>S</V>
      </T>
      <T x={50} y={12.5} size={3} weight={600} o={enter(t, b.channel + 0.2)}>
        栅极 <V c={MUTED}>G</V>
      </T>
      <T x={73} y={12.5} size={3} weight={600} o={enter(t, b.channel + 0.2)}>
        漏极 <V c={MUTED}>D</V>
      </T>
      <T x={50} y={28} size={2.3} color={MUTED} o={enter(t, b.ox, 0.4)}>
        绝缘层
      </T>
      <T x={50} y={40} size={2.8} weight={600} color={AMP} o={enter(t, b.ch, 0.4)}>
        沟道
      </T>
      <T x={95} y={6.5} size={2.4} anchor="end" color={MUTED} o={enter(t, b.vg - 0.2)}>
        栅极电压 <V c={VOLT}>V</V>
        <Sb>GS</Sb>
      </T>
      <T x={95} y={13.5} size={4.6} anchor="end" weight={600} color={VOLT} o={enter(t, b.vg - 0.2)} className="tabular">
        <M>{vg.toFixed(1)} V</M>
      </T>
    </>
  )
}

// ── the threshold ────────────────────────────────────────────────────────────

const OX = 14
const OY = 44
const XS = 12
const VTH = 1.5
const idOf = (v: number) => (v <= VTH ? 0 : Math.min(36, 1.68 * (v - VTH) ** 2))
const ID_PATH = polyD(curvePts(idOf, 0, 6, 80).map(([v, i]) => [OX + v * XS, OY - i] as Pt))

function Threshold({ t, b }: Pick<StageProps, "t" | "b">) {
  const axes = enter(t, b.thresh + 0.05, 0.6)
  const curve = easeInOut((t - (b.thresh + 0.3)) / 2)
  const thx = OX + VTH * XS
  const fullX = OX + 4.5 * XS
  return (
    <>
      <Svg>
        <Draw d={`M${OX - 2} ${OY} H88`} p={axes} />
        <Draw d={`M${OX} ${OY + 2} V8`} p={axes} />
        <g opacity={enter(t, b.thresh + 0.4)}>
          <path d={`M86.6 ${OY - 1.1} L88 ${OY} L86.6 ${OY + 1.1} M${OX - 1.1} 9.4 L${OX} 8 L${OX + 1.1} 9.4`} />
        </g>
        <Draw d={ID_PATH} p={curve} stroke={AMP} strokeWidth={0.5} />
        <g opacity={enter(t, b.th, 0.4)} stroke={MUTED} strokeWidth={0.22} strokeDasharray="0.8 0.8">
          <path d={`M${thx} ${OY + 2} V${OY - 9}`} />
        </g>
        <circle cx={thx} cy={OY} r={1} fill={VOLT} stroke="none" opacity={enter(t, b.th, 0.4)} />
        <g opacity={enter(t, b.far, 0.5)} stroke={MUTED} strokeWidth={0.22} strokeDasharray="0.8 0.8">
          <path d={`M${fullX} ${OY + 2} V19`} />
        </g>
        <Arrow x1={thx} y1={19} x2={fullX} y2={19} p={enter(t, b.far, 0.8)} color={HEAT} width={0.4} />
        <Arrow x1={fullX} y1={19} x2={thx} y2={19} p={enter(t, b.far, 0.8)} color={HEAT} width={0.4} />
      </Svg>
      <T x={92} y={OY - 3.8} size={2.4} anchor="end" color={MUTED} o={enter(t, b.thresh + 0.4)}>
        栅极电压 <V c={VOLT}>V</V>
        <Sb>GS</Sb>
      </T>
      <T x={OX} y={5.2} size={2.4} color={MUTED} o={enter(t, b.thresh + 0.4)}>
        漏极电流 <V c={AMP}>I</V>
        <Sb>D</Sb>
      </T>
      <T x={thx} y={OY + 5} size={2.6} weight={600} color={VOLT} o={enter(t, b.th, 0.4)}>
        阈值电压 <V c={VOLT}>V</V>
        <Sb>th</Sb>
      </T>
      <T x={thx + 1} y={OY - 12} size={2.6} anchor="start" color={MUTED} o={enter(t, b.th + 0.4)}>
        刚开始导通
      </T>
      <T x={fullX} y={OY + 5} size={2.6} color={MUTED} o={enter(t, b.far, 0.4)}>
        完全导通
      </T>
      <T x={(thx + fullX) / 2} y={14.5} size={2.8} weight={600} color={HEAT} o={enter(t, b.far + 0.2, 0.4)}>
        还差得远
      </T>
    </>
  )
}

// ── a small resistor ─────────────────────────────────────────────────────────

function Rds({ t, b, still, rise }: StageProps & { rise: (at: number, d?: number) => number }) {
  const parts = enter(t, b.rds - 0.2, 0.7)
  const on = enter(t, b.on, 0.5)
  const ph = still ? 0 : Math.max(0, t - b.on) * 14
  return (
    <>
      <Svg>
        <Sym x={26} y={30} scale={0.55} opacity={parts}>
          <Mosfet x={0} y={0} />
        </Sym>
        <Draw d="M4 30 H9.5" p={parts} />
        <Draw d="M33.7 13.5 V4" p={parts} />
        <Draw d="M33.7 46.5 V52" p={parts} />
        <Sym x={74} y={30} scale={0.5} opacity={enter(t, b.rds + 1.2, 0.6)}>
          <Resistor x={0} y={0} rot={90} />
        </Sym>
        <Draw d="M74 4 V15" p={enter(t, b.rds + 1.2, 0.6)} />
        <Draw d="M74 45 V52" p={enter(t, b.rds + 1.2, 0.6)} />
        <FlowDots pts={[[33.7, 4], [33.7, 52]]} phase={ph} gap={3} o={on} skip={(_, y) => y > 16 && y < 44} />
        <FlowDots pts={[[74, 4], [74, 52]]} phase={ph} gap={3} o={on * enter(t, b.rds + 1.4, 0.5)} skip={(_, y) => y > 16 && y < 44} />
      </Svg>
      <T x={14} y={40} size={2.8} color={MUTED} o={enter(t, b.on, 0.4)}>
        完全导通
      </T>
      <T x={38} y={8} size={2.4} anchor="start" color={MUTED} o={parts}>
        D
      </T>
      <T x={38} y={52} size={2.4} anchor="start" color={MUTED} o={parts}>
        S
      </T>
      <T x={52} y={30} size={7} color={MUTED} o={enter(t, b.rr - 0.3, 0.5)}>
        ≈
      </T>
      <T x={81} y={27} size={3.4} weight={600} anchor="start" o={enter(t, b.rr, 0.4)} dy={rise(b.rr, 1)}>
        <V>R</V>
        <Sb>DS(on)</Sb>
      </T>
      <T x={81} y={33.5} size={2.8} anchor="start" color={MUTED} o={enter(t, b.rr + 0.3, 0.4)}>
        几毫欧
      </T>
    </>
  )
}

// ── heat ─────────────────────────────────────────────────────────────────────

function Heat({ t, b, rise }: Pick<StageProps, "t" | "b"> & { rise: (at: number, d?: number) => number }) {
  const chips: { x: number; letter: React.ReactNode; value: string; color?: string; at: number }[] = [
    { x: 20, letter: <V c={AMP}>I</V>, value: "2 A", color: AMP, at: b.e2 },
    { x: 50, letter: <><V>R</V><Sb>DS(on)</Sb></>, value: "33 mΩ", at: b.e33 },
    { x: 80, letter: <V c={HEAT}>P</V>, value: "0.13 W", color: HEAT, at: b.e013 },
  ]
  return (
    <>
      <T x={50} y={9} size={2.6} color={MUTED} o={enter(t, b.heat + 0.1)} dy={rise(b.heat, 1)}>
        导通时管子的发热
      </T>
      <T x={50} y={21} size={7}>
        <span className="inline-flex items-baseline gap-[0.3em]">
          <span style={{ opacity: enter(t, b.heat + 0.3) }}>
            <V c={HEAT}>P</V>
          </span>
          <span style={{ opacity: enter(t, b.heat + 0.5) }}>
            <M>=</M>
          </span>
          <span style={{ opacity: enter(t, b.pw) }}>
            <V c={AMP}>I</V>
            <M>²</M>
          </span>
          <span style={{ opacity: enter(t, b.pw + 0.9) }}>
            <M>×</M>
          </span>
          <span style={{ opacity: enter(t, b.pw + 1.1) }}>
            <V>R</V>
            <Sb>DS(on)</Sb>
          </span>
        </span>
      </T>
      <Svg>
        {chips.map((c) => (
          <rect key={c.x} x={c.x - 13} y={33} width={26} height={14} rx={1.6} stroke={LINE} strokeWidth={0.25} opacity={enter(t, c.at - 0.1, 0.5)} />
        ))}
      </Svg>
      {chips.map((c) => (
        <React.Fragment key={c.x}>
          <T x={c.x} y={37} size={2.6} color={MUTED} o={enter(t, c.at, 0.4)}>
            {c.letter}
          </T>
          <T x={c.x} y={43} size={4.6} weight={600} color={c.color} o={enter(t, c.at, 0.4)} dy={rise(c.at, 1)} className="tabular">
            <M>{c.value}</M>
          </T>
        </React.Fragment>
      ))}
    </>
  )
}

// ── logic-level vs standard ──────────────────────────────────────────────────

function Logic({ t, b, rise }: Pick<StageProps, "t" | "b"> & { rise: (at: number, d?: number) => number }) {
  const cols = [
    { cx: 27, name: "逻辑电平管", vth: "阈值约 1.5 V", open: 1, openText: "全开", heat: 0.04, heatText: "几乎不热", at: b.lg, show: b.logic + 0.3 },
    { cx: 73, name: "标准管", vth: "阈值约 3 V", open: 0.45, openText: "只开一半", heat: 0.85, heatText: "烫得厉害", at: b.sd, show: b.logic + 0.8 },
  ]
  return (
    <>
      <T x={50} y={5} size={2.6} color={MUTED} o={enter(t, b.logic + 0.1)}>
        栅极电压 <M c={VOLT}>3.3 V</M>
      </T>
      <Svg>
        <path d="M50 12 V50" stroke={LINE} strokeWidth={0.25} opacity={enter(t, b.logic + 0.8, 0.5)} />
        {cols.map((c) => (
          <g key={c.name}>
            <rect x={c.cx - 15} y={29} width={30} height={4} rx={1} stroke={LINE} strokeWidth={0.25} opacity={enter(t, c.show + 0.2, 0.4)} />
            <rect x={c.cx - 14.7} y={29.3} width={29.4 * c.open * enter(t, c.at + 0.4, 0.9)} height={3.4} rx={0.8} fill={AMP} stroke="none" />
          </g>
        ))}
        {cols.map((c) => {
          const o = enter(t, c.show + 0.2, 0.4)
          return (
            <g key={`h${c.name}`}>
              <rect x={c.cx - 15} y={43} width={30} height={4} rx={1} stroke={LINE} strokeWidth={0.25} opacity={o} />
              <rect x={c.cx - 14.7} y={43.3} width={29.4 * c.heat * enter(t, c.cx === 27 ? b.lg + 1.0 : b.hot, 0.9)} height={3.4} rx={0.8} fill={HEAT} stroke="none" />
            </g>
          )
        })}
      </Svg>
      {cols.map((c) => (
        <React.Fragment key={c.name}>
          <T x={c.cx} y={13} size={3.8} weight={600} o={enter(t, c.show)} dy={rise(c.show, 1)}>
            {c.name}
          </T>
          <T x={c.cx} y={19} size={2.4} color={MUTED} o={enter(t, c.show + 0.2)} className="tabular">
            <M>{c.vth}</M>
          </T>
          <T x={c.cx} y={25.5} size={2.4} color={MUTED} o={enter(t, c.show + 0.3)}>
            导通程度
          </T>
          <T x={c.cx} y={36} size={2.8} weight={600} color={AMP} o={enter(t, c.at + 1.0)}>
            {c.openText}
          </T>
          <T x={c.cx} y={40.2} size={2.4} color={MUTED} o={enter(t, c.show + 0.3)}>
            发热
          </T>
          <T x={c.cx} y={50} size={2.8} weight={600} color={HEAT} o={c.cx === 27 ? enter(t, b.lg + 1.6) : enter(t, b.hot + 0.3)}>
            {c.heatText}
          </T>
        </React.Fragment>
      ))}
    </>
  )
}

// ── the two gate resistors ───────────────────────────────────────────────────

function GateResistors({ t, b, rise }: Pick<StageProps, "t" | "b"> & { rise: (at: number, d?: number) => number }) {
  const p = enter(t, b.gate + 0.4, 0.9)
  const pd = enter(t, b.pd, 0.3)
  const sr = enter(t, b.sr, 0.3)
  return (
    <>
      <Svg>
        <Draw d="M4 32 H6" p={p} />
        <Draw d="M22.4 32 H33.5" p={p} />
        <Draw d="M27 32 V35.4" p={p} />
        <Draw d="M27 48.6 V50 M24.8 50 H29.2 M25.7 51.1 H28.3" p={p} />
        <Draw d="M55.7 13.5 V8" p={p} />
        <Draw d="M55.7 50.5 V51.5 M53.5 51.5 H57.9 M54.4 52.6 H57" p={p} />
        <circle cx={4} cy={32} r={0.8} fill="var(--background)" opacity={p} />
        <circle cx={27} cy={32} r={0.7} fill="currentColor" stroke="none" opacity={p} />
        <Sym x={14.2} y={32} scale={0.28} opacity={p}>
          <Resistor x={0} y={0} color={sr > 0.1 ? VOLT : undefined} />
        </Sym>
        <Sym x={27} y={42} scale={0.22} opacity={p}>
          <Resistor x={0} y={0} rot={90} color={pd > 0.1 ? VOLT : undefined} />
        </Sym>
        <Sym x={48} y={32} scale={0.5} opacity={p}>
          <Mosfet x={0} y={0} />
        </Sym>
      </Svg>
      <T x={4} y={37} size={2.4} anchor="start" color={MUTED} o={p}>
        引脚
      </T>
      <T x={55.7} y={5} size={2.6} color={MUTED} o={p}>
        负载
      </T>
      <T x={14.2} y={26} size={2.6} weight={600} color={VOLT} o={sr}>
        串联电阻
      </T>
      <T x={24} y={43} size={2.6} weight={600} color={VOLT} o={pd} anchor="end">
        下拉电阻
      </T>
      <T x={82} y={17} size={3.6} weight={600} o={enter(t, b.pd, 0.4)} dy={rise(b.pd, 1)}>
        下拉电阻
      </T>
      <T x={82} y={23.5} size={2.8} color={MUTED} o={enter(t, b.pd + 0.3, 0.4)}>
        上电时栅极保持 0 V
      </T>
      <T x={82} y={35} size={3.6} weight={600} o={enter(t, b.sr, 0.4)} dy={rise(b.sr, 1)}>
        串联电阻
      </T>
      <T x={82} y={41.5} size={2.8} color={MUTED} o={enter(t, b.sr + 0.3, 0.4)}>
        限制充放电的瞬间电流
      </T>
    </>
  )
}

// ── try it ───────────────────────────────────────────────────────────────────

function Outro({ t, b, still, rise }: StageProps & { rise: (at: number, d?: number) => number }) {
  const p = enter(t, b.outro - 0.2, 0.6)
  const k = still ? 0.6 : 0.5 + 0.5 * Math.sin(Math.max(0, t - b.drag) * 1.5 - Math.PI / 2)
  const lamp = easeInOut((k - 0.3) / 0.5)
  const x0 = 60
  const x1 = 92
  return (
    <>
      <Svg>
        <Sym x={76} y={20} scale={0.55} opacity={p}>
          <Lamp x={0} y={0} brightness={lamp * enter(t, b.drag, 0.5)} />
        </Sym>
        <g opacity={p}>
          <path d={`M${x0} 40 H${x1}`} stroke={LINE} strokeWidth={0.8} />
          <circle cx={lerp(x0, x1, k)} cy={40} r={1.5} fill={VOLT} stroke="none" opacity={enter(t, b.drag, 0.4)} />
        </g>
        <g opacity={enter(t, b.drag + 0.3)} transform={`translate(0 ${still ? 0 : Math.sin(t * 3.2) * 0.6})`} strokeWidth={0.45}>
          <path d="M24 38 V45 M21.6 42.6 L24 45 L26.4 42.6" />
        </g>
      </Svg>
      <T x={24} y={22} size={6} weight={600} dy={rise(b.outro)} o={enter(t, b.outro - 0.1, 0.5)}>
        动手试试
      </T>
      <T x={24} y={31} size={2.8} color={MUTED} o={enter(t, b.drag)} dy={rise(b.drag, 1)}>
        拖动下面的栅极电压
      </T>
      <T x={76} y={46} size={2.6} color={MUTED} o={enter(t, b.drag + 0.2)}>
        栅极电压 <M>0 – 10 V</M>
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "MOSFET",
  audio,
  timing,
  poster: 3.8,
  Stage,
}

export default function MosfetFilm() {
  return <FilmPlayer film={film} />
}

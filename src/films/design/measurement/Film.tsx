import * as React from "react"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, M, Scene, Svg, T, easeInOut, enter, glide, lerp, span, type FilmDef, type StageProps } from "../../kit"
import { AMP, BatteryV, Box, Check, GOOD, MUTED, POWER, VOLT, zig } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

/*
 * 仪器与调试, ~65 s.
 *   title (a meter and a scope) → one circuit, three ways to connect a meter: across (volts), in series
 *   (amps), and the mistake (amps range across the supply) → the scope screen: time and volts, then
 *   the three knobs, then counting divisions → probe ×10 and a short ground lead vs ringing
 *   → a logic analyzer decoding bytes → the order of checks → "try the multimeter".
 */

function Stage({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.6) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)
  const lift = (at: number) => (still ? 0 : -easeInOut((t - at) / 0.45) * 2)

  // each scene is gone before the next one's content arrives
  const title = span(t, 0.25, b.vmeas - 0.45)
  const meter = span(t, b.vmeas - 0.25, b.scope - 0.45)
  const scope = span(t, b.scope - 0.25, b.probe - 0.45)
  const probe = span(t, b.probe - 0.25, b.logic - 0.45)
  const logic = span(t, b.logic - 0.25, b.order - 0.45)
  // "焊接" is the last word of its line: the list stays up into the gap
  const order = span(t, b.order - 0.25, b.outro - 0.3)
  const outro = enter(t, b.outro + 0.05, 0.5)

  return (
    <>
      <Scene o={title} dy={lift(b.vmeas - 0.45)}>
        <T x={50} y={11} size={7} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
          仪器与调试
        </T>
        <T x={50} y={19} size={2.8} color={MUTED} o={enter(t, b.intro + 0.9)} dy={rise(b.intro + 0.9, 1)}>
          让你看见电，再告诉你先看哪里
        </T>
        <Teaser t={t} b={b} />
      </Scene>

      <Scene o={meter}>
        <Meter t={t} b={b} still={still} />
      </Scene>

      <Scene o={scope}>
        <Scope t={t} b={b} still={still} />
      </Scene>

      <Scene o={probe}>
        <Probe t={t} b={b} />
      </Scene>

      <Scene o={logic}>
        <Logic t={t} b={b} />
      </Scene>

      <Scene o={order}>
        <Order t={t} b={b} />
      </Scene>

      <Scene o={outro}>
        <T x={50} y={24} size={6} weight={600} dy={rise(b.outro)}>
          动手试试
        </T>
        <T x={50} y={32.5} size={2.8} color={MUTED} o={enter(t, b.try)} dy={rise(b.try, 1)}>
          拖动下面万用表的表笔，看读数怎么变
        </T>
        <Svg>
          <g opacity={enter(t, b.try + 0.3)} transform={`translate(0 ${still ? 0 : Math.sin(t * 3.2) * 0.6})`} strokeWidth={0.45}>
            <path d="M50 38 V45 M47.6 42.6 L50 45 L52.4 42.6" />
          </g>
        </Svg>
      </Scene>
    </>
  )
}

// ── title ────────────────────────────────────────────────────────────────────

function Teaser({ t, b }: Pick<StageProps, "t" | "b">) {
  const a = enter(t, b.intro + 2.8, 0.7)
  const c = enter(t, b.intro + 4.4, 0.7)
  const wave = "M54 36 V30 H60 V36 H66 V30 H72 V36 H78 V30 H84 V36"
  return (
    <>
      <Svg>
        <g opacity={a}>
          <Box x={14} y={25} w={28} h={18} />
          <rect x={18} y={28} width={20} height={6} rx={0.6} fill="var(--muted-foreground)" fillOpacity={0.15} stroke="none" />
          <circle cx={28} cy={38.6} r={2.2} />
        </g>
        <g opacity={c}>
          <Box x={50} y={25} w={40} h={18} />
          <Draw d={wave} p={c} stroke={AMP} strokeWidth={0.5} />
        </g>
      </Svg>
      <T x={28} y={31} size={2.8} weight={600} o={a} className="tabular">
        <M>3.30</M>
      </T>
      <T x={28} y={47.4} size={2.3} color={MUTED} o={a}>
        万用表：一个数
      </T>
      <T x={78} y={47.4} size={2.3} color={MUTED} o={c}>
        示波器：一条随时间变化的线
      </T>
    </>
  )
}

// ── one circuit, three ways to connect a meter ─────────────────────────────

const LX = 14
const RX = 62
const TOP = 20
const BOT = 44

function Meter({ t, b, still }: StageProps) {
  const loop = enter(t, b.vmeas - 0.1, 0.8)
  const vOn = Math.min(enter(t, b.mm, 0.5), 1 - enter(t, b.amps - 0.2, 0.4))
  const probes = enter(t, b.par - 0.2, 0.6)
  const gap = enter(t, b.brk - 0.1, 0.4) * (1 - enter(t, b.short - 0.2, 0.4))
  const aOn = Math.min(enter(t, b.ser - 0.2, 0.5), 1 - enter(t, b.short - 0.2, 0.4))
  const sOn = enter(t, b.short - 0.1, 0.5)
  const mx = 86
  const my = 32
  const heading = t < b.amps - 0.2 ? 0 : t < b.short - 0.2 ? 1 : 2
  return (
    <>
      <T x={50} y={9} size={2.8} weight={600} color={heading === 2 ? POWER : undefined} o={1}>
        {["量电压：表并联在两点上", "量电流：把回路断开，表串进去", "电流档去量电压：电源被短路"][heading]}
      </T>
      <Svg>
        {/* the loop: battery on the left, a resistor on the right */}
        <path d={`M${LX} 28.8 V${TOP} H36`} opacity={loop} />
        <path d={`M48 ${TOP} H${RX} V27`} opacity={loop} />
        <path d={`M36 ${TOP} H48`} opacity={loop * (1 - gap)} />
        <path d={`M${RX} 37 V${BOT} H${LX} V31.2`} opacity={loop} />
        <g opacity={loop}>
          <BatteryV x={LX} y={30} />
          <path d={zig(RX, 27, RX, 37, 4, 1.6, 0.1)} />
        </g>
        {/* volt meter probes */}
        <g opacity={vOn}>
          <circle cx={mx} cy={my} r={5.2} />
          <Draw d={`M${mx - 5} ${my - 2} L${RX + 1} 27`} p={probes} stroke={VOLT} strokeWidth={0.4} />
          <Draw d={`M${mx - 5} ${my + 2} L${RX + 1} 37`} p={probes} stroke="var(--foreground)" strokeWidth={0.4} />
          <circle cx={RX} cy={27} r={0.8} fill={VOLT} stroke="none" opacity={probes} />
          <circle cx={RX} cy={37} r={0.8} fill="var(--foreground)" stroke="none" opacity={probes} />
        </g>
        {/* ammeter in the gap */}
        <g opacity={aOn}>
          <circle cx={42} cy={TOP} r={4.4} fill="var(--background)" />
          <path d={`M36 ${TOP} H37.6 M46.4 ${TOP} H48`} />
        </g>
        {/* the mistake: the current range straight across the resistor */}
        <g opacity={sOn} stroke={POWER}>
          <circle cx={mx} cy={my} r={5.2} />
          <path d={`M${mx - 5} ${my - 2} L${RX + 1} 27 M${mx - 5} ${my + 2} L${RX + 1} 37`} strokeWidth={0.5} />
        </g>
        {sOn > 0.01 && !still && <circle cx={lerp(RX, mx - 5, (t * 1.6) % 1)} cy={lerp(28, 30, (t * 1.6) % 1)} r={0.6} fill={POWER} stroke="none" opacity={sOn} />}
      </Svg>
      <T x={LX - 3.5} y={30} size={2.2} color={MUTED} o={loop} anchor="end">
        电池
      </T>
      <T x={RX + 3.6} y={22.4} size={2.2} color={MUTED} anchor="start" o={loop * (1 - sOn - vOn)}>
        电阻
      </T>
      <T x={mx} y={my} size={3.2} weight={600} font="var" o={vOn}>
        V
      </T>
      <T x={mx} y={my + 9} size={3.6} weight={600} color={VOLT} o={enter(t, b.par + 0.5) * vOn} className="tabular">
        3.3 V
      </T>
      <T x={42} y={TOP} size={3} weight={600} font="var" o={aOn}>
        A
      </T>
      <T x={42} y={29} size={3.4} weight={600} color={AMP} o={enter(t, b.ser + 0.4) * aOn} className="tabular">
        12.4 mA
      </T>
      <T x={mx} y={my} size={3.2} weight={600} font="var" color={POWER} o={sOn}>
        A
      </T>
      <T x={mx} y={my + 9} size={3} weight={600} color={POWER} o={enter(t, b.shrt - 0.2) * sOn}>
        短路
      </T>
      <T x={30} y={48.6} size={2.2} color={MUTED} o={enter(t, b.low) * sOn}>
        内阻很小：几乎是一根导线
      </T>
      <T x={50} y={48.6} size={2.2} color={MUTED} o={enter(t, b.par + 1) * vOn}>
        不用断开电路，用得最多
      </T>
      <T x={42} y={30.6} size={2.4} color={MUTED} o={enter(t, b.brk) * (1 - enter(t, b.ser - 0.2, 0.4)) * (1 - sOn)}>
        断口
      </T>
    </>
  )
}

// ── the scope screen ────────────────────────────────────────────────────────

const SX0 = 8
const SY0 = 13
const CW = 8
const CH = 5.4
const NX = 8
const NY = 6

function Scope({ t, b, still }: StageProps) {
  const screen = enter(t, b.scope - 0.1, 0.7)
  // period in divisions: the time base moves it from 2.5 to 5; amplitude in divisions: the vertical knob from 1.4 to 3.3
  const period = glide(t, b.tb, 2.5, 5, 0.9)
  const amp = glide(t, b.vd, 1.4, 3.3, 0.9)
  // the wave runs until the trigger catches it, then settles with a rising edge one division in,
  // so the "one period" bracket below starts and ends on rising edges
  const P = 5 * CW
  const free = (still ? 0 : Math.min(t, b.trig) - b.scope) * 3.2
  const caught = Math.ceil((free + CW) / P) * P - CW
  const scroll = still ? P - CW : lerp(free, caught, easeInOut((t - b.trig) / 0.5))
  const base = SY0 + 4.5 * CH
  const wave = enter(t, b.scope + 0.4, 1.4)
  const pts: string[] = []
  const x1 = SX0 + NX * CW
  const n = Math.floor((NX * CW) / 0.5)
  for (let i = 0; i <= n; i++) {
    const x = SX0 + i * 0.5
    if (x - SX0 > wave * NX * CW) break
    const ph = (((x - SX0 + scroll) / (period * CW)) % 1 + 1) % 1
    const y = ph < 0.5 ? base - amp * CH : base
    pts.push(`${pts.length ? "L" : "M"}${x} ${y}`)
    // vertical edges are implied by the step between samples
  }
  const trigLvl = enter(t, b.trig, 0.5)
  const knobs: [string, number, number][] = [
    ["时基", b.tb, 0],
    ["档位", b.vd, 1],
    ["触发", b.trig, 2],
  ]
  const readOn = enter(t, b.cells - 0.3, 0.5)
  const lock = t > b.trig
  return (
    <>
      <Svg>
        <Box x={SX0} y={SY0} w={NX * CW} h={NY * CH} o={screen} />
        <g opacity={screen * 0.55} stroke="var(--border)" strokeWidth={0.15}>
          {Array.from({ length: NX - 1 }, (_, i) => (
            <path key={i} d={`M${SX0 + (i + 1) * CW} ${SY0} V${SY0 + NY * CH}`} />
          ))}
          {Array.from({ length: NY - 1 }, (_, i) => (
            <path key={i} d={`M${SX0} ${SY0 + (i + 1) * CH} H${x1}`} />
          ))}
        </g>
        <path d={pts.join(" ")} stroke={AMP} strokeWidth={0.55} />
        <path d={`M${SX0} ${SY0 + 3.2 * CH} H${x1}`} stroke={GOOD} strokeDasharray="1 0.8" strokeWidth={0.3} opacity={trigLvl} />
        {/* one period, counted in divisions */}
        <g opacity={readOn} stroke={VOLT} strokeWidth={0.3}>
          <path d={`M${SX0 + CW} ${SY0 + 0.9 * CH} H${SX0 + 6 * CW} M${SX0 + CW} ${SY0 + 0.5 * CH} V${SY0 + 1.3 * CH} M${SX0 + 6 * CW} ${SY0 + 0.5 * CH} V${SY0 + 1.3 * CH}`} />
        </g>
        {knobs.map(([, at, i]) => {
          const on = enter(t, at - 0.1, 0.4) * (1 - enter(t, at + 1.7, 0.4) * 0.5)
          const ang = (-50 + 100 * easeInOut((t - at) / 0.8) + i * 8) * (Math.PI / 180)
          return (
            <g key={i} opacity={0.35 + 0.65 * on}>
              <circle cx={82} cy={22 + i * 10} r={3.4} stroke={on > 0.5 ? GOOD : undefined} />
              <path d={`M82 ${22 + i * 10} l${Math.sin(ang) * 3} ${-Math.cos(ang) * 3}`} stroke={on > 0.5 ? GOOD : undefined} />
            </g>
          )
        })}
      </Svg>
      <T x={x1 - 0.5} y={SY0 + NY * CH - 1.8} size={2.2} color={MUTED} anchor="end" o={enter(t, b.time - 0.1) * (1 - readOn)}>
        时间 →
      </T>
      <T x={SX0 + 1} y={SY0 + 2.2} size={2.2} color={MUTED} anchor="start" o={enter(t, b.svolt - 0.1) * (1 - readOn)}>
        ↑ 电压
      </T>
      {knobs.map(([k, at, i]) => (
        <T key={k} x={87.5} y={22 + i * 10} size={2.6} weight={600} anchor="start" o={0.4 + 0.6 * enter(t, at - 0.1)}>
          {k}
        </T>
      ))}
      <T x={86} y={14} size={2.2} color={MUTED} o={enter(t, b.tb - 0.5)}>
        三组旋钮
      </T>
      <T x={SX0 + 3.5 * CW} y={SY0 + 0.4 * CH - 0.4} size={2.2} weight={600} color={VOLT} o={enter(t, b.cells)} className="tabular">
        一个周期 5 格
      </T>
      <T x={SX0 + 1} y={SY0 + NY * CH + 3.6} size={2.4} color={MUTED} anchor="start" o={enter(t, b.div - 0.1)} className="tabular">
        <M>200 μs / 格</M>
      </T>
      <T x={SX0 + 4 * CW} y={SY0 + NY * CH + 3.6} size={2.4} weight={600} color={VOLT} o={enter(t, b.khz - 0.2)} className="tabular">
        <M>5 × 200 μs = 1 ms，即 1 kHz</M>
      </T>
      <T x={x1 - 0.5} y={SY0 + 3.2 * CH - 1.6} size={2} color={GOOD} anchor="end" o={trigLvl && lock ? trigLvl : 0}>
        触发电平
      </T>
    </>
  )
}

// ── probe ×10 and ringing ───────────────────────────────────────────────────

function Probe({ t, b }: Pick<StageProps, "t" | "b">) {
  const sw = enter(t, b.probe, 0.6)
  const x10 = enter(t, b.x10 - 0.2, 0.4)
  const gnd = enter(t, b.gnd - 0.2, 0.6)
  const scr = enter(t, b.probe + 0.4, 0.6)
  const ring = enter(t, b.ring - 0.3, 0.8)
  const wave = (x0: number, ringing: number) => {
    const out: string[] = []
    const w = 38
    for (let i = 0; i <= 76; i++) {
      const x = i * (w / 76)
      const ph = (x / 12.7) % 1 // 3 periods across
      const edge = ph < 0.5 ? ph : ph - 0.5
      let v = ph < 0.5 ? 1 : 0
      const tt = edge * 12.7
      if (ringing > 0 && edge < 5) v += (ph < 0.5 ? -1 : 1) * 0.35 * ringing * Math.exp(-tt / 1.3) * Math.cos(tt * 3.6) * (1 - 0)
      out.push(`${i ? "L" : "M"}${x0 + x} ${36 - v * 11}`)
    }
    return out.join(" ")
  }
  return (
    <>
      <Svg>
        <g opacity={sw}>
          <Box x={38} y={9} w={11} h={5.6} />
          <Box x={49} y={9} w={13} h={5.6} color={GOOD} fill={0.15 * x10} sw={0.3 + 0.2 * x10} />
        </g>
        <Box x={8} y={19} w={40} h={22} o={scr} />
        <Box x={52} y={19} w={40} h={22} o={scr} />
        <path d={wave(9, 0)} stroke={AMP} strokeWidth={0.5} opacity={scr} />
        <path d={wave(53, ring)} stroke={POWER} strokeWidth={0.5} opacity={scr} />
        {/* ground leads, short and long */}
        <g opacity={gnd} stroke={MUTED}>
          <path d="M26 45 H30" strokeWidth={0.6} />
          <path d="M60 45 C60 49 66 49 70 46 S80 44 84 46" strokeWidth={0.6} />
        </g>
      </Svg>
      <T x={43.5} y={11.8} size={2.6} weight={500} color={MUTED} o={sw}>
        <M>×1</M>
      </T>
      <T x={55.5} y={11.8} size={2.6} weight={600} o={sw}>
        <M>×10</M>
      </T>
      <T x={30} y={11.8} size={2.4} color={MUTED} anchor="end" o={sw}>
        探头
      </T>
      <T x={28} y={50.6} size={2.4} weight={600} color={GOOD} o={gnd}>
        接地夹线短
      </T>
      <T x={72} y={50.6} size={2.4} weight={600} color={POWER} o={gnd}>
        线长：边沿多出振铃
      </T>
      <T x={89} y={22.4} size={2.2} weight={600} color={POWER} anchor="end" o={ring}>
        振铃
      </T>
    </>
  )
}

// ── logic analyzer ──────────────────────────────────────────────────────────

function Logic({ t, b }: Pick<StageProps, "t" | "b">) {
  const X0 = 20
  const BW = 4.6
  const bytes = [0x48, 0x1f]
  const bits = bytes.flatMap((v) => Array.from({ length: 8 }, (_, i) => (v >> (7 - i)) & 1))
  const lanes: [string, number, number][] = [
    ["时钟", 17, b.logic + 0.5],
    ["数据", 26, b.logic + 1.0],
    ["片选", 35, b.logic + 1.5],
  ]
  const clock = Array.from({ length: 16 }, (_, i) => `M${X0 + i * BW} 19 V14.5 H${X0 + i * BW + BW / 2} V19 H${X0 + (i + 1) * BW}`).join(" ")
  const data = (() => {
    let d = ""
    let prev = bits[0]
    d += `M${X0} ${prev ? 24 : 28.5}`
    bits.forEach((v, i) => {
      const y = v ? 24 : 28.5
      if (i && v !== prev) d += ` V${y}`
      d += ` H${X0 + (i + 1) * BW}`
      prev = v
    })
    return d
  })()
  const cs = `M${X0} 33.5 H${X0 + 0.5} V38 H${X0 + 16 * BW - 0.5} V33.5 H${X0 + 16 * BW}`
  const dec = enter(t, b.dec - 0.1, 0.6)
  const scan = enter(t, b.logic + 0.6, 1.6)
  return (
    <>
      <T x={50} y={9} size={2.8} weight={600} o={enter(t, b.logic)}>
        逻辑分析仪：只分高低，多路同时录
      </T>
      <Svg>
        <Draw d={clock} p={scan} stroke={AMP} strokeWidth={0.45} />
        <Draw d={data} p={enter(t, b.logic + 1.0, 1.6)} stroke={VOLT} strokeWidth={0.45} />
        <Draw d={cs} p={enter(t, b.logic + 1.4, 1.2)} stroke={GOOD} strokeWidth={0.45} />
        <path d={`M${X0} 40 H${X0 + 16 * BW}`} stroke="var(--border)" strokeWidth={0.2} opacity={enter(t, b.logic + 0.5)} />
        {[0, 1].map((k) => (
          <Box key={k} x={X0 + k * 8 * BW + 0.6} y={42} w={8 * BW - 1.2} h={6} o={dec} color={GOOD} fill={0.12} />
        ))}
      </Svg>
      {lanes.map(([k, y, at]) => (
        <T key={k} x={6} y={y} size={2.4} color={MUTED} anchor="start" o={enter(t, at)}>
          {k}
        </T>
      ))}
      <T x={6} y={45} size={2.4} weight={600} color={GOOD} anchor="start" o={dec}>
        解码
      </T>
      {bytes.map((v, k) => (
        <T key={k} x={X0 + k * 8 * BW + 4 * BW} y={45} size={3} weight={600} o={enter(t, b.dec + 0.2 + k * 0.4)} className="tabular">
          <M>{`0x${v.toString(16).toUpperCase().padStart(2, "0")}`}</M>
        </T>
      ))}
    </>
  )
}

// ── the order of checks ─────────────────────────────────────────────────────

function Order({ t, b }: Pick<StageProps, "t" | "b">) {
  const steps: [string, string, number][] = [
    ["电压", "稳压器没输出", b.o1],
    ["电流", "短路或焊反", b.o2],
    ["复位", "一直被拉低", b.o3],
    ["时钟", "晶振没起振", b.o4],
    ["下载口", "线序接错", b.o5],
    ["焊接", "虚焊、连锡", b.o6],
  ]
  const X = (i: number) => 13 + i * 14.8
  const prog = Math.min(1, Math.max(0, (steps.reduce((a, [, , at]) => a + enter(t, at - 0.1, 0.5), 0) - 1) / 5))
  return (
    <>
      <T x={50} y={12.5} size={3} weight={600} o={enter(t, b.order)}>
        不工作，先电源，后信号
      </T>
      <Svg>
        <path d={`M${X(0)} 28 H${X(5)}`} stroke="var(--border)" strokeWidth={0.4} opacity={enter(t, b.order + 0.3)} />
        <Draw d={`M${X(0)} 28 H${X(5)}`} p={prog} stroke={GOOD} strokeWidth={0.5} />
        {steps.map(([, , at], i) => {
          const on = enter(t, at - 0.1, 0.35)
          return (
            <g key={i}>
              <circle cx={X(i)} cy={28} r={3.2} fill={GOOD} fillOpacity={0.2 * on} stroke={on > 0.5 ? GOOD : "currentColor"} opacity={0.4 + 0.6 * enter(t, b.order + 0.3 + i * 0.08)} />
              <Check x={X(i)} y={48} p={enter(t, at + 0.5, 0.5)} r={1.4} />
            </g>
          )
        })}
        <path d={`M${X(0) - 3.4} 21 H${X(1) + 3.4}`} stroke={VOLT} strokeWidth={0.5} opacity={enter(t, b.order + 0.4)} />
      </Svg>
      <T x={(X(0) + X(1)) / 2} y={18} size={2.2} weight={600} color={VOLT} o={enter(t, b.order + 0.4)}>
        先电源
      </T>
      {steps.map(([k, why, at], i) => (
        <React.Fragment key={k}>
          <T x={X(i)} y={28.1} size={2.8} weight={600} font="math" o={enter(t, b.order + 0.3 + i * 0.08)} color={MUTED}>
            <M>{i + 1}</M>
          </T>
          <T x={X(i)} y={35.6} size={3.2} weight={600} o={0.4 + 0.6 * enter(t, at - 0.1)}>
            {k}
          </T>
          <T x={X(i)} y={41.2} size={2.1} color={MUTED} o={enter(t, at)}>
            {why}
          </T>
        </React.Fragment>
      ))}
    </>
  )
}

export const film: FilmDef = {
  title: "仪器与调试",
  audio,
  timing,
  poster: 6.0,
  Stage,
}

export default function MeasurementFilm() {
  return <FilmPlayer film={film} />
}

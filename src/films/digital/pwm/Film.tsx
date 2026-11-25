import * as React from "react"
import { glow, trace } from "@/lab/colors"
import { Mosfet } from "@/lab/schematic"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, Frac, M, Scene, Svg, Sym, T, V, enter, lerp, span, type FilmDef, type StageProps } from "../../kit"
import { DownArrow, FG, HI, LINE, MUTED, keys, makeLift, makeRise } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

/*
 * PWM 脉宽调制, ~65 s. Scenes, each keyed to the words that introduce it:
 *   title (high and low only, an LED that is on or off) → switching faster and faster, the LED settles at half
 *   → one period: t_on / T → duty 10 % → 90 % → 30 %: the average line and the LED follow
 *   → a resistor burns 6 W, a switch 0.05 W → which frequencies suit LEDs and motors against what we hear
 *   → a servo reads pulse width → a MOSFET carries the motor current → an RC filter smooths PWM into its average → "try it below".
 */

const LED = glow.amber

/** PWM square wave with duty d: `n` periods of width p from x0, high at yh, low at yl. */
function pwm(d: number, n: number, p: number, x0: number, yh: number, yl: number) {
  let s = `M${x0} ${yl}`
  for (let k = 0; k < n; k++) {
    const a = x0 + k * p
    s += `V${yh}H${(a + Math.max(0.01, d * p)).toFixed(2)}V${yl}H${(a + p).toFixed(2)}`
  }
  return s
}

function Led({ x, y, r, v, o = 1 }: { x: number; y: number; r: number; v: number; o?: number }) {
  return (
    <g opacity={o}>
      <circle cx={x} cy={y} r={r * (1.5 + 0.5 * v)} fill={LED} fillOpacity={0.28 * v} stroke="none" />
      <circle cx={x} cy={y} r={r} fill={LED} fillOpacity={0.1 + 0.9 * v} stroke={FG} strokeWidth={0.35} />
    </g>
  )
}

function Stage({ t, b, still }: StageProps) {
  const rise = makeRise(t, still)
  const lift = makeLift(t, still)
  const sc = (a: number, z: number) => span(t, a - 0.3, z - 0.15, 0.3, 0.3)

  // the intro: an LED that is either on or off, following a cursor along the wave
  const slots = [1, 1, 0, 0, 1, 1, 0, 0]
  const cur = ((t * 0.9) % 1) * 8
  const lv = slots[Math.floor(cur) % 8]

  return (
    <>
      <Scene o={span(t, 0.25, b.fastL - 0.15, 0.4, 0.3)} dy={lift(b.fastL - 0.45)}>
        <T x={50} y={14} size={7} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
          PWM 脉宽调制
        </T>
        <Svg>
          <Draw d={pwm(0.5, 4, 10.5, 12, 26, 36)} p={enter(t, 0.9, 1.4)} stroke={HI} strokeWidth={0.5} />
          <g opacity={enter(t, 1.9, 0.5)}>
            <path d={`M${12 + cur * 5.25} 23 V39`} stroke={MUTED} strokeWidth={0.25} strokeDasharray="0.8 0.8" />
            <path d="M58 31 H64 M62.6 29.6 L64 31 L62.6 32.4" strokeWidth={0.35} />
          </g>
          <Led x={74} y={31} r={4.5} v={lv} o={enter(t, 1.9, 0.5)} />
        </Svg>
        <T x={50} y={46} size={3} color={MUTED} o={enter(t, b.intro + 3.4, 0.5)} dy={rise(b.intro + 3.4, 1)}>
          只有全亮和全灭，半亮从哪来？
        </T>
      </Scene>

      <Scene o={sc(b.fastL, b.dutyL)}>
        <Fast t={t} b={b} />
      </Scene>
      <Scene o={sc(b.dutyL, b.avgL)}>
        <Duty t={t} b={b} />
      </Scene>
      <Scene o={sc(b.avgL, b.eff)}>
        <Avg t={t} b={b} />
      </Scene>
      <Scene o={sc(b.eff, b.freq)}>
        <Eff t={t} b={b} />
      </Scene>
      <Scene o={sc(b.freq, b.servoL)}>
        <Freq t={t} b={b} />
      </Scene>
      <Scene o={span(t, b.servoL - 0.3, b.drive - 0.5, 0.3, 0.3)}>
        <Servo t={t} b={b} />
      </Scene>
      <Scene o={sc(b.drive, b.rc)}>
        <Drive t={t} b={b} />
      </Scene>
      <Scene o={sc(b.rc, b.outro)}>
        <Rc t={t} b={b} />
      </Scene>

      <Scene o={enter(t, b.outro - 0.3, 0.4)}>
        <T x={50} y={22} size={6} weight={600} dy={rise(b.outro)}>
          动手试试
        </T>
        <T x={50} y={31} size={2.8} color={MUTED} o={enter(t, b.drag, 0.5)} dy={rise(b.drag, 1)}>
          拖动占空比，看亮度和平均电压
        </T>
        <Svg>
          <DownArrow t={t} at={b.drag + 0.3} still={still} y={37} />
        </Svg>
      </Scene>
    </>
  )
}

// ── faster and faster ───────────────────────────────────────────────────────

function Fast({ t, b }: Pick<StageProps, "t" | "b">) {
  const a = b.fastL + 0.2
  const z = b.blink + 1.4
  const d = z - a
  // blink rate in Hz ramps up; phase is its integral
  const f0 = 0.8
  const f1 = 6
  const s = Math.max(0, Math.min(t - a, d))
  const phase = f0 * s + ((f1 - f0) * s * s) / (2 * d) + (t > z ? f1 * (t - z) : 0)
  const started = t > a
  const mix = enter(t, b.blink + 0.6, 1.0)
  const sqv = started && phase % 1 < 0.5 ? 1 : 0
  const v = started ? lerp(sqv, 0.5, mix) : 0
  const cur = (phase % 8) * 1
  const on = enter(t, b.fastL, 0.5)
  return (
    <>
      <Svg>
        <Draw d={pwm(0.5, 8, 6, 12, 22, 34)} p={on} stroke={HI} strokeWidth={0.5} />
        <g opacity={on * (1 - mix)}>
          <path d={`M${12 + cur * 6} 18 V38`} stroke={MUTED} strokeWidth={0.25} strokeDasharray="0.8 0.8" />
        </g>
        <path d="M64 28 H69 M67.6 26.6 L69 28 L67.6 29.4" strokeWidth={0.35} opacity={on} />
        <Led x={80} y={28} r={5} v={v} o={on} />
      </Svg>
      {["开", "关", "开", "关"].map((w, i) => (
        <T key={i} x={15 + i * 12} y={14} size={3.4} weight={600} color={i % 2 ? MUTED : HI} o={enter(t, b.blink + i * 0.28 - 0.1, 0.3) * (1 - 0.6 * mix)}>
          {w}
        </T>
      ))}
      <T x={80} y={42} size={2.8} color={MUTED} o={mix}>
        看上去，半亮
      </T>
    </>
  )
}

// ── one period, duty cycle ──────────────────────────────────────────────────

function Duty({ t, b }: Pick<StageProps, "t" | "b">) {
  const P = 20
  const x0 = 10
  const d = 0.4
  const on = enter(t, b.dutyL, 0.6)
  const per = enter(t, b.period, 0.5)
  const ton = enter(t, b.on, 0.5)
  const sub = (s: string) => <span style={{ fontSize: "0.62em", position: "relative", top: "0.22em", fontStyle: "normal" }}>{s}</span>
  return (
    <>
      <Svg>
        <Draw d={pwm(d, 3, P, x0, 24, 38)} p={on} stroke={HI} strokeWidth={0.5} />
        <g opacity={per} strokeWidth={0.3}>
          <path d={`M${x0} 43 V48 M${x0 + P} 43 V48 M${x0} 45.5 H${x0 + P}`} />
          <path d={`M${x0 + 1.4} 44.1 L${x0} 45.5 L${x0 + 1.4} 46.9 M${x0 + P - 1.4} 44.1 L${x0 + P} 45.5 L${x0 + P - 1.4} 46.9`} />
        </g>
        <Draw d={`M${x0} 24 H${x0 + d * P}`} p={ton} stroke={HI} strokeWidth={1.1} />
      </Svg>
      <T x={x0 + P / 2} y={51} size={2.6} color={MUTED} o={per}>
        一个周期 <V>T</V>
      </T>
      <T x={x0 + (d * P) / 2} y={20} size={2.6} weight={600} color={HI} o={ton}>
        开着 <V>t</V>
        {sub("on")}
      </T>
      <T x={84} y={25} size={5} o={enter(t, b.duty, 0.5)}>
        <span className="inline-flex items-center gap-[0.3em]">
          <V>D</V>
          <M>=</M>
          <Frac
            top={
              <span>
                <V c={HI}>t</V>
                {sub("on")}
              </span>
            }
            bottom={<V>T</V>}
            bar={enter(t, b.duty + 0.2, 0.4)}
          />
        </span>
      </T>
      <T x={84} y={38} size={2.8} color={MUTED} o={enter(t, b.duty + 0.5, 0.5)}>
        占空比
      </T>
    </>
  )
}

// ── duty cycle sets the average ─────────────────────────────────────────────

function Avg({ t, b }: Pick<StageProps, "t" | "b">) {
  const D = keys(t, [
    [b.avgL, 0.1],
    [b.bigger - 0.3, 0.1],
    [b.bigger + 1.3, 0.9],
    [b.d30 - 0.5, 0.9],
    [b.d30 + 0.3, 0.3],
  ])
  const hi = 18
  const lo = 38
  const yAvg = lerp(lo, hi, D)
  const on = enter(t, b.avgL, 0.5)
  return (
    <>
      <Svg>
        <path d={pwm(D, 5, 10, 10, hi, lo)} stroke={HI} strokeWidth={0.5} opacity={on} />
        <path d={`M8 ${yAvg} H62`} stroke={FG} strokeWidth={0.3} strokeDasharray="1.2 0.9" opacity={on} />
        <Led x={80} y={28} r={4.5} v={D} o={on} />
      </Svg>
      <T x={65} y={yAvg} size={2.4} anchor="start" color={MUTED} o={on}>
        平均
      </T>
      <T x={80} y={11} size={2.6} color={MUTED} o={on}>
        占空比
      </T>
      <T x={80} y={17.5} size={5} weight={600} color={HI} o={on} className="tabular">
        {Math.round(D * 100)}%
      </T>
      <T x={80} y={39} size={2.6} color={MUTED} o={on}>
        平均电压
      </T>
      <T x={80} y={45.5} size={5} weight={600} o={on} className="tabular">
        {(D * 5).toFixed(1)} V
      </T>
      <T x={36} y={47} size={2.6} color={MUTED} o={on}>
        高电平 5 V
      </T>
    </>
  )
}

// ── why a switch is efficient ───────────────────────────────────────────────

function Eff({ t, b }: Pick<StageProps, "t" | "b">) {
  const h1 = 30 * enter(t, b.res, 0.9)
  const h2 = Math.max(0.5, 30 * (0.05 / 6)) * enter(t, b.sw, 0.9)
  return (
    <>
      <T x={50} y={6.5} size={2.8} color={MUTED} o={enter(t, b.eff, 0.5)}>
        12 V 电机降到半速，1 A
      </T>
      <Svg>
        <path d="M12 44 H88" stroke={LINE} strokeWidth={0.3} opacity={enter(t, b.eff, 0.4)} />
        <rect x={24} y={44 - h1} width={14} height={h1} fill={trace.power} fillOpacity={0.85} stroke="none" />
        <rect x={62} y={44 - h2} width={14} height={h2} fill={trace.good} stroke="none" />
      </Svg>
      <T x={31} y={44 - h1 - 3.4} size={4.6} weight={600} color={trace.power} o={enter(t, b.res + 0.5, 0.4)} className="tabular">
        6 W
      </T>
      <T x={69} y={44 - h2 - 3.4} size={4.6} weight={600} color={trace.good} o={enter(t, b.sw + 0.5, 0.4)} className="tabular">
        0.05 W
      </T>
      <T x={31} y={49.5} size={2.8} o={enter(t, b.res, 0.4)}>
        电阻降压：变成热
      </T>
      <T x={69} y={49.5} size={2.8} o={enter(t, b.eff + 1.0, 0.4)}>
        开关：几乎不发热
      </T>
    </>
  )
}

// ── which frequency ─────────────────────────────────────────────────────────

const fx = (f: number) => 10 + 20 * Math.log10(f / 10)

function Freq({ t, b }: Pick<StageProps, "t" | "b">) {
  const ear = enter(t, b.ear - 0.2, 0.6)
  const ax = enter(t, b.freq, 0.6)
  const arrow = (x0: number, y: number, p: number) => (
    <Draw d={`M${x0} ${y} H90 M88.4 ${y - 1.4} L90 ${y} L88.4 ${y + 1.4}`} p={p} stroke={HI} strokeWidth={0.5} />
  )
  return (
    <>
      <Svg>
        <path d="M10 40 H90" strokeWidth={0.35} opacity={ax} />
        {[10, 100, 1000, 10000, 100000].map((f) => (
          <path key={f} d={`M${fx(f)} 40 v1.2`} strokeWidth={0.3} opacity={ax} />
        ))}
        <rect x={fx(20)} y={31} width={fx(20000) - fx(20)} height={9} fill={LINE} stroke="none" opacity={0.6 * ear} />
        {arrow(fx(300), 14, enter(t, b.led, 0.8))}
        {arrow(fx(20000), 25, enter(t, b.motor, 0.8))}
      </Svg>
      {(
        [
          [10, "10"],
          [100, "100"],
          [1000, "1k"],
          [10000, "10k"],
          [100000, "100k"],
        ] as const
      ).map(([f, s]) => (
        <T key={f} x={fx(f)} y={44.5} size={2.2} color={MUTED} o={ax} className="tabular">
          {s}
        </T>
      ))}
      <T x={90} y={49.5} size={2.2} anchor="end" color={MUTED} o={ax}>
        频率 Hz
      </T>
      <T x={fx(300)} y={9.5} size={2.8} anchor="start" weight={600} color={HI} o={enter(t, b.led, 0.5)}>
        调光：几百 Hz 以上
      </T>
      <T x={90} y={20.5} size={2.8} anchor="end" weight={600} color={HI} o={enter(t, b.motor, 0.5)}>
        电机：20 kHz 以上
      </T>
      <T x={(fx(20) + fx(20000)) / 2} y={35.5} size={2.8} color={FG} o={ear}>
        人耳听得到
      </T>
    </>
  )
}

// ── servo: the width itself ─────────────────────────────────────────────────

function Servo({ t, b }: Pick<StageProps, "t" | "b">) {
  const w = keys(t, [
    [b.servoL + 0.3, 1.5],
    [b.ms1 - 0.3, 1.5],
    [b.ms1 + 0.3, 1.0],
    [b.ms2 - 0.3, 1.0],
    [b.ms2 + 0.4, 2.0],
  ])
  const ang = ((w - 1.5) * 120 * Math.PI) / 180
  const px = 77
  const py = 35
  const on = enter(t, b.servoL, 0.5)
  const pw = w * 9
  // a break in each long low stretch: the real period is 20 ms, far longer than the pulse
  const brk = (x: number) => `M${x - 1.6} 39.6 L${x - 0.6} 36.4 M${x + 0.6} 39.6 L${x + 1.6} 36.4`
  return (
    <>
      <Svg>
        <path d={`M8 38 H12 V22 H${12 + pw} V38 H36 V22 H${36 + pw} V38 H60`} stroke={HI} strokeWidth={0.5} opacity={on} />
        <path d={`${brk((48 + pw) / 2)} ${brk((96 + pw) / 2)}`} stroke={MUTED} strokeWidth={0.3} opacity={on} />
        <g opacity={on}>
          <path d={`M${px + 15 * Math.sin(-Math.PI / 3)} ${py - 15 * Math.cos(Math.PI / 3)} A15 15 0 0 1 ${px + 15 * Math.sin(Math.PI / 3)} ${py - 15 * Math.cos(Math.PI / 3)}`} stroke={LINE} strokeDasharray="0.8 0.8" strokeWidth={0.3} />
          <path d={`M${px} ${py} L${px + 14 * Math.sin(ang)} ${py - 14 * Math.cos(ang)}`} stroke={FG} strokeWidth={1} />
          <circle cx={px} cy={py} r={2.2} fill="var(--background)" strokeWidth={0.5} />
          <rect x={px - 9} y={py + 4} width={18} height={8} rx={1.2} strokeWidth={0.35} />
        </g>
      </Svg>
      <T x={34} y={14} size={3} weight={600} o={on}>
        脉冲宽度
      </T>
      <T x={34} y={45} size={5.4} weight={600} color={HI} o={on} className="tabular">
        {w.toFixed(1)} ms
      </T>
      <T x={34} y={51} size={2.4} color={MUTED} o={on} className="tabular">
        每 20 ms 一个脉冲
      </T>
      <T x={px} y={51} size={2.4} color={MUTED} o={on}>
        舵机转角
      </T>
    </>
  )
}

// ── MOSFET drives the motor ─────────────────────────────────────────────────

function Drive({ t, b }: Pick<StageProps, "t" | "b">) {
  const on = enter(t, b.drive, 0.5)
  const big = enter(t, b.big - 0.1, 0.5)
  const fet = enter(t, b.fet - 0.1, 0.6)
  const X = 51.6
  return (
    <>
      <Svg>
        <rect x={6} y={24} width={16} height={12} rx={1.4} strokeWidth={0.4} opacity={on} />
        <path d={pwm(0.4, 3, 5, 7, 17, 21)} stroke={HI} strokeWidth={0.4} opacity={on} />
        <circle cx={X} cy={12} r={5} strokeWidth={0.4} opacity={on} />
        <path d={`M${X} 4 V7 M40 4 H64`} strokeWidth={0.4} opacity={on} />
        <g opacity={fet}>
          <Sym x={46} y={30} scale={0.4}>
            <Mosfet x={0} y={0} />
          </Sym>
        </g>
        <Draw d="M22 30 H34" p={fet} strokeWidth={0.4} stroke={HI} />
        <Draw d={`M${X} 17 V18`} p={fet} strokeWidth={0.4} />
        <Draw d={`M${X} 42 V47 M48 47 H55.2 M49.5 48.6 H53.7 M51 50.2 H52.2`} p={fet} strokeWidth={0.4} />
        <g opacity={fet} strokeWidth={0.4}>
          <path d={`M61 4 V9.4 M61 12.6 V17.5 H${X}`} />
          <path d="M59.2 12.6 H62.8 L61 9.4 Z" fill="var(--background)" />
          <path d="M59.2 9.4 H62.8" />
          <circle cx={X} cy={17.5} r={0.55} fill="currentColor" stroke="none" />
        </g>
      </Svg>
      <T x={14} y={30} size={2.6} weight={600} o={on}>
        单片机
      </T>
      <T x={X} y={12} size={3.4} weight={600} font="var" o={on}>
        M
      </T>
      <T x={66} y={4} size={2.4} anchor="start" color={MUTED} o={on} className="tabular">
        12 V
      </T>
      <T x={14} y={42} size={2.6} color={trace.power} o={big}>
        只有几毫安
      </T>
      <T x={X - 7.5} y={12} size={2.6} anchor="end" color={trace.power} o={big}>
        要几安
      </T>
      <T x={66} y={30} size={3} anchor="start" weight={600} o={fet}>
        场效应管
      </T>
      <T x={66} y={36} size={2.4} anchor="start" color={MUTED} o={fet}>
        MOSFET，当开关
      </T>
    </>
  )
}

// ── RC smooths PWM into its average ─────────────────────────────────────────

function rcWave(tauPeriods: number, n: number, d: number) {
  const steps = 10
  let v = 0
  const pts: number[] = [0]
  for (let k = 0; k < n; k++)
    for (let s = 0; s < steps; s++) {
      const vin = s / steps < d ? 1 : 0
      v += (vin - v) * (1 / steps / tauPeriods)
      pts.push(v)
    }
  return pts
}

function Rc({ t, b }: Pick<StageProps, "t" | "b">) {
  const n = 24
  const P = 2.6
  const x0 = 14
  const d = 0.5
  const outPath = (pts: number[]) => pts.map((v, i) => `${i ? "L" : "M"}${(x0 + (i / (pts.length - 1)) * n * P).toFixed(2)} ${(48 - 18 * v).toFixed(2)}`).join("")
  const weak = React.useMemo(() => outPath(rcWave(0.6, n, d)), [])
  const strong = React.useMemo(() => outPath(rcWave(4, n, d)), [])
  const on = enter(t, b.rc, 0.6)
  const lp = enter(t, b.lp - 0.1, 0.5)
  const sm = enter(t, b.smooth - 0.1, 0.8)
  const avg = enter(t, b.mean - 0.1, 0.5)
  return (
    <>
      <Svg>
        <path d={pwm(d, n, P, x0, 8, 16)} stroke={HI} strokeWidth={0.4} opacity={on} />
        <g opacity={lp} strokeWidth={0.4}>
          <path d="M44 18 V21 M42.8 19.6 L44 21 L45.2 19.6" />
          <rect x={34} y={21} width={20} height={6.5} rx={1.2} />
          <path d="M44 27.5 V29.5 M42.8 28.1 L44 29.5 L45.2 28.1" />
        </g>
        <path d={`M${x0} 48 H${x0 + n * P}`} stroke={LINE} strokeWidth={0.3} opacity={lp} />
        <Draw d={weak} p={enter(t, b.lp + 0.3, 1.2)} stroke={trace.second} strokeWidth={0.45} opacity={1 - sm} />
        <path d={strong} stroke={trace.second} strokeWidth={0.55} opacity={sm} />
        <path d={`M${x0} ${48 - 18 * d} H${x0 + n * P + 3}`} stroke={FG} strokeWidth={0.25} strokeDasharray="1 0.9" opacity={avg} />
      </Svg>
      <T x={10} y={12} size={2.4} anchor="end" color={MUTED} o={on}>
        PWM
      </T>
      <T x={44} y={24.3} size={2.6} weight={600} o={lp}>
        低通滤波
      </T>
      <T x={10} y={40} size={2.4} anchor="end" color={MUTED} o={lp}>
        输出
      </T>
      <T x={x0 + n * P + 5} y={48 - 18 * d} size={2.8} anchor="start" weight={600} o={avg}>
        平均电压
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "PWM 脉宽调制",
  audio,
  timing,
  poster: 3.4,
  Stage,
}

export default function PwmFilm() {
  return <FilmPlayer film={film} />
}

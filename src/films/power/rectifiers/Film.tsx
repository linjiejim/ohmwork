import * as React from "react"
import { trace } from "@/lab/colors"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, Frac, M, Scene, Svg, T, V, easeInOut, enter, glide, lerp, span, type FilmDef, type StageProps } from "../../kit"
import { AMP, LINE, MUTED, POWER, VOLT } from "../../basics/shared"
import { DiodeMark, Outro, StepChip, lobe, vzig } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

const TEAL = trace.third

/*
 * 整流与滤波, ~56 s. Scenes, each keyed to the words that introduce it:
 *   title → an AC sine becomes a flat DC line ("100 times a second" pulses)
 *   → step 1: a transformer, a tall 220 V wave in and a short 9 V wave out
 *   → step 2: one diode cuts the negative half, then a bridge flips it up (bumps that fall to zero)
 *   → step 3: a capacitor tank fills on each peak and drains in each valley, the valleys fill in; ripple marked
 *   → the ripple formula → bigger C / heavier load, side by side → "try it below".
 */

const HW = 9 // half a cycle, in stage units
const SPEED = 3 // the waves scroll this many units a second

/** Scrolling offset of every wave, so all of them stay in step. */
const scroll = (t: number, still: boolean) => (still ? 0 : (t * SPEED) % (2 * HW))

/** The sine at stage x on a scope that starts at x0: +1 at the first peak. */
const sine = (x: number, x0: number, off: number) => Math.sin((Math.PI * (x - x0 + off)) / HW)

/** Rectified output with a smoothing capacitor: the bump or a straight discharge from the last peak, whichever is higher. k is the droop per half-cycle (0–∞). */
function smooth(u: number, k: number) {
  const w = ((((u - 0.5) % 1) + 1) % 1) + 0.5 // 0.5 … 1.5 within one hump, peak at 0.5
  return Math.max(Math.abs(Math.sin(Math.PI * w)), 1 - k * (w - 0.5))
}

/** The scope frame: a faint rounded box. */
function Scope({ x, y, w, h, o = 1 }: { x: number; y: number; w: number; h: number; o?: number }) {
  return <rect x={x} y={y} width={w} height={h} rx={1.2} stroke="var(--border)" strokeWidth={0.2} opacity={o} />
}

/** A scrolling polyline of f(x) between x0 and x1 on baseline y with the given amplitude. */
function waveD(x0: number, x1: number, y: number, amp: number, f: (x: number) => number, step = 0.6) {
  const pts: string[] = []
  for (let x = x0; x <= x1 + 0.001; x += step) pts.push(`${pts.length ? "L" : "M"}${x.toFixed(2)} ${(y - amp * f(x)).toFixed(2)}`)
  return pts.join("")
}

function Stage({ t, b, still }: StageProps) {
  const lift = (at: number) => (still ? 0 : -easeInOut((t - at) / 0.45) * 2)
  const rise = (at: number, d = 1.6) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)

  const title = span(t, 0.25, b.xfmr - 0.15, 0.4, 0.3)
  const xfmr = span(t, b.xfmr - 0.3, b.diode - 0.15, 0.3, 0.3)
  const rect = span(t, b.diode - 0.3, b.cap - 0.15, 0.3, 0.3)
  const cap = span(t, b.cap - 0.3, b.calc - 0.15, 0.3, 0.3)
  const calc = span(t, b.calc - 0.3, b.more - 0.15, 0.3, 0.3)
  const more = span(t, b.more - 0.3, b.outro - 0.15, 0.3, 0.3)
  const outro = enter(t, b.outro - 0.3, 0.4)

  return (
    <>
      <Scene o={title} dy={lift(b.xfmr - 0.45)}>
        <Title t={t} b={b} still={still} rise={rise} />
      </Scene>
      <Scene o={xfmr}>
        <Transformer t={t} b={b} still={still} />
      </Scene>
      <Scene o={rect}>
        <Rectify t={t} b={b} still={still} />
      </Scene>
      <Scene o={cap}>
        <Smoothing t={t} b={b} still={still} />
      </Scene>
      <Scene o={calc}>
        <Formula t={t} b={b} rise={rise} />
      </Scene>
      <Scene o={more}>
        <Compare t={t} b={b} still={still} />
      </Scene>
      <Scene o={outro}>
        <Outro t={t} b={b} still={still} hint="拖动下面实验台里的电容和负载" />
      </Scene>
    </>
  )
}

// ── title: AC → DC ──────────────────────────────────────────────────────────

function Title({ t, b, still, rise }: StageProps & { rise: (at: number, d?: number) => number }) {
  const off = scroll(t, still)
  const wave = enter(t, 1.0, 0.8)
  const dc = enter(t, b.dc - 0.3, 0.7)
  const pulse = (at: number) => (still ? 0 : Math.max(0, 1 - (t - at) / 0.6))
  return (
    <>
      <T x={50} y={13} size={7.5} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
        整流与滤波
      </T>
      <Svg>
        <g opacity={wave}>
          <clipPath id="ttl-c">
            <rect x={8} y={22} width={34} height={20} />
          </clipPath>
          <path d={waveD(8, 42, 32, 8, (x) => sine(x, 8, off))} stroke={VOLT} strokeWidth={0.5} clipPath="url(#ttl-c)" />
          <path d="M8 32 H42" stroke={LINE} strokeWidth={0.15} />
        </g>
        <g opacity={enter(t, b.dc - 0.3, 0.5)} strokeWidth={0.45}>
          <path d="M45 32 H55 M52.6 30.4 L55 32 L52.6 33.6" />
        </g>
        <g opacity={dc}>
          <path d="M58 32 H92" stroke={VOLT} strokeWidth={0.65} />
          <path d="M58 20 V40" stroke={LINE} strokeWidth={0.15} />
        </g>
        {/* "100 times a second": a tick at every reversal on the sine, pulsing */}
        {[0, 1, 2, 3, 4].map((j) => {
          const x = 8 - off + j * HW
          if (x < 8.5 || x > 41.5) return null
          return <circle key={j} cx={x} cy={32} r={0.7 + pulse(b.hund) * 0.8} fill={POWER} stroke="none" opacity={enter(t, b.hund - 0.1, 0.3)} />
        })}
      </Svg>
      <T x={25} y={43} size={3} weight={600} o={enter(t, b.ac, 0.4)}>
        交流 AC
      </T>
      <T x={75} y={43} size={3} weight={600} o={enter(t, b.dc, 0.4)}>
        直流 DC
      </T>
      <T x={25} y={49} size={2.4} color={POWER} o={span(t, b.hund - 0.1, b.xfmr - 0.8)}>
        <M className="tabular">每秒反向 100 次</M>
      </T>
    </>
  )
}

// ── step 1: transformer ─────────────────────────────────────────────────────

function Transformer({ t, b, still }: StageProps) {
  const off = scroll(t, still)
  const coil = enter(t, b.xf - 0.1, 0.7)
  const aIn = enter(t, b.xfmr, 0.5)
  const aOut = enter(t, b.v9 - 0.2, 0.5)
  const amp2 = lerp(0, 3, enter(t, b.v9 - 0.1, 0.7))
  const coilPath = (x: number, dir: 1 | -1) => {
    const y0 = 19
    const n = 5
    const hgt = 20
    let d = `M${x} ${y0 - 3} V${y0}`
    for (let i = 0; i < n; i++) d += ` a${(hgt / n) / 2} ${(hgt / n) / 2} 0 0 ${dir === 1 ? 1 : 0} 0 ${hgt / n}`
    d += ` V${y0 + hgt + 3}`
    return d
  }
  return (
    <>
      <StepChip o={enter(t, b.xfmr - 0.1)}>第一步 · 降压</StepChip>
      <Svg>
        <Scope x={4} y={15} w={28} h={26} o={aIn} />
        <Scope x={68} y={15} w={28} h={26} o={aOut} />
        <g opacity={aIn}>
          <clipPath id="tr-a">
            <rect x={4} y={15} width={28} height={26} />
          </clipPath>
          <path d={waveD(4, 32, 28, 10, (x) => sine(x, 4, off))} stroke={VOLT} strokeWidth={0.5} clipPath="url(#tr-a)" />
        </g>
        <g opacity={aOut}>
          <clipPath id="tr-b">
            <rect x={68} y={15} width={28} height={26} />
          </clipPath>
          <path d={waveD(68, 96, 28, amp2 * 1 + 0.001, (x) => sine(x, 68, off))} stroke={VOLT} strokeWidth={0.5} clipPath="url(#tr-b)" />
        </g>
        <Draw d={coilPath(41, -1)} p={coil} />
        <Draw d={coilPath(59, 1)} p={coil} />
        <g opacity={coil}>
          <path d="M49.2 17 V43 M50.8 17 V43" strokeWidth={0.3} />
        </g>
        <g opacity={aIn} stroke={LINE} strokeWidth={0.15}>
          <path d="M32 28 H36 V16 H41" />
        </g>
        <g opacity={aOut} stroke={LINE} strokeWidth={0.15}>
          <path d="M68 28 H64 V16 H59" />
        </g>
      </Svg>
      <T x={18} y={46} size={3.4} weight={600} color={VOLT} o={enter(t, b.v220 - 0.1, 0.4)} className="tabular">
        <M>220 V</M>
      </T>
      <T x={82} y={46} size={3.4} weight={600} color={VOLT} o={aOut} className="tabular">
        <M>9 V</M>
      </T>
      <T x={50} y={48} size={2.6} color={MUTED} o={coil}>
        变压器
      </T>
    </>
  )
}

// ── step 2: diode and bridge ────────────────────────────────────────────────

const PX0 = 46 // the plots
const PX1 = 94

function Rectify({ t, b, still }: StageProps) {
  const off = scroll(t, still)
  const m = still ? (t > b.flip ? 1 : 0) : easeInOut((t - (b.flip - 0.2)) / 0.8)
  const bridge = enter(t, b.bridge - 0.1, 0.5)
  const single = 1 - bridge
  const now = sine(PX1, PX0, off) // the wave at the right edge, "now"
  const pos = now >= 0
  const outY = 47
  const outAmp = 14
  const inY = 20
  const inAmp = 7

  // the output, one half-cycle at a time: positive halves always; negative halves flipped up by m
  const lobes: React.ReactNode[] = []
  const phase = (-off) % (2 * HW)
  for (let k = -1; k < 7; k++) {
    const xa = PX0 + phase + k * HW + (off === 0 ? 0 : 0)
    const up = (k % 2 + 2) % 2 === 0 ? 1 : -1
    // the sine's sign over [xa, xa+HW]: sample its middle
    const sgn = Math.sign(sine(xa + HW / 2, PX0, off)) || 1
    const h = sgn > 0 ? outAmp : outAmp * m
    if (h < 0.05) continue
    void up
    lobes.push(<path key={k} d={lobe(xa, xa + HW, outY, h)} stroke={sgn > 0 ? VOLT : TEAL} strokeWidth={0.55} />)
  }
  const blk = enter(t, b.blk - 0.2, 0.5)
  const flipped = enter(t, b.flip - 0.2, 0.5)
  const zeros = enter(t, b.zero - 0.1, 0.4)

  // the input scope: the part a single diode blocks is dimmed
  const inPos: string[] = []
  const inNeg: string[] = []
  for (let k = -1; k < 7; k++) {
    const xa = PX0 + phase + k * HW
    const sgn = Math.sign(sine(xa + HW / 2, PX0, off)) || 1
    ;(sgn > 0 ? inPos : inNeg).push(lobe(xa, xa + HW, inY, sgn * inAmp))
  }

  return (
    <>
      <StepChip o={enter(t, b.diode - 0.1)}>第二步 · 整流</StepChip>
      <Svg>
        <clipPath id="rc-p">
          <rect x={PX0} y={10} width={PX1 - PX0} height={42} />
        </clipPath>
        {/* left: the circuit */}
        <g opacity={single * enter(t, b.diode, 0.5)}>
          {/* a small loop: AC source → diode → load resistor → back */}
          <circle cx={8} cy={37} r={2.6} />
          <path d="M6.4 37 q0.8 -1.4 1.6 0 t1.6 0" strokeWidth={0.28} />
          <path d={`M8 34.4 V30 H${20 - 3.3} M${20 + 3.3} 30 H32 V33 ${vzig(32, 33, 41).slice(`M32 33`.length)} V44 H8 V39.6`} />
          <DiodeMark x={20} y={30} angle={0} size={2.2} color={pos ? AMP : MUTED} o={pos ? 1 : 0.5} />
          <path d={`M${20 - 3} ${30 - 5} L${20 + 3} ${30 + 5}`} stroke={POWER} strokeWidth={0.5} opacity={blk * (pos ? 0 : 1)} />
        </g>
        <g opacity={bridge}>
          {/* the bridge: a diamond of four diodes */}
          <path d="M12 36 L23 26 L34 36 L23 46 Z" strokeWidth={0.28} />
          <DiodeMark x={17.5} y={31} angle={-42} size={1.8} color={pos ? AMP : undefined} o={pos ? 1 : 0.4} />
          <DiodeMark x={28.5} y={31} angle={-138} size={1.8} color={!pos ? AMP : undefined} o={!pos ? 1 : 0.4} />
          <DiodeMark x={17.5} y={41} angle={-138} size={1.8} color={!pos ? AMP : undefined} o={!pos ? 1 : 0.4} />
          <DiodeMark x={28.5} y={41} angle={-42} size={1.8} color={pos ? AMP : undefined} o={pos ? 1 : 0.4} />
          <path d="M23 26 V21 M23 46 V51" />
        </g>
        {/* right: scopes */}
        <g opacity={enter(t, b.diode - 0.1, 0.5)}>
          <path d={`M${PX0} ${inY} H${PX1}`} stroke={LINE} strokeWidth={0.15} />
          <path d={`M${PX0} ${outY} H${PX1}`} stroke={LINE} strokeWidth={0.15} />
          <g clipPath="url(#rc-p)">
            {inPos.map((d, i) => (
              <path key={`p${i}`} d={d} stroke={VOLT} strokeWidth={0.45} />
            ))}
            {inNeg.map((d, i) => (
              <path key={`n${i}`} d={d} stroke={VOLT} strokeWidth={0.45} opacity={1 - 0.7 * Math.max(blk * (1 - m), 0) - 0.0} strokeDasharray={blk * (1 - m) > 0.3 ? "0.8 0.8" : undefined} />
            ))}
            {lobes}
          </g>
        </g>
        {/* valleys: the output touches zero */}
        {[0, 1, 2, 3, 4, 5].map((k) => {
          const x = PX0 + phase + k * HW + HW
          if (x < PX0 + 1 || x > PX1 - 1) return null
          return <circle key={k} cx={x} cy={outY} r={0.9} fill={POWER} stroke="none" opacity={zeros * m} />
        })}
      </Svg>
      <T x={PX0 - 1.5} y={inY} size={2.4} anchor="end" color={MUTED} o={enter(t, b.diode)}>
        输入
      </T>
      <T x={PX0 - 1.5} y={outY - 7} size={2.4} anchor="end" color={MUTED} o={enter(t, b.diode)}>
        输出
      </T>
      <T x={PX0 - 1.5} y={outY + 3} size={2} anchor="end" color={POWER} o={zeros * m}>
        <M>0 V</M>
      </T>
      <T x={20} y={22.4} size={2.4} color={MUTED} o={single * enter(t, b.diode, 0.5)}>
        二极管
      </T>
      <T x={30} y={49} size={2.4} color={MUTED} o={bridge}>
        整流桥
      </T>
      <T x={12} y={30} size={2.6} color={MUTED} o={bridge}>
        ~
      </T>
      <T x={34} y={30} size={2.6} color={MUTED} o={bridge}>
        ~
      </T>
      <T x={72} y={11} size={2.4} color={POWER} o={span(t, b.blk - 0.1, b.bridge - 0.3) * (1 - m)}>
        负半周被挡住
      </T>
      <T x={72} y={11} size={2.4} color={TEAL} o={flipped * (1 - 0)}>
        负半周被翻上来
      </T>
    </>
  )
}

// ── step 3: the capacitor ───────────────────────────────────────────────────

function Smoothing({ t, b, still }: StageProps) {
  const off = scroll(t, still)
  const X0 = 6
  const X1 = 66
  const Y0 = 48
  const AMPL = 26
  const k = glide(t, b.dis - 0.2, 2.6, 0.32, 1.6)
  const u = (x: number) => (x - X0 + off) / HW
  // "now" at the right edge: is the capacitor being charged (following the bump) or feeding the load?
  const nowU = u(X1)
  const w = ((((nowU - 0.5) % 1) + 1) % 1) + 0.5
  const bump = Math.abs(Math.sin(Math.PI * w))
  const line = 1 - k * (w - 0.5)
  const charging = bump >= line - 0.002
  const level = smooth(nowU, k)
  const wave = enter(t, b.cap - 0.2, 0.6)
  const smoothO = enter(t, b.cap + 0.2, 0.5)
  const peakY = Y0 - AMPL
  const valleyY = Y0 - AMPL * (1 - k)
  const rip = enter(t, b.rip - 0.2, 0.5)
  return (
    <>
      <StepChip o={enter(t, b.cap - 0.1)}>第三步 · 滤波</StepChip>
      <Svg>
        <clipPath id="sm-c">
          <rect x={X0} y={12} width={X1 - X0} height={40} />
        </clipPath>
        <g opacity={wave}>
          <path d={`M${X0} ${Y0} H${X1}`} stroke={LINE} strokeWidth={0.15} />
          <g clipPath="url(#sm-c)">
            <path d={waveD(X0, X1, Y0, AMPL, (x) => Math.abs(Math.sin(Math.PI * u(x))))} stroke={LINE} strokeWidth={0.35} strokeDasharray="0.8 0.8" />
            <path d={waveD(X0, X1, Y0, AMPL, (x) => smooth(u(x), k), 0.4)} stroke={VOLT} strokeWidth={0.6} opacity={smoothO} />
          </g>
        </g>
        {/* ripple bracket */}
        <g opacity={rip} stroke={POWER}>
          <path d={`M${X0} ${peakY} H${X1 + 1.5}`} strokeWidth={0.15} strokeDasharray="0.6 0.6" />
          <path d={`M${X0} ${valleyY} H${X1 + 1.5}`} strokeWidth={0.15} strokeDasharray="0.6 0.6" />
          <path d={`M${X1 + 2.5} ${peakY} V${valleyY} M${X1 + 1.7} ${peakY} H${X1 + 3.3} M${X1 + 1.7} ${valleyY} H${X1 + 3.3}`} strokeWidth={0.4} />
        </g>
        {/* the capacitor as a tank that fills on each peak and drains in each valley */}
        <g opacity={enter(t, b.cap - 0.1, 0.6)}>
          <rect x={78} y={18} width={12} height={24} rx={0.8} />
          <rect x={78.2} y={18 + 24 * (1 - level)} width={11.6} height={Math.max(0, 24 * level - 0.2)} fill={VOLT} stroke="none" opacity={0.28} />
          <path d={`M78 ${18 + 24 * (1 - level)} H90`} stroke={VOLT} strokeWidth={0.5} />
          <g opacity={charging ? 1 : 0} stroke={AMP} strokeWidth={0.5}>
            <path d="M84 10.5 V16 M82.2 14.2 L84 16 L85.8 14.2" />
          </g>
          <g opacity={charging ? 0 : 1} stroke={POWER} strokeWidth={0.5}>
            <path d="M84 44 V49.5 M82.2 47.7 L84 49.5 L85.8 47.7" />
          </g>
        </g>
      </Svg>
      <T x={84} y={charging ? 7.5 : 52} size={2.4} color={charging ? AMP : POWER} o={enter(t, b.chg - 0.1) * wave}>
        {charging ? "充电" : "放电"}
      </T>
      <T x={84} y={30} size={2.4} color={MUTED} o={enter(t, b.cap, 0.5)} className="font-medium">
        电容
      </T>
      <T x={X1 + 5.2} y={(peakY + valleyY) / 2} size={2.6} anchor="start" color={POWER} o={rip} className="font-semibold">
        纹波
      </T>
      <T x={32} y={13} size={2.4} color={MUTED} o={wave}>
        <span style={{ color: LINE }}>- - -</span> 整流后　<span style={{ color: VOLT }}>——</span> 加电容后
      </T>
    </>
  )
}

// ── the formula ─────────────────────────────────────────────────────────────

function Formula({ t, b, rise }: Pick<StageProps, "t" | "b"> & { rise: (at: number, d?: number) => number }) {
  const hi = (at: number, until: number) => 0.45 + 0.55 * span(t, at - 0.2, until, 0.25, 0.3)
  return (
    <>
      <T x={50} y={11} size={2.6} color={MUTED} o={enter(t, b.calc)}>
        纹波有多大？
      </T>
      <T x={50} y={27} size={7.4}>
        <span className="inline-flex items-center gap-[0.3em]">
          <span className="relative" style={{ opacity: enter(t, b.calc + 0.1) }}>
            <V c={VOLT}>ΔV</V>
          </span>
          <span style={{ opacity: enter(t, b.calc + 0.3) }}>
            <M>≈</M>
          </span>
          <Frac
            top={
              <span style={{ opacity: enter(t, b.cI - 0.1) }}>
                <V c={AMP}>I</V>
              </span>
            }
            bottom={
              <span className="inline-flex items-center gap-[0.2em]">
                <span style={{ opacity: enter(t, b.cF - 0.1) }}>
                  <V>f</V>
                </span>
                <span style={{ opacity: enter(t, b.cC - 0.2) }}>
                  <M>·</M>
                  <V>C</V>
                </span>
              </span>
            }
            bar={enter(t, b.cI - 0.3, 0.5)}
          />
        </span>
      </T>
      <T x={20} y={44} size={2.5} color={AMP} o={enter(t, b.cI) * hi(b.cI, b.cF - 0.4)} dy={rise(b.cI, 1)}>
        <span className="inline-flex items-center gap-[0.4em]"><V c={AMP}>I</V> 负载电流</span>
      </T>
      <T x={50} y={44} size={2.5} o={enter(t, b.cF) * hi(b.cF, b.cC - 0.2)} dy={rise(b.cF, 1)}>
        <span className="inline-flex items-center gap-[0.4em]"><V>f</V> 脉动频率 <M className="tabular">100 Hz</M></span>
      </T>
      <T x={82} y={44} size={2.5} o={enter(t, b.cC) * hi(b.cC, b.more - 0.4)} dy={rise(b.cC, 1)}>
        <span className="inline-flex items-center gap-[0.4em]"><V>C</V> 电容</span>
      </T>
    </>
  )
}

// ── bigger C / heavier load ─────────────────────────────────────────────────

function Panel({ t, still, x0, at, go, title, badge, label, k0, k1, color, k0Label, k1Label }: Pick<StageProps, "t" | "still"> & { x0: number; at: number; go: number; badge: string; title: string; label: string; k0: number; k1: number; color: string; k0Label: string; k1Label: string }) {
  const off = scroll(t, still)
  const W = 40
  const Y0 = 41
  const AMPL = 21
  const o = enter(t, at - 0.2, 0.5)
  const g = easeInOut((t - (go + 0.6)) / 1.0)
  const k = lerp(k0, k1, g)
  const u = (x: number) => (x - x0 + off) / HW
  const peakY = Y0 - AMPL
  const valleyY = Y0 - AMPL * (1 - k)
  return (
    <>
      <T x={x0 + W / 2} y={12} size={3} weight={600} o={o}>
        {title}
        <span style={{ opacity: enter(t, go, 0.4), color }}> {badge}</span>
      </T>
      <Svg>
        <clipPath id={`pn-${x0}`}>
          <rect x={x0} y={14} width={W} height={30} />
        </clipPath>
        <g opacity={o}>
          <path d={`M${x0} ${Y0} H${x0 + W}`} stroke={LINE} strokeWidth={0.15} />
          <path d={`M${x0} ${peakY} H${x0 + W}`} stroke={LINE} strokeWidth={0.15} strokeDasharray="0.6 0.6" />
          <g clipPath={`url(#pn-${x0})`}>
            <path d={waveD(x0, x0 + W, Y0, AMPL, (x) => smooth(u(x), k0), 0.4)} stroke={LINE} strokeWidth={0.4} />
            <path d={waveD(x0, x0 + W, Y0, AMPL, (x) => smooth(u(x), k), 0.4)} stroke={color} strokeWidth={0.6} />
          </g>
          <g stroke={POWER} strokeWidth={0.4}>
            <path d={`M${x0 + W + 1.4} ${peakY} V${valleyY} M${x0 + W + 0.6} ${peakY} H${x0 + W + 2.2} M${x0 + W + 0.6} ${valleyY} H${x0 + W + 2.2}`} />
          </g>
        </g>
      </Svg>
      <T x={x0 + W / 2} y={47} size={2.6} o={o} color={MUTED}>
        <span className="inline-flex items-center gap-[0.5em]">
          {label} <span style={{ color }} className="font-semibold">{g < 0.5 ? k0Label : k1Label}</span>
        </span>
      </T>
    </>
  )
}

function Compare({ t, b, still }: StageProps) {
  return (
    <>
      <Panel t={t} still={still} x0={6} at={b.more} go={b.bigC} title="电容" badge="×2" label="纹波" k0={0.36} k1={0.18} color={VOLT} k0Label="1×" k1Label="÷2" />
      <Panel t={t} still={still} x0={54} at={b.more} go={b.heavy} title="负载" badge="×2" label="纹波" k0={0.36} k1={0.72} color={trace.power} k0Label="1×" k1Label="×2" />
    </>
  )
}

export const film: FilmDef = {
  title: "整流与滤波",
  audio,
  timing,
  poster: 3.6,
  Stage,
}

export default function RectifiersFilm() {
  return <FilmPlayer film={film} />
}

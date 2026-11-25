import * as React from "react"
import { trace } from "@/lab/colors"
import { FilmPlayer } from "../../FilmPlayer"
import { M, Scene, Svg, T, V, clamp01, easeInOut, enter, lerp, span, type FilmDef, type StageProps } from "../../kit"
import { AMP, MUTED, POWER, VOLT, Readout } from "../../basics/shared"
import { Outro, PolyDots, StepChip, type Seg } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

const GOOD = trace.good

/*
 * 电池与充电, ~62 s. Scenes, each keyed to the words that introduce it:
 *   title → a lithium cell drawn in
 *   → voltage: a gauge from 4.2 V (full) down to 3 V (stop), the cell draining with it
 *   → capacity: a tank empties at 500 mA over five hours (2500 mAh)
 *   → rate: bars of how long 1C and 2C last
 *   → internal resistance: a cell with a resistor inside; more current, lower terminal voltage
 *   → discharge curve: fast, flat, then a cliff; a heavy load sinks it and leaves charge stranded
 *   → charging: constant current while the voltage climbs, then constant voltage while the current tapers to a tenth
 *   → safety: over-charge, over-discharge, short circuit, and the protection board → "try it below".
 */

function Stage({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.6) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)
  const lift = (at: number) => (still ? 0 : -easeInOut((t - at) / 0.45) * 2)
  const sc = (a: number, z: number) => span(t, a - 0.3, z - 0.25, 0.3, 0.3)

  return (
    <>
      <Scene o={span(t, 0.25, b.volt - 0.25, 0.4, 0.3)} dy={lift(b.volt - 0.4)}>
        <Title t={t} b={b} still={still} rise={rise} />
      </Scene>
      <Scene o={sc(b.volt, b.cap)}>
        <Voltage t={t} b={b} still={still} />
      </Scene>
      <Scene o={sc(b.cap, b.rate)}>
        <Capacity t={t} b={b} still={still} />
      </Scene>
      <Scene o={sc(b.rate, b.res)}>
        <Rate t={t} b={b} still={still} />
      </Scene>
      <Scene o={sc(b.res, b.curve)}>
        <Internal t={t} b={b} still={still} />
      </Scene>
      <Scene o={sc(b.curve, b.cc)}>
        <Curve t={t} b={b} still={still} />
      </Scene>
      <Scene o={sc(b.cc, b.safe)}>
        <Charge t={t} b={b} still={still} />
      </Scene>
      <Scene o={sc(b.safe, b.outro)}>
        <Safety t={t} b={b} still={still} />
      </Scene>
      <Scene o={enter(t, b.outro - 0.3, 0.4)}>
        <Outro t={t} b={b} still={still} hint="调内阻和电流，看能放出多少电" />
      </Scene>
    </>
  )
}

/** A vertical cell icon: body from y to y+h, a nub on top, filled to `level` (0–1). */
function Cell({ x, y, w, h, level, color = VOLT, o = 1 }: { x: number; y: number; w: number; h: number; level: number; color?: string; o?: number }) {
  return (
    <g opacity={o}>
      <rect x={x} y={y} width={w} height={h} rx={1.2} strokeWidth={0.35} />
      <rect x={x + w * 0.32} y={y - 1.8} width={w * 0.36} height={1.8} rx={0.4} strokeWidth={0.3} />
      <rect x={x + 0.35} y={y + 0.35 + (h - 0.7) * (1 - level)} width={w - 0.7} height={Math.max(0, (h - 0.7) * level)} rx={0.8} fill={color} stroke="none" opacity={0.3} />
    </g>
  )
}

// ── title ───────────────────────────────────────────────────────────────────

function Title({ t, b, rise }: StageProps & { rise: (at: number, d?: number) => number }) {
  const cell = enter(t, b.intro + 1.6, 0.8)
  return (
    <>
      <T x={50} y={13} size={7.5} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
        电池与充电
      </T>
      <Svg>
        <Cell x={42} y={22} w={16} h={22} level={cell} o={cell} />
        <g opacity={enter(t, b.bat, 0.5)} strokeWidth={0.4} stroke={VOLT}>
          <path d="M50 29.5 V34.5 M47.5 32 H52.5" />
        </g>
      </Svg>
      <T x={50} y={47.5} size={3} weight={600} o={enter(t, b.bat, 0.5)}>
        锂离子电池
      </T>
      <T x={26} y={33} size={2.6} color={MUTED} o={enter(t, b.intro + 1.2, 0.5)}>
        用多久？
      </T>
      <T x={74} y={33} size={2.6} color={MUTED} o={enter(t, b.intro + 1.8, 0.5)}>
        怎么充回去？
      </T>
    </>
  )
}

// ── voltage ─────────────────────────────────────────────────────────────────

function Voltage({ t, b }: StageProps) {
  const fall = easeInOut((t - (b.stop - 0.3)) / 2.4)
  const v = lerp(4.2, 3.0, fall)
  const level = (v - 3.0) / 1.2
  const SY0 = 16 // 4.2 V
  const SY1 = 44 // 3.0 V
  const vy = (x: number) => lerp(SY1, SY0, (x - 3.0) / 1.2)
  const sc = enter(t, b.volt, 0.6)
  const full = enter(t, b.full - 0.2, 0.5)
  const stopO = enter(t, b.stop - 0.2, 0.5)
  return (
    <>
      <StepChip o={enter(t, b.volt + 0.15)}>电压</StepChip>
      <Svg>
        <Cell x={16} y={vy(4.2) - 1} w={20} h={29} level={sc * level + (1 - sc) * 1} color={VOLT} o={sc} />
        <g opacity={sc}>
          <path d={`M54 ${SY0} V${SY1}`} />
          <path d={`M52 ${SY0} H56 M52 ${SY1} H56`} />
          <path d={`M52 ${vy(3.7)} H56`} strokeWidth={0.2} />
        </g>
        <g opacity={sc}>
          <path d={`M36 ${vy(v)} H50`} stroke={VOLT} strokeWidth={0.2} strokeDasharray="0.6 0.6" />
          <path d={`M50.2 ${vy(v)} L52.4 ${vy(v) - 1.4} V${vy(v) + 1.4} Z`} fill={VOLT} stroke="none" />
        </g>
      </Svg>
      <T x={58} y={SY0} size={2.8} anchor="start" weight={600} color={VOLT} o={full} className="tabular">
        <M>4.2 V</M>
      </T>
      <T x={67} y={SY0} size={2.6} anchor="start" color={MUTED} o={full}>
        充满
      </T>
      <T x={58} y={SY1} size={2.8} anchor="start" weight={600} color={POWER} o={stopO} className="tabular">
        <M>3.0 V</M>
      </T>
      <T x={67} y={SY1} size={2.6} anchor="start" color={MUTED} o={stopO}>
        停止放电
      </T>
      <T x={58} y={vy(3.7)} size={2.3} anchor="start" color={MUTED} o={sc * 0.9} className="tabular">
        <M>3.7 V 平均</M>
      </T>
      <T x={26} y={31} size={3.6} weight={600} color={VOLT} o={sc} className="tabular">
        <M>{v.toFixed(2)}</M>
      </T>
      <T x={26} y={49.5} size={2.4} color={MUTED} o={sc}>
        电压会一路降
      </T>
    </>
  )
}

// ── capacity ────────────────────────────────────────────────────────────────

function Capacity({ t, b }: StageProps) {
  const T0 = b.c2500 + 0.5
  const T1 = b.h5 + 1.2
  const p = easeInOut((t - T0) / (T1 - T0))
  const hours = Math.round(p * 5 * 10) / 10
  const tank = enter(t, b.cap - 0.1, 0.6)
  return (
    <>
      <StepChip o={enter(t, b.cap - 0.1)}>容量</StepChip>
      <Svg>
        <Cell x={10} y={16} w={18} h={28} level={1 - p} color={AMP} o={tank} />
        <g opacity={enter(t, b.c2500 - 0.1, 0.5)}>
          <path d="M19 46 V51" strokeWidth={0.4} stroke={AMP} />
          <path d="M17.2 49.4 L19 51.2 L20.8 49.4" strokeWidth={0.4} stroke={AMP} />
        </g>
        {/* five hours */}
        <g opacity={enter(t, b.h5 - 1.5, 0.5)}>
          <rect x={44} y={37} width={44} height={4} rx={0.6} strokeWidth={0.2} />
          <rect x={44.2} y={37.2} width={43.6 * (1 - p)} height={3.6} rx={0.5} fill={AMP} stroke="none" opacity={0.4} />
          {[1, 2, 3, 4].map((i) => (
            <path key={i} d={`M${44 + 8.8 * i} 37 V41`} strokeWidth={0.15} />
          ))}
        </g>
      </Svg>
      <T x={66} y={19} size={6.2} weight={600} o={enter(t, b.cap + 0.2, 0.5)} className="tabular">
        <M c={AMP}>2500</M>
        <M> mAh</M>
      </T>
      <T x={66} y={29} size={2.8} color={MUTED} o={enter(t, b.cap + 0.2, 0.5)}>
        毫安时 = 电流 × 时间
      </T>
      <T x={22} y={49} size={2.6} anchor="start" color={AMP} o={enter(t, b.c2500 + 0.3, 0.5)} className="tabular">
        <M>500 mA</M>
      </T>
      <T x={88} y={46} size={2.6} anchor="end" weight={600} o={enter(t, b.h5 - 1.5, 0.5)} className="tabular">
        <M>{hours.toFixed(1)} h</M>
      </T>
      <T x={44} y={46} size={2.4} anchor="start" color={MUTED} o={enter(t, b.h5 - 1.5, 0.5)}>
        放电 5 小时
      </T>
    </>
  )
}

// ── rate ────────────────────────────────────────────────────────────────────

function Rate({ t, b }: StageProps) {
  const rows = [
    { c: "1C", a: "2.5 A", time: "1 小时", len: 36, at: b.r1, color: AMP },
    { c: "2C", a: "5 A", time: "30 分钟", len: 18, at: b.r2, color: VOLT },
  ]
  return (
    <>
      <T x={50} y={9} size={2.6} color={MUTED} o={enter(t, b.rate - 0.1)}>
        以 2500 mAh 的电池为例
      </T>
      <T x={50} y={18} size={3.8} o={enter(t, b.rate + 0.2, 0.5)}>
        <span className="inline-flex items-center gap-[0.4em]">
          倍率 <M>=</M> 电流 <M>÷</M> 容量
        </span>
      </T>
      {rows.map((r, i) => {
        const y = 30 + i * 11
        const o = enter(t, b.rate + 0.3 + i * 0.3, 0.5)
        const g = enter(t, r.at - 0.1, 0.8)
        return (
          <React.Fragment key={r.c}>
            <T x={8} y={y} size={4.4} anchor="start" weight={600} color={r.color} o={o} className="tabular">
              <M>{r.c}</M>
            </T>
            <T x={22} y={y} size={2.6} anchor="start" color={MUTED} o={o} className="tabular">
              <M>{r.a}</M>
            </T>
            <Svg>
              <g opacity={o}>
                <rect x={36} y={y - 2.5} width={r.len * g} height={5} rx={0.6} fill={r.color} stroke="none" opacity={0.4} />
                <rect x={36} y={y - 2.5} width={r.len} height={5} rx={0.6} strokeWidth={0.2} />
              </g>
            </Svg>
            <T x={36 + r.len + 2} y={y} size={3} anchor="start" weight={600} o={enter(t, r.at + 0.4, 0.5)}>
              {r.time}放完
            </T>
          </React.Fragment>
        )
      })}
    </>
  )
}

// ── internal resistance ─────────────────────────────────────────────────────

const LOOP: Seg[] = [
  [8, 22, 8, 14],
  [8, 14, 46, 14],
  [46, 14, 46, 24],
  [46, 24, 46, 36, true],
  [46, 36, 46, 44],
  [46, 44, 8, 44],
  [8, 44, 8, 32],
]

function Internal({ t, b, still }: StageProps) {
  const ramp = easeInOut((t - (b.ir + 0.6)) / (b.low - b.ir - 0.2))
  const I = lerp(0.4, 4, ramp)
  const R = 0.08
  const drop = I * R
  const vt = 4.2 - drop
  const box = enter(t, b.res - 0.1, 0.6)
  const rr = enter(t, b.ir - 0.3, 0.5)
  const dr = enter(t, b.drop - 0.3, 0.5)
  const phase = still ? 0 : t * (4 + I * 4)
  return (
    <>
      <StepChip o={enter(t, b.res - 0.1)}>内阻</StepChip>
      <Svg>
        <g opacity={box}>
          <path d="M8 22 V14 H46 V24 M46 36 V44 H8 V32" />
          <path d="M46 24 L47.6 25.5 L44.4 28 L47.6 30.5 L44.4 33 L47.6 35 L46 36" />
          <rect x={4} y={19} width={12} height={16} rx={1.4} strokeDasharray="1 0.8" strokeWidth={0.25} />
          <path d="M4.6 24.5 H11.4" />
          <path d="M6.4 26.7 H9.6" strokeWidth={0.75} />
        </g>
        <g opacity={rr} stroke={POWER}>
          <path d="M8 22 V24.5 M8 26.7 V29 L9.4 29.6 L6.6 30.8 L9.4 32 L8 32.6 V32" />
        </g>
        <PolyDots segs={LOOP} phase={phase} o={box} color={AMP} />
        <g stroke="var(--border)" strokeWidth={0.12}>
          <path d="M62 23 H90" opacity={box} />
          <path d="M62 33 H90" opacity={rr} />
          <path d="M62 43 H90" opacity={dr} />
        </g>
      </Svg>
      <T x={20.5} y={27} size={2.4} anchor="start" color={POWER} o={rr}>
        内阻 <V>r</V>
      </T>
      <T x={17.5} y={21.5} size={2.4} anchor="start" color={MUTED} o={box}>
        电池
      </T>
      <T x={49.5} y={30} size={2.4} anchor="start" color={MUTED} o={box}>
        负载
      </T>
      <Readout y={18} label="电流" letter="I" color={AMP} o={box} value={`${I.toFixed(1)} A`} />
      <Readout y={28} label="内阻上掉的" letter="" color={POWER} o={dr} value={`${drop.toFixed(2)} V`} />
      <Readout y={38} label="端电压" letter="" color={VOLT} o={enter(t, b.low - 0.4, 0.5)} value={`${vt.toFixed(2)} V`} />
      <T x={76} y={48.5} size={2.4} color={MUTED} o={enter(t, b.low - 0.4, 0.5)} className="tabular">
        <M>端电压 = 4.2 V − I × r</M>
      </T>
    </>
  )
}

// ── discharge curve ─────────────────────────────────────────────────────────

const v0 = (x: number) => 3.5 + 0.65 * Math.exp(-x / 0.12) + 0.06 * (1 - x) - 0.5 * Math.exp(-(1 - x) / 0.035)
const v1 = (x: number) => v0(x) - 0.5

function Curve({ t, b }: StageProps) {
  const OX = 18
  const OY = 44
  const XE = 86
  const px = (x: number) => OX + x * (XE - OX)
  const py = (v: number) => OY - ((v - 2.8) / 1.5) * 32
  const axes = enter(t, b.curve - 0.1, 0.6)
  const P = clamp01((t - (b.curve + 0.3)) / (b.c3 + 0.9 - (b.curve + 0.3)))
  const pts = (f: (x: number) => number, upto: number, x1 = 1) => {
    const out: string[] = []
    for (let x = 0; x <= x1 + 1e-6; x += 0.01) {
      if (x > upto) break
      if (f(x) < 3.0 - 0.001 && f === v1) break
      out.push(`${out.length ? "L" : "M"}${px(x).toFixed(2)} ${py(f(x)).toFixed(2)}`)
    }
    return out.join("")
  }
  // where the heavy curve hits the 3.0 V line
  let xs = 1
  for (let x = 0; x <= 1; x += 0.005) if (v1(x) < 3.0) { xs = x; break }
  const P2 = easeInOut((t - (b.heavy - 0.1)) / 1.6)
  const labels = [
    { at: b.c1, text: "降得快", x: 0.3, dy: -5 },
    { at: b.c2, text: "中间很平缓", x: 0.5, dy: -4 },
    { at: b.c3, text: "急剧下跌", x: 0.9, dy: -6 },
  ]
  const fade = 1 - enter(t, b.heavy - 0.4, 0.4)
  return (
    <>
      <Svg>
        <g opacity={axes}>
          <path d={`M${OX} ${OY} H${XE + 2} M${OX} ${OY} V10`} />
          <path d={`M${OX} ${py(3.0)} H${XE}`} stroke={POWER} strokeWidth={0.2} strokeDasharray="0.8 0.8" />
        </g>
        <path d={pts(v0, P)} stroke={VOLT} strokeWidth={0.6} />
        {P > 0.02 && P < 1 && <circle cx={px(P)} cy={py(v0(P))} r={0.8} fill={VOLT} stroke="none" />}
        <path d={pts(v1, P2)} stroke={POWER} strokeWidth={0.6} opacity={P2 > 0 ? 1 : 0} />
        {P2 > 0.98 && <rect x={px(xs)} y={py(3.0) - 1.2} width={px(1) - px(xs)} height={2.4} fill={POWER} stroke="none" opacity={0.25 * enter(t, b.stuck - 0.3, 0.5)} />}
      </Svg>
      <T x={OX - 1.5} y={py(4.2)} size={2.2} anchor="end" color={MUTED} o={axes} className="tabular">
        <M>4.2 V</M>
      </T>
      <T x={OX - 1.5} y={py(3.0)} size={2.2} anchor="end" color={POWER} o={axes} className="tabular">
        <M>3.0 V</M>
      </T>
      <T x={XE} y={OY + 3.4} size={2.4} anchor="end" color={MUTED} o={axes}>
        放出的电量 →
      </T>
      <T x={OX} y={8} size={2.4} color={MUTED} o={axes}>
        电压
      </T>
      {labels.map((l) => (
        <T key={l.text} x={px(l.x)} y={py(v0(l.x)) + l.dy} size={2.5} weight={600} color={VOLT} o={enter(t, l.at, 0.4) * fade}>
          {l.text}
        </T>
      ))}
      <T x={px(0.6)} y={py(4.05)} size={2.5} weight={600} color={POWER} o={enter(t, b.heavy, 0.5)}>
        负载重：整条曲线下沉
      </T>
      <T x={px((xs + 1) / 2)} y={py(3.0) + 2.5} size={2.4} weight={600} color={POWER} o={enter(t, b.stuck - 0.2, 0.5)}>
        取不出来
      </T>
    </>
  )
}

// ── charging ────────────────────────────────────────────────────────────────

function Charge({ t, b }: StageProps) {
  const OX = 14
  const OY = 44
  const XE = 88
  const XC = 50 // the CC → CV switch
  const XF = 80 // the end
  const vy = (v: number) => OY - ((v - 3.0) / 1.4) * 30
  const iy = (i: number) => OY - i * 16 // the current sits well below the 4.2 V line
  const axes = enter(t, b.cc - 0.1, 0.6)
  const p1 = clamp01((t - (b.ccw - 0.2)) / (b.cv - 0.3 - (b.ccw - 0.2)))
  const p2 = clamp01((t - (b.cv - 0.3)) / (b.tenth + 0.4 - (b.cv - 0.3)))
  const vAt = (x: number) => (x <= XC ? lerp(3.4, 4.2, 1 - (1 - (x - OX) / (XC - OX)) ** 1.4) : 4.2)
  const iAt = (x: number) => (x <= XC ? 1 : 0.1 + 0.9 * Math.exp(-(x - XC) / 9))
  const trace1 = (f: (x: number) => number, y: (v: number) => number, x1: number, x2: number) => {
    const out: string[] = []
    for (let x = x1; x <= x2 + 1e-6; x += 0.5) out.push(`${out.length ? "L" : "M"}${x.toFixed(1)} ${y(f(x)).toFixed(2)}`)
    return out.join("")
  }
  const xNow = XC + p2 * (XF - XC)
  const cvO = enter(t, b.cvw - 0.2, 0.5)
  return (
    <>
      <Svg>
        <g opacity={axes}>
          <path d={`M${OX} ${OY} H${XE} M${OX} ${OY} V10`} />
          <path d={`M${OX} ${vy(4.2)} H${XE}`} stroke={VOLT} strokeWidth={0.15} strokeDasharray="0.6 0.6" />
        </g>
        {/* the two phases as faint bands */}
        <rect x={OX} y={10} width={XC - OX} height={OY - 10} fill={AMP} stroke="none" opacity={0.06 * enter(t, b.ccw - 0.3, 0.5)} />
        <rect x={XC} y={10} width={XF - XC + 6} height={OY - 10} fill={VOLT} stroke="none" opacity={0.06 * cvO} />
        {p1 > 0 && <path d={trace1(vAt, vy, OX + 0.1, OX + p1 * (XC - OX))} stroke={VOLT} strokeWidth={0.6} />}
        {p2 > 0 && <path d={trace1(vAt, vy, XC, xNow)} stroke={VOLT} strokeWidth={0.6} />}
        {p1 > 0 && <path d={trace1(iAt, iy, OX + 0.1, OX + p1 * (XC - OX))} stroke={AMP} strokeWidth={0.6} />}
        {p2 > 0 && <path d={trace1(iAt, iy, XC, xNow)} stroke={AMP} strokeWidth={0.6} />}
        <g opacity={enter(t, b.tenth - 0.3, 0.5)}>
          <path d={`M${XC} ${iy(0.1)} H${XF + 6}`} stroke={POWER} strokeWidth={0.2} strokeDasharray="0.8 0.8" />
          <circle cx={XF} cy={iy(iAt(XF))} r={1.1} stroke={POWER} />
        </g>
      </Svg>
      <T x={OX + (XC - OX) / 2} y={13} size={3} weight={600} color={AMP} o={enter(t, b.ccw - 0.2, 0.4)}>
        恒流
      </T>
      <T x={XC + (XF - XC) / 2 + 3} y={13} size={3} weight={600} color={VOLT} o={cvO}>
        恒压
      </T>
      <T x={XE} y={vy(4.2) - 2.4} size={2.2} anchor="end" color={VOLT} o={axes} className="tabular">
        <M>4.2 V</M>
      </T>
      <T x={OX + (XC - OX) * 0.72} y={iy(1) + 2.8} size={2.3} color={AMP} o={enter(t, b.ccw, 0.4)}>
        电流不变
      </T>
      <T x={OX + 3} y={vy(3.45) + 3.2} size={2.3} anchor="start" color={VOLT} o={enter(t, b.climb - 0.2, 0.4)}>
        电压爬升
      </T>
      <T x={XC + 8} y={iy(0.55) - 3} size={2.3} anchor="start" color={AMP} o={enter(t, b.taper - 0.2, 0.4)}>
        电流减小
      </T>
      <T x={XF + 7} y={iy(0.1) - 3.8} size={2.3} anchor="end" color={POWER} o={enter(t, b.tenth - 0.2, 0.4)}>
        降到 1/10：停
      </T>
      <T x={XE} y={OY + 3.4} size={2.4} anchor="end" color={MUTED} o={axes}>
        充电时间 →
      </T>
    </>
  )
}

// ── safety ──────────────────────────────────────────────────────────────────

function Safety({ t, b, still }: StageProps) {
  const cols = [
    { x: 20, at: b.over, label: "过充", sub: "高于 4.2 V" },
    { x: 50, at: b.under, label: "过放", sub: "低于 2.5 V" },
    { x: 80, at: b.short, label: "短路", sub: "电流瞬间几十安" },
  ]
  const gy = (v: number) => lerp(40, 14, (v - 2.0) / 2.8)
  const board = enter(t, b.board - 0.3, 0.6)
  const shimmer = (i: number) => (still ? 0 : Math.sin(t * 5 + i * 2))
  const base = enter(t, b.safe - 0.1, 0.5)
  const hit = cols.map((c) => enter(t, c.at - 0.1, 0.4))
  return (
    <>
      {cols.map((c, i) => (
        <React.Fragment key={c.label}>
          <T x={c.x} y={10} size={3.4} weight={600} color={MUTED} o={base * (1 - hit[i])}>
            {c.label}
          </T>
          <T x={c.x} y={10} size={3.4} weight={600} color={POWER} o={hit[i]}>
            {c.label}
          </T>
          <T x={c.x} y={43} size={2.3} color={MUTED} o={base * (1 - 0.5 * board)}>
            {c.sub}
          </T>
        </React.Fragment>
      ))}
      <Svg>
        <g opacity={base}>
          <rect x={16} y={14} width={8} height={26} rx={1} strokeWidth={0.3} />
          <rect x={16.3} y={gy(4.2)} width={7.4} height={40 - gy(4.2) - 0.3} fill={VOLT} stroke="none" opacity={0.3} />
          <rect x={46} y={14} width={8} height={26} rx={1} strokeWidth={0.3} />
          <rect x={76} y={18} width={8} height={18} rx={1} strokeWidth={0.3} />
          <rect x={79} y={16.4} width={2} height={1.6} rx={0.3} strokeWidth={0.25} />
        </g>
        <g opacity={base}>
          <path d={`M14 ${gy(4.2)} H26`} stroke={POWER} strokeWidth={0.25} strokeDasharray="0.6 0.6" />
          <path d={`M44 ${gy(2.5)} H56`} stroke={POWER} strokeWidth={0.25} strokeDasharray="0.6 0.6" />
        </g>
        <rect x={16.3} y={gy(4.7)} width={7.4} height={Math.max(0, (gy(4.2) - gy(4.7)) * hit[0])} fill={POWER} stroke="none" opacity={0.5} />
        <rect x={46.3} y={gy(2.2)} width={7.4} height={Math.max(0, 40 - gy(2.2) - 0.3) * hit[1]} fill={POWER} stroke="none" opacity={0.5} />
        <g opacity={hit[2]}>
          <path d="M80 16.4 V13.6 H90 V40 H80 V36" stroke={POWER} strokeWidth={0.5} />
          {[0, 1, 2].map((i) => (
            <path key={i} d={`M${86 + i * 2.2} 9.5 q1 -1.2 0 -2.4`} stroke={POWER} strokeWidth={0.35} opacity={0.5 + 0.5 * shimmer(i)} />
          ))}
        </g>
        <g opacity={board}>
          <rect x={14} y={46} width={72} height={6.4} rx={1.2} stroke={GOOD} strokeWidth={0.45} />
          <rect x={14} y={46} width={72} height={6.4} rx={1.2} fill={GOOD} stroke="none" opacity={0.1} />
        </g>
      </Svg>
      <T x={50} y={49.2} size={2.8} weight={600} color={GOOD} o={board}>
        保护板 + 正规的充电芯片
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "电池与充电",
  audio,
  timing,
  poster: 5.4,
  Stage,
}

export default function BatteriesFilm() {
  return <FilmPlayer film={film} />
}

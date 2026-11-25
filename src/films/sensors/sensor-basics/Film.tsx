import * as React from "react"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, M, Scene, Svg, T, V, enter, glide, lerp, span, type FilmDef, type StageProps } from "../../kit"
import { AMP, HEAT, LINE, MUTED, Outro, VOLT, Box, HArrow, curve, rnd, riseFn, sceneO } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

/*
 * 传感器与信号调理, ~59 s. Scenes, each keyed to the words that introduce it:
 *   title → a physical world that is not a voltage, and a microcontroller that only reads voltages
 *   → the chain sensor → conditioning → ADC → MCU, with the signal's shape under each stage
 *   → three output kinds → resolution (fine ticks) vs accuracy (an error band)
 *   → amplify to fill the ADC range, then too far: it clips (saturation)
 *   → two-point calibration → noise shrinking with averaging → "try it below".
 */
function Stage({ t, b, still }: StageProps) {
  const rise = riseFn(t, still)
  const title = span(t, 0.25, b.chain - 0.15, 0.4, 0.3)
  const chain = sceneO(t, b.chain, b.out)
  const out = sceneO(t, b.out, b.res)
  const acc = sceneO(t, b.res, b.amp)
  const amp = sceneO(t, b.amp, b.cal)
  const cal = sceneO(t, b.cal, b.avg)
  const avg = sceneO(t, b.avg, b.outro)
  const outro = enter(t, b.outro - 0.3, 0.4)

  return (
    <>
      <Scene o={title}>
        <T x={50} y={11} size={7.2} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
          传感器与信号调理
        </T>
        <Svg>
          <Box x={8} y={22} w={34} h={20} o={enter(t, b.phys - 0.2, 0.5)} />
          <Box x={58} y={22} w={34} h={20} o={enter(t, b.mcu + 0.3, 0.5)} />
          <HArrow x0={44} x1={56} y={32} p={enter(t, b.phys + 0.8, 0.6)} color={MUTED} />
        </Svg>
        <T x={25} y={29} size={3.2} weight={600} o={enter(t, b.phys, 0.5)} dy={rise(b.phys, 1)}>
          温度 · 光 · 重量
        </T>
        <T x={25} y={36} size={2.4} color={MUTED} o={enter(t, b.phys + 0.4, 0.5)}>
          世界上的物理量
        </T>
        <T x={75} y={29} size={3.2} weight={600} o={enter(t, b.mcu + 0.4, 0.5)} dy={rise(b.mcu + 0.4, 1)}>
          单片机
        </T>
        <T x={75} y={36} size={2.4} color={MUTED} o={enter(t, b.mcu + 0.8, 0.5)}>
          只认电压和数字
        </T>
        <T x={50} y={27.5} size={3} color={MUTED} o={enter(t, b.phys + 1.2, 0.5)}>
          ?
        </T>
      </Scene>

      <Scene o={chain}>
        <Chain t={t} b={b} still={still} />
      </Scene>
      <Scene o={out}>
        <Outputs t={t} b={b} still={still} />
      </Scene>
      <Scene o={acc}>
        <Accuracy t={t} b={b} />
      </Scene>
      <Scene o={amp}>
        <Amplify t={t} b={b} still={still} />
      </Scene>
      <Scene o={cal}>
        <Calibrate t={t} b={b} />
      </Scene>
      <Scene o={avg}>
        <Average t={t} b={b} />
      </Scene>
      <Scene o={outro}>
        <Outro t={t} still={still} at={b.outro} hintAt={b.try} hint="拖动实验台里的放大倍数和平均次数" />
      </Scene>
    </>
  )
}

// ── the signal chain ─────────────────────────────────────────────────────────

function Chain({ t, b, still }: StageProps) {
  const names = ["传感器", "信号调理", "模数转换器", "单片机"]
  const at = [b.sens, b.cond, b.adc, b.adc + 1.1]
  const notes = ["又小又吵", "放大、滤波", "变成数字", "读进来"]
  const ph = still ? 0 : t * 2
  const X = (i: number) => 4.25 + i * 24.5
  const cy = 38
  return (
    <>
      <Svg>
        {names.map((_, i) => (
          <Box key={i} x={X(i)} y={11} w={18} h={11} o={Math.max(enter(t, b.chain - 0.1, 0.6) * 0.55, enter(t, at[i], 0.45))} />
        ))}
        {[0, 1, 2].map((i) => (
          <HArrow key={i} x0={X(i) + 19} x1={X(i) + 23.5} y={16.5} p={enter(t, at[i + 1] - 0.3, 0.5)} color={MUTED} />
        ))}
        {/* 1: small and noisy */}
        <path d={curve((x) => cy + 1.6 * Math.sin((x - X(0)) * 0.9 + ph) + (rnd(Math.round((x - X(0)) * 3), Math.floor(ph * 2)) - 0.5) * 2.4, X(0), X(0) + 18, 50)} stroke={VOLT} opacity={enter(t, at[0] + 0.3)} />
        {/* 2: big and smooth */}
        <path d={curve((x) => cy + 6 * Math.sin((x - X(1)) * 0.9 + ph), X(1), X(1) + 18)} stroke={VOLT} opacity={enter(t, at[1] + 0.3)} />
        {/* 3: stair steps */}
        <path
          d={(() => {
            let d = ""
            for (let i = 0; i < 18; i++) {
              const y = cy - Math.round(6 * Math.sin(i * 0.9 + ph) * 0.75) * (6 / 4.5) * 1
              d += `${i ? "L" : "M"}${X(2) + i} ${y}L${X(2) + i + 1} ${y}`
            }
            return d
          })()}
          stroke={AMP}
          opacity={enter(t, at[2] + 0.3)}
        />
        <g stroke={LINE} strokeWidth={0.15} opacity={enter(t, b.sens + 0.2)}>
          {names.map((_, i) => (
            <path key={i} d={`M${X(i)} ${cy + 8} H${X(i) + 18}`} />
          ))}
        </g>
      </Svg>
      {names.map((n, i) => (
        <React.Fragment key={n}>
          <T x={X(i) + 9} y={16.5} size={2.8} weight={600} o={enter(t, at[i], 0.45)}>
            {n}
          </T>
          <T x={X(i) + 9} y={cy + 12} size={2.4} color={MUTED} o={enter(t, at[i] + 0.4, 0.45)}>
            {notes[i]}
          </T>
        </React.Fragment>
      ))}
      {["0110", "1011", "0101"].map((s, k) => (
        <T key={s} x={X(3) + 9} y={cy - 5 + k * 5} size={3.2} color={AMP} o={enter(t, at[3] + 0.3 + k * 0.15)} className="tabular">
          {s}
        </T>
      ))}
    </>
  )
}

// ── three kinds of output ────────────────────────────────────────────────────

function Outputs({ t, b, still }: StageProps) {
  const cards = [
    { x: 21, name: "模拟量", ex: "热敏电阻 · LM35", at: b.ana },
    { x: 50, name: "数字量", ex: "DS18B20 · BME280", at: b.dig },
    { x: 79, name: "开关量", ex: "霍尔开关 · 人体感应", at: b.sw },
  ]
  const ph = still ? 0 : t * 1.5
  return (
    <>
      <T x={50} y={9} size={4} weight={600} o={enter(t, b.out, 0.5)} dy={riseFn(t, still)(b.out)}>
        传感器交给你的信号
      </T>
      <Svg>
        {cards.map((c) => (
          <Box key={c.name} x={c.x - 13} y={16} w={26} h={26} o={enter(t, b.out + 0.3, 0.6)} />
        ))}
        <path d={curve((x) => 33 + 4 * Math.sin((x - 8) * 0.55 + ph), 11, 31, 50)} stroke={VOLT} opacity={enter(t, cards[0].at + 0.2)} />
        <path
          d={curve((x) => (Math.floor((x * 0.32 + ph * 0.3) % 2) === 0 ? 28 : 35), 69.5, 88.5, 120)}
          stroke={AMP}
          opacity={enter(t, cards[2].at + 0.2)}
          strokeLinecap="butt"
        />
      </Svg>
      {cards.map((c) => (
        <React.Fragment key={c.name}>
          <T x={c.x} y={22} size={3.2} weight={600} o={enter(t, c.at, 0.45)} dy={riseFn(t, still)(c.at, 1)}>
            {c.name}
          </T>
          <T x={c.x} y={47} size={2.4} color={MUTED} o={enter(t, c.at + 0.3, 0.45)}>
            {c.ex}
          </T>
        </React.Fragment>
      ))}
      {["0110 1010", "1100 0111"].map((s, k) => (
        <T key={s} x={50} y={31 + k * 5.5} size={3.2} color={AMP} o={enter(t, cards[1].at + 0.3 + k * 0.2)} className="tabular">
          {s}
        </T>
      ))}
      <T x={79} y={39} size={2.4} color={MUTED} o={enter(t, cards[2].at + 0.5)}>
        高 / 低
      </T>
    </>
  )
}

// ── resolution vs accuracy ───────────────────────────────────────────────────

function Accuracy({ t, b }: Pick<StageProps, "t" | "b">) {
  const ticks = enter(t, b.fine, 0.9)
  const band = enter(t, b.off - 1.3, 0.7)
  const x0 = 12
  const x1 = 88
  const step = 1.25
  const n = Math.floor((x1 - x0) / step)
  let d = ""
  for (let i = 0; i <= n; i++) d += `M${x0 + i * step} 19 v${i % 8 === 0 ? 5 : 3}`
  return (
    <>
      <T x={12} y={9} size={3.2} weight={600} anchor="start" o={enter(t, b.res, 0.45)}>
        分辨率
        <span style={{ marginLeft: "0.7em", fontSize: "0.72em", fontWeight: 400, color: MUTED }}>读数有多细</span>
      </T>
      <Svg>
        <Draw d={d} p={ticks} strokeWidth={0.2} stroke={MUTED} />
        <g opacity={enter(t, b.f1 - 0.2, 0.5)} stroke={AMP} strokeWidth={0.35}>
          <path d={`M${x0 + 20 * step} 27.5 V28.8 H${x0 + 21 * step} V27.5`} />
        </g>
        <g opacity={enter(t, b.acc, 0.5)}>
          <path d={`M${x0} 43 H${x1}`} stroke={LINE} strokeWidth={0.25} />
        </g>
        <rect x={lerp(50, 40, band)} y={39.5} width={lerp(0, 20, band)} height={6.5} rx={1.2} stroke={VOLT} strokeWidth={0.3} fill="none" opacity={band} />
        <circle cx={50} cy={43} r={1} fill={AMP} stroke="none" opacity={enter(t, b.acc + 0.5)} />
      </Svg>
      <T x={x0 + 20.5 * step} y={31} size={2.4} color={AMP} weight={600} o={enter(t, b.f1, 0.45)} className="tabular">
        <M>0.0625 °C</M>
      </T>
      <T x={12} y={37} size={3.2} weight={600} anchor="start" o={enter(t, b.acc - 0.2, 0.45)}>
        精度
        <span style={{ marginLeft: "0.7em", fontSize: "0.72em", fontWeight: 400, color: MUTED }}>读数有多准</span>
      </T>
      <T x={50} y={49} size={2.4} color={AMP} o={enter(t, b.acc + 0.5)} className="tabular">
        <M>读数 25.3 °C</M>
      </T>
      <T x={lerp(50, 60, band) + 2} y={43} size={2.8} weight={600} anchor="start" color={VOLT} o={band} className="tabular">
        <M>±0.5 °C</M>
      </T>
      <T x={24} y={49} size={2.4} color={MUTED} o={band} anchor="middle">
        真实值可能在这一段
      </T>
    </>
  )
}

// ── amplify, then clip ──────────────────────────────────────────────────────

function Amplify({ t, b, still }: StageProps) {
  const FX = 14
  const FW = 76
  const top = 14
  const bot = 46
  const mid = (top + bot) / 2
  const half = (bot - top) / 2
  const gain = t < b.over - 0.2 ? glide(t, b.big + 0.2, 1, 8, 1.0) : glide(t, b.over - 0.2, 8, 16, 0.9)
  const ph = still ? 0 : t * 1.6
  // ×8 fills the range (peaks at 14 of 16 units), ×16 runs far past it
  const raw = (x: number) => 1.75 * gain * Math.sin((x - FX) * 0.35 + ph)
  const clamp = (v: number) => Math.max(-half + 0.4, Math.min(half - 0.4, v))
  const sig = enter(t, b.small - 0.2, 0.5)
  const pts: [number, number, boolean][] = []
  for (let i = 0; i <= 90; i++) {
    const x = FX + (FW * i) / 90
    const r = raw(x)
    pts.push([x, mid - clamp(r), Math.abs(r) > half - 0.4])
  }
  const full = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join("")
  let clipped = ""
  pts.forEach((p, i) => {
    if (p[2] && i > 0 && pts[i - 1][2]) clipped += `M${pts[i - 1][0].toFixed(2)} ${pts[i - 1][1].toFixed(2)}L${p[0].toFixed(2)} ${p[1].toFixed(2)}`
  })
  const clipO = enter(t, b.over + 0.8, 0.5)
  const satO = enter(t, b.satw - 0.2, 0.45)
  return (
    <>
      <Svg>
        <Box x={FX} y={top} w={FW} h={bot - top} o={enter(t, b.amp, 0.5)} rx={0.8} />
        <path d={full} stroke={VOLT} opacity={sig} strokeWidth={0.45} />
        <path d={clipped} stroke={HEAT} opacity={sig * clipO} strokeWidth={0.8} />
      </Svg>
      <T x={FX - 1.5} y={top} size={2.2} anchor="end" color={MUTED} o={enter(t, b.amp + 0.3)} className="tabular">
        <M>3.3 V</M>
      </T>
      <T x={FX - 1.5} y={bot} size={2.2} anchor="end" color={MUTED} o={enter(t, b.amp + 0.3)} className="tabular">
        <M>0 V</M>
      </T>
      <T x={FX + FW} y={top - 3.4} size={2.4} anchor="end" color={MUTED} o={enter(t, b.full - 0.1)}>
        转换器的量程
      </T>
      <T x={FX} y={top - 3.4} size={3} anchor="start" weight={600} o={enter(t, b.big - 0.2, 0.5)} className="tabular">
        <span style={{ fontWeight: 400, color: MUTED }}>放大 </span>
        <M c={t > b.over ? HEAT : VOLT}>×{Math.round(gain)}</M>
      </T>
      <T x={50} y={50} size={3} color={MUTED} o={span(t, b.small - 0.1, b.big + 0.3, 0.4, 0.3)}>
        信号太小，只用了量程的一小截
      </T>
      <T x={50} y={50} size={3} color={MUTED} o={span(t, b.big + 1.1, b.over - 0.1, 0.4, 0.3)}>
        放大到正好占满量程
      </T>
      <T x={50} y={50} size={3} color={HEAT} o={enter(t, b.over + 1.0, 0.45)}>
        读数顶在最大值，波形被削平
      </T>
      <T x={50} y={top - 3.4} size={3.4} weight={600} color={HEAT} o={satO} scale={1 + 0.15 * (1 - enter(t, b.satw - 0.2, 0.5))}>
        饱和
      </T>
    </>
  )
}

// ── two-point calibration ───────────────────────────────────────────────────

function Calibrate({ t, b }: Pick<StageProps, "t" | "b">) {
  const gx = (r: number) => 24 + r * 0.5
  const gy = (v: number) => 44 - v * 0.34
  const axes = enter(t, b.cal, 0.6)
  const ice = enter(t, b.ice, 0.45)
  const boil = enter(t, b.boil, 0.45)
  const line = enter(t, b.boil + 0.3, 0.8)
  // what the uncalibrated sensor reads in ice water and in boiling water: off enough to see
  const ICE = 4
  const BOIL = 94
  return (
    <>
      <Svg>
        <Draw d={`M24 44 H78`} p={axes} />
        <Draw d={`M24 44 V8`} p={axes} />
        <Draw d={`M${gx(0)} ${gy(0)} L${gx(100)} ${gy(100)}`} p={enter(t, b.cal + 0.6, 0.8)} stroke="var(--faint-foreground)" strokeWidth={0.25} />
        <Draw d={`M${gx(ICE)} ${gy(0)} L${gx(BOIL)} ${gy(100)}`} p={line} stroke={VOLT} strokeWidth={0.4} />
        <circle cx={gx(ICE)} cy={gy(0)} r={1} fill={AMP} stroke="none" opacity={ice} />
        <circle cx={gx(BOIL)} cy={gy(100)} r={1} fill={AMP} stroke="none" opacity={boil} />
      </Svg>
      <T x={78} y={47.5} size={2.4} anchor="end" color={MUTED} o={axes}>
        传感器读数
      </T>
      <T x={22} y={8} size={2.4} anchor="end" color={MUTED} o={axes}>
        真实温度
      </T>
      <T x={gx(ICE) + 9} y={gy(0) - 2.2} size={2.6} anchor="start" weight={600} o={ice} className="tabular">
        冰水 <M>0 °C</M>
        <span style={{ marginLeft: "0.7em", fontWeight: 400, color: MUTED }}>
          读 <M>4.0</M>
        </span>
      </T>
      <T x={gx(BOIL) + 1} y={5.5} size={2.6} anchor="end" weight={600} o={boil} className="tabular">
        沸水 <M>100 °C</M>
        <span style={{ marginLeft: "0.7em", fontWeight: 400, color: MUTED }}>
          读 <M>94.0</M>
        </span>
      </T>
      <T x={84} y={14} size={2.4} color={MUTED} o={enter(t, b.cal + 1.2)} anchor="middle">
        理想：读数 = 真实
      </T>
      <T x={88} y={26} size={2.6} color={VOLT} o={enter(t, b.boil + 1.0)} anchor="middle">
        两点定一条线
      </T>
    </>
  )
}

// ── averaging ───────────────────────────────────────────────────────────────

function Average({ t, b }: Pick<StageProps, "t" | "b">) {
  const FX = 8
  const FW = 54
  const level = 28
  const n = 36
  const shown = Math.min(n, Math.floor(((t - b.jump) / (b.mean - b.jump)) * n * 0.9 + 1))
  const meanP = enter(t, b.mean, 1.0)
  const bars = [
    { label: "N = 1", h: 1, at: b.root - 0.9 },
    { label: "N = 4", h: 0.5, at: b.root - 0.5 },
    { label: "N = 16", h: 0.25, at: b.root - 0.1 },
    { label: "N = 64", h: 0.125, at: b.root + 0.3 },
  ]
  const BH = 26
  return (
    <>
      <T x={FX} y={9} size={3.2} weight={600} anchor="start" o={enter(t, b.avg, 0.45)}>
        同一个温度，连读几次
      </T>
      <Svg>
        <Box x={FX} y={14} w={FW} h={32} rx={0.8} o={enter(t, b.avg, 0.5)} />
        <path d={`M${FX} ${level} H${FX + FW * meanP}`} stroke={AMP} strokeWidth={0.45} opacity={meanP > 0 ? 1 : 0} />
        {Array.from({ length: Math.max(0, shown) }, (_, i) => {
          const x = FX + 2 + (i * (FW - 4)) / (n - 1)
          const noise = (rnd(i, 3) - 0.5) * 2
          const y = level + noise * 10 * (1 - 0.65 * meanP)
          return <circle key={i} cx={x} cy={y} r={0.75} fill={VOLT} stroke="none" opacity={enter(t, b.jump + (i / n) * (b.mean - b.jump) * 0.9, 0.2)} />
        })}
      </Svg>
      <T x={FX + FW / 2} y={50} size={2.4} color={MUTED} o={enter(t, b.jump + 0.8)}>
        每个点是一次读数，总在跳
      </T>
      <T x={FX + FW - 1.5} y={level - 6.5} size={2.4} anchor="end" color={AMP} weight={600} o={meanP}>
        平均值
      </T>

      <T x={78} y={9} size={3.2} weight={600} o={enter(t, b.root - 1.2, 0.45)}>
        噪声
      </T>
      <Svg>
        <path d={`M69 ${14 + BH + 4} H90`} stroke={LINE} strokeWidth={0.2} opacity={enter(t, b.root - 1.2)} />
        {bars.map((br, i) => {
          const p = enter(t, br.at, 0.5)
          const x = 70 + i * 5.2
          return <rect key={i} x={x} y={14 + BH + 4 - BH * br.h * p} width={3.4} height={BH * br.h * p} fill={VOLT} stroke="none" opacity={0.85} />
        })}
      </Svg>
      {bars.map((br, i) => (
        <T key={i} x={71.7 + i * 5.2} y={14 + BH + 7.4} size={1.9} color={MUTED} o={enter(t, br.at + 0.2)} className="tabular">
          {[1, 4, 16, 64][i]}
        </T>
      ))}
      <T x={79.5} y={51.5} size={2.4} color={MUTED} o={enter(t, b.root + 0.2)}>
        平均次数 <V>N</V>，噪声 ÷ √<V>N</V>
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "传感器与信号调理",
  audio,
  timing,
  poster: 5.2,
  Stage,
}

export default function SensorBasicsFilm() {
  return <FilmPlayer film={film} />
}

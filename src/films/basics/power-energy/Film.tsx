import * as React from "react"
import { glow, trace } from "@/lab/colors"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, Frac, M, Scene, Sub, Svg, T, V, easeInOut, enter, glide, lerp, span, type FilmDef, type StageProps } from "../../kit"
import { AMP, LINE, MUTED, POWER, VOLT, zig } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

const ENERGY = trace.third

/*
 * 功率与能量, 65 s. Scenes, each keyed to the words that introduce it:
 *   title → two questions (will it burn? how long will it last?) as P and E cards
 *   → electric energy becomes heat / light / motion: "how fast" is power
 *   → P = V × I with 5 V × 2 A = 10 W → the two other forms on the resistor
 *   → rating line on a P–V parabola, the burn zone, then V ×2 → P ×4
 *   → E = P × t → mAh × V = Wh → battery life bars → "try both labs".
 */
function Stage({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.6) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)
  // a scene has faded out by the time the next line starts, and the next fades in from there:
  // two scenes are never on the stage at once
  const sc = (a: number, z: number) => span(t, a - 0.05, z - 0.3, 0.35, 0.3)
  const title = span(t, 0.25, b.conv - 0.3, 0.4, 0.3)
  const conv = sc(b.conv, b.form)
  const form = sc(b.form, b.forms)
  const forms = sc(b.forms, b.rated)
  const graph = sc(b.rated, b.energy)
  const energy = sc(b.energy, b.cap)
  const cap = sc(b.cap, b.life)
  const life = sc(b.life, b.outro)
  const outro = enter(t, b.outro - 0.05, 0.4)
  return (
    <>
      <Scene o={title}>
        <Title t={t} b={b} rise={rise} />
      </Scene>
      <Scene o={conv}>
        <Convert t={t} b={b} still={still} />
      </Scene>
      <Scene o={form}>
        <Formula t={t} b={b} rise={rise} />
      </Scene>
      <Scene o={forms}>
        <Forms t={t} b={b} />
      </Scene>
      <Scene o={graph}>
        <Parabola t={t} b={b} />
      </Scene>
      <Scene o={energy}>
        <Energy t={t} b={b} rise={rise} />
      </Scene>
      <Scene o={cap}>
        <Capacity t={t} b={b} />
      </Scene>
      <Scene o={life}>
        <Life t={t} b={b} />
      </Scene>
      <Scene o={outro}>
        <Outro t={t} b={b} still={still} rise={rise} />
      </Scene>
    </>
  )
}

// ── title ────────────────────────────────────────────────────────────────────

function Title({ t, b, rise }: { t: number; b: Record<string, number>; rise: (at: number, d?: number) => number }) {
  const cards = [
    { x: 29, letter: "P", word: "功率", q: "电阻会烫坏吗？", color: POWER, at: b.hot },
    { x: 71, letter: "E", word: "能量", q: "电池能撑多久？", color: ENERGY, at: b.batt },
  ]
  const frame = enter(t, b.intro + 1.0, 0.6)
  return (
    <>
      <T x={50} y={12} size={7.6} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
        功率与能量
      </T>
      <Svg>
        {cards.map((c) => (
          <rect key={c.letter} x={c.x - 17} y={22} width={34} height={21} rx={1.6} stroke={LINE} strokeWidth={0.25} opacity={frame} />
        ))}
      </Svg>
      {cards.map((c) => (
        <React.Fragment key={c.letter}>
          <T x={c.x} y={30} size={7} color={MUTED} o={frame * (1 - enter(t, c.at, 0.3))}>
            ?
          </T>
          <T x={c.x} y={29.5} size={7} font="var" color={c.color} o={enter(t, c.at, 0.4)} dy={rise(c.at, 1)}>
            {c.letter}
          </T>
          <T x={c.x} y={37} size={3.2} o={enter(t, c.at + 0.1, 0.4)}>
            {c.q}
          </T>
        </React.Fragment>
      ))}
    </>
  )
}

// ── energy becomes heat, light, motion ───────────────────────────────────────

function Convert({ t, b, still }: StageProps) {
  const wave = (at: number, i: number) => (still ? 1 : 0.45 + 0.55 * Math.sin(t * 4 + i * 1.7)) * enter(t, at, 0.4)
  const spin = still ? 0 : t * 3
  const tiles: { x: number; word: string; at: number }[] = [
    { x: 20, word: "变成热", at: b.heat },
    { x: 50, word: "变成光", at: b.light },
    { x: 80, word: "变成转动", at: b.spin },
  ]
  return (
    <>
      <T x={50} y={9} size={3.4} color={MUTED} o={enter(t, b.conv - 0.1, 0.5)}>
        电能
      </T>
      <Svg>
        <path d="M50 12.5 V15" opacity={enter(t, b.conv, 0.4)} stroke={MUTED} strokeWidth={0.25} />
        <path d="M20 15 H80 M20 15 V18 M50 15 V18 M80 15 V18" opacity={enter(t, b.conv, 0.5)} stroke={MUTED} strokeWidth={0.25} />
        {/* heat */}
        <g opacity={enter(t, b.heat, 0.4)}>
          <path d={zig(11, 28, 29, 28, 6, 1.7)} />
        </g>
        {[-4, 0, 4].map((dx, i) => (
          <path key={i} d={`M${20 + dx} 25 q1.3 -1.4 0 -2.8 t0 -2.8`} stroke={POWER} strokeWidth={0.4} opacity={wave(b.heat, i)} />
        ))}
        {/* light: a diode with rays */}
        <g opacity={enter(t, b.light, 0.4)}>
          <path d="M41 28 H46 M54 28 H59 M46 23.5 V32.5 L53 28 Z M53 23.5 V32.5" />
        </g>
        <g stroke={glow.amber} strokeWidth={0.45} opacity={wave(b.light, 3)}>
          <path d="M52 21.5 L56 17.5 M54.6 21 L58.6 17" />
          <path d="M56 17.5 h-1.5 M56 17.5 v1.5 M58.6 17 h-1.5 M58.6 17 v1.5" />
        </g>
        {/* motion */}
        <g opacity={enter(t, b.spin, 0.4)}>
          <circle cx={80} cy={26} r={7} />
          {[0, 1, 2].map((k) => {
            const a = spin + (k * 2 * Math.PI) / 3
            return <path key={k} d={`M80 26 L${80 + 5 * Math.cos(a)} ${26 + 5 * Math.sin(a)}`} strokeWidth={0.4} />
          })}
        </g>
        {/* the power bar */}
        <Draw d="M30 44.5 H70" p={enter(t, b.pwr - 0.2, 0.7)} stroke={POWER} strokeWidth={0.4} />
      </Svg>
      {tiles.map((c) => (
        <T key={c.x} x={c.x} y={38} size={3.2} color={MUTED} o={enter(t, c.at + 0.1, 0.4)}>
          {c.word}
        </T>
      ))}
      <T x={26} y={49} size={3.6} anchor="start" o={enter(t, b.pwr, 0.45)}>
        转换得多快：功率 <V c={POWER}>P</V>
      </T>
      <T x={94} y={49} size={3.2} anchor="end" weight={600} color={POWER} o={enter(t, b.watt, 0.45)}>
        单位 瓦特（W）
      </T>
    </>
  )
}

// ── P = V × I ────────────────────────────────────────────────────────────────

function Formula({ t, b, rise }: { t: number; b: Record<string, number>; rise: (at: number, d?: number) => number }) {
  return (
    <>
      <T x={50} y={22} size={9}>
        <span className="inline-flex items-center gap-[0.3em]">
          <span className="relative" style={{ opacity: enter(t, b.pf - 0.1, 0.4) }}>
            <V c={POWER}>P</V>
            <Sub>功率</Sub>
          </span>
          <span style={{ opacity: enter(t, b.pf + 0.2, 0.4) }}>
            <M>=</M>
          </span>
          <span className="relative" style={{ opacity: enter(t, b.fv, 0.4) }}>
            <V c={VOLT}>V</V>
            <Sub>电压</Sub>
          </span>
          <span style={{ opacity: enter(t, b.fv + 0.2, 0.4) }}>
            <M>×</M>
          </span>
          <span className="relative" style={{ opacity: enter(t, b.fi, 0.4) }}>
            <V c={AMP}>I</V>
            <Sub>电流</Sub>
          </span>
        </span>
      </T>
      <T x={50} y={42} size={6} dy={rise(b.e5, 1)} o={enter(t, b.e5 - 0.2, 0.4)}>
        <span className="inline-flex items-center gap-[0.3em] tabular">
          <M c={VOLT} className="">
            <span style={{ opacity: enter(t, b.e5, 0.4) }}>5 V</span>
          </M>
          <span style={{ opacity: enter(t, b.e5 + 0.3, 0.4) }}>
            <M>×</M>
          </span>
          <M c={AMP}>
            <span style={{ opacity: enter(t, b.e2, 0.4) }}>2 A</span>
          </M>
          <span style={{ opacity: enter(t, b.e10 - 0.2, 0.4) }}>
            <M>=</M>
          </span>
          <span className="inline-block" style={{ opacity: enter(t, b.e10, 0.4), transform: `scale(${lerp(1.18, 1, enter(t, b.e10, 0.5))})` }}>
            <M c={POWER} className="font-semibold">
              10 W
            </M>
          </span>
        </span>
      </T>
    </>
  )
}

// ── the three forms ──────────────────────────────────────────────────────────

function Forms({ t, b }: Pick<StageProps, "t" | "b">) {
  const rows = [
    { y: 15, at: b.forms, note: "任何元件都能用" },
    { y: 29, at: b.ir, note: "导线、串联的电阻发多少热" },
    { y: 43, at: b.vr, note: "电阻直接接在已知电压上" },
  ]
  return (
    <>
      <T x={30} y={rows[0].y} size={6} o={enter(t, b.forms - 0.1, 0.5)}>
        <span className="inline-flex items-center gap-[0.28em]">
          <V c={POWER}>P</V>
          <M>=</M>
          <V c={VOLT}>V</V>
          <M>×</M>
          <V c={AMP}>I</V>
        </span>
      </T>
      <T x={30} y={rows[1].y} size={6} o={enter(t, b.ir, 0.45)}>
        <span className="inline-flex items-center gap-[0.28em]">
          <V c={POWER}>P</V>
          <M>=</M>
          <span>
            <V c={AMP}>I</V>
            <sup style={{ fontSize: "0.55em" }}>
              <M>2</M>
            </sup>
          </span>
          <M>×</M>
          <V>R</V>
        </span>
      </T>
      <T x={30} y={rows[2].y} size={6} o={enter(t, b.vr, 0.45)}>
        <span className="inline-flex items-center gap-[0.28em]">
          <V c={POWER}>P</V>
          <M>=</M>
          <Frac
            top={
              <span>
                <V c={VOLT}>V</V>
                <sup style={{ fontSize: "0.55em" }}>
                  <M>2</M>
                </sup>
              </span>
            }
            bottom={<V>R</V>}
            bar={enter(t, b.vr + 0.1, 0.4)}
          />
        </span>
      </T>
      {rows.map((r, i) => (
        <T key={i} x={55} y={r.y} size={2.7} anchor="start" color={MUTED} o={enter(t, r.at + (i ? 0.25 : 0.1), 0.5)}>
          {r.note}
        </T>
      ))}
      <Svg>
        {rows.map((r, i) => (
          <path key={i} d={`M50 ${r.y} h2.5`} stroke={MUTED} strokeWidth={0.25} opacity={enter(t, r.at + (i ? 0.25 : 0.1), 0.5)} />
        ))}
      </Svg>
    </>
  )
}

// ── P against V ──────────────────────────────────────────────────────────────

const OX = 14
const OY = 46
const XS = 5.6 // per volt
const YS = 30 // per watt
const px = (v: number) => OX + XS * v
const py = (p: number) => OY - YS * p

function Parabola({ t, b }: Pick<StageProps, "t" | "b">) {
  const axes = enter(t, b.rated - 0.3, 0.7)
  const curve = enter(t, b.rated - 0.1, 1.1)
  const volts = glide(t, b.dbl, 5, 10, 1)
  const pw = (volts * volts) / 100
  const marker = enter(t, b.rate + 0.2, 0.4)
  const pts: string[] = []
  const nMax = Math.round(curve * 40)
  for (let i = 0; i <= nMax; i++) {
    const v = (i / 40) * 10
    pts.push(`${i ? "L" : "M"}${px(v)} ${py((v * v) / 100)}`)
  }
  const zone = enter(t, b.burn, 0.6)
  const over = enter(t, b.four, 0.4)
  return (
    <>
      <Svg>
        <rect x={OX} y={11} width={XS * 10} height={py(0.25) - 11} fill={POWER} stroke="none" opacity={zone * 0.1} />
        <Draw d={`M${OX} ${OY} H${px(10) + 6}`} p={axes} />
        <Draw d={`M${OX} ${OY} V9`} p={axes} />
        <g opacity={axes} strokeWidth={0.2}>
          <path d={`M${px(5)} ${OY} v0.9 M${px(10)} ${OY} v0.9 M${OX} ${py(1)} h-0.9`} />
        </g>
        {nMax > 0 && <path d={pts.join(" ")} stroke={POWER} strokeWidth={0.5} />}
        <Draw d={`M${OX} ${py(0.25)} H${px(10) + 1}`} p={enter(t, b.rate, 0.6)} stroke={MUTED} strokeWidth={0.3} strokeDasharray="1 0.8" />
        <circle cx={px(volts)} cy={py(pw)} r={1} fill={POWER} stroke="none" opacity={marker} />
        <circle cx={px(10)} cy={py(1)} r={2.4} stroke={POWER} strokeWidth={0.4} opacity={over} />
      </Svg>
      <T x={px(10) + 7} y={OY} size={2.4} anchor="start" color={MUTED} o={axes}>
        电压 <V c={VOLT}>V</V>
      </T>
      <T x={OX} y={6.5} size={2.4} color={MUTED} o={axes}>
        功率 <V c={POWER}>P</V>
      </T>
      <T x={px(5)} y={OY + 2.8} size={2} color={MUTED} o={axes} className="tabular">
        5 V
      </T>
      <T x={px(10)} y={OY + 2.8} size={2} color={MUTED} o={axes} className="tabular">
        10 V
      </T>
      <T x={OX - 1.6} y={py(1)} size={2} anchor="end" color={MUTED} o={axes} className="tabular">
        1 W
      </T>
      <T x={px(10) + 3} y={py(0.25)} size={2.6} anchor="start" color={MUTED} o={enter(t, b.rate, 0.5)}>
        额定 1/4 W
      </T>
      <T x={OX + 3} y={15} size={3.4} anchor="start" weight={600} color={POWER} o={zone}>
        烧坏
      </T>
      <T x={px(volts) - 2.5} y={py(pw) - 2.8} size={2.6} anchor="end" color={MUTED} o={marker} className="tabular">
        {Math.round(volts)} V · {pw < 0.995 ? `${Math.round(pw * 1000)} mW` : "1 W"}
      </T>
      <T x={px(10) + 5} y={py(1)} size={4.4} anchor="start" weight={600} color={POWER} o={over}>
        <M>×4</M>
      </T>
      <T x={86} y={15} size={3} color={MUTED} o={enter(t, b.rated - 0.1, 0.5)}>
        <span className="tabular">R = 100 Ω</span>
      </T>
      <T x={86} y={21} size={3.2} o={enter(t, b.sq, 0.5)}>
        <span className="inline-flex items-center gap-[0.25em]">
          <V c={POWER}>P</V>
          <M>=</M>
          <Frac
            top={
              <span>
                <V c={VOLT}>V</V>
                <sup style={{ fontSize: "0.6em" }}>
                  <M>2</M>
                </sup>
              </span>
            }
            bottom={<V>R</V>}
          />
        </span>
      </T>
    </>
  )
}


// ── E = P × t ────────────────────────────────────────────────────────────────

function Energy({ t, b, rise }: { t: number; b: Record<string, number>; rise: (at: number, d?: number) => number }) {
  return (
    <>
      <T x={50} y={21} size={9}>
        <span className="inline-flex items-center gap-[0.3em]">
          <span className="relative" style={{ opacity: enter(t, b.eng - 0.1, 0.45) }}>
            <V c={ENERGY}>E</V>
            <Sub>能量</Sub>
          </span>
          <span style={{ opacity: enter(t, b.eng + 0.2, 0.4) }}>
            <M>=</M>
          </span>
          <span style={{ opacity: enter(t, b.energy - 0.1, 0.45) }}>
            <V c={POWER}>P</V>
          </span>
          <span style={{ opacity: enter(t, b.time - 0.2, 0.4) }}>
            <M>×</M>
          </span>
          <span className="relative" style={{ opacity: enter(t, b.time, 0.4) }}>
            <V>t</V>
            <Sub>时间</Sub>
          </span>
        </span>
      </T>
      <T x={50} y={40} size={5} o={enter(t, b.wh - 1.8, 0.5)} dy={rise(b.wh - 1.8, 1)}>
        <span className="inline-flex items-center gap-[0.3em] tabular">
          <M c={POWER}>1 W</M>
          <M>×</M>
          <M>1 小时</M>
          <span style={{ opacity: enter(t, b.wh - 0.3, 0.4) }}>
            <M>=</M>
          </span>
          <span style={{ opacity: enter(t, b.wh, 0.4) }}>
            <M c={ENERGY} className="font-semibold">
              1 Wh
            </M>
          </span>
        </span>
      </T>
    </>
  )
}

// ── mAh × V ──────────────────────────────────────────────────────────────────

function Capacity({ t, b }: Pick<StageProps, "t" | "b">) {
  const fill = enter(t, b.cap, 0.8)
  return (
    <>
      <Svg>
        <g opacity={enter(t, b.cap - 0.1, 0.5)}>
          <rect x={34} y={9} width={32} height={13} rx={1.6} />
          <path d="M66 13 h1.8 v5 h-1.8" />
        </g>
        <rect x={35.6} y={10.6} width={29 * fill} height={9.8} rx={0.8} fill={AMP} stroke="none" opacity={0.25} />
      </Svg>
      <T x={50} y={15.8} size={3.4} weight={600} color={AMP} o={enter(t, b.mah - 0.2, 0.4)}>
        <M className="tabular">3000 mAh</M>
      </T>
      <T x={50} y={36} size={5.4}>
        <span className="inline-flex items-center gap-[0.3em] tabular">
          <span className="relative" style={{ opacity: enter(t, b.mah, 0.4) }}>
            <M c={AMP}>3000 mAh</M>
            <Sub>容量</Sub>
          </span>
          <span style={{ opacity: enter(t, b.cv - 0.2, 0.4) }}>
            <M>×</M>
          </span>
          <span className="relative" style={{ opacity: enter(t, b.cv, 0.4) }}>
            <M c={VOLT}>3.7 V</M>
            <Sub>电压</Sub>
          </span>
          <span style={{ opacity: enter(t, b.cen - 0.3, 0.4) }}>
            <M>≈</M>
          </span>
          <span className="inline-block" style={{ opacity: enter(t, b.cen, 0.4), transform: `scale(${lerp(1.18, 1, enter(t, b.cen, 0.5))})` }}>
            <M c={ENERGY} className="font-semibold">
              11 Wh
            </M>
          </span>
        </span>
      </T>
    </>
  )
}

// ── battery life ─────────────────────────────────────────────────────────────

function Life({ t, b }: Pick<StageProps, "t" | "b">) {
  const rows = [
    { y: 25, label: "100 mA", value: "约 30 小时", len: 14, at: b.c100, vAt: b.h30 },
    { y: 42, label: "10 μA", value: "几十年（约 34 年）", len: 56, at: b.c10, vAt: b.yrs },
  ]
  return (
    <>
      <T x={50} y={10} size={3.4} color={MUTED} o={enter(t, b.life - 0.1, 0.5)}>
        一块 <M className="tabular">3000 mAh</M> 的电池
      </T>
      <Svg>
        {/* empty tracks while the battery is named, filled on each current */}
        {rows.map((r) => (
          <rect key={`k${r.y}`} x={30} y={r.y + 1.2} width={56} height={2.6} rx={0.6} fill="var(--muted-foreground)" fillOpacity={0.12} stroke="none" opacity={enter(t, b.life + 0.5, 0.5)} />
        ))}
        {rows.map((r) => (
          <rect key={r.y} x={30} y={r.y + 1.2} width={Math.max(0.01, r.len * easeInOut((t - r.at) / 0.9))} height={2.6} rx={0.6} fill={AMP} stroke="none" opacity={enter(t, r.at, 0.2)} />
        ))}
        {/* 30 h against 34 years is 10 000 : 1 — the long bar is broken, not to scale */}
        <path d="M57.2 42.4 l1.2 4.2 M59.2 42.4 l1.2 4.2" stroke="var(--background)" strokeWidth={0.7} opacity={enter(t, b.c10 + 0.5, 0.3)} />
      </Svg>
      {rows.map((r) => (
        <React.Fragment key={r.y}>
          <T x={8} y={r.y + 2.5} size={3.6} anchor="start" weight={600} color={AMP} o={Math.max(0.3 * enter(t, b.life + 0.5, 0.5), enter(t, r.at - 0.1, 0.4))}>
            <M className="tabular">{r.label}</M>
          </T>
          <T x={30} y={r.y - 2.5} size={3.4} anchor="start" weight={600} o={enter(t, r.vAt, 0.45)}>
            {r.value}
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
      <T x={30} y={36} size={2.8} color={VOLT} className={chip} o={enter(t, b.d1 - 0.1, 0.5)} dy={rise(b.d1, 1)}>
        拖电压：电阻烧不烧
      </T>
      <T x={70} y={36} size={2.8} color={AMP} className={chip} o={enter(t, b.d2 - 0.1, 0.5)} dy={rise(b.d2, 1)}>
        调电流：电池撑多久
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
  title: "功率与能量",
  audio,
  timing,
  poster: 6.4,
  Stage,
}

export default function PowerEnergyFilm() {
  return <FilmPlayer film={film} />
}

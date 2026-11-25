import * as React from "react"
import { trace } from "@/lab/colors"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, Frac, M, Scene, Sub, Svg, T, V, easeInOut, enter, glide, lerp, span, type FilmDef, type StageProps } from "../../kit"
import timing from "./timing.json"
import audio from "./audio.mp3"

const VOLT = trace.voltage
const AMP = trace.current
const MUTED = "var(--muted-foreground)"

/*
 * 欧姆定律, 60 s. Scenes, each keyed to the words that introduce it:
 *   title → a battery-and-resistor loop with live readouts (V ×2 → I ×2; R ×2 → I ÷2)
 *   → the formula assembles → it moves aside into three forms beside the V/I·R triangle
 *   → a worked example → the volts-over-kilohms trick → the I–V line → "try it below".
 */
function Stage({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.6) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)
  const lift = (at: number) => (still ? 0 : -easeInOut((t - at) / 0.45) * 2)

  const title = span(t, 0.25, b.loop - 0.45)
  const circuit = span(t, b.loop - 0.25, b.law - 0.45)
  const law = span(t, b.law - 0.2, b.example - 0.45)
  const example = span(t, b.example - 0.2, b.trick - 0.45)
  const trick = span(t, b.trick - 0.2, b.graph - 0.45)
  const outro = enter(t, b.outro - 0.1, 0.5)
  const graph = enter(t, b.graph - 0.2) * (1 - 0.86 * outro)

  return (
    <>
      <Scene o={title} dy={lift(b.loop - 0.45)}>
        <T x={50} y={22} size={8} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
          欧姆定律
        </T>
        <T x={50} y={36} size={4.8} o={enter(t, b.intro + 1.1)} dy={rise(b.intro + 1.1)}>
          <span className="inline-flex items-center gap-[0.28em]">
            <V c={AMP}>I</V>
            <M>=</M>
            <Frac top={<V c={VOLT}>V</V>} bottom={<V>R</V>} />
          </span>
        </T>
      </Scene>

      <Scene o={circuit}>
        <Circuit t={t} b={b} still={still} />
      </Scene>

      <Scene o={law}>
        <Law t={t} b={b} still={still} />
      </Scene>

      <Scene o={example}>
        <T x={50} y={12} size={2.6} color={MUTED} o={enter(t, b.example)}>
          举个例子
        </T>
        <T x={50} y={28} size={6.4}>
          <span className="inline-flex items-center gap-[0.3em]">
            <span style={{ opacity: enter(t, b.example + 0.3) }} className="inline-flex items-center gap-[0.3em]">
              <V c={AMP}>I</V>
              <M>=</M>
            </span>
            <Frac
              top={
                <M c={VOLT} className="tabular" >
                  <span style={{ opacity: enter(t, b.exV) }}>5 V</span>
                </M>
              }
              bottom={
                <M className="tabular">
                  <span style={{ opacity: enter(t, b.exR) }}>1 kΩ</span>
                </M>
              }
              bar={enter(t, b.exR - 0.2, 0.5)}
            />
            <span className="inline-flex items-center gap-[0.3em]" style={{ opacity: enter(t, b.exI - 0.1) }}>
              <M>=</M>
              <span className="inline-block" style={{ transform: `scale(${still ? 1 : lerp(1.18, 1, enter(t, b.exI, 0.5))})` }}>
                <M c={AMP} className="font-semibold">
                  5 mA
                </M>
              </span>
            </span>
          </span>
        </T>
        <T x={50} y={44} size={2.5} color={MUTED} o={enter(t, b.exI + 0.7)} dy={rise(b.exI + 0.7, 1)}>
          <M>5 V ÷ 1000 Ω = 0.005 A = 5 mA</M>
        </T>
      </Scene>

      <Scene o={trick}>
        <T x={50} y={11} size={2.6} o={enter(t, b.trick)} className="rounded-full border border-input px-[0.9em] py-[0.45em] text-muted-foreground">
          口算窍门
        </T>
        <T x={50} y={25} size={7}>
          <span className="inline-flex items-center gap-[0.32em]">
            <Piece o={enter(t, b.tV)} word="伏特">
              <M c={VOLT}>V</M>
            </Piece>
            <Piece o={enter(t, b.tV + 0.25)}>
              <M>÷</M>
            </Piece>
            <Piece o={enter(t, b.tK)} word="千欧">
              <M>kΩ</M>
            </Piece>
            <Piece o={enter(t, b.tmA - 0.15)}>
              <M>=</M>
            </Piece>
            <Piece o={enter(t, b.tmA)} word="毫安">
              <M c={AMP} className="font-semibold">
                mA
              </M>
            </Piece>
          </span>
        </T>
        <T x={50} y={42} size={3} color={MUTED} o={enter(t, b.tmA + 0.6)} dy={rise(b.tmA + 0.6, 1)}>
          <M className="tabular">5 V ÷ 1 kΩ = 5 mA</M>
        </T>
        <T x={50} y={48} size={3} color={MUTED} o={enter(t, b.tmA + 1.0)} dy={rise(b.tmA + 1.0, 1)}>
          <M className="tabular">3.3 V ÷ 10 kΩ = 0.33 mA</M>
        </T>
      </Scene>

      <Scene o={graph}>
        <Graph t={t} b={b} />
      </Scene>

      <Scene o={outro}>
        <T x={50} y={24} size={6} weight={600} dy={rise(b.outro)}>
          动手试试
        </T>
        <T x={50} y={32.5} size={2.8} color={MUTED} o={enter(t, b.drag)} dy={rise(b.drag, 1)}>
          拖动下面实验台的滑块
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

/** A formula piece with an optional word under it. */
function Piece({ o, word, children }: { o: number; word?: string; children: React.ReactNode }) {
  return (
    <span className="relative" style={{ opacity: o }}>
      {children}
      {word && <Sub>{word}</Sub>}
    </span>
  )
}

// ── the loop ─────────────────────────────────────────────────────────────────

const LEFT = 16
const RIGHT = 46
const TOP = 11
const BOTTOM = 45
const MID = 28
const PERIMETER = 2 * (RIGHT - LEFT) + 2 * (BOTTOM - TOP)

/** A point on the loop, `d` units clockwise from the top-left corner. */
function onLoop(d: number): [number, number] {
  const w = RIGHT - LEFT
  const h = BOTTOM - TOP
  const s = ((d % PERIMETER) + PERIMETER) % PERIMETER
  if (s < w) return [LEFT + s, TOP]
  if (s < w + h) return [RIGHT, TOP + (s - w)]
  if (s < 2 * w + h) return [RIGHT - (s - w - h), BOTTOM]
  return [LEFT, BOTTOM - (s - 2 * w - h)]
}

/** A vertical zigzag from y0 to y1 with a fixed tooth pitch, so a longer resistor grows new teeth. */
function zigzag(x: number, y0: number, y1: number, amp = 1.6, pitch = 1) {
  const pts: string[] = [`M${x} ${y0 - 2.5}`, `V${y0}`]
  const len = y1 - y0
  const n = Math.floor(len / pitch)
  for (let i = 0; i < n; i++) pts.push(`L${x + (i % 2 ? -amp : amp)} ${y0 + pitch * (i + 0.5)}`)
  const rest = len - n * pitch
  if (rest > 0.01) pts.push(`L${x + (n % 2 ? -amp : amp) * Math.min(1, rest / (pitch / 2))} ${y0 + n * pitch + Math.min(rest, pitch / 2)}`)
  pts.push(`L${x} ${y1}`, `V${y1 + 2.5}`)
  return pts.join(" ")
}

function Circuit({ t, b, still }: StageProps) {
  const cells = enter(t, b.v2, 0.5)
  const rLen = glide(t, b.r2, 12, 24, 0.7)
  const y0 = MID - rLen / 2
  const y1 = MID + rLen / 2
  const topPlate = lerp(26.8, 24.4, cells)
  const bottomPlate = lerp(29.2, 31.6, cells)

  const volts = glide(t, b.v2, 5, 10, 0.6)
  const kohm = glide(t, b.r2, 1, 2, 0.6)
  const mA = (at: number) => (at < b.ihalf ? glide(at, b.i2, 5, 10, 0.6) : glide(at, b.ihalf, 10, 5, 0.6))
  const amps = mA(t)

  // dots move at a speed proportional to the current: integrate it from the moment it starts flowing
  let phase = 0
  if (!still && t > b.flow) {
    const dt = 1 / 60
    for (let s = b.flow; s < t; s += dt) phase += mA(s) * 0.55 * Math.min(dt, t - s)
  }
  const dots = enter(t, b.flow, 0.4)
  const wires = enter(t, b.bat + 0.2, 0.8)

  const r = enter(t, b.res, 0.5)
  const bat = enter(t, b.bat, 0.45)

  return (
    <>
      <Svg>
        <Draw d={`M${LEFT} ${topPlate} V${TOP} H${RIGHT} V${y0 - 2.5}`} p={wires} />
        <Draw d={`M${RIGHT} ${y1 + 2.5} V${BOTTOM} H${LEFT} V${bottomPlate}`} p={wires} />
        <Draw d={zigzag(RIGHT, y0, y1)} p={r} />
        <g opacity={bat}>
          <g opacity={1 - cells}>
            <path d={`M${LEFT - 3.4} 26.8 H${LEFT + 3.4}`} />
            <path d={`M${LEFT - 1.6} 29.2 H${LEFT + 1.6}`} strokeWidth={0.75} />
          </g>
          <g opacity={cells}>
            <path d={`M${LEFT - 3.4} 24.4 H${LEFT + 3.4} M${LEFT - 3.4} 29.2 H${LEFT + 3.4} M${LEFT} 26.8 V29.2`} />
            <path d={`M${LEFT - 1.6} 26.8 H${LEFT + 1.6} M${LEFT - 1.6} 31.6 H${LEFT + 1.6}`} strokeWidth={0.75} />
          </g>
          <path d={`M${LEFT + 3.4} ${topPlate - 1.5} h1.6 M${LEFT + 4.2} ${topPlate - 2.3} v1.6`} strokeWidth={0.22} stroke={VOLT} />
        </g>
        {dots > 0 &&
          Array.from({ length: Math.floor(PERIMETER / 4) }, (_, i) => {
            const [x, y] = onLoop(i * 4 + phase)
            // the dots run on the wires only: they pass behind the battery and the resistor
            const hidden = (x === LEFT && y > topPlate - 1.2 && y < bottomPlate + 1.2) || (x === RIGHT && y > y0 - 1.2 && y < y1 + 1.2)
            return hidden ? null : <circle key={i} cx={x} cy={y} r={0.55} fill={AMP} stroke="none" opacity={dots} />
          })}
        <g opacity={enter(t, b.flow, 0.4)} stroke={AMP} strokeWidth={0.3}>
          <path d={`M${(LEFT + RIGHT) / 2 - 0.9} ${TOP - 1.2} L${(LEFT + RIGHT) / 2 + 0.5} ${TOP} L${(LEFT + RIGHT) / 2 - 0.9} ${TOP + 1.2}`} />
        </g>
        {/* the readout table's hairlines */}
        <g stroke="var(--border)" strokeWidth={0.12}>
          <path d="M62 23 H90" opacity={enter(t, b.bat)} />
          <path d="M62 33 H90" opacity={enter(t, b.flow)} />
        </g>
      </Svg>

      <T x={LEFT - 6} y={MID} size={4} anchor="end" font="var" color={VOLT} o={bat}>
        V
      </T>
      <T x={RIGHT + 4} y={MID} size={4} anchor="start" font="var" o={r}>
        R
      </T>
      <T x={(LEFT + RIGHT) / 2} y={TOP - 3.8} size={3.4} font="var" color={AMP} o={dots}>
        I
      </T>

      <Row y={18} label="电压" letter="V" color={VOLT} o={bat} value={`${Math.round(volts)} V`} badge={{ text: "×2", o: span(t, b.v2, b.r2 - 0.3) }} />
      <Row y={28} label="电阻" letter="R" o={r} value={`${kohm % 1 > 0.02 && kohm % 1 < 0.98 ? kohm.toFixed(1) : Math.round(kohm)} kΩ`} badge={{ text: "×2", o: enter(t, b.r2) }} />
      <Row
        y={38}
        label="电流"
        letter="I"
        color={AMP}
        o={dots}
        value={`${Math.round(amps)} mA`}
        badge={t < b.ihalf - 0.05 ? { text: "×2", o: span(t, b.i2, b.r2 - 0.3) } : { text: "÷2", o: enter(t, b.ihalf) }}
      />
    </>
  )
}

function Row({ y, label, letter, color, o, value, badge }: { y: number; label: string; letter: string; color?: string; o: number; value: string; badge: { text: string; o: number } }) {
  return (
    <>
      <T x={62} y={y} size={2.5} anchor="start" color={MUTED} o={o}>
        {label} <V c={color}>{letter}</V>
      </T>
      <T x={90} y={y} size={4.6} anchor="end" weight={600} color={color} o={o} className="tabular">
        {value}
      </T>
      <T x={91.5} y={y} size={2.5} anchor="start" weight={600} color={color ?? "var(--foreground)"} o={badge.o * o}>
        <M>{badge.text}</M>
      </T>
    </>
  )
}

// ── the formula and its three forms ─────────────────────────────────────────

function Law({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.6) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)
  const move = still ? (t > b.forms ? 1 : 0) : easeInOut((t - b.forms) / 0.8)
  const cx = lerp(50, 70, move)
  const cy = lerp(27, 13.5, move)
  const scale = lerp(1, 0.58, move)
  const words = 1 - move

  // "know any two, find the third": each form in turn, its unknown hidden in the triangle
  const k0 = b.know
  const k1 = b.third + 0.9
  const d = (k1 - k0) / 3
  const focus = [0, 1, 2].map((i) => span(t, k0 + i * d, k0 + (i + 1) * d - 0.15, 0.25, 0.25))
  const cycling = span(t, k0, k1 - 0.15, 0.25, 0.3)
  const rowO = (i: number) => 1 - 0.65 * cycling * (1 - focus[i])

  const tri = enter(t, b.forms + 0.3, 0.9)
  const letters = enter(t, b.forms + 0.9)

  return (
    <>
      {/* the name fills the stage while the year is spoken, then steps up to make room for the formula */}
      <T
        x={50}
        y={glide(t, b.write - 0.3, 25, 9.5, 0.6)}
        size={glide(t, b.write - 0.3, 5.2, 2.6, 0.6)}
        weight={600}
        color={t < b.write ? undefined : MUTED}
        o={span(t, b.law - 0.1, b.forms)}
        dy={rise(b.law - 0.1)}
      >
        1827 年 · 欧姆
      </T>
      <T x={50} y={33} size={2.6} color={MUTED} o={span(t, b.law + 0.4, b.write - 0.3, 0.4, 0.3)}>
        Georg Simon Ohm
      </T>

      <div
        className="absolute leading-none"
        style={{ left: `${cx}cqw`, top: `${cy}cqw`, fontSize: "7.2cqw", transform: `translate(-50%, -50%) scale(${scale})`, opacity: rowO(0) }}
      >
        <span className="inline-flex items-center gap-[0.28em]">
          <span className="relative" style={{ opacity: enter(t, b.lawI) }}>
            <V c={AMP}>I</V>
            {words > 0.01 && <span style={{ opacity: words }}><Sub>电流</Sub></span>}
          </span>
          <span style={{ opacity: enter(t, b.lawI + 0.2) }}>
            <M>=</M>
          </span>
          <Frac
            top={
              <span className="relative" style={{ opacity: enter(t, b.lawV) }}>
                <V c={VOLT}>V</V>
                {words > 0.01 && <span style={{ opacity: words }}><Sub side="right">电压</Sub></span>}
              </span>
            }
            bottom={
              <span className="relative" style={{ opacity: enter(t, b.lawR) }}>
                <V>R</V>
                {words > 0.01 && <span style={{ opacity: words }}><Sub side="right">电阻</Sub></span>}
              </span>
            }
            bar={enter(t, b.lawR - 0.25, 0.4)}
          />
        </span>
      </div>

      <T x={70} y={28} size={4.2} o={enter(t, b.three + 0.35) * rowO(1)} dy={0}>
        <span className="inline-flex items-center gap-[0.28em]">
          <V c={VOLT}>V</V>
          <M>=</M>
          <V c={AMP}>I</V>
          <M>×</M>
          <V>R</V>
        </span>
      </T>
      <T x={70} y={42.5} size={4.2} o={enter(t, b.three + 0.7) * rowO(2)}>
        <span className="inline-flex items-center gap-[0.28em]">
          <V>R</V>
          <M>=</M>
          <Frac top={<V c={VOLT}>V</V>} bottom={<V c={AMP}>I</V>} />
        </span>
      </T>

      <Svg>
        <Draw d="M27 11 L12 44 H42 Z" p={tri} />
        <Draw d="M18.8 29 H35.2 M27 29 V44" p={tri} strokeWidth={0.22} />
      </Svg>
      {(
        [
          ["I", 21.2, 37, AMP],
          ["V", 27, 22, VOLT],
          ["R", 32.8, 37, undefined],
        ] as const
      ).map(([letter, x, y, c], i) => (
        <React.Fragment key={letter}>
          <T x={x} y={y} size={4.6} font="var" color={c} o={letters * (1 - focus[i])}>
            {letter}
          </T>
          <T x={x} y={y} size={4.6} color={MUTED} o={letters * focus[i]}>
            ?
          </T>
        </React.Fragment>
      ))}
    </>
  )
}

// ── the I–V line ────────────────────────────────────────────────────────────

const OX = 24
const OY = 47
const XS = 52 / 10 // stage units per volt
const YS = 35 / 20 // stage units per mA

function Graph({ t, b }: Pick<StageProps, "t" | "b">) {
  const axes = enter(t, b.axes, 0.6)
  const lines: { ohm: number; label: string; color: string; at: number }[] = [
    { ohm: 1000, label: "1 kΩ", color: AMP, at: b.line - 0.1 },
    { ohm: 500, label: "500 Ω", color: trace.second, at: b.steep },
    { ohm: 2000, label: "2 kΩ", color: trace.third, at: b.steep + 0.55 },
  ]
  const end = (ohm: number): [number, number] => [OX + 10 * XS, OY - ((10 / ohm) * 1000) * YS]
  return (
    <>
      <Svg>
        <Draw d={`M${OX} ${OY} H80`} p={axes} />
        <Draw d={`M${OX} ${OY} V9`} p={axes} />
        <g opacity={enter(t, b.axes + 0.4)}>
          <path d="M78.6 45.9 L80 47 L78.6 48.1 M22.9 10.4 L24 9 L25.1 10.4" />
          <path d={`M${OX + 5 * XS} ${OY} v0.9 M${OX + 10 * XS} ${OY} v0.9 M${OX} ${OY - 10 * YS} h-0.9 M${OX} ${OY - 20 * YS} h-0.9`} strokeWidth={0.2} />
        </g>
        {lines.map((l) => {
          const p = easeInOut((t - l.at) / 0.9)
          const [x, y] = end(l.ohm)
          return (
            <g key={l.ohm} stroke={l.color}>
              <Draw d={`M${OX} ${OY} L${x} ${y}`} p={p} strokeWidth={0.42} />
              {p > 0.01 && <circle cx={lerp(OX, x, p)} cy={lerp(OY, y, p)} r={0.7} fill={l.color} stroke="none" />}
            </g>
          )
        })}
      </Svg>
      <T x={81.5} y={OY} size={2.4} anchor="start" color={MUTED} o={enter(t, b.axes + 0.4)}>
        电压 <V c={VOLT}>V</V>
      </T>
      <T x={OX} y={6.2} size={2.4} color={MUTED} o={enter(t, b.axes + 0.4)}>
        电流 <V c={AMP}>I</V>
      </T>
      {(
        [
          [OX + 5 * XS, "5 V"],
          [OX + 10 * XS, "10 V"],
        ] as const
      ).map(([x, s]) => (
        <T key={s} x={x} y={OY + 2.8} size={2} color={MUTED} o={enter(t, b.axes + 0.5)} className="tabular">
          {s}
        </T>
      ))}
      {(
        [
          [OY - 10 * YS, "10 mA"],
          [OY - 20 * YS, "20 mA"],
        ] as const
      ).map(([y, s]) => (
        <T key={s} x={OX - 1.8} y={y} size={2} anchor="end" color={MUTED} o={enter(t, b.axes + 0.5)} className="tabular">
          {s}
        </T>
      ))}
      {lines.map((l) => {
        const [x, y] = end(l.ohm)
        return (
          <T key={l.ohm} x={x + 1.6} y={y} size={2.4} anchor="start" weight={600} color={l.color} o={enter(t, l.at + 0.7)}>
            <M>{l.label}</M>
          </T>
        )
      })}
    </>
  )
}

export const film: FilmDef = {
  title: "欧姆定律",
  audio,
  timing,
  poster: 3.4,
  Stage,
}

export default function OhmsLawFilm() {
  return <FilmPlayer film={film} />
}

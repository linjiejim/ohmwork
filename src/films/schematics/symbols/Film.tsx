import * as React from "react"
import { Capacitor, Chip, Diode, Ground, Led, Mosfet, Bjt, Rail, Resistor } from "@/lab/schematic"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, Scene, Svg, Sym, T, enter, span, type FilmDef, type StageProps } from "../../kit"
import { FG, MUTED, POWER, SECOND, VOLT, riseAt } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

/*
 * 原理图符号, ~60 s. Scenes, each keyed to its line:
 *   title → real resistors turn into one symbol → R1 / 10k tags → designator letters
 *   → 4k7 → polarity (diode bar, capacitor +) → zigzag vs rectangle
 *   → same-named supply and ground join → 3V3 vs 3.3V do not → "try the quiz".
 */
function Stage({ t, b, still }: StageProps) {
  const title = span(t, 0.25, b.shape - 0.45)
  const shape = span(t, b.shape - 0.25, b.tag - 0.45)
  const tag = span(t, b.tag - 0.25, b.letters - 0.45)
  const letters = span(t, b.letters - 0.25, b.value - 0.45)
  const value = span(t, b.value - 0.25, b.polar - 0.45)
  const polar = span(t, b.polar - 0.25, b.std - 0.45)
  const std = span(t, b.std - 0.25, b.same - 0.45)
  const same = span(t, b.same - 0.25, b.diff - 0.45)
  const diff = span(t, b.diff - 0.25, b.outro - 0.3)
  const outro = enter(t, b.outro + 0.1, 0.5)
  const rise = (at: number, d = 1.6) => riseAt(t, at, still, d)

  return (
    <>
      <Scene o={title}>
        <T x={50} y={19} size={8} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
          原理图符号
        </T>
        <T x={50} y={28.5} size={2.8} color={MUTED} o={enter(t, b.intro + 1.0)}>
          认全图上的记号
        </T>
        <Svg>
          <g opacity={enter(t, b.intro + 1.2)}>
            <Sym x={20} y={38} scale={0.2}>
              <Resistor x={0} y={0} />
            </Sym>
            <Sym x={35} y={38} scale={0.2}>
              <Capacitor x={0} y={0} />
            </Sym>
            <Sym x={50} y={38} scale={0.2}>
              <Diode x={0} y={0} />
            </Sym>
            <Sym x={65} y={38} scale={0.2}>
              <Bjt x={0} y={0} />
            </Sym>
            <Sym x={80} y={38} scale={0.2}>
              <Mosfet x={0} y={0} />
            </Sym>
          </g>
        </Svg>
      </Scene>

      <Scene o={shape}>
        <Shape t={t} b={b} still={still} />
      </Scene>

      <Scene o={tag}>
        <Svg>
          <Sym x={50} y={30} scale={0.55} opacity={enter(t, b.tag - 0.1)}>
            <Resistor x={0} y={0} />
          </Sym>
        </Svg>
        <T x={50} y={19} size={5.2} weight={600} o={enter(t, b.ref)} dy={rise(b.ref, 1)}>
          R1
        </T>
        <T x={50} y={13} size={2.5} color={MUTED} o={enter(t, b.ref + 0.1)}>
          位号：是哪一只
        </T>
        <T x={50} y={41} size={5.2} weight={600} color={VOLT} o={enter(t, b.val)} dy={rise(b.val, 1)} className="tabular">
          10k
        </T>
        <T x={50} y={47.5} size={2.5} color={MUTED} o={enter(t, b.val + 0.1)}>
          数值：有多大
        </T>
      </Scene>

      <Scene o={letters}>
        <Letters t={t} b={b} still={still} />
      </Scene>

      <Scene o={value}>
        <Value t={t} b={b} still={still} />
      </Scene>

      <Scene o={polar}>
        <Polar t={t} b={b} still={still} />
      </Scene>

      <Scene o={std}>
        <Svg>
          <Sym x={27} y={28} scale={0.45} opacity={enter(t, b.std)}>
            <Resistor x={0} y={0} />
          </Sym>
          <Sym x={73} y={28} scale={0.45} opacity={enter(t, b.iec)}>
            <Resistor x={0} y={0} variant="iec" />
          </Sym>
        </Svg>
        <T x={27} y={39} size={4} weight={600} o={enter(t, b.zig)} dy={rise(b.zig, 1)}>
          折线
        </T>
        <T x={27} y={45} size={2.5} color={MUTED} o={enter(t, b.zig + 0.1)}>
          美标 ANSI
        </T>
        <T x={73} y={39} size={4} weight={600} o={enter(t, b.iec)} dy={rise(b.iec, 1)}>
          空心矩形
        </T>
        <T x={73} y={45} size={2.5} color={MUTED} o={enter(t, b.iec + 0.1)}>
          国标 IEC
        </T>
        <T x={50} y={28} size={5} color={MUTED} o={enter(t, b.iec + 0.5)} font="math">
          =
        </T>
        <T x={50} y={12} size={2.6} color={MUTED} o={enter(t, b.std + 0.2)}>
          同一只电阻的两种画法
        </T>
      </Scene>

      <Scene o={same}>
        <Same t={t} b={b} still={still} />
      </Scene>

      <Scene o={diff}>
        <Diff t={t} b={b} still={still} />
      </Scene>

      <Scene o={outro}>
        <T x={50} y={17} size={6} weight={600} dy={rise(b.outro)}>
          符号测验
        </T>
        <T x={50} y={25} size={2.8} color={MUTED} o={enter(t, b.quiz)} dy={rise(b.quiz, 1)}>
          看你能认对几个
        </T>
        <Svg>
          <g opacity={enter(t, b.outro + 0.4)}>
            <Sym x={16} y={35} scale={0.16}>
              <Resistor x={0} y={0} />
            </Sym>
            <Sym x={32} y={35} scale={0.16}>
              <Capacitor x={0} y={0} polarized />
            </Sym>
            <Sym x={48} y={35} scale={0.16}>
              <Diode x={0} y={0} variant="zener" />
            </Sym>
            <Sym x={64} y={35} scale={0.16}>
              <Led x={0} y={0} />
            </Sym>
            <Sym x={80} y={35} scale={0.16}>
              <Bjt x={0} y={0} />
            </Sym>
          </g>
          <g opacity={enter(t, b.quiz + 0.3)} transform={`translate(0 ${still ? 0 : Math.sin(t * 3.2) * 0.6})`} strokeWidth={0.45}>
            <path d="M50 42 V49 M47.6 46.6 L50 49 L52.4 46.6" />
          </g>
        </Svg>
      </Scene>
    </>
  )
}

// ── a real resistor and its symbol ───────────────────────────────────────────

function Shape({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.2) => riseAt(t, at, still, d)
  const smd = enter(t, b.smd)
  const tht = enter(t, b.tht)
  const sym = enter(t, b.sym, 0.5)
  const arrows = enter(t, b.sym - 0.3, 0.6)
  const sx = 28
  return (
    <>
      <Svg>
        {/* surface-mount resistor: a ceramic chip with metal ends */}
        <g opacity={smd}>
          <rect x={sx - 3.6} y={14.2} width={7.2} height={3.6} rx={0.4} fill="var(--muted)" stroke={FG} />
          <rect x={sx - 3.6} y={14.2} width={1.4} height={3.6} fill={MUTED} stroke="none" />
          <rect x={sx + 2.2} y={14.2} width={1.4} height={3.6} fill={MUTED} stroke="none" />
        </g>
        {/* through-hole resistor: a body, colour bands, long leads */}
        <g opacity={tht}>
          <path d={`M${sx - 12} 36 H${sx + 12}`} />
          <rect x={sx - 5.5} y={34} width={11} height={4} rx={1.8} fill="var(--muted)" stroke={FG} />
          {[-2.8, -0.9, 1, 3.4].map((dx, i) => (
            <path key={dx} d={`M${sx + dx} 34.2 V37.8`} strokeWidth={0.55} stroke={i === 3 ? MUTED : FG} />
          ))}
        </g>
        <Draw d="M40 16 C50 16 54 24 62 27" p={arrows} stroke={MUTED} strokeWidth={0.25} />
        <Draw d="M40 36 C50 36 54 32 62 29.5" p={arrows} stroke={MUTED} strokeWidth={0.25} />
        <Sym x={78} y={28} scale={0.5} opacity={sym}>
          <Resistor x={0} y={0} />
        </Sym>
      </Svg>
      <T x={sx} y={21.6} size={3} weight={500} o={smd} dy={rise(b.smd)}>
        贴片电阻
      </T>
      <T x={sx} y={43} size={3} weight={500} o={tht} dy={rise(b.tht)}>
        插件电阻
      </T>
      <T x={78} y={38} size={3.4} weight={600} o={sym} dy={rise(b.sym)}>
        同一个符号
      </T>
      <T x={78} y={44} size={2.4} color={MUTED} o={enter(t, b.sym + 0.4)}>
        只画功能，不画外形
      </T>
    </>
  )
}

// ── designator letters ───────────────────────────────────────────────────────

function Letters({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.2) => riseAt(t, at, still, d)
  const dim = (at: number) => Math.max(0.3 * enter(t, b.letters + 0.2), enter(t, at - 0.1))
  const cells = [
    { x: 14, at: b.lR, letter: "R", name: "电阻" },
    { x: 38, at: b.lC, letter: "C", name: "电容" },
    { x: 62, at: b.lD, letter: "D", name: "二极管" },
    { x: 86, at: b.lU, letter: "U", name: "芯片" },
  ]
  return (
    <>
      <T x={50} y={11} size={2.6} color={MUTED} o={enter(t, b.letters + 0.1)}>
        位号的字母，说明器件种类
      </T>
      <Svg>
        <Sym x={cells[0].x} y={26} scale={0.28} opacity={dim(cells[0].at)}>
          <Resistor x={0} y={0} />
        </Sym>
        <Sym x={cells[1].x} y={26} scale={0.28} opacity={dim(cells[1].at)}>
          <Capacitor x={0} y={0} />
        </Sym>
        <Sym x={cells[2].x} y={26} scale={0.28} opacity={dim(cells[2].at)}>
          <Diode x={0} y={0} />
        </Sym>
        <Sym x={cells[3].x} y={26} scale={0.2} opacity={dim(cells[3].at)}>
          <Chip x={0} y={0} w={40} h={44} left={["1", "2", "3"]} right={["6", "5", "4"]} pitch={14} />
        </Sym>
      </Svg>
      {cells.map((c) => (
        <React.Fragment key={c.letter}>
          <T x={c.x} y={38} size={5.4} weight={600} color={VOLT} o={enter(t, c.at)} dy={rise(c.at)}>
            {c.letter}
            <span style={{ color: MUTED, fontWeight: 400 }}>1</span>
          </T>
          <T x={c.x} y={45} size={2.8} color={MUTED} o={enter(t, c.at + 0.1)}>
            {c.name}
          </T>
        </React.Fragment>
      ))}
    </>
  )
}

// ── 4k7 ──────────────────────────────────────────────────────────────────────

function Value({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.2) => riseAt(t, at, still, d)
  const dotHit = enter(t, b.dot, 0.3)
  const k = enter(t, b.k47, 0.4)
  return (
    <>
      <T x={50} y={11} size={2.6} color={MUTED} o={enter(t, b.value + 0.1)}>
        数值的写法
      </T>
      <T x={50} y={21} size={7} font="math" o={enter(t, b.value + 0.2)} className="tabular">
        4<span style={{ color: dotHit > 0.5 ? VOLT : undefined }}>.</span>7 kΩ
      </T>
      <Svg>
        <g opacity={enter(t, b.k47 - 0.15)} strokeWidth={0.4} stroke={MUTED}>
          <path d="M50 27.5 V31 M48.2 29.5 L50 31.4 L51.8 29.5" />
        </g>
      </Svg>
      <T x={50} y={39} size={12} weight={600} font="math" o={k} dy={rise(b.k47, 1.6)} className="tabular">
        4<span style={{ color: VOLT }}>k</span>7
      </T>
      <T x={50} y={48} size={2.6} color={MUTED} o={enter(t, b.k47 + 0.8)} dy={rise(b.k47 + 0.8, 1)}>
        字母站在小数点的位置：印糊了也不会看错
      </T>
    </>
  )
}

// ── polarity ─────────────────────────────────────────────────────────────────

function Polar({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.2) => riseAt(t, at, still, d)
  const dx = 26
  const cx = 74
  const y = 28
  const s = 0.42
  const bar = enter(t, b.bar, 0.4)
  const plus = enter(t, b.plus, 0.4)
  return (
    <>
      <Svg>
        <Sym x={dx} y={y} scale={s} opacity={enter(t, b.polar + 0.1)}>
          <Diode x={0} y={0} />
        </Sym>
        <path d={`M${dx + 8 * s} ${y - 8 * s} V${y + 8 * s}`} stroke={SECOND} strokeWidth={0.9} opacity={bar} />
        <Sym x={cx} y={y} scale={s} opacity={enter(t, b.polar + 0.3)}>
          <Capacitor x={0} y={0} polarized />
        </Sym>
        <circle cx={cx - 12 * s} cy={y - 9 * s} r={2.3 * plus + 0.01} stroke={VOLT} strokeWidth={0.34} opacity={plus} />
      </Svg>
      <T x={dx} y={14} size={3.4} weight={600} o={enter(t, b.diode)} dy={rise(b.diode)}>
        二极管
      </T>
      <T x={dx + 4} y={40} size={2.8} color={SECOND} weight={600} o={bar} dy={rise(b.bar, 1)}>
        竖线一端是负极
      </T>
      <T x={cx} y={14} size={3.4} weight={600} o={enter(t, b.cap)} dy={rise(b.cap)}>
        电解电容
      </T>
      <T x={cx - 2} y={40} size={2.8} color={VOLT} weight={600} o={plus} dy={rise(b.plus, 1)}>
        加号一端是正极
      </T>
    </>
  )
}

// ── same name, same net ──────────────────────────────────────────────────────

function Same({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.2) => riseAt(t, at, still, d)
  const join = enter(t, b.join - 0.1, 0.8)
  const names = enter(t, b.sameName, 0.5)
  const s = 0.34
  return (
    <>
      <Svg>
        <g opacity={names}>
          <Sym x={16} y={24} scale={s}>
            <Rail x={0} y={0} />
          </Sym>
          <Sym x={84} y={24} scale={s}>
            <Rail x={0} y={0} />
          </Sym>
          <Sym x={16} y={40} scale={s}>
            <Ground x={0} y={0} />
          </Sym>
          <Sym x={84} y={40} scale={s}>
            <Ground x={0} y={0} />
          </Sym>
        </g>
        <path d={`M22 ${24 - 10 * s} H78`} stroke={VOLT} strokeDasharray="1.2 1" strokeWidth={0.3} opacity={join} />
        <path d="M22 40 H78" stroke={MUTED} strokeDasharray="1.2 1" strokeWidth={0.3} opacity={join} />
      </Svg>
      <T x={16} y={17} size={3.2} weight={600} color={VOLT} o={names}>
        3V3
      </T>
      <T x={84} y={17} size={3.2} weight={600} color={VOLT} o={enter(t, b.sameName + 0.25)}>
        3V3
      </T>
      <T x={16} y={49} size={3} weight={600} o={names}>
        GND
      </T>
      <T x={84} y={49} size={3} weight={600} o={enter(t, b.sameName + 0.25)}>
        GND
      </T>
      <T x={50} y={32} size={3.4} weight={600} o={enter(t, b.join)} dy={rise(b.join)}>
        名字相同，就是同一个网络
      </T>
    </>
  )
}

// ── 3V3 is not 3.3V ──────────────────────────────────────────────────────────

function Diff({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.2) => riseAt(t, at, still, d)
  const a = enter(t, b.a, 0.45)
  const c = enter(t, b.b, 0.45)
  // the cross lands on "差一个字", a second before "两个网络" closes the line
  const two = enter(t, b.b + 1.1, 0.5)
  const nets = enter(t, b.two - 0.2, 0.5)
  const s = 0.4
  return (
    <>
      <T x={50} y={11} size={2.6} color={MUTED} o={enter(t, b.diff + 0.1)}>
        读图时留心
      </T>
      <Svg>
        <Sym x={26} y={26} scale={s} opacity={a}>
          <Rail x={0} y={0} />
        </Sym>
        <Sym x={74} y={26} scale={s} opacity={c}>
          <Rail x={0} y={0} />
        </Sym>
        <Draw d="M26 26 V36" p={two} stroke={MUTED} />
        <Draw d="M74 26 V36" p={two} stroke={MUTED} />
        <path d="M33 31 H67" stroke={POWER} strokeWidth={0.3} strokeDasharray="1.2 1" opacity={two} />
        <circle cx={50} cy={31} r={2.2} fill="var(--background)" stroke={POWER} strokeWidth={0.3} opacity={two} />
        <path d="M48.8 29.8 L51.2 32.2 M51.2 29.8 L48.8 32.2" stroke={POWER} strokeWidth={0.4} opacity={two} />
      </Svg>
      <T x={26} y={16} size={4.2} weight={600} color={VOLT} o={a} dy={rise(b.a)}>
        3V3
      </T>
      <T x={74} y={16} size={4.2} weight={600} color={VOLT} o={c} dy={rise(b.b)}>
        3.3V
      </T>
      <T x={26} y={42} size={2.6} color={MUTED} o={nets}>
        网络 1
      </T>
      <T x={74} y={42} size={2.6} color={MUTED} o={nets}>
        网络 2
      </T>
      <T x={50} y={48} size={3.2} weight={600} color={POWER} o={two} dy={rise(b.b + 1.1, 1)}>
        差一个字，不会连上
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "原理图符号",
  audio,
  timing,
  poster: 3.6,
  Stage,
}

export default function SymbolsFilm() {
  return <FilmPlayer film={film} />
}

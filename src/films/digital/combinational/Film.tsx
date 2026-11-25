import * as React from "react"
import { glow, trace } from "@/lab/colors"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, M, Scene, Svg, T, enter, lerp, span, type FilmDef, type StageProps } from "../../kit"
import { CUR, DownArrow, FG, GateAt, HI, LINE, MUTED, gateFn, makeLift, makeRise } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

/*
 * 二进制与组合逻辑, ~65 s. Scenes, each keyed to the words that introduce it:
 *   title (bits, then gates) → place values 8·4·2·1 and 8 + 2 + 1 = 11 → two nibbles become 3 and C
 *   → half adder: inputs step through, XOR gives the sum, AND the carry → 1111 + 0001 ripples its carry to a fifth digit that is lost
 *   → 3-to-8 decoder lights one line → seven-segment digit follows a 4-bit input → input in, output out, no memory → "try it below".
 */

function Stage({ t, b, still }: StageProps) {
  const rise = makeRise(t, still)
  const lift = makeLift(t, still)
  const sc = (a: number, z: number) => span(t, a - 0.3, z - 0.15, 0.3, 0.3)

  return (
    <>
      <Scene o={span(t, 0.25, b.weight - 0.15, 0.4, 0.3)} dy={lift(b.weight - 0.45)}>
        <T x={50} y={16} size={7} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
          二进制与组合逻辑
        </T>
        {[1, 0, 1, 1, 0, 0, 1, 0].map((v, i) => (
          <T key={i} x={50 + 7 * (i - 3.5)} y={29} size={4} weight={600} color={v ? HI : MUTED} o={enter(t, b.bits + i * 0.1 - 0.4, 0.4)} dy={rise(b.bits + i * 0.1 - 0.4, 1)} className="tabular">
            {v}
          </T>
        ))}
        <Svg>
          {[0, 1, 2].map((i) => (
            <GateAt key={i} x={36 + 14 * i} y={40} scale={0.24} type={(["and", "xor", "or"] as const)[i]} o={enter(t, b.gates + i * 0.25, 0.5)} />
          ))}
        </Svg>
      </Scene>

      <Scene o={sc(b.weight, b.hexL)}>
        <Weights t={t} b={b} still={still} rise={rise} />
      </Scene>
      <Scene o={sc(b.hexL, b.halfL)}>
        <Hex t={t} b={b} />
      </Scene>
      <Scene o={sc(b.halfL, b.carryL)}>
        <Half t={t} b={b} />
      </Scene>
      <Scene o={sc(b.carryL, b.decL)}>
        <Ripple t={t} b={b} />
      </Scene>
      <Scene o={sc(b.decL, b.segL)}>
        <Decoder t={t} b={b} />
      </Scene>
      <Scene o={sc(b.segL, b.combL)}>
        <Seg t={t} b={b} />
      </Scene>
      <Scene o={sc(b.combL, b.outro)}>
        <Comb t={t} b={b} />
      </Scene>

      <Scene o={enter(t, b.outro - 0.3, 0.4)}>
        <T x={50} y={22} size={6} weight={600} dy={rise(b.outro)}>
          动手试试
        </T>
        <T x={50} y={31} size={2.8} color={MUTED} o={enter(t, b.drag, 0.5)} dy={rise(b.drag, 1)}>
          拨动加数的每一位
        </T>
        <Svg>
          <DownArrow t={t} at={b.drag + 0.3} still={still} y={37} />
        </Svg>
      </Scene>
    </>
  )
}

// ── place values ────────────────────────────────────────────────────────────

const WB = [1, 0, 1, 1]
const WX = [29, 43, 57, 71]

function Weights({ t, b, rise }: StageProps & { rise: (at: number, d?: number) => number }) {
  const wOn = [enter(t, b.w8, 0.4), enter(t, b.w4, 0.4), enter(t, (b.w1 + b.w4) / 2 + 0.1, 0.4), enter(t, b.w1, 0.4)]
  const wTxt = ["8", "4", "2", "1"]
  const pick = [enter(t, b.e8, 0.4), 0, enter(t, b.e2, 0.4), enter(t, b.e1, 0.4)]
  return (
    <>
      <T x={50} y={11} size={2.8} color={MUTED} o={enter(t, b.weight, 0.5)}>
        二进制 <M>1011</M>
      </T>
      <Svg>
        {WX.map((x, i) => (
          <rect key={i} x={x - 5.5} y={17} width={11} height={13} rx={1.4} stroke={WB[i] ? HI : LINE} strokeWidth={0.35} opacity={enter(t, b.weight + 0.2 + i * 0.12, 0.4)} />
        ))}
      </Svg>
      {WX.map((x, i) => (
        <React.Fragment key={i}>
          <T x={x} y={23.5} size={6} weight={600} color={WB[i] ? HI : MUTED} o={enter(t, b.weight + 0.3 + i * 0.12, 0.4)} className="tabular">
            {WB[i]}
          </T>
          <T x={x} y={36} size={4} weight={600} color={pick[i] > 0.5 ? HI : MUTED} o={wOn[i]} dy={rise(b.w1, 1)} className="tabular">
            {wTxt[i]}
          </T>
        </React.Fragment>
      ))}
      <T x={50} y={46} size={5.6} weight={600} className="tabular">
        <M>
          <span style={{ opacity: enter(t, b.e8, 0.4), color: HI }}>8</span>
          <span style={{ opacity: enter(t, b.e2 - 0.25, 0.4) }}> + </span>
          <span style={{ opacity: enter(t, b.e2, 0.4), color: HI }}>2</span>
          <span style={{ opacity: enter(t, b.e1 - 0.25, 0.4) }}> + </span>
          <span style={{ opacity: enter(t, b.e1, 0.4), color: HI }}>1</span>
          <span style={{ opacity: enter(t, b.res - 0.3, 0.4) }}> = </span>
          <span style={{ opacity: enter(t, b.res, 0.4) }}>11</span>
        </M>
      </T>
    </>
  )
}

// ── hexadecimal ─────────────────────────────────────────────────────────────

const HB = [0, 0, 1, 1, 1, 1, 0, 0]
const hx = (i: number) => 50 + 8 * (i - 3.5)

function Hex({ t, b }: Pick<StageProps, "t" | "b">) {
  const nib = enter(t, b.nib, 0.5)
  const hex = enter(t, b.hex, 0.5)
  const byte = enter(t, b.byte - 0.2, 0.5)
  return (
    <>
      <Svg>
        {HB.map((_, i) => (
          <rect key={i} x={hx(i) - 3.4} y={14} width={6.8} height={9} rx={1} stroke={HB[i] ? HI : LINE} strokeWidth={0.3} opacity={enter(t, b.hexL + 0.1 + i * 0.07, 0.4)} />
        ))}
        {[0, 1].map((g) => (
          <Draw key={g} d={`M${hx(g * 4) - 3.4} 26 V28 H${hx(g * 4 + 3) + 3.4} V26`} p={nib} stroke={MUTED} strokeWidth={0.3} />
        ))}
        <Draw d={`M${hx(0) - 3.4} 12 V10 H${hx(7) + 3.4} V12`} p={byte} stroke={FG} strokeWidth={0.3} />
      </Svg>
      {HB.map((v, i) => (
        <T key={i} x={hx(i)} y={18.5} size={4} weight={600} color={v ? HI : MUTED} o={enter(t, b.hexL + 0.15 + i * 0.07, 0.4)} className="tabular">
          {v}
        </T>
      ))}
      {["3", "C"].map((c, g) => (
        <T key={c} x={(hx(g * 4) + hx(g * 4 + 3)) / 2} y={37} size={8} weight={600} o={hex} dy={0} className="tabular">
          <M>{c}</M>
        </T>
      ))}
      <T x={(hx(0) + hx(3)) / 2} y={30.6} size={2.4} color={MUTED} o={nib}>
        四位
      </T>
      <T x={(hx(4) + hx(7)) / 2} y={30.6} size={2.4} color={MUTED} o={nib}>
        四位
      </T>
      <T x={50} y={7.5} size={2.6} color={MUTED} o={byte}>
        1 字节 = 8 位
      </T>
      <T x={50} y={46} size={5} weight={600} o={enter(t, b.byte, 0.5)} className="tabular">
        <M>0x3C</M>
      </T>
    </>
  )
}

// ── half adder ──────────────────────────────────────────────────────────────

function Half({ t, b }: Pick<StageProps, "t" | "b">) {
  const steps = [0, 1, 2, 3].map((i) => lerp(b.half, b.and, i / 3))
  let idx = -1
  steps.forEach((s, i) => {
    if (t >= s) idx = i
  })
  const [a, bb] = [[0, 0], [0, 1], [1, 0], [1, 1]][Math.max(0, idx)]
  const s = gateFn("xor", a, bb)
  const c = gateFn("and", a, bb)
  const w = (on: number) => ({ stroke: on ? HI : MUTED, strokeWidth: on ? 0.5 : 0.28 })
  const wires = enter(t, b.halfL + 0.2, 0.7)
  const xorHi = enter(t, b.xor - 0.1, 0.4)
  const andHi = enter(t, b.and - 0.1, 0.4)
  return (
    <>
      <T x={50} y={6.5} size={4} weight={600} o={enter(t, b.halfL + 0.2, 0.5)} className="tabular">
        <M>
          {a} + {bb} = {c}
          {s}
        </M>
      </T>
      <Svg>
        <g opacity={wires}>
          <path d="M10 14 H35 M26 14 V36 H35" {...w(a)} />
          <path d="M10 22 H35 M18 22 V44 H35" {...w(bb)} />
          <circle cx={26} cy={14} r={0.6} fill={a ? HI : MUTED} stroke="none" />
          <circle cx={18} cy={22} r={0.6} fill={bb ? HI : MUTED} stroke="none" />
          <path d="M65 18 H68" {...w(s)} />
          <path d="M65 40 H68" {...w(c)} />
        </g>
        <GateAt x={50} y={18} scale={0.5} type="xor" a={!!a} b={!!bb} out={!!s} o={enter(t, b.halfL, 0.5)} />
        <GateAt x={50} y={40} scale={0.5} type="and" a={!!a} b={!!bb} out={!!c} o={enter(t, b.halfL, 0.5)} />
        <rect x={34} y={9.5} width={32} height={17} rx={1.4} stroke={HI} strokeWidth={0.3} opacity={xorHi * (1 - 0.7 * andHi)} />
        <rect x={34} y={32} width={32} height={17} rx={1.4} stroke={HI} strokeWidth={0.3} opacity={andHi} />
      </Svg>
      <T x={7} y={14} size={2.8} anchor="end" o={wires}>
        A
      </T>
      <T x={7} y={22} size={2.8} anchor="end" o={wires}>
        B
      </T>
      <T x={50} y={29} size={2.4} color={MUTED} o={enter(t, b.xor, 0.4)}>
        异或
      </T>
      <T x={50} y={51} size={2.4} color={MUTED} o={enter(t, b.and, 0.4)}>
        与
      </T>
      <T x={70} y={18} size={3} anchor="start" o={wires}>
        <span style={{ color: MUTED }}>和 S </span>
        <span style={{ color: s ? HI : FG, fontWeight: 600 }}>{s}</span>
      </T>
      <T x={70} y={40} size={3} anchor="start" o={wires}>
        <span style={{ color: MUTED }}>进位 C </span>
        <span style={{ color: c ? HI : FG, fontWeight: 600 }}>{c}</span>
      </T>
    </>
  )
}

// ── ripple carry and overflow ───────────────────────────────────────────────

const RX = [74, 62, 50, 38]
const FX = 26

function Ripple({ t, b }: Pick<StageProps, "t" | "b">) {
  // index 0 is the lowest bit (the rightmost column): 1111 + 0001
  const A = [1, 1, 1, 1]
  const B = [1, 0, 0, 0]
  const tk = [0, 1, 2, 3].map((k) => lerp(b.carry + 0.3, b.ripple + 1.0, k / 3))
  const tf = tk[3] + 0.7
  const colHi = [0, 1, 2, 3].map((k) => enter(t, tk[k], 0.25) * (k < 3 ? 1 - enter(t, tk[k + 1], 0.25) : 1 - enter(t, tf, 0.25)))
  const lost = enter(t, b.lost, 0.5)
  const over = enter(t, b.over, 0.5)
  return (
    <>
      <T x={29} y={26} size={4} color={MUTED} o={enter(t, b.carryL + 0.3, 0.4)}>
        +
      </T>
      {RX.map((x, k) => (
        <React.Fragment key={k}>
          <T x={x} y={19} size={5} weight={600} color={A[k] ? HI : MUTED} o={enter(t, b.carryL + 0.2 + k * 0.08, 0.4)} className="tabular">
            {A[k]}
          </T>
          <T x={x} y={26} size={5} weight={600} color={B[k] ? HI : MUTED} o={enter(t, b.carryL + 0.3 + k * 0.08, 0.4)} className="tabular">
            {B[k]}
          </T>
          <T x={x} y={38} size={5} weight={600} color={lost > 0.5 && false ? MUTED : FG} o={enter(t, tk[k], 0.3)} className="tabular">
            0
          </T>
        </React.Fragment>
      ))}
      <T x={FX} y={38} size={5} weight={600} color={HI} o={enter(t, tf, 0.3) * (1 - 0.65 * lost)} className="tabular">
        1
      </T>
      <T x={50} y={5.5} size={2.4} color={CUR} o={enter(t, b.carry, 0.4)}>
        进位
      </T>
      <Svg>
        <path d="M20 31.5 H80" stroke={LINE} strokeWidth={0.3} opacity={enter(t, b.carryL + 0.5, 0.4)} />
        {[0, 1, 2, 3].map((k) => (
          <React.Fragment key={k}>
            <rect x={RX[k] - 5.5} y={14.5} width={11} height={29} rx={1.4} stroke={HI} strokeWidth={0.3} opacity={colHi[k] * 0.7} />
            <Draw d={`M${RX[k] - 1} 12 Q${(RX[k] + (RX[k] - 12)) / 2} 7 ${RX[k] - 11} 12 M${RX[k] - 9.4} 10.6 L${RX[k] - 11} 12 L${RX[k] - 9} 12.9`} p={enter(t, tk[k] + 0.15, 0.4)} stroke={CUR} strokeWidth={0.4} />
          </React.Fragment>
        ))}
        <g opacity={lost}>
          <rect x={FX - 5.5} y={32.5} width={11} height={11} rx={1.4} stroke={trace.power} strokeDasharray="1.2 1" strokeWidth={0.35} />
          <path d={`M${FX - 3.5} 38 H${FX + 3.5}`} stroke={trace.power} strokeWidth={0.45} />
        </g>
      </Svg>
      <T x={FX} y={47.5} size={2.8} weight={600} color={trace.power} o={over}>
        溢出
      </T>
      <T x={62} y={47.5} size={2.8} color={MUTED} o={lost}>
        只存四位，结果变成 0000
      </T>
    </>
  )
}

// ── decoder ─────────────────────────────────────────────────────────────────

function Decoder({ t, b }: Pick<StageProps, "t" | "b">) {
  const seq = [2, 6, 3, 5]
  const times = [0, 1, 2, 3].map((i) => lerp(b.dec + 0.2, b.line, i / 3))
  let k = 0
  times.forEach((s, i) => {
    if (t >= s) k = i
  })
  const sel = seq[k]
  const bits = [(sel >> 2) & 1, (sel >> 1) & 1, sel & 1]
  const oy = (i: number) => 10 + i * 5.2
  const on = enter(t, b.decL, 0.5)
  return (
    <>
      <Svg>
        <rect x={36} y={9} width={22} height={38} rx={1.6} strokeWidth={0.4} opacity={on} />
        {[0, 1, 2].map((i) => (
          <path key={i} d={`M24 ${20 + i * 8} H36`} stroke={bits[i] ? HI : MUTED} strokeWidth={bits[i] ? 0.5 : 0.28} opacity={on} />
        ))}
        {Array.from({ length: 8 }, (_, i) => (
          <g key={i} opacity={enter(t, b.decL + 0.3 + i * 0.05, 0.4)}>
            <path d={`M58 ${oy(i) + 2} H77`} stroke={i === sel ? HI : MUTED} strokeWidth={i === sel ? 0.5 : 0.25} />
            <circle cx={80} cy={oy(i) + 2} r={1.7} fill={i === sel ? HI : "none"} stroke={i === sel ? HI : MUTED} strokeWidth={0.3} />
          </g>
        ))}
      </Svg>
      <T x={47} y={28} size={3} weight={600} o={on}>
        译码器
      </T>
      {bits.map((v, i) => (
        <T key={i} x={21} y={20 + i * 8} size={4} weight={600} anchor="end" color={v ? HI : MUTED} o={on} className="tabular">
          {v}
        </T>
      ))}
      <T x={17} y={10} size={2.4} color={MUTED} o={on}>
        地址
      </T>
      {Array.from({ length: 8 }, (_, i) => (
        <T key={i} x={86} y={oy(i) + 2} size={2.6} weight={i === sel ? 600 : 400} anchor="start" color={i === sel ? HI : MUTED} o={enter(t, b.decL + 0.3 + i * 0.05, 0.4)} className="tabular">
          {i}
        </T>
      ))}
    </>
  )
}

// ── seven-segment digit ─────────────────────────────────────────────────────

const SEGS: Record<string, [number, number, number, number]> = {
  a: [-5, -11, 5, -11],
  b: [6.5, -9.5, 6.5, -1.5],
  c: [6.5, 1.5, 6.5, 9.5],
  d: [-5, 11, 5, 11],
  e: [-6.5, 1.5, -6.5, 9.5],
  f: [-6.5, -9.5, -6.5, -1.5],
  g: [-5, 0, 5, 0],
}
const CODE = ["abcdef", "bc", "abdeg", "abcdg", "bcfg", "acdfg", "acdefg", "abc", "abcdefg", "abcdfg"]

function Seg({ t, b }: Pick<StageProps, "t" | "b">) {
  const seq = [3, 7, 5, 2, 9, 0, 8]
  const k = Math.max(0, Math.floor((t - b.seg - 0.1) / 0.8)) % seq.length
  const d = seq[k]
  const on = enter(t, b.segL, 0.5)
  const lit = enter(t, b.lit - 0.2, 0.5)
  return (
    <>
      <T x={22} y={14} size={2.4} color={MUTED} o={on}>
        四位输入
      </T>
      {[3, 2, 1, 0].map((bit, i) => (
        <T key={bit} x={13 + i * 6.4} y={26} size={5} weight={600} color={(d >> bit) & 1 ? HI : MUTED} o={on} className="tabular">
          {(d >> bit) & 1}
        </T>
      ))}
      <Svg>
        <path d="M38 26 H48 M46.2 24.4 L48 26 L46.2 27.6" opacity={on} strokeWidth={0.4} />
        <g transform="translate(68 28) scale(1.25)" opacity={on} strokeWidth={2.2 / 1.25}>
          {Object.entries(SEGS).map(([k2, [x1, y1, x2, y2]]) => {
            const isOn = CODE[d].includes(k2)
            return <path key={k2} d={`M${x1} ${y1} L${x2} ${y2}`} stroke={isOn ? glow.red : LINE} opacity={isOn ? 1 : 0.55} />
          })}
        </g>
      </Svg>
      <T x={22} y={38} size={2.4} color={MUTED} o={lit}>
        哪几段亮
      </T>
      <T x={22} y={43} size={2.6} anchor="middle" weight={600} color={glow.red} o={lit} className="tabular">
        {CODE[d].split("").join(" ")}
      </T>
    </>
  )
}

// ── no memory ───────────────────────────────────────────────────────────────

function Comb({ t, b }: Pick<StageProps, "t" | "b">) {
  const seq = [5, 12, 9]
  const times = [0, 1, 2].map((i) => lerp(b.comb, b.mem - 0.4, i / 2))
  let k = 0
  times.forEach((s, i) => {
    if (t >= s) k = i
  })
  const v = seq[k]
  const gone = enter(t, b.mem, 0.5)
  const on = enter(t, b.combL, 0.5)
  return (
    <>
      <Svg>
        <rect x={38} y={18} width={24} height={20} rx={1.6} strokeWidth={0.4} opacity={on} />
        <path d="M26 28 H38 M62 28 H74" strokeWidth={0.4} opacity={on} stroke={HI} />
        <path d="M36.4 26.4 L38 28 L36.4 29.6 M72.4 26.4 L74 28 L72.4 29.6" stroke={HI} strokeWidth={0.4} opacity={on} />
      </Svg>
      <T x={50} y={28} size={3.2} weight={600} o={on}>
        组合逻辑
      </T>
      <T x={16} y={19} size={2.4} color={MUTED} o={on}>
        输入
      </T>
      <T x={84} y={19} size={2.4} color={MUTED} o={on}>
        输出
      </T>
      <T x={16} y={28} size={4.4} weight={600} color={HI} o={on * (1 - gone)} className="tabular">
        <M>{v.toString(2).padStart(4, "0")}</M>
      </T>
      <T x={84} y={28} size={5} weight={600} o={on * (1 - gone)} className="tabular">
        {v}
      </T>
      <T x={16} y={28} size={4.4} color={MUTED} o={gone}>
        ····
      </T>
      <T x={84} y={28} size={5} color={MUTED} o={gone}>
        ?
      </T>
      <T x={50} y={42} size={3} weight={600} o={gone}>
        输入撤掉，结果就没了
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "二进制与组合逻辑",
  audio,
  timing,
  poster: 4.2,
  Stage,
}

export default function CombinationalFilm() {
  return <FilmPlayer film={film} />
}

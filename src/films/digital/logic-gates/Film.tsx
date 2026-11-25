import * as React from "react"
import type { GateType } from "@/lab/schematic"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, Scene, Svg, T, enter, glide, lerp, span, type FilmDef, type StageProps } from "../../kit"
import { DownArrow, FG, GateAt, HI, LINE, MUTED, gateFn, hash, makeLift, makeRise, sq } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

/*
 * 逻辑电平与逻辑门, ~65 s. Scenes, each keyed to the words that introduce it:
 *   title (a 0 / 1 square wave) → an analog wave with a roaming readout, then noise
 *   → two levels, high = 1 and low = 0 → noise on a digital signal, thresholds, a clean copy
 *   → gate demos (与 或 非 异或): inputs step through every combination, the output answers, the truth table fills row by row
 *   → the NAND gate that builds all the others → the seven gates, "try them below".
 */

const BITS = [0, 1, 1, 0, 1, 0, 0, 1]

function Stage({ t, b, still }: StageProps) {
  const rise = makeRise(t, still)
  const lift = makeLift(t, still)
  const sc = (a: number, z: number) => span(t, a - 0.3, z - 0.15, 0.3, 0.3)

  return (
    <>
      <Scene o={span(t, 0.25, b.ana - 0.15, 0.4, 0.3)} dy={lift(b.ana - 0.45)}>
        <T x={50} y={17} size={7} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
          逻辑电平与逻辑门
        </T>
        {BITS.map((v, i) => (
          <T key={i} x={25 + 6.25 * (i + 0.5)} y={27.5} size={2.8} weight={600} color={v ? HI : MUTED} o={enter(t, 1.3 + i * 0.12, 0.4)} className="tabular">
            {v}
          </T>
        ))}
        <Svg>
          <Draw d={sq(BITS, 25, 6.25, 32, 40)} p={enter(t, 0.9, 1.6)} stroke={HI} strokeWidth={0.5} />
        </Svg>
      </Scene>

      <Scene o={sc(b.ana, b.dig)}>
        <Analog t={t} b={b} />
      </Scene>
      <Scene o={sc(b.dig, b.regen)}>
        <Digital t={t} b={b} />
      </Scene>
      <Scene o={sc(b.regen, b.gateL)}>
        <Regen t={t} b={b} />
      </Scene>

      <Scene o={sc(b.gateL, b.orL)}>
        <Demo t={t} type="and" gx={glide(t, b.table - 0.75, 50, 30, 0.7)} name={t < b.and - 0.3 ? "逻辑门" : "与门"} en={t < b.and - 0.3 ? "" : "AND"} labelAt={b.gateL} pre={[b.rule, b.rule + 0.9, b.rule + 1.8, b.rule + 2.7].map((x) => x + 0.5)} tableAt={b.table} steps={[0, 1, 2, 3].map((i) => lerp(b.and + 0.2, b.both, i / 3))} />
      </Scene>
      <Scene o={sc(b.orL, b.notL)}>
        <Demo t={t} type="or" name="或门" en="OR" tableAt={b.orL} steps={[0, 1, 2, 3].map((i) => lerp(b.or + 0.2, b.or1, i / 3))} />
      </Scene>
      <Scene o={sc(b.notL, b.xorL)}>
        <Demo t={t} type="not" name="非门" en="NOT" tableAt={b.notL} steps={[b.not + 0.3, b.inv]} />
      </Scene>
      <Scene o={sc(b.xorL, b.nandL)}>
        <Demo t={t} type="xor" name="异或门" en="XOR" tableAt={b.xorL} steps={[0, 1, 2, 3].map((i) => lerp(b.xor + 0.2, b.xor1, i / 3))} />
      </Scene>

      <Scene o={sc(b.nandL, b.outro)}>
        <Nand t={t} b={b} />
      </Scene>

      <Scene o={enter(t, b.outro - 0.3, 0.4)}>
        <Seven t={t} b={b} still={still} rise={rise} />
      </Scene>
    </>
  )
}

// ── analog: any value, then noise ───────────────────────────────────────────

const aw = (x: number) => (0.65 * Math.sin((x - 12) * 0.14) + 0.35 * Math.sin((x - 12) * 0.34 + 0.8)) * 1.0
const ay = (x: number) => 27 - 11 * aw(x)

function Analog({ t, b }: Pick<StageProps, "t" | "b">) {
  const p = enter(t, b.ana, 2.2)
  const x1 = 12 + 76 * p
  const amp = enter(t, b.noise, 0.9) * 1.7
  let clean = ""
  let noisy = ""
  for (let i = 0; i <= 190; i++) {
    const x = 12 + (76 * i) / 190
    if (x > x1) break
    clean += `${i ? "L" : "M"}${x.toFixed(2)} ${ay(x).toFixed(2)}`
    noisy += `${i ? "L" : "M"}${x.toFixed(2)} ${(ay(x) + (hash(i, 3) - 0.5) * 2 * amp).toFixed(2)}`
  }
  // a dot roams along the wave, the readout shows its voltage: every value is possible
  const dotX = 12 + 76 * glide(t, b.any - 0.3, 0.05, 0.95, 3.2)
  const dotV = 1.65 + 1.4 * aw(dotX)
  const roam = enter(t, b.any - 0.3, 0.4) * (1 - enter(t, b.noise - 0.2, 0.4))
  return (
    <>
      <T x={12} y={10} size={3} weight={600} anchor="start" o={enter(t, b.ana, 0.5)}>
        模拟信号
      </T>
      <Svg>
        <path d={clean} stroke={HI} strokeWidth={0.5} opacity={1 - 0.6 * enter(t, b.noise, 0.6)} />
        {amp > 0.01 && <path d={noisy} stroke={FG} strokeWidth={0.28} opacity={0.9} />}
        {roam > 0.01 && (
          <g opacity={roam}>
            <circle cx={dotX} cy={ay(dotX)} r={0.9} fill={HI} stroke="none" />
            <path d={`M12 ${ay(dotX)} H${dotX}`} stroke={HI} strokeWidth={0.2} strokeDasharray="0.8 0.8" />
          </g>
        )}
      </Svg>
      <T x={88} y={10} size={4} weight={600} anchor="end" color={HI} o={roam} className="tabular">
        {dotV.toFixed(2)} V
      </T>
      <T x={50} y={45} size={2.8} color={MUTED} o={enter(t, b.noise, 0.5)}>
        一点噪声，波形就变了样
      </T>
    </>
  )
}

// ── digital: two levels ─────────────────────────────────────────────────────

const DB = [0, 1, 1, 0, 1, 0, 0, 1, 1, 0]
const HIY = 21
const LOY = 42

function Digital({ t, b }: Pick<StageProps, "t" | "b">) {
  const p = enter(t, b.dig + 0.05, b.zero - b.dig + 1.4)
  return (
    <>
      <T x={12} y={10} size={3} weight={600} anchor="start" o={enter(t, b.dig, 0.5)}>
        数字信号
      </T>
      {DB.map((v, i) => (
        <T key={i} x={14 + 6.2 * (i + 0.5)} y={HIY - 4.6} size={2.8} weight={600} color={v ? HI : MUTED} o={enter(t, b.dig + 0.25 + (i / DB.length) * (b.zero - b.dig + 0.6), 0.3)} className="tabular">
          {v}
        </T>
      ))}
      <Svg>
        <g stroke={LINE} strokeDasharray="1 1" strokeWidth={0.2}>
          <path d={`M14 ${HIY} H78`} opacity={enter(t, b.hi, 0.4)} />
          <path d={`M14 ${LOY} H78`} opacity={enter(t, b.lo, 0.4)} />
        </g>
        <Draw d={sq(DB, 14, 6.2, HIY, LOY)} p={p} stroke={HI} strokeWidth={0.5} />
      </Svg>
      <T x={81} y={HIY} size={3.4} weight={600} anchor="start" color={HI} o={enter(t, b.hi, 0.4)}>
        高 <span style={{ opacity: enter(t, b.one, 0.4) }}>= 1</span>
      </T>
      <T x={81} y={LOY} size={3.4} weight={600} anchor="start" o={enter(t, b.lo, 0.4)}>
        低 <span style={{ opacity: enter(t, b.zero, 0.4) }}>= 0</span>
      </T>
    </>
  )
}

// ── regeneration: noisy in, clean out ───────────────────────────────────────

const RB = [1, 0, 1, 1, 0, 1, 0, 0]
const RX = 20
const RDX = 7.5

function Regen({ t, b }: Pick<StageProps, "t" | "b">) {
  const amp = enter(t, b.noise2, 1.0) * 1.7
  const draw = enter(t, b.regen, 1.4)
  const hiY = 12
  const loY = 24
  let noisy = ""
  const n = 160
  const x1 = RX + RDX * RB.length * draw
  for (let i = 0; i <= n; i++) {
    const x = RX + (RDX * RB.length * i) / n
    if (x > x1) break
    const slot = Math.min(RB.length - 1, Math.floor((x - RX) / RDX))
    const frac = (x - RX) / RDX - slot
    const prev = slot ? RB[slot - 1] : RB[0]
    // a short ramp at each edge so the noisy trace stays a plain polyline
    const lvl = frac < 0.12 ? lerp(prev ? hiY : loY, RB[slot] ? hiY : loY, frac / 0.12) : RB[slot] ? hiY : loY
    noisy += `${i ? "L" : "M"}${x.toFixed(2)} ${(lvl + (hash(i, 7) - 0.5) * 2 * amp).toFixed(2)}`
  }
  const thr = enter(t, b.thr - 0.1, 0.5)
  return (
    <>
      <T x={10} y={18} size={2.6} color={MUTED} o={enter(t, b.regen, 0.5)}>
        收到
      </T>
      <T x={10} y={40} size={2.6} color={MUTED} o={enter(t, b.thr + 0.6, 0.5)}>
        输出
      </T>
      <Svg>
        <rect x={RX - 1} y={16.5} width={RDX * RB.length + 2} height={3} fill={LINE} stroke="none" opacity={0.5 * thr} />
        <g stroke={MUTED} strokeDasharray="1 1" strokeWidth={0.2} opacity={thr}>
          <path d={`M${RX - 1} 16.5 H${RX + RDX * RB.length + 1}`} />
          <path d={`M${RX - 1} 19.5 H${RX + RDX * RB.length + 1}`} />
        </g>
        <path d={noisy} stroke={FG} strokeWidth={0.3} />
        <Draw d={sq(RB, RX, RDX, 34, 46)} p={enter(t, b.thr + 0.6, b.clean - b.thr + 1.2)} stroke={HI} strokeWidth={0.5} />
        <g opacity={enter(t, b.thr + 0.5, 0.5)} strokeWidth={0.3}>
          <path d="M50 27 V31 M48.4 29.4 L50 31 L51.6 29.4" />
        </g>
      </Svg>
      <T x={RX + RDX * RB.length + 3} y={18} size={2.6} anchor="start" color={MUTED} o={thr}>
        门槛
      </T>
    </>
  )
}

// ── gate demos ──────────────────────────────────────────────────────────────

function Demo({ t, type, name, en, tableAt, steps, pre = [], labelAt, gx = 30 }: { labelAt?: number; gx?: number; t: number; type: GateType; name: string; en: string; tableAt: number; steps: number[]; pre?: number[] }) {
  const single = type === "not"
  const combos = single ? [[0], [1]] : [[0, 0], [0, 1], [1, 0], [1, 1]]
  let idx = -1
  steps.forEach((s, i) => {
    if (t >= s) idx = i
  })
  let pi = -1
  pre.forEach((s, i) => {
    if (t >= s) pi = i
  })
  const cur = combos[idx >= 0 ? idx : Math.max(0, pi) % combos.length]
  const a = cur[0]
  const bb = single ? 0 : cur[1]
  const y = gateFn(type, a, bb)
  const GX = gx
  const GY = 26
  const S = 0.55
  const tab = enter(t, tableAt, 0.5)
  const lab = enter(t, labelAt ?? tableAt - 0.3, 0.4)
  const colA = single ? 72 : 64
  const colB = 74
  const colY = single ? 86 : 86
  const rowY = (i: number) => (single ? 27 + 10 * i : 25 + 8.5 * i)
  const rowO = (i: number) => (idx === i ? enter(t, steps[i], 0.2) * (i + 1 < steps.length ? 1 - enter(t, steps[i + 1], 0.2) : 1) : i === idx - 1 ? 1 - enter(t, steps[idx], 0.2) : 0)
  return (
    <>
      <Svg>
        <GateAt x={GX} y={GY} scale={S} type={type} a={!!a} b={!!bb} out={!!y} />
        <path d={`M${colA - 6} 19.5 H92`} stroke={LINE} strokeWidth={0.2} opacity={tab} />
        {combos.map((_, i) => (
          <rect key={i} x={colA - 6} y={rowY(i) - 3.7} width={92 - colA + 6} height={7.4} rx={1} stroke={HI} strokeWidth={0.3} opacity={rowO(i) * tab} />
        ))}
      </Svg>
      <T x={GX - 18.5} y={GY - 8 * S - (single ? -8 * S : 0)} size={2.6} anchor="end" o={lab}>
        <span style={{ color: MUTED }}>A </span>
        <span style={{ color: a ? HI : FG, fontWeight: 600 }}>{a}</span>
      </T>
      {!single && (
        <T x={GX - 18.5} y={GY + 8 * S} size={2.6} anchor="end" o={lab}>
          <span style={{ color: MUTED }}>B </span>
          <span style={{ color: bb ? HI : FG, fontWeight: 600 }}>{bb}</span>
        </T>
      )}
      <T x={GX + 18.5} y={GY} size={2.6} anchor="start" o={lab}>
        <span style={{ color: MUTED }}>Y </span>
        <span style={{ color: y ? HI : FG, fontWeight: 600 }}>{y}</span>
      </T>
      <T x={GX} y={40} size={4} weight={600} o={lab}>
        {name}
      </T>
      <T x={GX} y={46} size={2.4} color={MUTED} o={lab}>
        {en}
      </T>
      <T x={colA} y={16} size={2.4} color={MUTED} o={tab}>A</T>
      {!single && <T x={colB} y={16} size={2.4} color={MUTED} o={tab}>B</T>}
      <T x={colY} y={16} size={2.4} color={MUTED} o={tab}>Y</T>
      {combos.map((c, i) => {
        const o = enter(t, tableAt + 0.15 * i, 0.4)
        const yv = gateFn(type, c[0], single ? 0 : c[1])
        const known = enter(t, steps[i], 0.3)
        return (
          <React.Fragment key={i}>
            <T x={colA} y={rowY(i)} size={3} o={o * 0.7} className="tabular">{c[0]}</T>
            {!single && <T x={colB} y={rowY(i)} size={3} o={o * 0.7} className="tabular">{c[1]}</T>}
            <T x={colY} y={rowY(i)} size={3} weight={600} color={yv ? HI : FG} o={o * known} className="tabular">
              {yv}
            </T>
          </React.Fragment>
        )
      })}
    </>
  )
}

// ── the NAND gate that builds the rest ──────────────────────────────────────

function Nand({ t, b }: Pick<StageProps, "t" | "b">) {
  const minis: { type: GateType; label: string; y: number; at: number }[] = [
    { type: "not", label: "非门", y: 14, at: b.all },
    { type: "and", label: "与门", y: 28, at: b.all + 0.55 },
    { type: "or", label: "或门", y: 42, at: b.all + 1.1 },
  ]
  // the NAND gate starts alone in the middle, then steps aside for the gates it builds
  const nx = glide(t, b.all - 0.75, 50, 26, 0.7)
  return (
    <>
      <Svg>
        <GateAt x={nx} y={28} scale={0.6} type="nand" o={enter(t, b.nandL - 0.1, 0.5)} />
        {minis.map((m) => (
          // an arrow ("builds"), not a wire: it stops short of the gate's inputs
          <g key={m.label}>
            <Draw d={`M45 28 H49 V${m.y} H55`} p={enter(t, m.at - 0.15, 0.5)} stroke={MUTED} strokeWidth={0.25} />
            <path d={`M53.6 ${m.y - 1.2} L55 ${m.y} L53.6 ${m.y + 1.2}`} stroke={MUTED} strokeWidth={0.25} opacity={enter(t, m.at + 0.2, 0.3)} />
            <GateAt x={70} y={m.y} scale={0.34} type={m.type} o={enter(t, m.at, 0.5)} />
          </g>
        ))}
      </Svg>
      <T x={nx} y={40} size={3.4} weight={600} o={enter(t, b.nand, 0.4)}>
        与非门
      </T>
      <T x={nx} y={47} size={4.2} weight={600} color={HI} o={enter(t, b.univ, 0.5)}>
        万能门
      </T>
      {minis.map((m) => (
        <T key={m.label} x={84} y={m.y} size={2.8} anchor="start" color={MUTED} o={enter(t, m.at + 0.15, 0.4)}>
          {m.label}
        </T>
      ))}
    </>
  )
}

// ── the seven gates ─────────────────────────────────────────────────────────

const SEVEN: { type: GateType; name: string }[] = [
  { type: "and", name: "与" },
  { type: "or", name: "或" },
  { type: "not", name: "非" },
  { type: "nand", name: "与非" },
  { type: "nor", name: "或非" },
  { type: "xor", name: "异或" },
  { type: "xnor", name: "同或" },
]

function Seven({ t, b, still, rise }: StageProps & { rise: (at: number, d?: number) => number }) {
  const pos = (i: number): [number, number] => (i < 4 ? [18 + i * 21, 19] : [28.5 + (i - 4) * 21, 33])
  return (
    <>
      <T x={50} y={7} size={4.4} weight={600} o={enter(t, b.outro - 0.1, 0.5)} dy={rise(b.outro - 0.1)}>
        七种门，挨个试
      </T>
      <Svg>
        {SEVEN.map((g, i) => {
          const [x, y] = pos(i)
          return <GateAt key={g.type} x={x} y={y} scale={0.3} type={g.type} o={enter(t, b.outro + 0.3 + i * 0.14, 0.5)} />
        })}
        <DownArrow t={t} at={b.try + 0.4} still={still} y={45} />
      </Svg>
      {SEVEN.map((g, i) => {
        const [x, y] = pos(i)
        return (
          <T key={g.type} x={x} y={y + 8} size={2.6} color={MUTED} o={enter(t, b.outro + 0.4 + i * 0.14, 0.5)}>
            {g.name}
          </T>
        )
      })}
    </>
  )
}

export const film: FilmDef = {
  title: "逻辑电平与逻辑门",
  audio,
  timing,
  poster: 3.4,
  Stage,
}

export default function LogicGatesFilm() {
  return <FilmPlayer film={film} />
}

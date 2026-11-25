import { trace } from "@/lab/colors"
import { Resistor } from "@/lab/schematic"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, M, Scene, Svg, Sym, T, V, enter, glide, lerp, span, type FilmDef, type StageProps } from "../../kit"
import { AMP, Box, GOOD, HArrow, HEAT, LINE, MUTED, Outro, VOLT, riseFn, sceneO } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

const RES = trace.second

/*
 * 力、压力与环境传感器, ~58 s. Scenes, each keyed to the words that introduce it:
 *   title → weighing on the left, air / humidity / gas on the right
 *   → a strain gauge stretches and its resistance rises → but only by a thousandth
 *   → the Wheatstone bridge: two dividers side by side, balanced = 0, only the change is left
 *   → a dedicated chip amplifies ×128 and digitises → two-point calibration with a known weight
 *   → pressure falls with height → gas and soil probes can only say more or less → "try it below".
 */
function Stage({ t, b, still }: StageProps) {
  const A = span(t, 0.25, b.strain - 0.15, 0.4, 0.3)
  const S = [
    sceneO(t, b.strain, b.tiny),
    sceneO(t, b.tiny, b.bridge),
    sceneO(t, b.bridge, b.chip),
    sceneO(t, b.chip, b.cal),
    sceneO(t, b.cal, b.baro),
    sceneO(t, b.baro, b.gas),
    sceneO(t, b.gas, b.outro),
  ]
  const outro = enter(t, b.outro - 0.3, 0.4)
  return (
    <>
      <Scene o={A}>
        <Title t={t} b={b} still={still} />
      </Scene>
      <Scene o={S[0]}>
        <Strain t={t} b={b} still={still} />
      </Scene>
      <Scene o={S[1]}>
        <Tiny t={t} b={b} />
      </Scene>
      <Scene o={S[2]}>
        <Bridge t={t} b={b} />
      </Scene>
      <Scene o={S[3]}>
        <ChipChain t={t} b={b} />
      </Scene>
      <Scene o={S[4]}>
        <Calibrate t={t} b={b} />
      </Scene>
      <Scene o={S[5]}>
        <Pressure t={t} b={b} />
      </Scene>
      <Scene o={S[6]}>
        <Qualitative t={t} b={b} />
      </Scene>
      <Scene o={outro}>
        <Outro t={t} still={still} at={b.outro} hintAt={b.try} hint="拖动实验台里的应变，看电桥怎么把这点变化挑出来" />
      </Scene>
    </>
  )
}

// ── title ────────────────────────────────────────────────────────────────────

function Title({ t, b, still }: StageProps) {
  const rise = riseFn(t, still)
  const weigh = enter(t, b.weigh, 0.5)
  const sag = still ? 1 : glide(t, b.weigh + 0.6, 0, 1.6, 0.8)
  return (
    <>
      <T x={50} y={9} size={7} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
        力、压力与环境传感器
      </T>
      <Svg>
        <Box x={8} y={17} w={38} h={28} o={enter(t, b.weigh - 0.2, 0.5)} />
        <Box x={54} y={17} w={38} h={28} o={enter(t, b.env - 0.2, 0.5)} />
        <g opacity={weigh}>
          <path d="M14 26 H18 M14 26 V34" strokeWidth={0.6} />
          <path d={`M14 30 H40`} strokeWidth={0.8} transform={`rotate(${sag} 14 30)`} />
          <rect x={30} y={21} width={8} height={7} rx={0.8} fill="var(--muted)" transform={`translate(0 ${sag * 0.9})`} />
          <path d="M18 40 H42" stroke={LINE} />
        </g>
      </Svg>
      <T x={27} y={47.5} size={2.4} color={MUTED} o={enter(t, b.weigh + 0.3, 0.5)}>
        称重
      </T>
      {["气压", "湿度", "气体"].map((w, i) => (
        <T key={w} x={73} y={24 + i * 8} size={3.2} weight={600} o={enter(t, b.env + i * 0.5, 0.45)} dy={rise(b.env + i * 0.5, 1)}>
          {w}
        </T>
      ))}
      <T x={73} y={47.5} size={2.4} color={MUTED} o={enter(t, b.env + 0.3, 0.5)}>
        环境
      </T>
    </>
  )
}

// ── strain gauge ────────────────────────────────────────────────────────────

function Strain({ t, b, still }: StageProps) {
  const base = enter(t, b.strain, 0.5)
  const foil = enter(t, b.foil, 0.6)
  const e = still ? 0.16 : glide(t, b.stretch, 0, 0.16, 1.0)
  const W = 40 * (1 + e)
  const x0 = 50 - W / 2
  const zig = () => {
    let d = ""
    const rows = 5
    const inner = W - 8
    for (let r = 0; r < rows; r++) {
      const y = 24 + r * 3
      const xs = r % 2 ? [x0 + 4 + inner, x0 + 4] : [x0 + 4, x0 + 4 + inner]
      d += `${r ? "L" : "M"}${xs[0]} ${y}L${xs[1]} ${y}`
    }
    return d
  }
  // full load is +0.35 Ω (the next scene); the drawing exaggerates the stretch, the number does not
  const r = lerp(350, 350.35, e / 0.16)
  return (
    <>
      <Svg>
        <rect x={x0} y={20} width={W} height={22} rx={1} fill="var(--muted)" opacity={base} />
        <Draw d={zig()} p={foil} stroke={RES} strokeWidth={0.5} />
        <HArrow x0={x0 - 2} x1={x0 - 8} y={31} p={enter(t, b.stretch - 0.2, 0.4)} color={HEAT} />
        <HArrow x0={x0 + W + 2} x1={x0 + W + 8} y={31} p={enter(t, b.stretch - 0.2, 0.4)} color={HEAT} />
      </Svg>
      <T x={50} y={13} size={3} weight={600} o={base}>
        应变片
      </T>
      <T x={50} y={46} size={2.6} color={RES} o={foil} weight={600}>
        蛇形金属箔
      </T>
      <T x={9} y={31} size={2.4} color={HEAT} o={enter(t, b.stretch, 0.4)}>
        拉长
      </T>
      <T x={91} y={31} size={2.4} color={HEAT} o={enter(t, b.stretch, 0.4)}>
        拉长
      </T>
      <T x={50} y={51} size={2.8} weight={600} o={enter(t, b.stretch + 0.6, 0.5)} className="tabular">
        <span style={{ color: MUTED, fontWeight: 400 }}>阻值 </span>
        <M>{r.toFixed(2)} Ω</M>
        <span style={{ color: RES }}> ↑ 变大</span>
      </T>
    </>
  )
}

// ── only a thousandth ───────────────────────────────────────────────────────

function Tiny({ t, b }: Pick<StageProps, "t" | "b">) {
  const big = enter(t, b.thou, 0.5)
  const bar = enter(t, b.ohm, 0.6)
  const sliver = enter(t, b.ohm + 1.0, 0.5)
  return (
    <>
      <T x={50} y={15} size={6} weight={600} color={HEAT} o={big} className="tabular">
        <V>ΔR</V>
        <M> / </M>
        <V>R</V>
        <M> ≈ 0.1 %</M>
      </T>
      <T x={50} y={24} size={2.6} color={MUTED} o={big}>
        满载时，阻值只变千分之一
      </T>
      <Svg>
        <rect x={14} y={32} width={72} height={5} rx={0.8} fill={RES} stroke="none" opacity={0.75 * bar} />
        <rect x={85.6} y={30} width={0.9} height={9} fill={HEAT} stroke="none" opacity={sliver} />
        <path d="M86 28 L86 24" stroke={HEAT} opacity={sliver} />
      </Svg>
      <T x={50} y={43} size={3.4} weight={600} o={bar} className="tabular">
        <M>350 Ω</M>
      </T>
      <T x={86} y={21} size={2.8} weight={600} color={HEAT} o={sliver} className="tabular">
        <M>+0.35 Ω</M>
      </T>
    </>
  )
}

// ── the Wheatstone bridge ───────────────────────────────────────────────────

function Bridge({ t, b }: Pick<StageProps, "t" | "b">) {
  const XL = 24
  const XR = 46
  const parts = enter(t, b.bridge, 0.6)
  const wires = enter(t, b.bridge + 0.3, 0.8)
  const diff = enter(t, b.diff - 0.2, 0.5)
  const zero = enter(t, b.zero, 0.5)
  const base = enter(t, b.base, 0.5)
  const chg = enter(t, b.chg, 0.5)
  const gauge = glide(t, b.chg, 0, 1, 0.8)
  const res = (x: number, y: number, variable = false, c?: string) => (
    <Sym x={x} y={y} scale={0.25} opacity={parts} color={c}>
      <Resistor x={0} y={0} rot={90} variable={variable} />
    </Sym>
  )
  return (
    <>
      <Svg>
        <Draw d={`M${XL} 9 H${XR}`} p={wires} />
        <Draw d={`M${XL} 9 V11.5 M${XR} 9 V11.5`} p={wires} />
        {res(XL, 19)}
        {res(XR, 19)}
        <Draw d={`M${XL} 26.5 V31.5 M${XR} 26.5 V31.5`} p={wires} />
        {res(XL, 39)}
        {res(XR, 39, true, HEAT)}
        <Draw d={`M${XL} 46.5 V49 H${XR} V46.5`} p={wires} />
        <circle cx={XL} cy={29} r={0.9} fill={VOLT} stroke="none" opacity={diff} />
        <circle cx={XR} cy={29} r={0.9} fill={VOLT} stroke="none" opacity={diff} />
        <Draw d={`M${XL} 29 H31.8 M38.2 29 H${XR}`} p={diff} stroke={VOLT} />
        <circle cx={35} cy={29} r={3.2} opacity={diff} />
</Svg>
      <T x={35} y={29.1} size={2.6} font="var" o={diff}>
        V
      </T>
      <T x={35} y={5.2} size={2.2} color={MUTED} o={wires}>
        激励 <M>5 V</M>
      </T>
      <T x={XL - 4} y={19} size={2.4} anchor="end" color={MUTED} o={parts}>
        固定
      </T>
      <T x={XL - 4} y={39} size={2.4} anchor="end" color={MUTED} o={parts}>
        固定
      </T>
      <T x={XR + 5} y={39} size={2.4} anchor="start" weight={600} color={HEAT} o={parts}>
        应变片
      </T>
      <T x={35} y={34.5} size={2.6} weight={600} o={diff * (1 - 0.4 * chg)} className="tabular">
        <M c={chg > 0.5 ? HEAT : undefined}>{chg > 0.5 ? `${(1.25 * gauge).toFixed(2)} mV` : zero > 0.5 ? "0 V" : ""}</M>
      </T>
      <T x={XL - 2} y={27} size={2.2} anchor="end" color={VOLT} o={base * (1 - 0.7 * chg)} className="tabular">
        <M>2.5 V</M>
      </T>
      <T x={XR + 2} y={27} size={2.2} anchor="start" color={VOLT} o={base * (1 - 0.7 * chg)} className="tabular">
        <M>2.5 V</M>
      </T>
      <T x={62} y={13} size={3.2} weight={600} anchor="start" o={enter(t, b.bridgew, 0.5)}>
        两个分压器并排
      </T>
      <T x={62} y={19.5} size={2.6} anchor="start" color={MUTED} o={diff}>
        只量两个中点的差
      </T>
      <T x={62} y={30} size={3.2} weight={600} anchor="start" color={GOOD} o={zero * (1 - chg)}>
        平衡：输出为 0
      </T>
      <T x={62} y={37} size={2.6} anchor="start" color={MUTED} o={base * (1 - chg)}>
        2.5 V 的底被减掉
      </T>
      <T x={62} y={30} size={3.2} weight={600} anchor="start" color={HEAT} o={chg}>
        剩下的只有变化
      </T>
    </>
  )
}

// ── amplify and digitise ────────────────────────────────────────────────────

function ChipChain({ t, b }: Pick<StageProps, "t" | "b">) {
  const bridge = enter(t, b.chip, 0.5)
  const chip = enter(t, b.chipw, 0.5)
  const amp = enter(t, b.n128, 0.5)
  const flow = enter(t, b.chipw + 0.4, 0.6)
  const mv = glide(t, b.n128, 1.25, 160, 0.9)
  const bits = ["0110 1001", "1011 0100", "0001 1110"]
  return (
    <>
      <Svg>
        <Box x={6} y={20} w={22} h={14} o={bridge} />
        <Box x={36} y={13} w={58} h={28} o={chip} />
        <Box x={40} y={20} w={22} h={14} o={chip} />
        <Box x={68} y={20} w={22} h={14} o={chip} />
        <HArrow x0={29} x1={35} y={27} p={flow} color={MUTED} />
        <HArrow x0={63} x1={67} y={27} p={amp} color={MUTED} />
      </Svg>
      <T x={17} y={27} size={2.8} weight={600} o={bridge}>
        电桥
      </T>
      <T x={17} y={38} size={2.4} color={VOLT} o={bridge} className="tabular">
        <M>1.25 mV</M>
      </T>
      <T x={65} y={9} size={2.8} weight={600} o={chip}>
        专用芯片
      </T>
      <T x={51} y={25.5} size={2.8} weight={600} o={amp}>
        放大
      </T>
      <T x={51} y={30} size={2.4} color={AMP} o={amp} className="tabular">
        <M>× 128</M>
      </T>
      <T x={79} y={25.5} size={2.8} weight={600} o={amp}>
        变成数字
      </T>
      <T x={79} y={30} size={2.2} color={MUTED} o={amp}>
        24 位
      </T>
      <T x={51} y={46} size={3.2} weight={600} color={AMP} o={amp} className="tabular">
        <M>{mv < 10 ? mv.toFixed(2) : Math.round(mv)} mV</M>
      </T>
      {bits.map((s, i) => (
        <T key={s} x={79} y={44 + i * 3.2} size={2.4} color={AMP} o={enter(t, b.n128 + 0.5 + i * 0.2, 0.4)} className="tabular">
          {s}
        </T>
      ))}
    </>
  )
}

// ── two-point calibration ───────────────────────────────────────────────────

function Calibrate({ t, b }: Pick<StageProps, "t" | "b">) {
  const gx = (g: number) => 44 + g * 0.08
  const gy = (c: number) => 44 - c * 0.3
  const axes = enter(t, b.cal, 0.6)
  const p0 = enter(t, b.tare, 0.45)
  const p1 = enter(t, b.wt, 0.45)
  const line = enter(t, b.wt + 0.4, 0.8)
  return (
    <>
      <Svg>
        <Draw d="M44 44 H92" p={axes} />
        <Draw d="M44 44 V10" p={axes} />
        <Draw d={`M${gx(0)} ${gy(8)} L${gx(500)} ${gy(108)}`} p={line} stroke={VOLT} strokeWidth={0.45} />
        <circle cx={gx(0)} cy={gy(8)} r={1} fill={AMP} stroke="none" opacity={p0} />
        <circle cx={gx(500)} cy={gy(108)} r={1} fill={AMP} stroke="none" opacity={p1} />
        {/* the pan */}
        <g opacity={enter(t, b.cal, 0.5)}>
          <path d="M8 40 H34" />
          <path d="M12 40 V44 M30 40 V44" />
        </g>
        <rect x={16} y={31} width={10} height={9} rx={0.8} fill="var(--muted)" opacity={p1} />
      </Svg>
      <T x={21} y={47.5} size={2.6} color={MUTED} o={enter(t, b.cal, 0.5)}>
        秤盘
      </T>
      <T x={21} y={27} size={2.6} weight={600} o={p1}>
        砝码
      </T>
      <T x={92} y={47.5} size={2.4} anchor="end" color={MUTED} o={axes}>
        重量
      </T>
      <T x={42} y={9} size={2.4} anchor="end" color={MUTED} o={axes}>
        读数
      </T>
      <T x={gx(0) + 3} y={47.5} size={2.6} anchor="start" weight={600} o={p0}>
        空秤：去皮
      </T>
      <T x={gx(500) - 2.5} y={gy(108)} size={2.6} anchor="end" weight={600} o={p1}>
        放上已知的砝码
      </T>
    </>
  )
}

// ── pressure and height ─────────────────────────────────────────────────────

function Pressure({ t, b }: Pick<StageProps, "t" | "b">) {
  const base = enter(t, b.baro, 0.5)
  const h = glide(t, b.press + 0.4, 0, 90, 4.0)
  const y = 44 - (h / 100) * 30
  const p = 1013.25 - 0.12 * h
  const alt = enter(t, b.alt, 0.5)
  return (
    <>
      <Svg>
        <Draw d="M34 44 V12" p={base} />
        <path d="M31 44 H37 M31 14 H37 M31 29 H37" opacity={base} strokeWidth={0.2} />
        <circle cx={34} cy={y} r={1.6} fill={HEAT} stroke="none" opacity={base} />
        <path d={`M38 ${y} H48`} stroke={HEAT} opacity={base} />
      </Svg>
      <T x={29} y={44} size={2.2} anchor="end" color={MUTED} o={base}>
        <M>0 m</M>
      </T>
      <T x={29} y={14} size={2.2} anchor="end" color={MUTED} o={base}>
        <M>100 m</M>
      </T>
      <T x={34} y={8} size={2.4} color={MUTED} o={base}>
        高度
      </T>
      <T x={52} y={y} size={3.6} anchor="start" weight={600} color={HEAT} o={base} className="tabular">
        <M>{p.toFixed(1)} hPa</M>
      </T>
      <T x={78} y={36} size={2.6} color={MUTED} o={enter(t, b.press + 1.0, 0.5)}>
        越往高处，气压越低
      </T>
      <T x={78} y={46} size={3.2} weight={600} color={GOOD} o={alt}>
        气压芯片 = 高度计
      </T>
    </>
  )
}

// ── gas and soil: only more or less ─────────────────────────────────────────

function Qualitative({ t, b }: Pick<StageProps, "t" | "b">) {
  const cards = [
    { x: 27, name: "气体探头", steps: ["少", "中", "多"], at: b.gas },
    { x: 73, name: "土壤湿度探头", steps: ["干", "湿", "很湿"], at: b.gas + 0.2 },
  ]
  const qual = enter(t, b.qual, 0.5)
  const no = enter(t, b.qual + 1.5, 0.5)
  return (
    <>
      <Svg>
        {cards.map((c) => (
          <Box key={c.name} x={c.x - 19} y={12} w={38} h={26} o={enter(t, c.at + 0.05, 0.5)} />
        ))}
        {cards.map((c) =>
          c.steps.map((_, i) => (
            <rect key={c.name + i} x={c.x - 14 + i * 10} y={26} width={8} height={6} rx={0.8} fill={i === 2 ? HEAT : "var(--muted)"} stroke="none" opacity={enter(t, c.at + 0.4 + i * 0.35, 0.4) * (i === 2 ? 0.8 : 1)} />
          )),
        )}
        <g opacity={no} stroke={HEAT} strokeWidth={0.5}>
          <path d="M52 43 l5 6 M57 43 l-5 6" />
        </g>
      </Svg>
      {cards.map((c) => (
        <T key={c.name} x={c.x} y={18} size={2.8} weight={600} o={enter(t, c.at, 0.45)}>
          {c.name}
        </T>
      ))}
      {cards.map((c) =>
        c.steps.map((s, i) => (
          <T key={c.name + s} x={c.x - 10 + i * 10} y={35.2} size={2} color={MUTED} o={enter(t, c.at + 0.4 + i * 0.35, 0.4)}>
            {s}
          </T>
        )),
      )}
      <T x={28} y={46} size={3.2} weight={600} o={qual}>
        只能分多和少
      </T>
      <T x={76} y={46} size={3.2} weight={600} color={HEAT} o={no}>
        不能当报警器
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "力、压力与环境传感器",
  audio,
  timing,
  poster: 3.6,
  Stage,
}

export default function ForceEnvironmentFilm() {
  return <FilmPlayer film={film} />
}

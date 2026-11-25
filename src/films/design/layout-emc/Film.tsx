import * as React from "react"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, M, Scene, Svg, T, easeInOut, enter, glide, lerp, span, type FilmDef, type StageProps } from "../../kit"
import { AMP, Box, Check, GOOD, MUTED, POWER, VOLT } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

/*
 * 布局、接地与 EMC, ~70 s.
 *   title (a small loop vs a big one) → out and back as a loop → top view of a ground plane: the return
 *   current spreads at low frequency, hugs the trace at high frequency → a slot forces a detour and
 *   a big loop area that radiates → decoupling cap far vs near (voltage droop) → the numbers
 *   → cap hugging the pin → source / path / victim → "try the return-path lab".
 * Copper is the voltage orange; current is blue; the bad loop is red.
 */
const COPPER = VOLT

/**
 * When each narration line starts. Some beats share their line's id ("surge": "抽一口电流" sits a
 * second into the line "surge"), and a beat overrides the line of the same name in `b`.
 */
const LINE = Object.fromEntries(timing.lines.map((l) => [l.id, l.start])) as Record<string, number>

function Stage({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.6) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)
  const lift = (at: number) => (still ? 0 : -easeInOut((t - at) / 0.45) * 2)

  // each scene is gone before the next one's content arrives
  const title = span(t, 0.25, b.loop - 0.45)
  const loop = span(t, b.loop - 0.25, b.low - 0.45)
  const plane = span(t, b.low - 0.25, LINE.surgeL - 0.45)
  const surge = span(t, LINE.surgeL - 0.25, b.rules - 0.45)
  // "地端就近打孔" closes its line: the placement stays up into the gap
  const rules = span(t, b.rules - 0.25, b.emc - 0.15)
  const emc = span(t, b.emc + 0.15, b.outro - 0.45)
  const outro = enter(t, b.outro - 0.1, 0.5)

  return (
    <>
      <Scene o={title} dy={lift(b.loop - 0.45)}>
        <T x={50} y={11} size={6.4} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
          布局、接地与 EMC
        </T>
        <T x={50} y={19} size={2.8} color={MUTED} o={enter(t, b.intro + 0.9)} dy={rise(b.intro + 0.9, 1)}>
          电流总要回来
        </T>
        <Teaser t={t} b={b} />
      </Scene>

      <Scene o={loop}>
        <Loop t={t} b={b} still={still} />
      </Scene>

      <Scene o={plane}>
        <Plane t={t} b={b} still={still} />
      </Scene>

      <Scene o={surge}>
        <Surge t={t} b={b} still={still} />
      </Scene>

      <Scene o={rules}>
        <Rules t={t} b={b} still={still} />
      </Scene>

      <Scene o={emc}>
        <Three t={t} b={b} still={still} />
      </Scene>

      <Scene o={outro}>
        <T x={50} y={24} size={6} weight={600} dy={rise(b.outro)}>
          动手试试
        </T>
        <T x={50} y={32.5} size={2.8} color={MUTED} o={enter(t, b.drag)} dy={rise(b.drag, 1)}>
          拖动下面的频率，看回流电流怎么选路
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

/** Dots drifting along a polyline, `phase` units travelled. */
function Dots({ pts, phase, o = 1, spacing = 3.2, color = AMP, r = 0.55 }: { pts: [number, number][]; phase: number; o?: number; spacing?: number; color?: string; r?: number }) {
  if (o <= 0.01) return null
  const segs = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]))
  const L = segs.reduce((a, c) => a + c, 0)
  const n = Math.max(1, Math.floor(L / spacing))
  const out: React.ReactNode[] = []
  for (let i = 0; i < n; i++) {
    let s = (((i + 0.5) * (L / n) + phase) % L + L) % L
    let k = 0
    while (k < segs.length - 1 && s > segs[k]) s -= segs[k++]
    const [x0, y0] = pts[k]
    const [x1, y1] = pts[k + 1]
    out.push(<circle key={i} cx={x0 + ((x1 - x0) * s) / segs[k]} cy={y0 + ((y1 - y0) * s) / segs[k]} r={r} fill={color} stroke="none" opacity={o} />)
  }
  return <>{out}</>
}

// ── title: two ways to place the same parts ────────────────────────────────

function Teaser({ t, b }: Pick<StageProps, "t" | "b">) {
  const a = enter(t, b.intro + 2.6, 0.7)
  const c = enter(t, b.intro + 4.0, 0.7)
  return (
    <>
      <Svg>
        <g opacity={a}>
          <Box x={12} y={28} w={8} h={6} /> <Box x={34} y={28} w={8} h={6} />
          <path d="M20 31 H34" stroke={COPPER} strokeWidth={0.7} />
          <path d="M20 33.5 H34" stroke={AMP} strokeWidth={0.3} />
        </g>
        <g opacity={c}>
          <Box x={58} y={26} w={8} h={6} /> <Box x={86} y={26} w={8} h={6} />
          <path d="M66 29 H86" stroke={COPPER} strokeWidth={0.7} />
          <path d="M62 32 V45 H90 V32" stroke={AMP} strokeWidth={0.3} />
          <path d="M66 29 H86 V45 H62 V32 H66 Z" fill={POWER} fillOpacity={0.1} stroke="none" />
        </g>
      </Svg>
      <T x={27} y={40.5} size={2.4} color={MUTED} o={a}>
        摆法 A：安安静静
      </T>
      <T x={76} y={50} size={2.4} color={POWER} o={c}>
        摆法 B：偶尔复位
      </T>
    </>
  )
}

// ── out and back ────────────────────────────────────────────────────────────

function Loop({ t, b, still }: StageProps) {
  const chips = enter(t, b.loop, 0.6)
  const out = enter(t, b.out - 0.2, 0.7)
  const back = enter(t, b.back - 0.2, 0.7)
  const phase = still ? 0 : (t - b.out) * 9
  const top: [number, number][] = [[26, 22], [74, 22]]
  const bot: [number, number][] = [[74, 38], [26, 38]]
  return (
    <>
      <T x={50} y={11} size={3} color={MUTED} o={enter(t, b.loop)}>
        电流只在回路里流
      </T>
      <Svg>
        <Box x={8} y={16} w={18} h={28} o={chips} />
        <Box x={74} y={16} w={18} h={28} o={chips} />
        <path d="M26 22 H74 V38 H26 Z" fill={AMP} fillOpacity={0.07} stroke="none" opacity={back} />
        <Draw d="M26 22 H74" p={out} stroke={COPPER} strokeWidth={0.7} />
        <Draw d="M74 38 H26" p={back} stroke={AMP} strokeWidth={0.4} strokeDasharray="1 0.8" />
        <Dots pts={top} phase={phase} o={out} />
        <Dots pts={bot} phase={phase} o={back} />
      </Svg>
      <T x={17} y={30} size={2.8} weight={500} o={chips}>
        芯片 A
      </T>
      <T x={83} y={30} size={2.8} weight={500} o={chips}>
        芯片 B
      </T>
      <T x={50} y={18} size={2.6} weight={600} color={COPPER} o={out}>
        信号电流，出去
      </T>
      <T x={50} y={42} size={2.6} weight={600} color={AMP} o={back}>
        回流，从地回来
      </T>
    </>
  )
}

// ── the ground plane ────────────────────────────────────────────────────────

const PY0 = 15
const PY1 = 47
const TY = 28

function Plane({ t, b, still }: StageProps) {
  const base = enter(t, b.low - 0.1, 0.6)
  const phase = still ? 0 : t * 10
  // how far the return current spreads: wide at low frequency, tight at high
  const sigma = glide(t, b.high - 0.2, 8, 0.7, 0.9)
  const detour = enter(t, b.slot + 0.5, 0.6)
  const bands = (1 - detour) * base
  const slot = enter(t, b.slot - 0.1, 0.5)
  const area = enter(t, b.area - 0.2, 0.6)
  const offs = [-12, -8, -4, 0, 4, 8, 12]
  const detourPath: [number, number][] = [[82, TY + 1.5], [56, TY + 1.5], [56, 42], [43, 42], [43, TY + 1.5], [18, TY + 1.5]]
  const lowOn = Math.min(enter(t, b.low), 1 - enter(t, b.high - 0.1, 0.4))
  const highOn = Math.min(enter(t, b.high), 1 - enter(t, LINE.slotL + 0.1, 0.4))
  const slotOn = enter(t, LINE.slotL + 0.5)
  const radiate = enter(t, b.ant - 0.2, 0.5)
  return (
    <>
      <T x={50} y={8.5} size={2.8} weight={600} color={lowOn > 0.5 ? undefined : MUTED} o={lowOn} anchor="middle">
        低频：挑电阻最小的路，散开
      </T>
      <T x={50} y={8.5} size={2.8} weight={600} o={highOn}>
        高频：挑电感最小的路，紧贴信号线
      </T>
      <T x={50} y={8.5} size={2.8} weight={600} color={POWER} o={slotOn}>
        地平面被切断：只能绕路
      </T>
      <Svg>
        <rect x={8} y={PY0} width={84} height={PY1 - PY0} rx={1} fill="var(--muted-foreground)" fillOpacity={0.1 * base} stroke="var(--border)" opacity={base} />
        {/* slot */}
        <g opacity={slot}>
          <rect x={47} y={PY0} width={4} height={26} fill="var(--background)" stroke="var(--muted-foreground)" strokeWidth={0.25} strokeDasharray="0.8 0.6" />
        </g>
        {/* loop area between the trace and the detour */}
        <rect x={43} y={TY} width={13} height={14} fill={POWER} fillOpacity={0.22} stroke="none" opacity={area} />
        {/* the return current, spread by frequency */}
        {offs.map((o, i) => {
          const w = 1 / (1 + (o / sigma) ** 2) ** 1.5
          const y = TY + 1.5 + o
          if (Math.abs(o) < 0.1) return null
          return <path key={i} d={`M82 ${y} H18`} stroke={AMP} strokeWidth={0.3} opacity={w * bands} />
        })}
        <path d={`M82 ${TY + 1.5} H18`} stroke={AMP} strokeWidth={0.3 + 0.35 * (1 - sigma / 8)} opacity={bands} />
        {offs.map((o, i) => {
          const w = 1 / (1 + (o / sigma) ** 2) ** 1.5
          return <Dots key={i} pts={[[82, TY + 1.5 + o], [18, TY + 1.5 + o]]} phase={phase * (1 + w)} o={w * bands} spacing={4.5} r={0.45} />
        })}
        <Draw d={detourPath.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(" ")} p={detour} stroke={AMP} strokeWidth={0.45} />
        <Dots pts={detourPath} phase={phase} o={detour} spacing={3.2} />
        {/* chips and the signal trace on top */}
        <g opacity={base}>
          <Box x={10} y={TY - 3.5} w={8} h={7} color="var(--foreground)" />
          <Box x={82} y={TY - 3.5} w={8} h={7} color="var(--foreground)" />
          <path d={`M18 ${TY} H82`} stroke={COPPER} strokeWidth={0.8} />
        </g>
        {/* radiation */}
        {[0, 1, 2].map((i) => {
          const p = still ? 0.5 : ((t * 0.55 + i / 3) % 1)
          return <circle key={i} cx={49.5} cy={35.5} r={4 + p * 11} stroke={POWER} strokeWidth={0.3} opacity={radiate * (1 - p) * 0.8} />
        })}
        {(
          [
            [24, 46, 42, 40.5],
            [24, 38.5, 41.5, 36.5],
          ] as const
        ).map(([x0, y0, x1, y1], i) => {
          const o = enter(t, b.pick + i * 0.2, 0.4)
          const a = Math.atan2(y1 - y0, x1 - x0)
          const hx = (d: number) => x1 - 2.2 * Math.cos(a + d)
          const hy = (d: number) => y1 - 2.2 * Math.sin(a + d)
          return <path key={i} d={`M${x0} ${y0} L${x1} ${y1} M${hx(0.45)} ${hy(0.45)} L${x1} ${y1} L${hx(-0.45)} ${hy(-0.45)}`} stroke={MUTED} opacity={o * 0.9} />
        })}
      </Svg>
      <T x={14} y={TY + 7.8} size={2.2} color={MUTED} o={base}>
        芯片 A
      </T>
      <T x={86} y={TY + 7.8} size={2.2} color={MUTED} o={base}>
        芯片 B
      </T>
      <T x={32} y={TY - 4.6} size={2.2} color={COPPER} o={base}>
        信号线
      </T>
      <T x={86} y={PY1 - 2.4} size={2.2} color={MUTED} o={base}>
        地平面
      </T>
      <T x={65} y={39} size={2.4} weight={600} color={POWER} anchor="start" o={area}>
        回路面积
      </T>
      <T x={65} y={43} size={2.2} color={POWER} anchor="start" o={enter(t, b.rad - 0.2)}>
        向外辐射
      </T>
      <T x={28} y={50.2} size={2.2} color={MUTED} anchor="middle" o={enter(t, b.pick - 0.1)}>
        外面的干扰也会进来
      </T>
    </>
  )
}

// ── decoupling: far cap, droop ──────────────────────────────────────────────

function Surge({ t, b, still }: StageProps) {
  const cx = glide(t, b.far - 0.2, 30, 8, 0.8)
  const far = enter(t, b.far, 0.6)
  const chip = enter(t, LINE.surgeL + 0.1, 0.6)
  const phase = still ? 0 : t * 12
  const spike = enter(t, b.spike - 0.1, 0.8)
  const wave = "M64 22 H72 L74 29 L77 24 L80 22 H92"
  return (
    <>
      <T x={25} y={11} size={2.8} color={MUTED} o={enter(t, LINE.surgeL + 0.1)}>
        电源脚旁的去耦电容
      </T>
      <T x={78} y={11} size={2.8} color={MUTED} o={enter(t, b.spike - 0.3)}>
        电源脚上的电压
      </T>
      <Svg>
        <Box x={36} y={22} w={14} h={16} o={chip} />
        <path d="M4 30 H36" stroke={COPPER} strokeWidth={0.8} opacity={chip} />
        <path d="M4 44 H50" stroke="var(--muted-foreground)" strokeWidth={0.5} opacity={chip} />
        <g opacity={chip}>
          <path d={`M${cx} 30 V35.5 M${cx - 2} 35.5 H${cx + 2} M${cx - 2} 37.5 H${cx + 2} M${cx} 37.5 V44`} />
        </g>
        <Dots pts={[[cx, 30], [36, 30]]} phase={phase} o={enter(t, b.surge)} spacing={2.4} />
        {/* the trace between cap and pin, as an inductance bracket */}
        <g opacity={far} stroke={POWER} strokeWidth={0.3}>
          <path d={`M${cx} 25 H36 M${cx} 24 V26 M36 24 V26`} />
        </g>
        <Draw d={wave} p={spike} stroke={POWER} strokeWidth={0.5} />
        <path d="M64 22 H92" stroke="var(--border)" strokeWidth={0.2} strokeDasharray="0.8 0.8" opacity={enter(t, b.spike - 0.3)} />
      </Svg>
      <T x={43} y={30} size={2.4} color={MUTED} o={chip}>
        芯片
      </T>
      <T x={(cx + 36) / 2} y={20.8} size={2.4} weight={600} color={POWER} o={far}>
        走线电感 L
      </T>
      <T x={62} y={22} size={2.2} color={MUTED} anchor="end" o={enter(t, b.spike - 0.3)} className="tabular">
        3.3 V
      </T>
      <T x={82} y={31} size={2.8} weight={600} color={POWER} anchor="start" o={enter(t, b.vv - 0.1)} className="tabular">
        <M>− 0.2 V</M>
      </T>
      <T x={12} y={49.5} size={2.8} weight={600} o={enter(t, b.ten - 0.1)} anchor="middle" className="tabular">
        <span style={{ color: POWER }}>
          <M>L ≈ 10 nH</M>
        </span>
      </T>
      <T x={33} y={49.5} size={2.8} weight={600} o={enter(t, b.hund - 0.1)} className="tabular">
        <span style={{ color: AMP }}>
          <M>ΔI = 100 mA</M>
        </span>
      </T>
      {/* "跳变": the jump takes a few ns, which is what makes 10 nH × 100 mA come to 0.2 V */}
      <T x={53} y={49.5} size={2.8} weight={600} o={enter(t, b.hund + 0.9)} className="tabular">
        <M>Δt ≈ 5 ns</M>
      </T>
      <T x={80} y={49.5} size={2.6} weight={600} o={enter(t, b.vv - 0.1)} className="tabular">
        <M>V = L · ΔI/Δt ≈ 0.2 V</M>
      </T>
    </>
  )
}

// ── good placement ──────────────────────────────────────────────────────────

function Rules({ t, b, still }: StageProps) {
  const chip = enter(t, b.rules, 0.6)
  const cx = glide(t, b.close - 0.3, 14, 37, 0.7)
  const fat = enter(t, b.short - 0.1, 0.6)
  const hole = enter(t, b.hole - 0.1, 0.6)
  const phase = still ? 0 : t * 12
  return (
    <>
      <T x={50} y={11} size={2.8} color={MUTED} o={enter(t, b.rules)}>
        去耦电容的摆法
      </T>
      <Svg>
        <Box x={44} y={19} w={18} h={20} o={chip} />
        <rect x={6} y={24 - lerp(0.35, 1.4, fat)} width={38} height={lerp(0.7, 2.8, fat)} fill={COPPER} fillOpacity={0.8} stroke="none" opacity={chip} />
        <g opacity={chip}>
          <path d={`M${cx} 25.4 V28.6 M${cx - 2.2} 28.6 H${cx + 2.2} M${cx - 2.2} 30.4 H${cx + 2.2} M${cx} 30.4 V33`} />
        </g>
        <path d="M6 45 H94" stroke="var(--muted-foreground)" strokeWidth={0.5} opacity={chip} />
        <rect x={6} y={45} width={88} height={3.2} fill="var(--muted-foreground)" fillOpacity={0.15} stroke="none" opacity={chip} />
        <Draw d={`M${cx} 33 V45`} p={hole} stroke={COPPER} strokeWidth={0.6} />
        <circle cx={cx} cy={36} r={1.5} fill="var(--background)" stroke={AMP} opacity={hole} />
        <Dots pts={[[6, 24], [44, 24]]} phase={phase} o={chip} spacing={3} />
        <g opacity={enter(t, b.close, 0.4)} stroke={GOOD} strokeWidth={0.3}>
          <path d="M37 21 H44 M37 20 V22 M44 20 V22" />
        </g>
      </Svg>
      <T x={53} y={29} size={2.4} color={MUTED} o={chip}>
        芯片
      </T>
      <T x={7} y={50.8} size={2.2} color={MUTED} anchor="start" o={chip}>
        地平面
      </T>
      <T x={40.5} y={16.8} size={2.6} weight={600} color={GOOD} o={enter(t, b.close)}>
        紧贴电源脚
      </T>
      <T x={20} y={19.5} size={2.6} weight={600} color={COPPER} o={enter(t, b.short)}>
        走线短而粗
      </T>
      <T x={39.5} y={41.8} size={2.6} weight={600} anchor="start" color={AMP} o={enter(t, b.hole)}>
        地端就近打孔
      </T>
    </>
  )
}

// ── source, path, victim ────────────────────────────────────────────────────

function Three({ t, b, still }: StageProps) {
  const items: [string, string, number, number, string][] = [
    ["干扰源", "开关电源、时钟、电机", 18, b.src, POWER],
    ["耦合路径", "公共地线、平行走线、空间", 50, b.cp, COPPER],
    ["受害者", "小信号、ADC、复位脚", 82, b.vic, AMP],
  ]
  const cut = enter(t, b.cutit, 0.5)
  return (
    <>
      <T x={50} y={11} size={3} color={MUTED} o={enter(t, b.emc)}>
        干扰的三个要素
      </T>
      <Svg>
        {items.map(([, , x, at, c], i) => (
          <Box key={x} x={x - 12} y={20} w={24} h={12} o={(0.3 + 0.7 * enter(t, at - 0.1, 0.5)) * (i === 1 ? 1 - 0.55 * cut : 1)} color={i === 1 && cut > 0.5 ? undefined : c} dash={i === 1 && cut > 0.5 ? "1 0.8" : undefined} fill={i === 2 ? 0.1 * cut : 0.08} />
        ))}
        <g stroke="var(--muted-foreground)">
          <path d="M31 26 H37 M34.5 23.8 L37 26 L34.5 28.2" opacity={enter(t, b.cp - 0.2) * (1 - 0.7 * cut)} />
          <path d="M63 26 H69 M66.5 23.8 L69 26 L66.5 28.2" opacity={enter(t, b.vic - 0.2) * (1 - 0.7 * cut)} />
        </g>
        <g opacity={cut} stroke={GOOD} strokeWidth={0.5}>
          <path d="M44 22 L56 30 M56 22 L44 30" stroke={POWER} />
        </g>
        <Check x={74.4} y={41.2} p={cut} r={1.5} />
      </Svg>
      {items.map(([k, ex, x, at]) => (
        <React.Fragment key={k}>
          <T x={x} y={26} size={3.2} weight={600} o={enter(t, at) * (k === "耦合路径" ? 1 - 0.5 * cut : 1)}>
            {k}
          </T>
          <T x={x} y={36.5} size={2.2} color={MUTED} o={enter(t, at + 0.3)}>
            {ex}
          </T>
        </React.Fragment>
      ))}
      <T x={50} y={47} size={3.4} weight={600} color={GOOD} o={cut} dy={still ? 0 : (1 - cut) * 1}>
        去掉任何一个，干扰就解决了
      </T>
      <T x={82} y={41} size={2.4} color={GOOD} o={cut}>
        不再被干扰
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "布局、接地与 EMC",
  audio,
  timing,
  poster: 6.2,
  Stage,
}

export default function LayoutEmcFilm() {
  return <FilmPlayer film={film} />
}

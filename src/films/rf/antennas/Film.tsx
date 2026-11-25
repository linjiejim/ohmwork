import { trace } from "@/lab/colors"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, M, Scene, Svg, T, V, easeInOut, enter, glide, lerp, span, type FilmDef, type StageProps } from "../../kit"
import { MUTED, Outro, riseOf, sinePath } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

const VOLT = trace.voltage
const AMP = trace.current
const FG = "var(--foreground)"
const TAU = Math.PI * 2

/*
 * 天线, ~60 s. Scenes, each keyed to the words that introduce it:
 *   title (circuit → antenna → space) → a pair of wires splays open into a dipole
 *   → the standing-wave current on it → half a wavelength resonates
 *   → half of it replaced by a ground plane (monopole) → 433 MHz: 69 cm wave, 16 cm antenna
 *   → the dipole's doughnut pattern → gain is focusing → keep-out on a PCB → "drag the slider".
 */
function Stage({ t, b, still }: StageProps) {
  const rise = riseOf(t, still)
  // the old scene has faded out by the time the next line starts and the new one fades in from there,
  // so two scenes never sit on top of each other
  const sc = (a: number, z: number) => span(t, a - 0.05, z - 0.3, 0.35, 0.3)
  const title = span(t, 0.25, b.dipole - 0.3, 0.4, 0.3)
  const dipole = sc(b.dipole, b.standing)
  const standing = sc(b.standing, b.half)
  const half = sc(b.half, b.mono)
  const mono = sc(b.mono, b.calc)
  const calc = sc(b.calc, b.pattern)
  const pattern = sc(b.pattern, b.gain)
  const gain = sc(b.gain, b.pcb)
  const pcb = sc(b.pcb, b.outro)

  return (
    <>
      <Scene o={title}>
        <T x={50} y={13} size={8} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
          天线
        </T>
        <T x={50} y={22} size={3} color={MUTED} o={enter(t, b.intro + 1.1)} dy={rise(b.intro + 1.1, 1)}>
          电路和空间之间的接口
        </T>
        <Title t={t} b={b} still={still} />
      </Scene>
      <Scene o={dipole}>
        <Dipole t={t} b={b} still={still} />
      </Scene>
      <Scene o={standing}>
        <Standing t={t} b={b} still={still} />
      </Scene>
      <Scene o={half}>
        <Half t={t} b={b} still={still} />
      </Scene>
      <Scene o={mono}>
        <Mono t={t} b={b} still={still} />
      </Scene>
      <Scene o={calc}>
        <Calc t={t} b={b} still={still} />
      </Scene>
      <Scene o={pattern}>
        <Pattern t={t} b={b} still={still} />
      </Scene>
      <Scene o={gain}>
        <Gain t={t} b={b} still={still} />
      </Scene>
      <Scene o={pcb}>
        <Pcb t={t} b={b} still={still} />
      </Scene>

      <Outro t={t} b={b} still={still} hint="拖动下面的频率滑块，看天线多长" />
    </>
  )
}

/** Arcs of field leaving a point, drawn on the right half-plane. */
function Rings({ t, cx, cy, at, still, max = 62, a = 0.95 }: { t: number; cx: number; cy: number; at: number; still: boolean; max?: number; a?: number }) {
  const P = 0.9
  return (
    <>
      {Array.from({ length: 8 }, (_, k) => {
        const age = still ? 5 + k * 3 : t - at - k * P
        if (age <= 0) return null
        const r = age * 11
        const fade = Math.max(0, 1 - r / max) * Math.min(1, age / 0.3)
        if (fade <= 0.01) return null
        return <path key={k} d={`M${cx + r * Math.cos(a)} ${cy - r * Math.sin(a)} A${r} ${r} 0 0 1 ${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`} stroke={VOLT} strokeWidth={0.4} opacity={0.75 * fade} />
      })}
    </>
  )
}

function Title({ t, b, still }: StageProps) {
  const e = enter(t, b.intro + 0.5, 0.6)
  const cx = 46
  const flow = still ? 0 : (t * 14) % 6
  return (
    <>
      <Svg>
        <g opacity={e}>
          <rect x={6} y={36} width={14} height={10} rx={1} />
          <path d={`M20 41 H${cx}`} />
          {!still && [0, 1, 2].map((i) => <circle key={i} cx={20 + ((flow + i * 6) % 18)} cy={41} r={0.55} fill={AMP} stroke="none" />)}
          <path d={`M${cx} 41 V29 M${cx} 35 L${cx - 5} 29 M${cx} 35 L${cx + 5} 29`} strokeWidth={0.5} />
        </g>
        <Rings t={t} cx={cx} cy={35} at={b.intro + 2.2} still={still} max={40} a={0.42} />
      </Svg>
      <T x={13} y={50.5} size={2.4} color={MUTED} o={enter(t, b.intro + 0.8)}>
        电路
      </T>
      <T x={90} y={42} size={2.4} color={VOLT} o={enter(t, b.intro + 3.4)}>
        空间
      </T>
    </>
  )
}

// ── wires splay into a dipole ────────────────────────────────────────────────

function Dipole({ t, b, still }: StageProps) {
  const rise = riseOf(t, still)
  const p = still ? (t > b.open ? 1 : 0) : easeInOut((t - b.open) / 1.4)
  const a = (p * Math.PI) / 2
  const L = 15
  const fx = 46
  const y = 28
  const topEnd: [number, number] = [fx + L * Math.cos(a), y - 1 - L * Math.sin(a)]
  const botEnd: [number, number] = [fx + L * Math.cos(a), y + 1 + L * Math.sin(a)]
  // the legs rotate about the end of the wires: a quarter turn each
  return (
    <>
      <Svg>
        <g opacity={enter(t, b.dipole, 0.5)} strokeWidth={0.5}>
          <path d={`M10 ${y - 1} H${fx} M10 ${y + 1} H${fx}`} />
          <path d={`M${fx} ${y - 1} L${topEnd[0]} ${topEnd[1]}`} />
          <path d={`M${fx} ${y + 1} L${botEnd[0]} ${botEnd[1]}`} />
        </g>
        {!still && (
          <g opacity={enter(t, b.dipole + 0.6, 0.5)}>
            {[0, 1, 2, 3].map((i) => (
              <circle key={i} cx={10 + ((t * 9 + i * 9) % 36)} cy={y - 1} r={0.55} fill={AMP} stroke="none" />
            ))}
          </g>
        )}
      </Svg>
      <T x={26} y={y - 7} size={2.6} color={MUTED} o={enter(t, b.dipole + 0.4)}>
        一对平行导线
      </T>
      <T x={78} y={y} size={5.2} weight={600} o={enter(t, b.dip, 0.5)} dy={rise(b.dip, 1)}>
        偶极子
      </T>
      <T x={78} y={y + 7} size={2.4} color={MUTED} o={enter(t, b.dip + 0.4)}>
        dipole
      </T>
    </>
  )
}

// ── standing wave of current ─────────────────────────────────────────────────

function Standing({ t, b, still }: StageProps) {
  const rise = riseOf(t, still)
  const x = 34
  const top = 8
  const bot = 48
  const mid = 28
  const s = still ? 0.8 : Math.sin(t * 5)
  const pts: string[] = []
  for (let yy = top; yy <= bot + 1e-6; yy += 1) pts.push(`${pts.length ? "L" : "M"}${x + 11 * Math.cos((Math.PI * (yy - mid)) / (bot - top)) * s} ${yy}`)
  const env = (sg: number) => {
    const q: string[] = []
    for (let yy = top; yy <= bot + 1e-6; yy += 1) q.push(`${q.length ? "L" : "M"}${x + sg * 11 * Math.cos((Math.PI * (yy - mid)) / (bot - top))} ${yy}`)
    return q.join("")
  }
  const e = enter(t, b.standing, 0.5)
  const r = enter(t, b.refl - 0.2, 0.4)
  const m = enter(t, b.mid - 0.2, 0.4)
  return (
    <>
      <Svg>
        <path d={`M${x} ${top} V${bot}`} strokeWidth={0.55} opacity={e} />
        <g opacity={e * 0.5} stroke="var(--border)" strokeWidth={0.2} strokeDasharray="0.8 0.9">
          <path d={env(1)} />
          <path d={env(-1)} />
        </g>
        <path d={pts.join("")} stroke={AMP} strokeWidth={0.5} opacity={e} />
        <g opacity={r} strokeWidth={0.4}>
          <path d={`M${x + 5} ${top + 1} A3 3 0 1 0 ${x + 1} ${top + 4.5} M${x + 1.6} ${top + 3.3} l-0.8 1.4 l1.6 0.3`} />
          <path d={`M${x + 5} ${bot - 1} A3 3 0 1 1 ${x + 1} ${bot - 4.5} M${x + 1.6} ${bot - 3.3} l-0.8 -1.4 l1.6 -0.3`} />
        </g>
      </Svg>
      <T x={x + 10} y={top - 0.5} size={2.6} anchor="start" color={MUTED} o={r} dy={rise(b.refl, 1)}>
        到头被反弹，端点电流为 0
      </T>
      <T x={x + 22} y={mid} size={4} anchor="start" weight={600} color={AMP} o={m} dy={rise(b.mid, 1)}>
        中间最大
      </T>
      <T x={x + 22} y={mid + 6} size={2.4} anchor="start" color={MUTED} o={m}>
        驻波
      </T>
    </>
  )
}

// ── half a wavelength ────────────────────────────────────────────────────────

function Half({ t, b, still }: StageProps) {
  const rise = riseOf(t, still)
  const x = 36
  const top = 8
  const bot = 46
  const mid = 27
  const hl = enter(t, b.hlf, 0.6)
  const res = enter(t, b.res, 0.5)
  const pulse = still ? 0 : 0.5 + 0.5 * Math.sin(t * 5)
  return (
    <>
      <Svg>
        <path d={`M${x} ${top} V${bot}`} strokeWidth={0.55} opacity={enter(t, b.half, 0.5)} />
        <g opacity={hl} strokeWidth={0.35}>
          <path d={`M${x + 8} ${top} V${bot} M${x + 6.5} ${top} H${x + 9.5} M${x + 6.5} ${bot} H${x + 9.5}`} />
        </g>
        <path d={`M${x + 1} ${mid - 3} A2.5 2.5 0 0 1 ${x + 1} ${mid + 3}`} opacity={0} />
        <g opacity={res}>
          <circle cx={x} cy={mid} r={2.2 + 2.5 * pulse} stroke={VOLT} strokeWidth={0.35} opacity={0.8 - 0.5 * pulse} />
          <circle cx={x} cy={mid} r={0.9} fill={VOLT} stroke="none" />
        </g>
        <path d={`M8 ${mid} H${x - 1.5}`} opacity={enter(t, b.half, 0.5)} />
        {!still && res > 0.01 && [0, 1, 2].map((i) => <circle key={i} cx={8 + ((t * 10 + i * 9) % 26)} cy={mid} r={0.55} fill={AMP} stroke="none" opacity={res} />)}
      </Svg>
      <T x={x + 11} y={top + 5} size={3.4} anchor="start" weight={600} color={VOLT} o={hl} dy={rise(b.hlf, 1)}>
        <V>λ</V>/2
      </T>
      <T x={x + 11} y={top + 11} size={2.4} anchor="start" color={MUTED} o={hl}>
        半个波长
      </T>
      <T x={72} y={22} size={6} weight={600} color={VOLT} o={res} dy={rise(b.res, 1)}>
        谐振
      </T>
      <T x={72} y={31} size={2.8} color={MUTED} o={res} dy={rise(b.res, 1)}>
        能量最容易送进去
      </T>
    </>
  )
}

// ── monopole ─────────────────────────────────────────────────────────────────

function Mono({ t, b, still }: StageProps) {
  const rise = riseOf(t, still)
  const x = 36
  const gy = 29
  const ghost = enter(t, b.cut, 0.7)
  const ground = enter(t, b.ground, 0.6)
  const q = enter(t, b.quarter - 0.1, 0.5)
  const hatch = Array.from({ length: 12 }, (_, i) => `M${x - 20 + i * 3.6} ${gy + 0.5} l-2.4 2.4`).join("")
  return (
    <>
      <Svg>
        <path d={`M${x} ${gy - 20} V${gy}`} strokeWidth={0.55} />
        <path d={`M${x} ${gy} V${gy + 20}`} strokeWidth={0.55} opacity={1 - 0.75 * ghost} strokeDasharray={ghost > 0.5 ? "1 1" : undefined} />
        <g opacity={ground}>
          <Draw d={`M${x - 22} ${gy} H${x + 22}`} p={ground} strokeWidth={0.7} />
          <path d={hatch} strokeWidth={0.2} />
        </g>
        <g opacity={q} strokeWidth={0.35}>
          <path d={`M${x + 8} ${gy - 20} V${gy} M${x + 6.5} ${gy - 20} H${x + 9.5} M${x + 6.5} ${gy} H${x + 9.5}`} />
        </g>
      </Svg>
      <T x={x + 13} y={gy - 10} size={3.2} anchor="start" weight={600} color={VOLT} o={q} dy={rise(b.quarter, 1)}>
        <V>λ</V>/4
      </T>
      <T x={x + 13} y={gy - 4.5} size={2.4} anchor="start" color={MUTED} o={q}>
        四分之一波长
      </T>
      <T x={x - 25} y={gy + 11} size={2.4} anchor="end" color={MUTED} o={ground}>
        镜像
      </T>
      <T x={x - 25} y={gy - 3.5} size={2.4} anchor="end" weight={500} o={ground} dy={rise(b.ground, 1)}>
        地平面
      </T>
      <T x={78} y={22} size={5.6} weight={600} o={enter(t, b.monon, 0.5)} dy={rise(b.monon, 1)}>
        单极子
      </T>
      <T x={78} y={30} size={2.4} color={MUTED} o={enter(t, b.monon + 0.3)}>
        monopole
      </T>
    </>
  )
}

// ── the length of a 433 MHz antenna ──────────────────────────────────────────

function Calc({ t, b, still }: StageProps) {
  const rise = riseOf(t, still)
  const x0 = 10
  const W = 80
  const L = W * (16.4 / 69.1)
  return (
    <>
      <T x={50} y={8} size={3.8} weight={600} color={AMP} o={enter(t, b.calc)} dy={rise(b.calc, 1)}>
        <M>433 MHz</M>
      </T>
      <Svg>
        <path d={sinePath(x0, x0 + W, 23, 5, W, still ? 0 : t * 0.15)} stroke={VOLT} strokeWidth={0.45} opacity={enter(t, b.calc + 0.2, 0.6)} />
        <g opacity={enter(t, b.wl - 0.3, 0.5)} strokeWidth={0.35}>
          <path d={`M${x0} 31 V35 M${x0 + W} 31 V35 M${x0} 33 H${x0 + W}`} />
        </g>
        <g opacity={enter(t, b.len - 0.3, 0.5)}>
          <path d={`M${x0} 47 H${x0 + L}`} strokeWidth={0.9} />
          <path d={`M${x0 + L} 45 V49`} strokeWidth={0.3} />
        </g>
      </Svg>
      <T x={x0 + W / 2} y={39} size={4.4} weight={600} color={VOLT} o={enter(t, b.wl)} dy={rise(b.wl, 1)}>
        波长 <M>69 cm</M>
      </T>
      <T x={x0 + L + 4} y={47} size={4.4} anchor="start" weight={600} o={enter(t, b.len)} dy={rise(b.len, 1)}>
        <M>16 cm</M>
      </T>
      <T x={x0 + L + 4} y={52} size={2.2} anchor="start" color={MUTED} o={enter(t, b.len + 0.4)}>
        <M>0.95 × λ/4</M>
      </T>
    </>
  )
}

// ── radiation pattern ────────────────────────────────────────────────────────

/** Half-wave dipole power pattern along direction φ measured from the +x axis (antenna along y). */
function dipoleR(phi: number) {
  const c = Math.cos(phi)
  if (Math.abs(c) < 1e-3) return 0
  const v = Math.cos((Math.PI / 2) * Math.sin(phi)) / c
  return v * v
}

function polar(cx: number, cy: number, f: (phi: number) => number, n = 120) {
  const pts: string[] = []
  for (let i = 0; i <= n; i++) {
    const phi = (i / n) * TAU
    const r = f(phi)
    pts.push(`${i ? "L" : "M"}${(cx + r * Math.cos(phi)).toFixed(2)} ${(cy - r * Math.sin(phi)).toFixed(2)}`)
  }
  return pts.join("") + "Z"
}

function Pattern({ t, b, still }: StageProps) {
  const rise = riseOf(t, still)
  // centred while it is the only thing on the stage, then makes room for the doughnut
  const cx = still ? 27 : glide(t, b.pat - 0.9, 50, 27, 0.8)
  const cy = 29
  const breathe = still ? 1 : 1 + 0.03 * Math.sin(t * 3)
  const left = enter(t, b.pat - 0.2, 0.7)
  const right = enter(t, b.donut - 0.2, 0.7)
  const R = 21 * breathe
  const dx = 74
  const dy = 29
  return (
    <>
      <Svg>
        <g opacity={enter(t, b.pattern, 0.6)}>
          <circle cx={cx} cy={cy} r={14} strokeWidth={0.3} strokeDasharray="1 1" opacity={1 - 0.75 * left} />
          <path d={`M${cx} ${cy - 13} V${cy + 13}`} strokeWidth={0.7} />
        </g>
        <g opacity={left}>
          <circle cx={cx} cy={cy} r={21} strokeWidth={0.15} stroke="var(--border)" />
          <circle cx={cx} cy={cy} r={10.5} strokeWidth={0.15} stroke="var(--border)" />
          <path d={polar(cx, cy, (phi) => R * dipoleR(phi))} stroke={VOLT} strokeWidth={0.5} fill={VOLT} fillOpacity={0.14} />
        </g>
        <g opacity={right}>
          <ellipse cx={dx} cy={dy} rx={20} ry={8.5} stroke={VOLT} strokeWidth={0.5} />
          <ellipse cx={dx} cy={dy} rx={6.5} ry={2.4} stroke={VOLT} strokeWidth={0.4} />
          <path d={`M${dx - 20} ${dy} A20 8.5 0 0 0 ${dx + 20} ${dy}`} strokeWidth={0} />
          <path d={`M${dx} ${dy - 14} V${dy + 14}`} strokeWidth={0.7} />
          <ellipse cx={dx} cy={dy} rx={13} ry={5.4} stroke={VOLT} strokeWidth={0.2} opacity={0.5} />
        </g>
      </Svg>
      <T x={cx} y={8} size={3} weight={500} o={enter(t, b.pattern, 0.5)} dy={rise(b.pattern, 1)}>
        偶极子的方向图
      </T>
      <T x={cx} y={51} size={2.4} color={MUTED} o={enter(t, b.pattern + 0.5)}>
        {/* one line out, then the other in: never both at once */}
        <span style={{ opacity: 1 - enter(t, b.pat - 0.3, 0.3) }}>虚线：均匀辐射（天线做不到）</span>
        <span style={{ opacity: enter(t, b.pat + 0.1, 0.4), position: "absolute", left: 0, right: 0, textAlign: "center" }}>顺着天线的方向：零</span>
      </T>
      <T x={dx} y={8} size={3} weight={500} o={right} dy={rise(b.donut, 1)}>
        整体像甜甜圈
      </T>
      <T x={dx} y={51} size={2.4} color={MUTED} o={right}>
        垂直于天线最强
      </T>
    </>
  )
}

// ── gain is focusing ─────────────────────────────────────────────────────────

function Gain({ t, b, still }: StageProps) {
  const rise = riseOf(t, still)
  const cx = 28
  const cy = 29
  const m = still ? (t > b.focus ? 1 : 0) : easeInOut((t - b.focus) / 1.3)
  const e = enter(t, b.gain - 0.1, 0.6)
  const beam = (phi: number) => {
    const c = Math.cos(phi)
    return c > 0 ? 25 * c ** 12 : 0
  }
  const f = (phi: number) => lerp(15 * dipoleR(phi) ** 0.9, beam(phi), m)
  const db = lerp(2.15, 8, m)
  return (
    <>
      <Svg>
        <g opacity={e}>
          <circle cx={cx} cy={cy} r={25} strokeWidth={0.15} stroke="var(--border)" />
          <path d={polar(cx, cy, f)} stroke={VOLT} strokeWidth={0.5} fill={VOLT} fillOpacity={0.14} />
          <path d={`M${cx} ${cy - 6} V${cy + 6}`} strokeWidth={0.7} opacity={1 - m} />
          <circle cx={cx} cy={cy} r={0.9} fill={FG} stroke="none" />
        </g>
      </Svg>
      <T x={76} y={17} size={2.8} color={MUTED} o={e} dy={rise(b.gain, 1)}>
        增益
      </T>
      <T x={76} y={27} size={8} weight={600} color={VOLT} o={e} className="tabular">
        {m < 0.02 ? "2.15" : m > 0.98 ? "8" : db.toFixed(1)}
      </T>
      <T x={76} y={36} size={3} color={MUTED} o={e}>
        dBi
      </T>
      <T x={76} y={46} size={2.8} weight={600} o={enter(t, b.focus + 0.5)} dy={rise(b.focus + 0.5, 1)}>
        不是放大，是集中
      </T>
    </>
  )
}

// ── on the board ─────────────────────────────────────────────────────────────

function Pcb({ t, b, still }: StageProps) {
  const rise = riseOf(t, still)
  const board = enter(t, b.pcb, 0.7)
  const clear = enter(t, b.clear - 0.2, 0.5)
  const cop = enter(t, b.copper - 0.1, 0.5)
  const pulse = still ? 1 : 0.7 + 0.3 * Math.sin(t * 5)
  const fill = "color-mix(in srgb, var(--foreground) 9%, transparent)"
  return (
    <>
      <Svg>
        <g opacity={board}>
          <rect x={8} y={8} width={80} height={38} rx={1} strokeWidth={0.4} />
          <rect x={8} y={8} width={42} height={38} stroke="none" fill={fill} />
          <rect x={50} y={34} width={38} height={12} stroke="none" fill={fill} />
          <rect x={20} y={20} width={16} height={12} rx={0.8} fill="var(--background)" />
          <path d="M36 26 H44 V19 H50" />
          {/* a meander antenna in the corner of the board with nothing under it */}
          <path d="M50 19 H54 V13 H58 V19 H62 V13 H66 V19 H70 V13 H74 V19 H83" stroke={VOLT} strokeWidth={0.5} />
        </g>
        <rect x={49.5} y={6.5} width={41} height={26.5} rx={1} strokeWidth={0.4} strokeDasharray="1.2 1" opacity={clear * pulse} stroke={VOLT} />
        <g opacity={cop} stroke={trace.power} strokeWidth={0.45}>
          <rect x={53} y={24} width={13} height={6} rx={0.4} fill={trace.power} fillOpacity={0.2} />
          <path d="M55 25.5 L64 28.5 M64 25.5 L55 28.5" />
        </g>
      </Svg>
      <T x={28} y={14} size={2.4} color={MUTED} o={board}>
        铺铜的地
      </T>
      <T x={28} y={36} size={2.4} color={MUTED} o={board}>
        模块
      </T>
      <T x={70} y={4} size={3} weight={600} color={VOLT} o={clear} dy={rise(b.clear, 1)}>
        净空：所有层都留空
      </T>
      <T x={50} y={51} size={2.8} weight={600} color={trace.power} o={cop} dy={rise(b.copper, 1)}>
        铜、走线、元件，别靠近
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "天线",
  audio,
  timing,
  poster: 4.6,
  Stage,
}

export default function AntennasFilm() {
  return <FilmPlayer film={film} />
}

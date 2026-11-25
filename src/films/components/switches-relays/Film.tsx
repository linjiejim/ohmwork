import { Bjt, Diode, Fuse, Inductor, Lamp, Resistor, Source, Switch } from "@/lab/schematic"
import { trace } from "@/lab/colors"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, Scene, Svg, Sym, T, easeInOut, enter, glide, lerp, span, type FilmDef, type StageProps } from "../../kit"
import { AMP, BatteryV, FG, Ground, LoopFlow, MUTED, POWER, VOLT, integ } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

const FIELD = trace.fourth
const GOOD = trace.good

/*
 * 开关、继电器与保护元件, ~67 s. Scenes, each keyed to the words that introduce it:
 *   title → a switch, a relay, a fuse
 *   → pole and throw on one SPDT, then the three kinds side by side (the lever keeps flipping)
 *   → a relay: coil pulls the armature, the contact closes, the lamp lights; nothing but magnetism crosses the gap
 *   → the driver: pin → transistor → coil, with the freewheel diode
 *   → a fuse in series that blows; a TVS in parallel that clips a spike
 *   → what a fuse does not protect → "try it below".
 */
function Stage({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.6) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)
  const lift = (at: number) => (still ? 0 : -easeInOut((t - at) / 0.45) * 2)

  const title = span(t, 0.25, b.pole - 0.15, 0.4, 0.3)
  const kinds = span(t, b.pole - 0.3, b.coil - 0.15, 0.3, 0.3)
  const relay = span(t, b.coil - 0.3, b.drive - 0.15, 0.3, 0.3)
  const drive = span(t, b.drive - 0.3, b.fuse - 0.15, 0.3, 0.3)
  const fuse = span(t, b.fuse - 0.3, b.tvs - 0.15, 0.3, 0.3)
  const tvs = span(t, b.tvs - 0.3, b.warn - 0.15, 0.3, 0.3)
  const warn = span(t, b.warn - 0.3, b.outro - 0.15, 0.3, 0.3)
  const outro = enter(t, b.outro - 0.3, 0.4)

  return (
    <>
      <Scene o={title} dy={lift(b.pole - 0.45)}>
        <Title t={t} b={b} still={still} rise={rise} />
      </Scene>
      <Scene o={kinds}>
        <Kinds t={t} b={b} still={still} />
      </Scene>
      <Scene o={relay}>
        <Relay t={t} b={b} still={still} />
      </Scene>
      <Scene o={drive}>
        <Drive t={t} b={b} rise={rise} />
      </Scene>
      <Scene o={fuse}>
        <FuseScene t={t} b={b} still={still} />
      </Scene>
      <Scene o={tvs}>
        <Tvs t={t} b={b} rise={rise} />
      </Scene>
      <Scene o={warn}>
        <Warn t={t} b={b} rise={rise} />
      </Scene>
      <Scene o={outro}>
        <T x={50} y={24} size={6} weight={600} dy={rise(b.outro - 0.3)}>
          动手试试
        </T>
        <T x={50} y={32.5} size={2.8} color={MUTED} o={enter(t, b.go)} dy={rise(b.go, 1)}>
          在下面的实验台里给线圈通电，看触点怎么动
        </T>
        <Svg>
          <g opacity={enter(t, b.go + 0.3)} transform={`translate(0 ${still ? 0 : Math.sin(t * 3.2) * 0.6})`} strokeWidth={0.45}>
            <path d="M50 38 V45 M47.6 42.6 L50 45 L52.4 42.6" />
          </g>
        </Svg>
      </Scene>
    </>
  )
}

type Rise = (at: number, d?: number) => number

// ── title ────────────────────────────────────────────────────────────────────

function Title({ t, b, still, rise }: { t: number; b: Record<string, number>; still: boolean; rise: Rise }) {
  const a = enter(t, b.sw - 0.1, 0.5)
  const r = enter(t, b.relay - 0.1, 0.5)
  const p = enter(t, b.prot - 0.1, 0.5)
  const flip = still ? 0 : (Math.sin(t * 2.4) > 0 ? 1 : 0)
  return (
    <>
      <T x={50} y={10} size={6.4} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
        开关、继电器与保护元件
      </T>
      <Svg>
        <g opacity={a}>
          <Sym x={20} y={26} scale={0.42}>
            <Switch x={0} y={0} closed={flip === 1} />
          </Sym>
        </g>
        <g opacity={r}>
          <Sym x={50} y={21.5} scale={0.3}>
            <Inductor x={0} y={0} />
          </Sym>
          <path d="M47 25 v2.2 M50 25 v2.2 M53 25 v2.2" stroke={FIELD} strokeWidth={0.28} strokeDasharray="0.6 0.5" />
          <Sym x={50} y={31} scale={0.3}>
            <Switch x={0} y={0} closed />
          </Sym>
        </g>
        <g opacity={p}>
          <Sym x={80} y={26} scale={0.42}>
            <Fuse x={0} y={0} />
          </Sym>
        </g>
      </Svg>
      <T x={20} y={38} size={3.2} weight={600} o={a}>
        开关
      </T>
      <T x={20} y={44} size={2.4} color={MUTED} o={enter(t, b.sw + 0.4, 0.5)}>
        管通断
      </T>
      <T x={50} y={38} size={3.2} weight={600} o={r}>
        继电器
      </T>
      <T x={50} y={44} size={2.4} color={MUTED} o={enter(t, b.relay + 0.4, 0.5)}>
        小电路控制大电路
      </T>
      <T x={80} y={38} size={3.2} weight={600} o={p}>
        保护元件
      </T>
      <T x={80} y={44} size={2.4} color={MUTED} o={enter(t, b.prot + 0.4, 0.5)}>
        出事先牺牲
      </T>
    </>
  )
}

// ── pole and throw ───────────────────────────────────────────────────────────

/** 0 → 1 → 0 … : which throw the lever is on, with a quick move at the start of each period. */
function lever(t: number, t0: number, period: number) {
  const k = (t - t0) / period
  if (k < 0) return 0
  const n = Math.floor(k)
  const f = Math.min(1, (k - n) / 0.12)
  const to = n % 2 === 0 ? 0 : 1
  const from = n === 0 ? 0 : 1 - to
  return lerp(from, to, easeInOut(f))
}

/** One switch drawn in its own coordinates, centred on (0, 0): a pole's pivot at x −14, throws at x 14. */
function Sw({ kind, v }: { kind: "spst" | "spdt" | "dpdt"; v: number }) {
  // a pole: pivot at (−14, py); one throw at (14, py + ya), and a second at (14, py + yb) unless there is none
  const pole = (py: number, ya: number, yb: number | null) => {
    const endY = yb === null ? lerp(py - 7, py, v) : lerp(py + ya, py + yb, v)
    return (
      <g key={py}>
        <path d={`M-26 ${py} H-14 M14 ${py + ya} H26${yb === null ? "" : ` M14 ${py + yb} H26`}`} />
        <circle cx={-14} cy={py} r={0.9} fill="var(--background)" />
        <circle cx={14} cy={py + ya} r={0.9} fill="var(--background)" />
        {yb !== null && <circle cx={14} cy={py + yb} r={0.9} fill="var(--background)" />}
        <path d={`M-14 ${py} L13 ${endY}`} stroke={VOLT} strokeWidth={0.6} />
      </g>
    )
  }
  if (kind === "spst") return pole(0, 0, null)
  if (kind === "spdt") return pole(0, -8, 8)
  return (
    <>
      {pole(-12, -5, 5)}
      {pole(12, -5, 5)}
      <path d="M-8 -12 V12" stroke={MUTED} strokeWidth={0.3} strokeDasharray="1 0.8" />
    </>
  )
}

function Kinds({ t, b, still }: StageProps) {
  const big = glide(t, b.kinds - 0.1, 1, 0.5, 0.7)
  const dx = 50
  const dy = glide(t, b.kinds - 0.1, 28, 27, 0.7)
  const v = still ? 0 : lever(t, b.polew + 0.4, 1.7)
  const v2 = still ? 0 : lever(t, b.spst + 0.4, 1.9)
  const v3 = still ? 0 : lever(t, b.dpdt + 0.2, 1.7)
  const sideO = (at: number) => enter(t, at - 0.1, 0.5)
  const ann = 1 - easeInOut((t - (b.kinds - 0.1)) / 0.4)
  const s = big
  return (
    <>
      <Svg>
        <g transform={`translate(${dx} ${dy}) scale(${s})`} strokeWidth={0.32 / s} opacity={enter(t, b.pole - 0.2, 0.6)}>
          <Sw kind="spdt" v={v} />
        </g>
        <g transform={`translate(18 27) scale(0.5)`} strokeWidth={0.32 / 0.5} opacity={sideO(b.spst)}>
          <Sw kind="spst" v={v2} />
        </g>
        <g transform={`translate(82 27) scale(0.5)`} strokeWidth={0.32 / 0.5} opacity={sideO(b.dpdt)}>
          <Sw kind="dpdt" v={v3} />
        </g>
        {/* 刀: the moving blade; 掷: the places it can land */}
        <g opacity={enter(t, b.polew, 0.4) * ann} stroke={VOLT} strokeWidth={0.28}>
          <path d="M33 21 L36 25" />
        </g>
        <g opacity={enter(t, b.throw, 0.4) * ann} stroke={FG} strokeWidth={0.28}>
          <path d="M68 17 Q72 28 68 39" />
        </g>
      </Svg>
      <T x={31} y={18.5} size={3.4} weight={600} color={VOLT} o={enter(t, b.polew, 0.4) * ann}>
        刀
      </T>
      <T x={73} y={28} size={3.4} weight={600} o={enter(t, b.throw, 0.4) * ann} anchor="start">
        掷
      </T>
      <T x={32} y={8} size={3} weight={600} color={VOLT} o={enter(t, b.n - 0.2, 0.5) * ann}>
        刀：几条电路
      </T>
      <T x={68} y={8} size={3} weight={600} o={enter(t, b.pos - 0.2, 0.5) * ann}>
        掷：几个位置
      </T>
      <T x={18} y={41} size={3} weight={600} o={enter(t, b.spst - 0.1, 0.5)}>
        单刀单掷
      </T>
      <T x={18} y={46.5} size={2.4} color={MUTED} o={enter(t, b.spst + 0.4, 0.5)}>
        只管通断
      </T>
      <T x={50} y={41} size={3} weight={600} o={enter(t, b.spdt - 0.1, 0.5)}>
        单刀双掷
      </T>
      <T x={50} y={46.5} size={2.4} color={MUTED} o={enter(t, b.spdt + 0.4, 0.5)}>
        二选一
      </T>
      <T x={82} y={41} size={3} weight={600} o={enter(t, b.dpdt - 0.1, 0.5)}>
        双刀双掷
      </T>
      <T x={82} y={46.5} size={2.4} color={MUTED} o={enter(t, b.dpdt + 0.4, 0.5)}>
        同时切两路
      </T>
    </>
  )
}

// ── the relay ────────────────────────────────────────────────────────────────

const PIV: [number, number] = [44, 17]

function Relay({ t, b, still }: StageProps) {
  const draw = enter(t, b.coil - 0.2, 0.7)
  const on = still ? (t > b.pull ? 1 : 0) : enter(t, b.pull, 0.45)
  const live = enter(t, b.pull - 0.6, 0.4)
  const angle = -6.1 * on
  const lamp = enter(t, b.contact - 0.2, 0.5)
  const iso = enter(t, b.isow - 0.1, 0.6)
  const phaseC = still ? 0 : integ(() => 9, 0, t)
  return (
    <>
      <Svg>
        {/* control side */}
        <Draw d="M15.5 25 H8 V27.8 M8 30.2 V36 H15.5" p={draw} />
        <BatteryV x={8} y={29} o={draw} />
        <g opacity={draw}>
          <rect x={15.5} y={22} width={11} height={14} rx={1.2} />
          <path d="M15.5 25.5 H26.5 M15.5 29 H26.5 M15.5 32.5 H26.5" strokeWidth={0.22} />
          <rect x={19.8} y={20} width={2.4} height={19} fill="var(--muted)" stroke={FG} strokeWidth={0.28} />
        </g>
        {/* the field it makes, reaching the armature */}
        <g opacity={on} stroke={FIELD} strokeWidth={0.3} strokeDasharray="0.9 0.7">
          <path d="M17.5 21 C12 14 28 12 24.5 19.6" />
          <path d="M16 21.4 C8 11 32 9 26 19" />
        </g>
        {/* the armature and its contact */}
        <g opacity={draw}>
          <g transform={`rotate(${angle} ${PIV[0]} ${PIV[1]})`}>
            <path d={`M13 ${PIV[1]} H61`} strokeWidth={0.9} stroke={FG} />
          </g>
          <circle cx={PIV[0]} cy={PIV[1]} r={0.9} fill="var(--background)" />
          <path d="M57.4 15.1 H62.6" strokeWidth={0.7} />
          <path d="M60 15.1 V8" />
          <path d="M44 17.8 V44 H86 V32.6" />
          <path d="M86 21.4 V8 H74 M62 8 H60" />
          <Sym x={68} y={8} scale={0.2}>
            <Source x={0} y={0} kind="ac" />
          </Sym>
          <Sym x={86} y={27} scale={0.18}>
            <Lamp x={0} y={0} rot={90} brightness={lamp} />
          </Sym>
        </g>
        <LoopFlow x0={8} y0={25} x1={15.5} y1={36} phase={phaseC} spacing={2.4} o={live * (still ? 0 : 1)} skip={(x, y) => x === 8 && y > 26 && y < 31} />
        {/* the gap */}
        <g opacity={iso} stroke={MUTED} strokeWidth={0.3} strokeDasharray="1 0.8">
          <path d="M39 21.5 V46.5" />
        </g>
      </Svg>
      <T x={21} y={42} size={2.6} weight={600} o={enter(t, b.coilw, 0.5)}>
        线圈
      </T>
      <T x={31} y={12.5} size={2.6} weight={600} o={enter(t, b.pull, 0.5)} color={FG}>
        衔铁
      </T>
      <T x={65} y={16.5} size={2.6} weight={600} anchor="start" o={enter(t, b.contact, 0.5)}>
        触点
      </T>
      <T x={8} y={21} size={2.4} color={VOLT} o={enter(t, b.v5, 0.5)} className="tabular">
        5 V
      </T>
      <T x={73} y={11.6} size={2.4} anchor="start" color={VOLT} o={enter(t, b.v220, 0.5)} className="tabular">
        220 V
      </T>
      <T x={39} y={50} size={2.4} weight={600} color={MUTED} o={iso}>
        电气隔离：只靠磁力
      </T>
    </>
  )
}

// ── driving the coil ─────────────────────────────────────────────────────────

function Drive({ t, b, rise }: { t: number; b: Record<string, number>; rise: Rise }) {
  const pin = enter(t, b.pin - 0.1, 0.5)
  const coil = enter(t, b.pin + 0.2, 0.6)
  const tr = enter(t, b.bjt - 0.2, 0.6)
  const dio = enter(t, b.dio - 0.3, 0.6)
  return (
    // nudged right and down: the pin's note keeps a margin on the left, the 5 V rail one at the top
    <div className="absolute inset-0" style={{ transform: "translate(3cqw, 2.2cqw)" }}>
      <Svg>
        <g opacity={coil}>
          <path d="M54.2 3.8 V7.6 M54.2 24.4 V24" />
          <Sym x={54.2} y={16} scale={0.28}>
            <Inductor x={0} y={0} rot={90} />
          </Sym>
        </g>
        <g opacity={pin}>
          <rect x={3} y={30} width={9} height={6} rx={0.8} />
          <path d="M12 33 H14.4" />
        </g>
        <g opacity={tr}>
          <path d="M14.4 33 H21.6" />
          <Sym x={14.4 + 6.6 + 7.2} y={33} scale={0.22}>
            <Resistor x={0} y={0} />
          </Sym>
          <path d="M34.2 33 H41" />
          <Sym x={50} y={33} scale={0.3}>
            <Bjt x={0} y={0} />
          </Sym>
          <path d="M54.2 42 V45" />
          <Ground x={54.2} y={45} />
        </g>
        <g opacity={dio}>
          <path d="M54.2 6 H66 V7.6 M66 24.4 V24.2 H54.2" />
          <Sym x={66} y={16} scale={0.28}>
            <Diode x={0} y={0} rot={270} />
          </Sym>
        </g>
      </Svg>
      <T x={58} y={3.4} size={2.4} anchor="start" color={VOLT} o={coil} className="tabular">
        5 V
      </T>
      <T x={7.5} y={33} size={2.2} o={pin}>
        引脚
      </T>
      <T x={7.5} y={41} size={2.3} color={MUTED} o={enter(t, b.pin + 0.3, 0.5)}>
        只有十几毫安
      </T>
      <T x={47} y={14} size={2.4} anchor="end" weight={600} color={POWER} o={coil} className="tabular">
        线圈 70 mA
      </T>
      <T x={62} y={36} size={2.8} anchor="start" weight={600} o={tr} dy={rise(b.bjt - 0.2, 1)}>
        三极管
      </T>
      <T x={62} y={41} size={2.3} anchor="start" color={MUTED} o={tr}>
        当电子开关
      </T>
      <T x={73.5} y={16} size={2.6} anchor="start" weight={600} color={AMP} o={dio}>
        续流二极管
      </T>
      <T x={73.5} y={21} size={2.3} anchor="start" color={MUTED} o={dio}>
        反着并在线圈上
      </T>
    </div>
  )
}

// ── a fuse in series ─────────────────────────────────────────────────────────

function FuseScene({ t, b, still }: StageProps) {
  const ramp = (s: number) => Math.min(1, Math.max(0, (s - (b.ser - 0.2)) / (b.blow - b.ser + 0.2)))
  const amps = (s: number) => (s < b.blow ? 1 + 5 * ramp(s) ** 1.5 : 0)
  const phase = still ? 0 : integ((s) => 2 + amps(s) * 2.2, 0, t)
  const a = amps(t)
  const blown = t >= b.blow
  const loop = enter(t, b.fuse - 0.1, 0.7)
  const glow = Math.max(0, Math.min(1, (a - 2) / 3))
  const spark = blown ? Math.max(0, 1 - (t - b.blow) / 0.5) : 0
  const lampB = blown ? 0 : 0.35 + 0.5 * glow
  return (
    <>
      <Svg>
        <Draw d="M14 14 H30 M50 14 H80 V21.4 M80 34.6 V42 H14 V29.2 M14 26.8 V14" p={loop} />
        <BatteryV x={14} y={28} o={loop} />
        <g opacity={loop}>
          <rect x={30} y={10.8} width={20} height={6.4} rx={0.8} fill="var(--background)" />
          <path d={blown ? "M31.5 14 H38.4 M41.6 14 H48.5" : "M31.5 14 H48.5"} stroke={glow > 0.05 ? POWER : FG} strokeWidth={0.4 + glow * 0.4} />
          <Sym x={80} y={28} scale={0.22}>
            <Lamp x={0} y={0} rot={90} brightness={lampB} />
          </Sym>
        </g>
        <g opacity={spark} stroke={POWER} strokeWidth={0.4}>
          <path d="M40 12.4 l-1 -2.4 M40 15.6 l1 2.4 M38.4 14 l-2 -1 M41.6 14 l2 1" />
        </g>
        <LoopFlow x0={14} y0={14} x1={80} y1={42} phase={phase} spacing={3.6} o={loop * (blown ? 0 : 1) * (still ? 0 : 1)} skip={(x, y) => (y === 14 && x > 29 && x < 51) || (x === 14 && y > 26 && y < 29.5) || (x === 80 && y > 20 && y < 36)} />
      </Svg>
      <T x={40} y={7.4} size={2.8} weight={600} o={enter(t, b.fusew - 0.1, 0.5)}>
        保险丝
      </T>
      <T x={40} y={20.2} size={2.4} color={MUTED} o={enter(t, b.ser, 0.5)}>
        串在回路里
      </T>
      <T x={47} y={28} size={2.4} anchor="end" color={MUTED} o={loop}>
        电流
      </T>
      <T x={49} y={28} size={6} anchor="start" weight={600} color={blown ? MUTED : glow > 0.4 ? POWER : AMP} o={loop} className="tabular">
        {a.toFixed(1)} A
      </T>
      <T x={47} y={36} size={2.4} color={MUTED} o={enter(t, b.ser + 0.4, 0.5)}>
        额定 2 A
      </T>
      <T x={40} y={46.5} size={3.2} weight={600} color={POWER} o={enter(t, b.blow, 0.4)}>
        熔断：一次性
      </T>
    </>
  )
}

// ── a TVS in parallel ────────────────────────────────────────────────────────

function Tvs({ t, b, rise }: { t: number; b: Record<string, number>; rise: Rise }) {
  const line = enter(t, b.tvs - 0.1, 0.6)
  const par = enter(t, b.par - 0.2, 0.6)
  const spikeP = enter(t, b.par + 0.6, 1.4)
  const thr = enter(t, b.tvsw - 0.2, 0.5)
  const clipP = enter(t, b.tvsw + 0.1, 1.2)
  const ghost = enter(t, b.clamp - 0.3, 0.5)
  const orig = "M56 36 H68 L71 9 L74 36 H94"
  const clipped = "M56 36 H68 L68.67 30 H73.33 L74 36 H94"
  return (
    <>
      <Svg>
        <Draw d="M5 20 H36" p={line} />
        <g opacity={line}>
          <rect x={36} y={15} width={11} height={10} rx={1} fill="var(--muted)" />
        </g>
        <circle cx={24} cy={20} r={0.7} fill="currentColor" stroke="none" opacity={par} />
        <g opacity={par}>
          <path d="M24 20 V23.5" />
          <Sym x={24} y={31} scale={0.25}>
            <Diode x={0} y={0} rot={90} variant="zener" />
          </Sym>
          <Ground x={24} y={38.5} />
        </g>
        {/* the plot */}
        <Draw d="M56 40 H95" p={line} />
        <Draw d="M56 41 V6" p={line} />
        <path d="M56 30 H94" stroke={VOLT} strokeWidth={0.25} strokeDasharray="0.9 0.8" opacity={thr} />
        <Draw d={orig} p={spikeP} stroke={POWER} strokeWidth={ghost > 0.5 ? 0.3 : 0.5} strokeDasharray={ghost > 0.5 ? "1 0.8" : undefined} opacity={1 - 0.5 * ghost} />
        <Draw d={clipped} p={clipP} stroke={VOLT} strokeWidth={0.7} />
      </Svg>
      <T x={14} y={14.5} size={2.4} color={MUTED} o={line}>
        信号线
      </T>
      <T x={41.5} y={20} size={2.4} o={line}>
        芯片
      </T>
      <T x={24} y={46} size={2.6} weight={600} o={enter(t, b.tvsw - 0.1, 0.5)} dy={rise(b.tvsw - 0.1, 1)}>
        瞬态抑制二极管
      </T>
      <T x={20.5} y={30} size={2.3} anchor="end" color={MUTED} o={par}>
        并在线和地之间
      </T>
      <T x={55} y={36} size={2.2} anchor="end" color={MUTED} o={line} className="tabular">
        5 V
      </T>
      <T x={66} y={12} size={2.6} weight={600} color={POWER} o={enter(t, b.par + 1.4, 0.4)}>
        尖峰
      </T>
      <T x={94} y={26.8} size={2.4} anchor="end" weight={600} color={VOLT} o={thr} className="tabular">
        钳在 5.8 V
      </T>
    </>
  )
}

// ── what a fuse does not do ──────────────────────────────────────────────────

function Warn({ t, b, rise }: { t: number; b: Record<string, number>; rise: Rise }) {
  const l = enter(t, b.warn - 0.1, 0.6)
  const wire = enter(t, b.warn + 0.3, 0.5)
  const human = enter(t, b.human - 0.2, 0.5)
  const why = enter(t, b.why - 0.1, 0.5)
  const bigger = enter(t, b.bigger - 0.2, 0.5)
  return (
    <>
      <T x={50} y={8} size={3.2} weight={600} o={l} dy={rise(b.warn - 0.1, 1)}>
        保险丝保护的是
      </T>
      <Svg>
        <g opacity={wire}>
          <path d="M12 22 q4 -6 8 0 t8 0 t8 0 t8 0" strokeWidth={0.8} />
        </g>
        <Draw d="M24 31 l2.4 2.6 l4.6 -5.6" p={wire} stroke={GOOD} strokeWidth={0.7} />
        <g opacity={human}>
          <circle cx={73} cy={18} r={2.4} />
          <path d="M73 20.4 V28 M67.5 23 H78.5 M73 28 L69.5 35 M73 28 L76.5 35" />
        </g>
        <Draw d="M80 29 l5 5 M85 29 l-5 5" p={human} stroke={POWER} strokeWidth={0.7} />
      </Svg>
      <T x={26} y={38} size={3} weight={600} o={wire}>
        导线和电源
      </T>
      <T x={74} y={40.5} size={3} weight={600} o={human}>
        不是人
      </T>
      <T x={74} y={44.5} size={2.3} color={MUTED} o={enter(t, b.human + 0.4, 0.5)}>
        几十毫安就致命
      </T>
      <T x={26} y={44.5} size={2.3} color={MUTED} o={enter(t, b.wire + 0.4, 0.5)}>
        过流时先熔断
      </T>
      <T x={50} y={49.5} size={2.8} weight={600} color={POWER} o={bigger}>
        不要换更大的，更不能用铜丝
      </T>
      <T x={50} y={30} size={3.2} weight={600} o={why} dy={rise(b.why - 0.1, 1)}>
        烧了，先找原因
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "开关、继电器与保护元件",
  audio,
  timing,
  poster: 6.9,
  Stage,
}

export default function SwitchesRelaysFilm() {
  return <FilmPlayer film={film} />
}

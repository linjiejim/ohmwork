import * as React from "react"
import { trace } from "@/lab/colors"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, Scene, Svg, T, V, easeInOut, enter, glide, lerp, span, type FilmDef, type StageProps } from "../../kit"
import timing from "./timing.json"
import audio from "./audio.mp3"

const VOLT = trace.voltage
const AMP = trace.current
const MUTED = "var(--muted-foreground)"
const LINE = "var(--border)"

/*
 * 电压、电流与电阻, 62 s. Scenes, each keyed to the words that introduce it:
 *   title → three cards fill in (电流 I, 电压 V, 电阻 R)
 *   → current: free electrons jiggle, then drift; more charge per second = bigger reading
 *   → voltage: a loop whose charges stand still until the battery pushes; the 1.5 V gauge between + and −
 *   → resistance: a clear lane and a lane full of obstacles, the charges crawl through it
 *   → the water picture: pump / flow / narrow pipe mapped to battery / current / resistance
 *   → the closed loop: open the switch and the current reads zero
 *   → the two rules as bars → "try it below".
 */

const rnd = (i: number, k = 0) => {
  const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453
  return s - Math.floor(s)
}

/** The integral of a speed over time, for dots whose speed changes. */
function integ(f: (s: number) => number, a: number, b: number) {
  let p = 0
  const dt = 1 / 30
  for (let s = a; s < b; s += dt) p += f(s) * Math.min(dt, b - s)
  return p
}

function Stage({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.6) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)
  const lift = (at: number) => (still ? 0 : -easeInOut((t - at) / 0.45) * 2)

  // the old scene has faded out by the time the next line starts and the new one fades in from there:
  // the stage is bare for a moment at most, and two dense scenes are never on top of each other
  const sc = (a: number, z: number) => span(t, a - 0.05, z - 0.3, 0.35, 0.3)
  const title = span(t, 0.25, b.cur - 0.3, 0.4, 0.3)
  const current = sc(b.cur, b.volt)
  const voltage = sc(b.volt, b.res)
  const resistance = sc(b.res, b.water)
  const water = sc(b.water, b.loop)
  const circuit = sc(b.loop, b.rule)
  const rules = sc(b.rule, b.outro)
  const outro = enter(t, b.outro - 0.05, 0.4)

  return (
    <>
      <Scene o={title} dy={lift(b.cur - 0.45)}>
        <Title t={t} b={b} rise={rise} />
      </Scene>
      <Scene o={current}>
        <Current t={t} b={b} still={still} />
      </Scene>
      <Scene o={voltage}>
        <Voltage t={t} b={b} still={still} />
      </Scene>
      <Scene o={resistance}>
        <Resistance t={t} b={b} still={still} />
      </Scene>
      <Scene o={water}>
        <Water t={t} b={b} still={still} />
      </Scene>
      <Scene o={circuit}>
        <Closed t={t} b={b} still={still} />
      </Scene>
      <Scene o={rules}>
        <Rules t={t} b={b} />
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
    { x: 21, letter: "I", word: "电流", color: AMP, at: b.iI },
    { x: 50, letter: "V", word: "电压", color: VOLT, at: b.iV },
    { x: 79, letter: "R", word: "电阻", color: undefined, at: b.iR },
  ]
  const frame = enter(t, b.intro + 1.2, 0.6)
  return (
    <>
      <T x={50} y={12} size={7.6} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
        电压、电流与电阻
      </T>
      <Svg>
        {cards.map((c) => (
          <rect key={c.letter} x={c.x - 12} y={24} width={24} height={18} rx={1.6} stroke={LINE} strokeWidth={0.25} opacity={frame} />
        ))}
      </Svg>
      {cards.map((c) => (
        <React.Fragment key={c.letter}>
          <T x={c.x} y={31} size={7} font="var" color={c.color} o={enter(t, c.at, 0.4)} dy={rise(c.at, 1)}>
            {c.letter}
          </T>
          <T x={c.x} y={38} size={3} color={MUTED} o={enter(t, c.at + 0.1, 0.4)}>
            {c.word}
          </T>
        </React.Fragment>
      ))}
    </>
  )
}

// ── current ──────────────────────────────────────────────────────────────────

function Current({ t, b, still }: StageProps) {
  const speed = (s: number) => 7 * enter(s, b.flow, 0.7) * (1 + 1.4 * enter(s, b.more, 0.7))
  const phase = still ? 0 : integ(speed, b.flow, Math.max(t, b.flow))
  const pipe = enter(t, b.cur - 0.3, 0.8)
  const blue = enter(t, b.curI, 0.5)
  const extra = enter(t, b.more, 0.5)
  const amps = glide(t, b.more, 1, 3, 0.7)
  const cross = enter(t, b.more - 0.1, 0.5)
  return (
    <>
      <Svg>
        <Draw d="M8 15 H92" p={pipe} />
        <Draw d="M8 33 H92" p={pipe} />
        {Array.from({ length: 32 }, (_, i) => {
          const o = i < 18 ? enter(t, b.elec - 0.1, 0.5) : extra * enter(t, b.elec - 0.1, 0.5)
          if (o <= 0.01) return null
          const x = 8 + ((rnd(i) * 84 + phase) % 84)
          const y = 18.5 + rnd(i, 1) * 11
          const jx = still ? 0 : 0.6 * Math.sin(t * 2.7 + i * 1.9)
          const jy = still ? 0 : 0.6 * Math.cos(t * 2.3 + i * 1.3)
          return (
            <g key={i} opacity={o}>
              <circle cx={x + jx} cy={y + jy} r={0.8} fill={MUTED} stroke="none" opacity={1 - blue} />
              <circle cx={x + jx} cy={y + jy} r={0.8} fill={AMP} stroke="none" opacity={blue} />
            </g>
          )
        })}
        <g opacity={enter(t, b.curI, 0.5)} stroke={AMP} strokeWidth={0.45}>
          <path d="M41 9 H59 M56 7 L59 9 L56 11" />
        </g>
        <path d="M70 12 V36" stroke={MUTED} strokeWidth={0.28} strokeDasharray="1 1" opacity={cross} />
      </Svg>
      <T x={26} y={39.5} size={2.6} color={MUTED} o={enter(t, b.elec, 0.5)}>
        导线里的自由电子
      </T>
      <T x={70} y={39.5} size={2.6} color={MUTED} o={cross}>
        每秒流过这里的电荷
      </T>
      <T x={65} y={9} size={3.6} font="var" color={AMP} o={enter(t, b.curI, 0.5)}>
        I
      </T>
      <T x={34} y={48} size={2.8} anchor="end" color={MUTED} o={enter(t, b.curI + 0.8)}>
        电流 <V c={AMP}>I</V>
      </T>
      <T x={37} y={48} size={5} anchor="start" weight={600} color={AMP} o={enter(t, b.curI + 0.8)} className="tabular">
        {Math.round(amps)} A
      </T>
      <T x={92} y={48} size={2.8} anchor="end" color={MUTED} o={enter(t, b.amp)}>
        单位：安培（A）
      </T>
    </>
  )
}

// ── a rectangular loop, shared by the voltage and closed-circuit scenes ──────

interface Geo {
  L: number
  R: number
  T: number
  B: number
  mid: number
}

const perim = (g: Geo) => 2 * (g.R - g.L) + 2 * (g.B - g.T)

/** A point on the loop, `d` units clockwise from the top-left corner. */
function onLoop(g: Geo, d: number): [number, number] {
  const w = g.R - g.L
  const h = g.B - g.T
  const p = perim(g)
  const s = ((d % p) + p) % p
  if (s < w) return [g.L + s, g.T]
  if (s < w + h) return [g.R, g.T + (s - w)]
  if (s < 2 * w + h) return [g.R - (s - w - h), g.B]
  return [g.L, g.B - (s - 2 * w - h)]
}

function zigzag(x: number, y0: number, y1: number, amp = 1.6, pitch = 1) {
  const pts: string[] = [`M${x} ${y0 - 2.5}`, `V${y0}`]
  const n = Math.floor((y1 - y0) / pitch)
  for (let i = 0; i < n; i++) pts.push(`L${x + (i % 2 ? -amp : amp)} ${y0 + pitch * (i + 0.5)}`)
  pts.push(`L${x} ${y1}`, `V${y1 + 2.5}`)
  return pts.join(" ")
}

/** Charge dots around a loop: grey while still, blue once moving. `hidden` is for parts the wire passes behind. */
function LoopDots({ g, phase, blue, show, hidden }: { g: Geo; phase: number; blue: number; show: number; hidden: (x: number, y: number) => boolean }) {
  return (
    <>
      {Array.from({ length: Math.floor(perim(g) / 4) }, (_, i) => {
        const [x, y] = onLoop(g, i * 4 + phase)
        if (hidden(x, y)) return null
        return (
          <g key={i} opacity={show}>
            <circle cx={x} cy={y} r={0.6} fill={MUTED} stroke="none" opacity={1 - blue} />
            <circle cx={x} cy={y} r={0.6} fill={AMP} stroke="none" opacity={blue} />
          </g>
        )
      })}
    </>
  )
}

function Plates({ x, mid, o, plus = 1 }: { x: number; mid: number; o: number; plus?: number }) {
  return (
    <g opacity={o}>
      <path d={`M${x - 3.4} ${mid - 1.2} H${x + 3.4}`} />
      <path d={`M${x - 1.6} ${mid + 1.2} H${x + 1.6}`} strokeWidth={0.75} />
      <path d={`M${x + 3.4} ${mid - 2.7} h1.6 M${x + 4.2} ${mid - 3.5} v1.6`} strokeWidth={0.22} stroke={VOLT} opacity={plus} />
    </g>
  )
}

// ── voltage ──────────────────────────────────────────────────────────────────

const VG: Geo = { L: 20, R: 46, T: 12, B: 42, mid: 27 }

function Voltage({ t, b, still }: StageProps) {
  const g = VG
  const y0 = g.mid - 6
  const y1 = g.mid + 6
  const speed = (s: number) => 9 * enter(s, b.push, 0.6)
  const phase = still ? 0 : integ(speed, b.push, Math.max(t, b.push))
  const wires = enter(t, b.volt - 0.3, 0.8)
  const blue = enter(t, b.push, 0.5)
  const pts = enter(t, b.two, 0.5)
  const bracket = enter(t, b.high - 0.1, 0.6)
  return (
    <>
      <Svg>
        <Draw d={`M${g.L} ${g.mid - 1.2} V${g.T} H${g.R} V${y0 - 2.5}`} p={wires} />
        <Draw d={`M${g.R} ${y1 + 2.5} V${g.B} H${g.L} V${g.mid + 1.2}`} p={wires} />
        <Draw d={zigzag(g.R, y0, y1)} p={wires} />
        <Plates x={g.L} mid={g.mid} o={enter(t, b.volt - 0.3, 0.45)} plus={1 - pts} />
        <LoopDots g={g} phase={phase} blue={blue} show={enter(t, b.volt - 0.1, 0.5)} hidden={(x, y) => (x === g.L && Math.abs(y - g.mid) < 3) || (x === g.R && y > y0 - 1.2 && y < y1 + 1.2)} />
        {/* the push: chevrons climbing the left wire */}
        <g stroke={VOLT} strokeWidth={0.4} opacity={enter(t, b.push, 0.4) * (still ? 1 : 0.55 + 0.45 * Math.sin(t * 5))}>
          <path d={`M${g.L - 1.4} 20 L${g.L} 18.4 L${g.L + 1.4} 20`} />
          <path d={`M${g.L - 1.4} 16.4 L${g.L} 14.8 L${g.L + 1.4} 16.4`} />
        </g>
        {/* the two points */}
        <g fill={VOLT} stroke="none" opacity={pts}>
          <circle cx={g.L} cy={20.5} r={1} />
          <circle cx={g.L} cy={33.5} r={1} />
        </g>
        {/* the gauge */}
        <Draw d="M60 15 H90" p={pts} stroke={VOLT} strokeWidth={0.45} />
        <Draw d="M60 39 H90" p={pts} stroke={MUTED} strokeWidth={0.45} />
        <g stroke={VOLT} strokeWidth={0.4}>
          <Draw d="M75 17.5 V36.5" p={bracket} />
          <Draw d="M73.4 19.6 L75 17.5 L76.6 19.6 M73.4 34.4 L75 36.5 L76.6 34.4" p={bracket} />
        </g>
      </Svg>
      <T x={g.L - 5} y={g.mid} size={3.2} anchor="end" color={MUTED} o={enter(t, b.voltV, 0.45)}>
        电压 <V c={VOLT}>V</V>
      </T>
      <T x={g.L + 3.2} y={20.5} size={3} color={VOLT} o={pts} weight={600}>
        +
      </T>
      <T x={g.L + 3.2} y={33.5} size={3} color={MUTED} o={pts} weight={600}>
        −
      </T>
      <T x={60} y={11.5} size={2.6} anchor="start" color={MUTED} o={pts}>
        正极 · 高
      </T>
      <T x={60} y={43} size={2.6} anchor="start" color={MUTED} o={pts}>
        负极 · 低
      </T>
      <T x={79} y={27.5} size={5.6} anchor="start" weight={600} color={VOLT} o={enter(t, b.v15, 0.5)} className="tabular">
        1.5 V
      </T>
    </>
  )
}

// ── resistance ───────────────────────────────────────────────────────────────

function Resistance({ t, b, still }: StageProps) {
  const slow = (s: number) => lerp(1, 0.22, easeInOut((s - b.block) / 0.7))
  const phaseA = still ? 0 : integ(() => 10, b.res, Math.max(t, b.res))
  const phaseB = still ? 0 : integ((s) => 10 * slow(s), b.res, Math.max(t, b.res))
  const pipe = enter(t, b.res - 0.3, 0.8)
  const obst = enter(t, b.block, 0.6)
  const shake = still ? 0 : 1.1 * enter(t, b.block, 0.6)
  const lane = (cy: number, phase: number, k: number, jit: number) =>
    Array.from({ length: 14 }, (_, i) => {
      const x = 8 + ((rnd(i, k) * 84 + phase) % 84)
      const y = cy - 3.5 + rnd(i, k + 1) * 7
      const jx = jit * Math.sin(t * 6.1 + i * 2.3)
      const jy = jit * Math.cos(t * 5.3 + i * 1.7)
      return <circle key={`${k}${i}`} cx={x + jx} cy={y + jy} r={0.8} fill={AMP} stroke="none" opacity={enter(t, b.res - 0.1, 0.5)} />
    })
  const obstacles: React.ReactNode[] = []
  for (let c = 0; c < 7; c++)
    for (let r = 0; r < 3; r++) obstacles.push(<circle key={`${c}${r}`} cx={32 + c * 6 + (r % 2) * 3} cy={39 + r * 3.4} r={1.2} stroke={MUTED} strokeWidth={0.25} opacity={obst * 0.8} />)
  return (
    <>
      <Svg>
        <Draw d="M8 15 H92" p={pipe} />
        <Draw d="M8 27 H92" p={pipe} />
        <Draw d="M8 36 H92" p={pipe} />
        <Draw d="M8 48 H92" p={pipe} />
        {obstacles}
        {lane(21, phaseA, 3, still ? 0 : 0.5)}
        {lane(42, phaseB, 7, still ? 0 : 0.5 + shake)}
      </Svg>
      <T x={8} y={10.5} size={2.8} anchor="start" color={MUTED} o={enter(t, b.res - 0.1, 0.5)}>
        铜导线：几乎不阻碍
      </T>
      <T x={8} y={31.5} size={2.8} anchor="start" color={MUTED} o={enter(t, b.block, 0.5)}>
        材料里的原子挡着路
      </T>
      <T x={42} y={31.5} size={3.4} anchor="start" o={enter(t, b.resR, 0.45)}>
        电阻 <V>R</V>
      </T>
      <T x={92} y={31.5} size={2.8} anchor="end" color={MUTED} o={enter(t, b.ohm, 0.45)}>
        单位：欧姆（Ω）
      </T>
    </>
  )
}

// ── the water picture ────────────────────────────────────────────────────────

const WG: Geo = { L: 16, R: 42, T: 12, B: 45, mid: 28.5 }

function Water({ t, b, still }: StageProps) {
  const g = WG
  const y0 = g.mid - 6
  const y1 = g.mid + 6
  const speed = (s: number) => 9 * enter(s, b.water + 0.9, 0.7)
  const phase = still ? 0 : integ(speed, b.water + 0.9, Math.max(t, b.water + 0.9))
  const pipe = enter(t, b.water - 0.3, 0.9)
  const pulse = (at: number) => span(t, at, at + 1.3, 0.2, 0.9)
  const row = (y: number, at: number, from: string, to: React.ReactNode) => (
    <React.Fragment key={y}>
      <T x={54} y={y} size={3.2} anchor="start" o={enter(t, at, 0.45)}>
        {from}
      </T>
      <T x={74} y={y} size={3.2} anchor="start" color={MUTED} o={enter(t, at + 0.15, 0.45)}>
        {to}
      </T>
    </React.Fragment>
  )
  return (
    <>
      <Svg>
        <g stroke={LINE} strokeWidth={2.4}>
          <Draw d={`M${g.R} ${y0} V${g.T} H${g.L} V${g.B} H${g.R} V${y1}`} p={pipe} />
          <Draw d={`M${g.R} ${y0} V${y1}`} p={pipe} strokeWidth={0.9} />
        </g>
        <LoopDots g={g} phase={phase} blue={1} show={enter(t, b.water + 0.9, 0.5)} hidden={(x, y) => x === g.L && Math.abs(y - g.mid) < 4.2} />
        <g opacity={enter(t, b.water + 0.1, 0.45)}>
          <circle cx={g.L} cy={g.mid} r={3.8} fill="var(--background)" stroke={VOLT} />
          <path d={`M${g.L} ${g.mid + 1.8} V${g.mid - 1.8} M${g.L - 1.3} ${g.mid - 0.5} L${g.L} ${g.mid - 1.9} L${g.L + 1.3} ${g.mid - 0.5}`} stroke={VOLT} />
        </g>
        <circle cx={g.L} cy={g.mid} r={6} stroke={VOLT} strokeWidth={0.4} opacity={pulse(b.pump) * 0.8} />
        <g stroke={AMP} strokeWidth={0.45} opacity={enter(t, b.wflow, 0.4)}>
          <path d={`M${(g.L + g.R) / 2 - 1.1} ${g.T - 3.2} L${(g.L + g.R) / 2 + 0.6} ${g.T - 3.2 + 1.2} M${(g.L + g.R) / 2 - 1.1} ${g.T - 3.2 + 2.4} L${(g.L + g.R) / 2 + 0.6} ${g.T - 3.2 + 1.2}`} />
        </g>
        <rect x={g.R - 3.6} y={y0 - 1.2} width={7.2} height={y1 - y0 + 2.4} rx={1.8} stroke="var(--foreground)" strokeWidth={0.4} opacity={pulse(b.pipe) * 0.8} />
        <g stroke={MUTED} strokeWidth={0.3}>
          <path d="M66 21.5 H71 M69.6 20.3 L71 21.5 L69.6 22.7" opacity={enter(t, b.pump + 0.1)} />
        </g>
        <g stroke={MUTED} strokeWidth={0.3}>
          <path d="M66 31.5 H71 M69.6 30.3 L71 31.5 L69.6 32.7" opacity={enter(t, b.wflow + 0.1)} />
          <path d="M66 41.5 H71 M69.6 40.3 L71 41.5 L69.6 42.7" opacity={enter(t, b.pipe + 0.1)} />
        </g>
      </Svg>
      {row(21.5, b.pump, "水泵", <>电池 · <V c={VOLT}>V</V></>)}
      {row(31.5, b.wflow, "水流", <>电流 · <V c={AMP}>I</V></>)}
      {row(41.5, b.pipe, "细管子", <>电阻 · <V>R</V></>)}
    </>
  )
}

// ── the closed loop ──────────────────────────────────────────────────────────

const CG: Geo = { L: 16, R: 46, T: 12, B: 44, mid: 28 }
const SW0 = 28
const SW1 = 36

function Closed({ t, b, still }: StageProps) {
  const g = CG
  const y0 = g.mid - 6
  const y1 = g.mid + 6
  const speed = (s: number) => 8 * enter(s, b.closed, 0.6) * (1 - easeInOut((s - b.cut) / 0.5))
  const phase = still ? 0 : integ(speed, b.closed, Math.max(t, b.closed))
  const wires = enter(t, b.loop - 0.3, 0.8)
  const open = easeInOut((t - b.cut) / 0.35)
  const lever = lerp(0, -32, open) * (Math.PI / 180)
  const dim = enter(t, b.zero, 0.6)
  const mA = glide(t, b.zero - 0.1, 5, 0, 0.5)
  const rowO = (at: number) => enter(t, at, 0.45)
  return (
    <>
      <Svg>
        <Draw d={`M${g.L} ${g.mid - 1.2} V${g.T} H${SW0}`} p={wires} />
        <Draw d={`M${SW1} ${g.T} H${g.R} V${y0 - 2.5}`} p={wires} />
        <Draw d={`M${g.R} ${y1 + 2.5} V${g.B} H${g.L} V${g.mid + 1.2}`} p={wires} />
        <Draw d={zigzag(g.R, y0, y1)} p={wires} />
        <Plates x={g.L} mid={g.mid} o={enter(t, b.loop - 0.3, 0.45)} />
        <g opacity={enter(t, b.loop - 0.1, 0.5)}>
          <circle cx={SW0} cy={g.T} r={0.55} fill="var(--foreground)" stroke="none" />
          <circle cx={SW1} cy={g.T} r={0.55} fill="var(--foreground)" stroke="none" />
          <path d={`M${SW0} ${g.T} L${SW0 + (SW1 - SW0) * Math.cos(lever)} ${g.T + (SW1 - SW0) * Math.sin(lever)}`} />
        </g>
        <LoopDots
          g={g}
          phase={phase}
          blue={1}
          show={enter(t, b.closed, 0.5) * (1 - 0.75 * dim)}
          hidden={(x, y) => (x === g.L && Math.abs(y - g.mid) < 3) || (x === g.R && y > y0 - 1.2 && y < y1 + 1.2) || (y === g.T && x > SW0 - 0.2 && x < SW1 + 0.2 && open > 0.4)}
        />
        <g stroke={AMP} strokeWidth={0.3} opacity={enter(t, b.closed, 0.4) * (1 - open)}>
          <path d={`M${(g.L + SW0) / 2 - 0.9} ${g.T - 1.2} L${(g.L + SW0) / 2 + 0.5} ${g.T} L${(g.L + SW0) / 2 - 0.9} ${g.T + 1.2}`} />
        </g>
      </Svg>
      <T x={31} y={50} size={2.8} color={MUTED} o={enter(t, b.closed, 0.45) * (1 - enter(t, b.cut - 0.1, 0.3))}>
        闭合回路
      </T>
      <T x={31} y={50} size={2.8} color={MUTED} o={enter(t, b.cut, 0.45)}>
        回路断开
      </T>
      <Readout y={18} label="电压" letter="V" color={VOLT} o={rowO(b.loop - 0.2)} value="5 V" />
      <Readout y={28} label="电阻" letter="R" o={rowO(b.loop)} value="1 kΩ" />
      <Readout y={38} label="电流" letter="I" color={AMP} o={rowO(b.closed)} value={`${Math.round(mA)} mA`} />
      <Svg>
        <g stroke={LINE} strokeWidth={0.12}>
          <path d="M62 23 H90" opacity={rowO(b.loop)} />
          <path d="M62 33 H90" opacity={rowO(b.closed)} />
        </g>
      </Svg>
    </>
  )
}

function Readout({ y, label, letter, color, o, value }: { y: number; label: string; letter: string; color?: string; o: number; value: string }) {
  return (
    <>
      <T x={62} y={y} size={2.5} anchor="start" color={MUTED} o={o}>
        {label} <V c={color}>{letter}</V>
      </T>
      <T x={90} y={y} size={4.6} anchor="end" weight={600} color={color} o={o} className="tabular">
        {value}
      </T>
    </>
  )
}

// ── the two rules ────────────────────────────────────────────────────────────

const BASE = 43

function Bar({ x, h, color, o }: { x: number; h: number; color: string; o: number }) {
  return <rect x={x - 3.5} y={BASE - h} width={7} height={Math.max(h, 0.01)} rx={0.8} fill={color} stroke="none" opacity={o} />
}

function Rules({ t, b }: Pick<StageProps, "t" | "b">) {
  const left = enter(t, b.rule - 0.2, 0.5)
  const right = enter(t, b.rhigh - 0.8, 0.5)
  const vH = glide(t, b.vhigh, 9, 25, 0.8)
  const iL = glide(t, b.ihigh, 8, 23, 0.8)
  const rH = glide(t, b.rhigh, 9, 25, 0.8)
  const iR = glide(t, b.ilow, 23, 8, 0.8)
  const arrow = (x: number, o: number) => (
    <g opacity={o} stroke={MUTED}>
      <path d={`M${x - 5} 28 H${x + 5} M${x + 3} 26 L${x + 5} 28 L${x + 3} 30`} />
    </g>
  )
  return (
    <>
      <T x={50} y={8} size={2.8} color={MUTED} o={enter(t, b.rule - 0.2, 0.5)}>
        两条规律
      </T>
      <Svg>
        <path d="M50 14 V46" stroke={LINE} strokeWidth={0.2} opacity={right} />
        <path d={`M8 ${BASE} H42`} stroke={LINE} strokeWidth={0.25} opacity={left} />
        <path d={`M58 ${BASE} H92`} stroke={LINE} strokeWidth={0.25} opacity={right} />
        <Bar x={14} h={vH} color={VOLT} o={left} />
        <Bar x={36} h={iL} color={AMP} o={left} />
        <Bar x={64} h={rH} color={MUTED} o={right} />
        <Bar x={86} h={iR} color={AMP} o={right} />
        {arrow(25, enter(t, b.ihigh - 0.2, 0.4))}
        {arrow(75, enter(t, b.ilow - 0.2, 0.4))}
      </Svg>
      <T x={14} y={47.5} size={2.8} color={MUTED} o={left}>
        电压 <V c={VOLT}>V</V>
      </T>
      <T x={36} y={47.5} size={2.8} color={MUTED} o={left}>
        电流 <V c={AMP}>I</V>
      </T>
      <T x={64} y={47.5} size={2.8} color={MUTED} o={right}>
        电阻 <V>R</V>
      </T>
      <T x={86} y={47.5} size={2.8} color={MUTED} o={right}>
        电流 <V c={AMP}>I</V>
      </T>
      <T x={25} y={24} size={3} weight={600} color={AMP} o={enter(t, b.ihigh, 0.4)}>
        越大
      </T>
      <T x={75} y={24} size={3} weight={600} color={AMP} o={enter(t, b.ilow, 0.4)}>
        越小
      </T>
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
        用下面的实验台
      </T>
      <T x={25} y={36} size={3} color={VOLT} className={chip} o={enter(t, b.drag, 0.5)} dy={rise(b.drag, 1)}>
        电压滑块
      </T>
      <T x={50} y={36} size={3} className={chip} o={enter(t, b.drag + 0.9, 0.5)} dy={rise(b.drag + 0.9, 1)}>
        电阻滑块
      </T>
      <T x={75} y={36} size={3} color={AMP} className={chip} o={enter(t, b.sw - 0.2, 0.5)} dy={rise(b.sw - 0.2, 1)}>
        断开开关
      </T>
      <Svg>
        <g opacity={enter(t, b.drag + 0.3)} transform={`translate(0 ${still ? 0 : Math.sin(t * 3.2) * 0.6})`} strokeWidth={0.45}>
          <path d="M50 42 V49 M47.6 46.6 L50 49 L52.4 46.6" />
        </g>
      </Svg>
    </>
  )
}

export const film: FilmDef = {
  title: "电压、电流与电阻",
  audio,
  timing,
  poster: 7.0,
  Stage,
}

export default function VoltageCurrentResistanceFilm() {
  return <FilmPlayer film={film} />
}

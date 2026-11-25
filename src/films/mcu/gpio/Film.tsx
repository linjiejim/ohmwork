import { trace } from "@/lab/colors"
import { Led } from "@/lab/schematic"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, Scene, Svg, Sym, T, easeInOut, enter, glide, lerp, span, type FilmDef, type StageProps } from "../../kit"
import { Box, LINE, MUTED, Outro, along, head, rnd, stepPath, zig } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

const VOLT = trace.voltage
const AMP = trace.current
const GOOD = trace.good

/*
 * 单片机与 GPIO, ~52 s. Scenes, each keyed to the words that introduce it:
 *   title → a chip grows pins
 *   → output: write 1, the pin goes high, the LED lights
 *   → input: the pin only looks at the outside level; unplugged it reads noise
 *   → pull-up: a resistor makes "high" the default, the button pulls it low
 *   → contact bounce on a timing lane, a wait before believing it
 *   → push-pull vs open-drain output stages
 *   → pin current limit and the series resistor → "try it below".
 */
function Stage({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.6) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)
  const lift = (at: number) => (still ? 0 : -easeInOut((t - at) / 0.45) * 2)

  const title = span(t, 0.25, b.out - 0.45)
  const out = span(t, b.out - 0.2, b.inp - 0.45)
  const inp = span(t, b.inp - 0.2, b.pull - 0.45)
  // the chip stays put from input to pull-up: the new scene comes in as the old one goes
  const pull = span(t, b.pull - 0.5, b.bounce - 0.45)
  const bounce = span(t, b.bounce - 0.2, b.od - 0.45)
  const od = span(t, b.od - 0.2, b.load - 0.45)
  const load = span(t, b.load - 0.2, b.outro - 0.45)

  return (
    <>
      <Scene o={title} dy={lift(b.out - 0.45)}>
        <Title t={t} b={b} rise={rise} />
      </Scene>
      <Scene o={out}>
        <Output t={t} b={b} still={still} />
      </Scene>
      <Scene o={inp}>
        <Input t={t} b={b} />
      </Scene>
      <Scene o={pull}>
        <Pull t={t} b={b} still={still} />
      </Scene>
      <Scene o={bounce}>
        <Bounce t={t} b={b} />
      </Scene>
      <Scene o={od}>
        <OutputStages t={t} b={b} />
      </Scene>
      <Scene o={load}>
        <Load t={t} b={b} still={still} />
      </Scene>
      <Outro t={t} b={b} still={still} hint="按一按按键，看引脚读到什么" tryAt={b.tryit} />
    </>
  )
}

/** Blue dots drifting along a polyline: current. */
function Dots({ poly, t, o, n = 8, speed = 0.35, skip }: { poly: [number, number][]; t: number; o: number; n?: number; speed?: number; skip?: (x: number, y: number) => boolean }) {
  if (o <= 0.01) return null
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const [x, y] = along(poly, (i / n + t * speed) % 1)
        return skip?.(x, y) ? null : <circle key={i} cx={x} cy={y} r={0.5} fill={AMP} stroke="none" opacity={o} />
      })}
    </>
  )
}

// ── title ────────────────────────────────────────────────────────────────────

function Title({ t, b, rise }: { t: number; b: Record<string, number>; rise: (at: number, d?: number) => number }) {
  const chip = enter(t, b.mcu - 0.2, 0.6)
  const ys = [22, 26.5, 31, 35.5, 40]
  return (
    <>
      <Svg>
        <Box x={36} y={18} w={28} h={26} o={chip} />
        {ys.map((y, i) => {
          const p = enter(t, b.pins + i * 0.12, 0.35)
          const hi = rnd(Math.floor(t * 1.6) + i * 7) > 0.5 && t > b.pins + 1
          return (
            <g key={i}>
              <Draw d={`M32 ${y}H36`} p={p} />
              <Draw d={`M64 ${y}H68`} p={p} />
              <circle cx={31.4} cy={y} r={0.7} fill={hi ? VOLT : "var(--border)"} stroke="none" opacity={p} />
              <circle cx={68.6} cy={y} r={0.7} fill={hi ? "var(--border)" : VOLT} stroke="none" opacity={p} />
            </g>
          )
        })}
      </Svg>
      <T x={50} y={9} size={6.4} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
        单片机与 GPIO
      </T>
      <T x={50} y={27} size={3.4} weight={600} o={chip}>
        单片机
      </T>
      <T x={50} y={34} size={2.2} color={MUTED} o={chip}>
        MCU
      </T>
      <T x={28.6} y={31} size={2.6} anchor="end" color={MUTED} o={enter(t, b.pins + 0.2)}>
        引脚
      </T>
      <T x={71.4} y={31} size={2.6} anchor="start" color={MUTED} o={enter(t, b.pins + 0.3)}>
        引脚
      </T>
    </>
  )
}

// ── a pin driving an LED ─────────────────────────────────────────────────────

const CHIP_X = 8
const CHIP_W = 22

function Chip({ cy, h = 24, o = 1 }: { cy: number; h?: number; o?: number }) {
  return <Box x={CHIP_X} y={cy - h / 2} w={CHIP_W} h={h} o={o} />
}

function Output({ t, b, still }: StageProps) {
  const cy = 29
  const pinO = enter(t, b.out + 0.2, 0.5)
  const parts = enter(t, b.outW, 0.5)
  const wr = enter(t, b.wr, 0.3)
  const hi = glide(t, b.high, 0, 1, 0.3)
  const lit = glide(t, b.lit, 0, 1, 0.4)
  const wireC = hi > 0.5 ? VOLT : LINE
  const route: [number, number][] = [[31, cy], [62.5, cy]]
  const back: [number, number][] = [[77.5, cy], [84, cy], [84, 41]]
  return (
    <>
      <Svg>
        <Chip cy={cy} o={pinO} />
        <Draw d={`M30 ${cy}H62.5M77.5 ${cy}H84V41`} p={parts} stroke={wireC} strokeWidth={0.45} />
        <Draw d={zig(40, 56, cy)} p={parts} stroke="var(--foreground)" />
        <Sym x={70} y={cy} scale={0.25} opacity={parts}>
          <Led x={0} y={0} color="red" brightness={lit} />
        </Sym>
        <g opacity={parts} stroke="var(--foreground)">
          <path d="M80.5 41H87.5M81.8 42.6H86.2M83 44.2H85" />
        </g>
        <Dots poly={route} t={still ? 0 : t} o={lit * 0.9} n={4} />
        <Dots poly={back} t={still ? 0 : t} o={lit * 0.9} n={3} />
      </Svg>
      <T x={19} y={cy - 8} size={2.4} color={MUTED} o={pinO}>
        单片机
      </T>
      <T x={19} y={cy + 2} size={4.6} weight={600} color={VOLT} o={wr} className="tabular">
        写 1
      </T>
      <T x={48} y={cy - 5.5} size={2.4} color={MUTED} o={parts}>
        限流电阻
      </T>
      <T x={32} y={cy + 5} size={2.8} weight={600} color={VOLT} anchor="start" o={enter(t, b.high + 0.1)}>
        高电平 3.3 V
      </T>
      <T x={19} y={cy + 19} size={2.6} color={MUTED} o={pinO}>
        输出
      </T>
    </>
  )
}

// ── input and floating ───────────────────────────────────────────────────────

function Input({ t, b }: Pick<StageProps, "t" | "b">) {
  const cy = 29
  const open = enter(t, b.open - 0.1, 0.35)
  const wire = enter(t, b.inW, 0.5)
  const sig = (at: number) => (at < b.hiLo - 0.2 ? 1 : Math.floor((at - (b.hiLo - 0.2)) / 1.1) % 2 === 0 ? 0 : 1)
  const level = t < b.open ? sig(t) : rnd(Math.floor(t * 9), 3) > 0.5 ? 1 : 0
  const outside = sig(t)
  const noise = enter(t, b.open, 0.4)
  // the outside level as a rolling lane, or noise when nothing is connected
  const X0 = 58
  const X1 = 92
  const pts: [number, number][] = []
  for (let i = 0; i <= 34; i++) {
    const x = X0 + i
    const ti = t - (34 - i) * 0.1
    const v = ti < b.open ? sig(ti) : rnd(Math.floor(ti * 5) + i, 9) > 0.5 ? 1 : 0
    pts.push([x, v ? 22 : 36])
  }
  const lane = pts.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join("")
  const stepD = (() => {
    let d = ""
    pts.forEach(([x, y], i) => {
      d += i === 0 ? `M${x} ${y}` : pts[i - 1][1] === y ? `H${x}` : `V${y}H${x}`
    })
    return d
  })()
  void lane
  return (
    <>
      <Svg>
        <Chip cy={cy} />
        <Draw d={`M30 ${cy}H${lerp(54, 44, open)}`} p={wire} stroke={t < b.open ? (outside ? VOLT : "var(--muted-foreground)") : LINE} strokeWidth={0.45} />
        <path d={head(30, cy, -1, 1.2)} strokeWidth={0.4} opacity={wire * (1 - open)} stroke={outside ? VOLT : MUTED} />
        <circle cx={44} cy={cy} r={0.9} fill="var(--background)" opacity={open} />
        {/* what is outside: a rolling lane (noise when open) */}
        <g opacity={wire}>
          <path d={`M${X0} 36H${X1}`} stroke={LINE} />
          <path d={stepD} stroke={t < b.open ? VOLT : MUTED} strokeWidth={0.4} strokeDasharray={noise > 0.5 ? "0.6 0.8" : undefined} />
          <path d={`M${X1} 16V40`} stroke={VOLT} strokeWidth={0.5} opacity={0.5} />
        </g>
      </Svg>
      <T x={19} y={cy - 8} size={2.4} color={MUTED} o={wire}>
        单片机
      </T>
      <T x={19} y={cy + 1.5} size={2.4} color={MUTED} o={enter(t, b.look)}>
        读到
      </T>
      <T x={19} y={cy + 8} size={5} weight={600} color={t < b.open ? (level ? VOLT : undefined) : MUTED} o={enter(t, b.look)} className="tabular">
        {level}
      </T>
      <T x={19} y={cy + 19} size={2.6} color={MUTED} o={wire}>
        输入
      </T>
      <T x={75} y={13} size={2.6} color={MUTED} o={wire * (1 - open)}>
        外面的电压：高还是低
      </T>
      <T x={75} y={13} size={2.6} color={MUTED} o={open}>
        什么都不接：读数乱跳
      </T>
      <T x={37} y={cy + 6} size={2.4} color={MUTED} o={open}>
        悬空
      </T>
    </>
  )
}

// ── pull-up and button ───────────────────────────────────────────────────────

function vzig(x: number, y0: number, y1: number, amp = 1.2, teeth = 6) {
  const a = y0 + 1.6
  const e = y1 - 1.6
  const step = (e - a) / teeth
  let d = `M${x} ${y0}V${a}`
  for (let i = 0; i < teeth; i++) d += `L${x + (i % 2 ? amp : -amp)} ${a + step * (i + 0.5)}`
  return d + `L${x} ${e}V${y1}`
}

function Pull({ t, b, still }: StageProps) {
  const cy = 29
  const jx = 52
  const R = enter(t, b.pullR - 0.2, 0.5)
  const btn = enter(t, b.dflt - 0.6, 0.5)
  const release = b.low + 1.9
  const down = t >= b.press && t < release
  const press = glide(t, b.press, 0, 1, 0.12) * (t < release ? 1 : 1 - glide(t, release, 0, 1, 0.12))
  const high = !down
  const wireC = high ? VOLT : MUTED
  const flow: [number, number][] = [[jx, 12], [jx, 33], [jx, 44]]
  return (
    <>
      <Svg>
        <Chip cy={cy} />
        <Draw d={`M30 ${cy}H${jx}`} p={enter(t, b.pull, 0.5)} stroke={wireC} strokeWidth={0.45} />
        <circle cx={jx} cy={cy} r={0.8} fill="var(--foreground)" stroke="none" opacity={R} />
        {/* the pull-up: rail, resistor, down to the node */}
        <g opacity={R}>
          <path d={`M${jx - 5} 8H${jx + 5}`} stroke={VOLT} strokeWidth={0.5} />
          <path d={`M${jx} 8V10`} stroke={VOLT} />
          <path d={vzig(jx, 10, 24)} />
          <path d={`M${jx} 24V${cy}`} stroke={wireC} strokeWidth={0.45} />
        </g>
        {/* the button: a switch down to ground, drawn like the one in the lab below */}
        <g opacity={btn}>
          <path d={`M${jx} ${cy}V${cy + 3}`} stroke={wireC} strokeWidth={0.45} />
          <Sw x={jx} y0={cy + 3} y1={44} closed={press} />
          <path d={`M${jx - 3.5} 44H${jx + 3.5}M${jx - 2.2} 45.6H${jx + 2.2}M${jx - 1} 47.2H${jx + 1}`} />
        </g>
        <Dots poly={flow} t={still ? 0 : t} o={press * R} n={7} speed={0.5} />
        <path d={head(30, cy, -1, 1.2)} strokeWidth={0.4} stroke={wireC} opacity={enter(t, b.pull, 0.5)} />
      </Svg>
      <T x={19} y={cy - 8} size={2.4} color={MUTED}>
        单片机
      </T>
      <T x={19} y={cy + 2} size={2.4} color={MUTED} o={enter(t, b.pull + 0.3)}>
        读到
      </T>
      <T x={19} y={cy + 8.5} size={5} weight={600} color={high ? VOLT : undefined} o={enter(t, b.pull + 0.3)} className="tabular">
        {high ? 1 : 0}
      </T>
      <T x={jx + 6.5} y={8} size={2.4} anchor="start" color={VOLT} o={R}>
        3.3 V
      </T>
      <T x={jx + 4.5} y={17} size={2.6} anchor="start" color={MUTED} o={R}>
        上拉电阻
      </T>
      <T x={jx + 6.5} y={38} size={2.6} anchor="start" color={MUTED} o={btn}>
        按键
      </T>
      <T x={73} y={19} size={2.8} anchor="start" o={enter(t, b.dflt)}>
        <span className="inline-flex items-baseline gap-[0.6em]">
          <span style={{ color: MUTED }}>没按</span>
          <span style={{ color: VOLT, fontWeight: 600 }}>读到 1</span>
        </span>
      </T>
      <T x={73} y={27} size={2.8} anchor="start" o={enter(t, b.press)}>
        <span className="inline-flex items-baseline gap-[0.6em]">
          <span style={{ color: MUTED }}>按下</span>
          <span style={{ fontWeight: 600 }}>读到 0</span>
        </span>
      </T>
    </>
  )
}

// ── contact bounce ───────────────────────────────────────────────────────────

const BOUNCE: [number, number][] = [[0, 1], [2, 0], [2.2, 1], [2.35, 0], [2.6, 1], [2.7, 0], [2.78, 1], [2.9, 0]]
const CONFIRMED: [number, number][] = [[0, 1], [4.2, 0]]

function Bounce({ t, b }: Pick<StageProps, "t" | "b">) {
  const lin = (a: number, c: number, from: number, to: number) => lerp(from, to, Math.min(1, Math.max(0, (t - a) / (c - a))))
  const tau =
    t < b.shake + 0.3 ? lin(b.bounce - 0.2, b.shake + 0.3, 0, 2) : t < b.wait ? lin(b.shake + 0.3, b.shake + 1.6, 2, 3.1) : lin(b.wait, b.wait + 1.8, 3.1, 8)
  const x0 = 14
  const slot = 9
  const ok = enter(t, b.bounce - 0.2)
  const wait = enter(t, b.wait, 0.5)
  const conf = Math.max(0, tau)
  return (
    <>
      <Svg>
        <g opacity={ok}>
          <path d={`M${x0} 25H${x0 + 8 * slot}`} stroke={LINE} />
          <path d={`M${x0} 48H${x0 + 8 * slot}`} stroke={LINE} />
        </g>
        <path d={stepPath(BOUNCE, 8, x0, slot, 15, 25, tau)} stroke={VOLT} strokeWidth={0.5} opacity={ok} />
        {conf > 3 && <path d={stepPath(CONFIRMED, 8, x0, slot, 36, 46, tau)} stroke={GOOD} strokeWidth={0.5} opacity={wait} />}
        {/* brackets: the shaking, and the wait */}
        <g opacity={enter(t, b.shake + 0.2)} stroke={VOLT} strokeWidth={0.3}>
          <path d={`M${x0 + 2 * slot} 11.5V10.5H${x0 + 2.9 * slot}V11.5`} />
        </g>
        <g opacity={wait} stroke={MUTED} strokeWidth={0.3}>
          <path d={`M${x0 + 2 * slot} 29.5V28.5H${x0 + 4.2 * slot}V29.5`} />
          <path d={`M${x0 + 4.2 * slot} 33.5V48`} strokeDasharray="0.8 0.8" />
        </g>
      </Svg>
      <T x={x0 - 2} y={20} size={2.6} anchor="end" color={MUTED} o={ok}>
        引脚
      </T>
      <T x={x0 - 2} y={41} size={2.6} anchor="end" color={MUTED} o={wait}>
        确认
      </T>
      <T x={x0 + 2.45 * slot} y={7.5} size={2.6} weight={600} color={VOLT} o={enter(t, b.shake + 0.2)}>
        触点弹跳
      </T>
      <T x={x0 + 3.1 * slot} y={31.5} size={2.6} weight={600} color={MUTED} o={wait}>
        等 10 到 20 毫秒
      </T>
      <T x={x0 + 6.3 * slot} y={51} size={2.6} color={GOOD} o={enter(t, b.wait + 1.2)}>
        再确认：按下
      </T>
    </>
  )
}

// ── push-pull and open-drain ────────────────────────────────────────────────

function Sw({ x, y0, y1, closed }: { x: number; y0: number; y1: number; closed: number }) {
  const m = lerp(y0 + 3, y1 - 3, 0.5)
  return (
    <g>
      <path d={`M${x} ${y0}V${y0 + 3}`} />
      <path d={`M${x} ${y1 - 3}V${y1}`} />
      <circle cx={x} cy={y0 + 3} r={0.45} fill="var(--foreground)" />
      <circle cx={x} cy={y1 - 3} r={0.45} fill="var(--foreground)" />
      <path d={`M${x} ${y0 + 3}L${lerp(x + 3.4, x, closed)} ${lerp(m + 1.5, y1 - 3, closed)}`} />
    </g>
  )
}

function OutputStages({ t, b }: Pick<StageProps, "t" | "b">) {
  // push-pull alone sits in the middle; it makes room when open-drain arrives
  const L = glide(t, b.odW - 0.6, 50, 27, 0.6)
  const R = 73
  const ppO = enter(t, b.od + 0.1, 0.5)
  const odO = enter(t, b.odW - 0.1, 0.5)
  const ppHigh = Math.floor((t - b.pp) / 1.2) % 2 === 0 || t < b.pp
  const odHigh = t < b.odLow ? true : Math.floor((t - b.odLow) / 1.2) % 2 === 1
  const k = (high: boolean) => (high ? VOLT : MUTED)
  return (
    <>
      <Svg>
        {/* push-pull: two switches */}
        <g opacity={ppO}>
          <path d={`M${L - 7} 10H${L + 7}`} stroke={VOLT} strokeWidth={0.5} />
          <Sw x={L} y0={10} y1={22} closed={ppHigh ? 1 : 0} />
          <Sw x={L} y0={32} y1={44} closed={ppHigh ? 0 : 1} />
          <path d={`M${L} 22V32`} stroke={k(ppHigh)} strokeWidth={0.45} />
          <path d={`M${L} 27H${L + 12}`} stroke={k(ppHigh)} strokeWidth={0.45} />
          <circle cx={L} cy={27} r={0.7} fill={k(ppHigh)} stroke="none" />
          <circle cx={L + 12} cy={27} r={1} fill={k(ppHigh)} stroke="none" />
          <path d={`M${L - 3} 44H${L + 3}M${L - 1.8} 45.6H${L + 1.8}`} />
        </g>
        {/* open-drain: a resistor outside, one switch */}
        <g opacity={odO}>
          <path d={`M${R - 7} 10H${R + 7}`} stroke={VOLT} strokeWidth={0.5} />
          <path d={`M${R} 10V12`} stroke={VOLT} />
          <path d={vzig(R, 12, 24)} strokeDasharray={undefined} />
          <path d={`M${R} 24V32`} stroke={k(odHigh)} strokeWidth={0.45} />
          <Sw x={R} y0={32} y1={44} closed={odHigh ? 0 : 1} />
          <path d={`M${R} 27H${R + 12}`} stroke={k(odHigh)} strokeWidth={0.45} />
          <circle cx={R} cy={27} r={0.7} fill={k(odHigh)} stroke="none" />
          <circle cx={R + 12} cy={27} r={1} fill={k(odHigh)} stroke="none" />
          <path d={`M${R - 3} 44H${R + 3}M${R - 1.8} 45.6H${R + 1.8}`} />
        </g>
        <path d="M50 8V46" stroke={LINE} strokeWidth={0.2} opacity={odO} strokeDasharray="0.8 0.8" />
      </Svg>
      <T x={L} y={5} size={3.2} weight={600} o={enter(t, b.pp - 0.1, 0.4)}>
        推挽
      </T>
      <T x={R} y={5} size={3.2} weight={600} o={odO}>
        开漏
      </T>
      <T x={L + 5.5} y={16} size={2.2} anchor="start" color={MUTED} o={ppO}>
        上管
      </T>
      <T x={L + 5.5} y={38} size={2.2} anchor="start" color={MUTED} o={ppO}>
        下管
      </T>
      <T x={R + 5.5} y={38} size={2.2} anchor="start" color={MUTED} o={odO}>
        下管
      </T>
      <T x={R - 3.5} y={17} size={2.2} anchor="end" color={MUTED} o={odO}>
        外部上拉
      </T>
      <T x={L + 6} y={22.5} size={2.8} weight={600} color={k(ppHigh)} o={ppO} className="tabular">
        {ppHigh ? "1" : "0"}
      </T>
      <T x={R + 6} y={22.5} size={2.8} weight={600} color={k(odHigh)} o={odO} className="tabular">
        {odHigh ? "1" : "0"}
      </T>
      <T x={L} y={50} size={2.5} color={MUTED} o={enter(t, b.ppBoth)}>
        主动拉高，也主动拉低
      </T>
      <T x={R} y={50} size={2.5} color={MUTED} o={enter(t, b.odLow)}>
        只会拉低，高靠电阻
      </T>
    </>
  )
}

// ── limit current ────────────────────────────────────────────────────────────

function Load({ t, b, still }: StageProps) {
  const cy = 17
  const on = enter(t, b.load, 0.5)
  const lim = enter(t, b.limit, 0.4)
  const rr = enter(t, b.limR - 0.2, 0.5)
  const pulse = still ? 0 : Math.max(0, Math.sin((t - b.limR) * 5)) * enter(t, b.limR, 0.2) * (1 - enter(t, b.limR + 1.5, 0.3))
  const route: [number, number][] = [[31, cy], [62.5, cy]]
  const back: [number, number][] = [[77.5, cy], [84, cy], [84, 29]]
  return (
    <>
      <Svg>
        <Chip cy={cy} h={20} o={on} />
        <Draw d={`M30 ${cy}H62.5M77.5 ${cy}H84V29`} p={on} stroke={VOLT} strokeWidth={0.45} />
        <Draw d={zig(40, 56, cy)} p={on} stroke="var(--foreground)" strokeWidth={0.32 + pulse * 0.25} />
        <Sym x={70} y={cy} scale={0.25} opacity={on}>
          <Led x={0} y={0} color="red" brightness={on} />
        </Sym>
        <g opacity={on}>
          <path d="M80.5 29H87.5M81.8 30.6H86.2M83 32.2H85" />
        </g>
        <Dots poly={route} t={still ? 0 : t} o={on * 0.9} n={4} />
        <Dots poly={back} t={still ? 0 : t} o={on * 0.9} n={3} />
        <path d={`M${lerp(24, 34, 0)} ${cy + 6}`} strokeWidth={0} />
      </Svg>
      <T x={19} y={cy} size={2.6} color={MUTED} o={on}>
        单片机
      </T>
      <T x={48} y={cy - 5.5} size={2.6} weight={rr > 0.5 ? 600 : 400} color={rr > 0.5 ? undefined : MUTED} o={enter(t, b.limR - 0.2)}>
        限流电阻
      </T>
      <T x={50} y={36} size={3.2} o={lim} dy={0}>
        <span className="inline-flex items-baseline gap-[0.5em]">
          <span style={{ color: MUTED }}>每个引脚最多</span>
          <span className="tabular" style={{ color: AMP, fontWeight: 600, fontSize: "1.3em" }}>
            10 到 20 mA
          </span>
        </span>
      </T>
      <T x={50} y={46} size={3} o={rr}>
        <span className="tabular">
          <span style={{ color: MUTED }}>R = </span>
          (3.3 V − 2 V) ÷ 5 mA = 260 Ω
          <span style={{ color: MUTED }}> ≈ </span>
          <span style={{ fontWeight: 600 }}>270 Ω</span>
        </span>
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "单片机与 GPIO",
  audio,
  timing,
  poster: 6.0,
  Stage,
}

export default function GpioFilm() {
  return <FilmPlayer film={film} />
}

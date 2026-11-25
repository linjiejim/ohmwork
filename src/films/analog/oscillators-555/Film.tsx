import { trace } from "@/lab/colors"
import { Capacitor, Crystal, OpAmp, Resistor } from "@/lab/schematic"
import { FilmPlayer } from "../../FilmPlayer"
import { M, Scene, Svg, Sym, T, V, easeInOut, enter, glide, lerp, span, type FilmDef, type StageProps } from "../../kit"
import { poly, pop } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

const VOLT = trace.voltage
const AMP = trace.current
const MUTED = "var(--muted-foreground)"
const LINE = "var(--border)"

/*
 * 振荡器与 555, ~62 s. Scenes, each keyed to the words that introduce it:
 *   title → a square wave runs across the stage
 *   → three ingredients: amplify, positive feedback, a timing part
 *   → relaxation: a capacitor charges to the upper threshold, discharges to the lower, the output a square wave
 *   → the 555 chip: its eight pins, then divider, two comparators, flip-flop, discharge transistor
 *   → a bigger capacitor slows the wave → charging through two resistors, discharging through one: duty above 50%
 *   → two thresholds clean a noisy slow signal → a crystal against an RC oscillator → "try it below".
 */
function Stage({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.6) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)
  const title = span(t, 0.25, b.need - 0.15, 0.4, 0.3)
  const need = span(t, b.need - 0.3, b.relax - 0.15, 0.3, 0.3)
  const relax = span(t, b.relax - 0.3, b.chip - 0.15, 0.3, 0.3)
  const chip = span(t, b.chip - 0.3, b.bigc - 0.15, 0.3, 0.3)
  const bigc = span(t, b.bigc - 0.3, b.duty - 0.15, 0.3, 0.3)
  const duty = span(t, b.duty - 0.3, b.schmitt - 0.15, 0.3, 0.3)
  const sch = span(t, b.schmitt - 0.3, b.xtal - 0.15, 0.3, 0.3)
  const xtal = span(t, b.xtal - 0.3, b.outro - 0.15, 0.3, 0.3)
  const outro = enter(t, b.outro - 0.3, 0.4)
  return (
    <>
      <Scene o={title}>
        <Title t={t} b={b} still={still} rise={rise} />
      </Scene>
      <Scene o={need}>
        <Need t={t} b={b} rise={rise} />
      </Scene>
      <Scene o={relax}>
        <Relax t={t} b={b} still={still} />
      </Scene>
      <Scene o={chip}>
        <Chip t={t} b={b} />
      </Scene>
      <Scene o={bigc}>
        <BigC t={t} b={b} still={still} />
      </Scene>
      <Scene o={duty}>
        <Duty t={t} b={b} still={still} />
      </Scene>
      <Scene o={sch}>
        <Schmitt t={t} b={b} />
      </Scene>
      <Scene o={xtal}>
        <Crystals t={t} b={b} />
      </Scene>
      <Scene o={outro}>
        <T x={50} y={24} size={6} weight={600} dy={rise(b.outro - 0.3)}>
          动手试试
        </T>
        <T x={50} y={32.5} size={2.8} color={MUTED} o={enter(t, b.drag)} dy={rise(b.drag, 1)}>
          先调一调下面实验台的电阻和电容
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

// ── waves ───────────────────────────────────────────────────────────────────

/** The capacitor voltage over one cycle (0–1) and whether the output is high. Charging 1/3 → 2/3 takes the duty share of the cycle. */
function cyc(f: number, d: number) {
  const u = f - Math.floor(f)
  if (u < d) return { v: 1 - (2 / 3) * 2 ** (-u / d), hi: true }
  return { v: (2 / 3) * 2 ** (-(u - d) / (1 - d)), hi: false }
}
const yv = (v: number, y0: number) => y0 + (0.8 - v) * 30
const Y_HI = 1 / 3
const Y_LO = 2 / 3

function wavePaths(x0: number, x1: number, fOf: (x: number) => number, d: number, y0: number, hiY: number, loY: number) {
  const cap: [number, number][] = []
  const out: [number, number][] = []
  const n = 240
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n
    const { v, hi } = cyc(fOf(x), d)
    cap.push([x, yv(v, y0)])
    out.push([x, hi ? hiY : loY])
  }
  return { cap: poly(cap), out: poly(out) }
}

// ── title ───────────────────────────────────────────────────────────────────

function Title({ t, b, still, rise }: { t: number; b: StageProps["b"]; still: boolean; rise: (at: number, d?: number) => number }) {
  const mt = still ? 4 : t
  const head = 8 + 84 * easeInOut((t - 1.0) / 2.4)
  const sq = (x: number) => ((x * 0.07 - mt * 1.1) % 1 + 1) % 1 < 0.5
  const pts: [number, number][] = []
  for (let i = 0; i <= 300; i++) {
    const x = 8 + (84 * i) / 300
    if (x > head) break
    pts.push([x, sq(x) ? 24 : 38])
  }
  return (
    <>
      <T x={50} y={10} size={6.4} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
        振荡器
      </T>
      <Svg>
        <path d="M8 24 H92 M8 38 H92" stroke={LINE} strokeWidth={0.15} opacity={enter(t, 1.0)} />
        {pts.length > 1 && <path d={poly(pts)} strokeWidth={0.55} />}
      </Svg>
      <T x={50} y={17.5} size={2.6} color={MUTED} o={enter(t, b.intro + 1.9, 0.5)}>
        周期信号：灯闪，蜂鸣，时钟
      </T>
    </>
  )
}

// ── three ingredients ───────────────────────────────────────────────────────

function Need({ t, b, rise }: { t: number; b: StageProps["b"]; rise: (at: number, d?: number) => number }) {
  const cols = [
    { x: 18, name: "放大", at: b.n1 },
    { x: 50, name: "正反馈", at: b.n2 },
    { x: 82, name: "定时元件", at: b.n3 },
  ]
  return (
    <>
      <T x={50} y={9} size={3.6} weight={600} o={enter(t, b.need, 0.5)} dy={rise(b.need, 1)}>
        振荡，要凑齐三样
      </T>
      <Svg>
        {cols.map((c) => (
          <rect key={c.x} x={c.x - 13} y={17} width={26} height={30} rx={2} stroke={LINE} strokeWidth={0.2} opacity={enter(t, b.need + 0.3 + cols.indexOf(c) * 0.5, 0.5)} />
        ))}
        <g opacity={enter(t, b.n1, 0.5)}>
          <Sym x={18} y={30} scale={0.3}>
            <OpAmp x={0} y={0} />
          </Sym>
        </g>
        <g opacity={enter(t, b.n2, 0.5)}>
          <path d="M55.6 26.2 A6.5 6.5 0 1 0 55.6 32.8 M54 31.6 L55.6 32.8 L56.3 30.9" />
        </g>
        <g opacity={enter(t, b.n3, 0.5)}>
          <Sym x={82} y={26} scale={0.2}>
            <Resistor x={0} y={0} />
          </Sym>
          <Sym x={82} y={35} scale={0.2}>
            <Capacitor x={0} y={0} />
          </Sym>
        </g>
      </Svg>
      {cols.map((c) => (
        <T key={c.x} x={c.x} y={43} size={3} weight={600} o={enter(t, c.at, 0.4)}>
          {c.name}
        </T>
      ))}
    </>
  )
}

// ── relaxation: charge, discharge, square wave ─────────────────────────────

function Relax({ t, b, still }: StageProps) {
  const X0 = 16
  const X1 = 84
  const start = b.chg - 0.4
  const D = 1.5
  const speed = 26 / (2 * D)
  const head = still ? X1 : Math.min(X1, X0 + Math.max(0, t - start) * speed)
  const w = wavePaths(X0, head, (x) => (x - X0) / speed / (2 * D), 0.5, 8, 34, 45)
  const f = (head - X0) / speed / (2 * D)
  const cur = cyc(f, 0.5)
  const th1 = enter(t, b.up - 0.2, 0.5)
  const th2 = enter(t, b.low - 0.4, 0.5)
  const tag = (x: number, y: number, text: string, o: number) => (
    <T x={x} y={y} size={2.4} color={MUTED} o={o}>
      {text}
    </T>
  )
  return (
    <>
      <Svg>
        <path d={`M${X0} ${yv(Y_LO, 8)} H${X1}`} stroke={VOLT} strokeWidth={0.2} strokeDasharray="0.7 0.6" opacity={th1} />
        <path d={`M${X0} ${yv(Y_HI, 8)} H${X1}`} stroke={VOLT} strokeWidth={0.2} strokeDasharray="0.7 0.6" opacity={th2} />
        <path d={`M${X0} 34 H${X1} M${X0} 45 H${X1}`} stroke={LINE} strokeWidth={0.15} />
        {head > X0 + 0.2 && <path d={w.cap} stroke={VOLT} strokeWidth={0.55} />}
        {head > X0 + 0.2 && <path d={w.out} strokeWidth={0.5} />}
        {head > X0 + 0.2 && <circle cx={head} cy={yv(cur.v, 8)} r={0.9} fill={VOLT} stroke="none" />}
      </Svg>
      <T x={X0 - 1.5} y={17} size={2.4} anchor="end" color={MUTED} o={enter(t, b.relax, 0.5)}>
        电容电压
      </T>
      <T x={X0 - 1.5} y={39.5} size={2.4} anchor="end" color={MUTED} o={enter(t, b.relax + 0.2, 0.5)}>
        输出
      </T>
      <T x={X1 + 1.5} y={yv(Y_LO, 8)} size={2.4} anchor="start" weight={600} color={VOLT} o={th1}>
        上门限
      </T>
      <T x={X1 + 1.5} y={yv(Y_HI, 8)} size={2.4} anchor="start" weight={600} color={VOLT} o={th2}>
        下门限
      </T>
      {tag(X0 + 6.5, 6.5, "充电", enter(t, b.chg, 0.4))}
      {tag(X0 + 19.5, 6.5, "放电", enter(t, b.dchg, 0.4))}
      <T x={X1 + 1.5} y={39.5} size={2.6} anchor="start" weight={600} o={enter(t, b.sq, 0.4)}>
        方波
      </T>
    </>
  )
}

// ── the chip ────────────────────────────────────────────────────────────────

function Chip({ t, b }: Pick<StageProps, "t" | "b">) {
  const body = enter(t, b.chip, 0.6)
  const name = enter(t, b.chip + 0.2, 0.5) * (1 - enter(t, b.inside - 0.2, 0.4))
  const pinY = [14, 22, 30, 38]
  const pins = [
    ...pinY.map((y, i) => ({ x: 18, x2: 22, y, n: i + 1 })),
    ...pinY.map((_, i) => ({ x: 78, x2: 82, y: pinY[3 - i], n: 5 + i })),
  ]
  const cmp = enter(t, b.cmp - 0.2, 0.5)
  const ff = enter(t, b.ff - 0.2, 0.5)
  const dis = enter(t, b.dis - 0.2, 0.5)
  const box = (x: number, y: number, w: number, h: number, o: number) => <rect x={x} y={y} width={w} height={h} rx={0.8} opacity={o} strokeWidth={0.28} />
  return (
    <>
      <Svg>
        <g opacity={body}>
          <rect x={22} y={8} width={56} height={39} rx={2.5} strokeWidth={0.45} />
        </g>
        {pins.map((p, i) => (
          <path key={i} d={`M${p.x} ${p.y} H${p.x2}`} opacity={enter(t, b.chipw + i * 0.1, 0.3)} />
        ))}
        {/* divider */}
        <g opacity={cmp}>
          {box(26.3, 14, 3.4, 8, 1)}
          {box(26.3, 22, 3.4, 8, 1)}
          {box(26.3, 30, 3.4, 8, 1)}
          <path d="M28 10.5 V14 M28 38 V41 M26.6 41 H29.4 M27.2 42 H28.8" />
          <path d="M29.7 22 H44 M29.7 30 H44" stroke={VOLT} />
          {box(44, 13, 12, 12, 1)}
          {box(44, 27, 12, 12, 1)}
          <path d="M40 47 V17 H44 M40 35 H44" />
        </g>
        <g opacity={ff}>
          <path d="M56 19 H58 V24 H60 M56 33 H58 V28 H60" />
          {box(60, 20, 12, 12, 1)}
          <path d="M72 26 H84" />
        </g>
        <g opacity={dis}>
          <path d="M66 32 V37.4" />
          <circle cx={66} cy={40} r={2.6} />
          <path d="M66 42.6 V47" />
        </g>
      </Svg>
      <T x={50} y={27.5} size={9} weight={600} o={name}>
        555
      </T>
      {pins.map((p, i) => (
        <T key={i} x={p.x < 50 ? p.x - 1.8 : p.x2 + 1.8} y={p.y} size={2.2} color={MUTED} o={enter(t, b.chipw + i * 0.1, 0.3)} className="tabular">
          {p.n}
        </T>
      ))}
      <T x={36.3} y={19.9} size={1.9} color={VOLT} o={cmp}>
        2/3
      </T>
      <T x={36.3} y={31.8} size={1.9} color={VOLT} o={cmp}>
        1/3
      </T>
      <T x={50} y={19} size={2.2} o={cmp}>
        比较器
      </T>
      <T x={50} y={33} size={2.2} o={cmp}>
        比较器
      </T>
      <T x={66} y={26} size={2.2} o={ff}>
        触发器
      </T>
      <T x={87.5} y={26} size={2.2} anchor="start" color={MUTED} o={ff}>
        输出
      </T>
      <T x={69.2} y={40} size={1.9} anchor="start" o={dis}>
        放电管
      </T>
      <T x={40} y={50.4} size={2.2} color={MUTED} o={cmp}>
        电容
      </T>
      <T x={31} y={11.2} size={2.2} anchor="start" color={MUTED} o={cmp}>
        电源
      </T>
    </>
  )
}

// ── a bigger capacitor, a slower wave ───────────────────────────────────────

const phaseCache = new Map<number, Float64Array>()
/** Cycles completed by time τ when the period glides from 2 s to 4 s starting at g0. Tabulated once per film. */
function phaseOf(g0: number, tau: number) {
  let tab = phaseCache.get(g0)
  const t0 = g0 - 14
  const dt = 0.02
  if (!tab) {
    const n = Math.ceil(34 / dt)
    tab = new Float64Array(n + 1)
    for (let i = 1; i <= n; i++) {
      const tt = t0 + (i - 0.5) * dt
      tab[i] = tab[i - 1] + dt / lerp(2, 4, easeInOut((tt - g0) / 2.2))
    }
    phaseCache.set(g0, tab)
  }
  const k = (tau - t0) / dt
  if (k <= 0) return k * (dt / 2)
  const i = Math.min(tab.length - 2, Math.floor(k))
  return lerp(tab[i], tab[i + 1], k - i)
}

function BigC({ t, b, still }: StageProps) {
  const X0 = 30
  const X1 = 92
  const speed = 8
  const g0 = b.slow - 0.9
  const mt = still ? b.lowf : t
  const w = wavePaths(X0, X1, (x) => phaseOf(g0, mt - (X1 - x) / speed), 0.5, 9, 34, 45)
  const cmicro = glide(t, b.bigw + 0.2, 10, 20, 0.9)
  const freq = glide(t, b.slow - 0.9, 1, 0.5, 2.2)
  const show = enter(t, b.bigc - 0.1, 0.5)
  return (
    <>
      <Svg>
        <Sym x={14} y={20} scale={0.28} opacity={show}>
          <Capacitor x={0} y={0} rot={90} />
        </Sym>
        <path d={`M${X0} ${yv(Y_LO, 9)} H${X1} M${X0} ${yv(Y_HI, 9)} H${X1}`} stroke={VOLT} strokeWidth={0.2} strokeDasharray="0.7 0.6" opacity={show} />
        <path d={`M${X0} 34 H${X1} M${X0} 45 H${X1}`} stroke={LINE} strokeWidth={0.15} opacity={show} />
        <g opacity={show}>
          <path d={w.cap} stroke={VOLT} strokeWidth={0.55} />
          <path d={w.out} strokeWidth={0.5} />
        </g>
      </Svg>
      <T x={14} y={32} size={3.4} weight={600} color={AMP} o={show} className="tabular">
        {Math.round(cmicro)} μF
      </T>
      <T x={14} y={37.5} size={2.2} color={MUTED} o={show}>
        电容
      </T>
      <T x={X0} y={6} size={2.4} anchor="start" color={MUTED} o={show}>
        电容电压
      </T>
      <T x={X0} y={30} size={2.4} anchor="start" color={MUTED} o={show}>
        输出
      </T>
      <T x={14} y={48.4} size={2.6} o={enter(t, b.lowf, 0.4)} className="tabular">
        频率 {freq.toFixed(freq % 1 > 0.04 && freq % 1 < 0.96 ? 1 : 0)} Hz
      </T>
    </>
  )
}

// ── duty: two resistors up, one down ───────────────────────────────────────

function Duty({ t, b, still }: StageProps) {
  const X0 = 52
  const X1 = 96
  const T0 = 3.0
  const dd = 2 / 3
  const speed = 8
  const mt = still ? b.longer : t
  const t0 = b.two - 0.3
  const w = wavePaths(X0, X1, (x) => (mt - (X1 - x) / speed - t0) / T0, dd, 9, 34, 45)
  const fNow = (mt - t0) / T0
  const charging = cyc(fNow, dd).hi
  const show = enter(t, b.duty - 0.1, 0.5)
  const hiRa = enter(t, b.two, 0.3)
  const hiRb = enter(t, b.two + 0.1, 0.3)
  const ra = charging ? AMP : undefined
  const rb = hiRb > 0.3 ? AMP : undefined
  const state = hiRa * (charging ? 1 : 0.55)
  return (
    <>
      <Svg>
        <g opacity={show}>
          <path d="M14 9 H30" />
          <path d="M22 9 V9" />
          <Sym x={22} y={14.4} scale={0.18} color={hiRa > 0.3 ? ra : undefined}>
            <Resistor x={0} y={0} rot={90} />
          </Sym>
          <Sym x={22} y={25.2} scale={0.18} color={rb}>
            <Resistor x={0} y={0} rot={90} />
          </Sym>
          <Sym x={22} y={36} scale={0.18}>
            <Capacitor x={0} y={0} rot={90} />
          </Sym>
          <path d="M22 41.4 V43 M20.4 43 H23.6 M21 44 H23 M21.6 45 H22.4" />
          <path d="M22 19.8 H33" stroke={!charging && hiRa > 0.3 ? AMP : undefined} />
          <circle cx={22} cy={19.8} r={0.6} fill="currentColor" stroke="none" />
          <circle cx={36} cy={19.8} r={2.2} />
          <path d="M36 22 V25 M34.6 25 H37.4" />
        </g>
        <path d={`M${X0} ${yv(Y_LO, 9)} H${X1} M${X0} ${yv(Y_HI, 9)} H${X1}`} stroke={VOLT} strokeWidth={0.2} strokeDasharray="0.7 0.6" opacity={show} />
        <path d={`M${X0} 34 H${X1} M${X0} 45 H${X1}`} stroke={LINE} strokeWidth={0.15} opacity={show} />
        <g opacity={show}>
          <path d={w.cap} stroke={VOLT} strokeWidth={0.55} />
          <path d={w.out} strokeWidth={0.5} />
        </g>
      </Svg>
      <T x={17.4} y={14.4} size={2.4} anchor="end" o={show}>
        <V>R</V>
        <M>A</M>
      </T>
      <T x={17.4} y={25.2} size={2.4} anchor="end" o={show}>
        <V>R</V>
        <M>B</M>
      </T>
      <T x={17.4} y={36} size={2.4} anchor="end" o={show}>
        <V>C</V>
      </T>
      <T x={40} y={19.8} size={2} anchor="start" color={MUTED} o={show}>
        放电管
      </T>
      <T x={22} y={6} size={2.2} color={MUTED} o={show}>
        电源
      </T>
      <T x={22} y={50} size={2.6} weight={600} color={AMP} o={hiRa * (charging ? 1 : 0)}>
        充电：走两只电阻
      </T>
      <T x={22} y={50} size={2.6} weight={600} color={AMP} o={hiRa * (charging ? 0 : 1)}>
        放电：只走一只
      </T>
      <T x={X0} y={6} size={2.4} anchor="start" color={MUTED} o={show * (1 - 0 * state)}>
        电容电压
      </T>
      <T x={X0} y={30} size={2.4} anchor="start" color={MUTED} o={show}>
        输出
      </T>
      <T x={X1} y={30} size={2.6} anchor="end" weight={600} o={enter(t, b.longer, 0.4)}>
        高电平更长
      </T>
    </>
  )
}

// ── two thresholds clean a noisy signal ─────────────────────────────────────

function Schmitt({ t, b }: Pick<StageProps, "t" | "b">) {
  const X0 = 22
  const X1 = 86
  const head = X0 + (X1 - X0) * easeInOut((t - b.thr) / 2.6)
  const nz = enter(t, b.noise - 0.3, 0.9)
  const YC = 17
  const AM = 6
  const n = 140
  const base = (x: number) => 0.9 * Math.sin(0.115 * (x - X0) + 0.4)
  const noise = (x: number) => 0.14 * Math.sin(2.9 * x) + 0.09 * Math.sin(5.3 * x + 1) + 0.07 * Math.sin(8.7 * x + 2)
  const sig = (x: number) => base(x) + nz * noise(x)
  const one: [number, number][] = []
  const two: [number, number][] = []
  const inp: [number, number][] = []
  let st = false
  for (let i = 0; i <= n; i++) {
    const x = X0 + ((X1 - X0) * i) / n
    if (x > head) break
    const s = sig(x)
    if (s > 0.3) st = true
    else if (s < -0.3) st = false
    inp.push([x, YC - AM * s])
    one.push([x, s > 0 ? 30 : 36])
    two.push([x, st ? 42 : 48])
  }
  const rowOne = enter(t, b.noise, 0.5)
  const rowTwo = enter(t, b.thr + 1.2, 0.5)
  const yT = (v: number) => YC - AM * v
  return (
    <>
      <Svg>
        <path d={`M${X0} ${yT(0.3)} H${X1} M${X0} ${yT(-0.3)} H${X1}`} stroke={VOLT} strokeWidth={0.2} strokeDasharray="0.7 0.6" opacity={enter(t, b.thr, 0.5)} />
        {inp.length > 1 && <path d={poly(inp)} stroke={VOLT} strokeWidth={0.45} />}
        <g opacity={rowOne}>{one.length > 1 && <path d={poly(one)} stroke={MUTED} strokeWidth={0.4} />}</g>
        <g opacity={rowTwo}>{two.length > 1 && <path d={poly(two)} strokeWidth={0.55} />}</g>
      </Svg>
      <T x={X0 - 1.5} y={YC} size={2.4} anchor="end" color={MUTED} o={enter(t, b.thr - 0.2, 0.5)}>
        输入
      </T>
      <T x={X0 - 1.5} y={33} size={2.4} anchor="end" color={MUTED} o={rowOne}>
        一个门限
      </T>
      <T x={X0 - 1.5} y={45} size={2.4} anchor="end" weight={600} o={rowTwo}>
        两个门限
      </T>
      <T x={X1 + 1.5} y={yT(0.3)} size={2.2} anchor="start" color={VOLT} o={enter(t, b.thr, 0.5)}>
        上门限
      </T>
      <T x={X1 + 1.5} y={yT(-0.3)} size={2.2} anchor="start" color={VOLT} o={enter(t, b.thr, 0.5)}>
        下门限
      </T>
      <T x={X1 + 1.5} y={33} size={2.2} anchor="start" color={MUTED} o={rowOne * enter(t, b.noise + 1, 0.5)}>
        乱跳
      </T>
      <T x={X1 + 1.5} y={45} size={2.2} anchor="start" weight={600} o={enter(t, b.clean, 0.4)}>
        干净
      </T>
    </>
  )
}

// ── RC against a crystal ────────────────────────────────────────────────────

function Crystals({ t, b }: Pick<StageProps, "t" | "b">) {
  const base = enter(t, b.xtal + 0.4, 0.5)
  const barRc = glide(t, b.rcw, 0, 44, 1.4)
  const rowX = enter(t, b.xtal + 0.4, 0.5)
  const rowRc = enter(t, b.xtal + 0.7, 0.5)
  const tick = pop(t, b.xdone)
  return (
    <>
      <T x={50} y={9} size={3.6} weight={600} o={enter(t, b.xtal, 0.5)}>
        一天会差多少
      </T>
      <Svg>
        <path d="M38 15 V45" stroke={LINE} strokeWidth={0.25} opacity={base} />
        <g opacity={rowRc}>
          <Sym x={24} y={24} scale={0.2}>
            <Resistor x={0} y={0} />
          </Sym>
        </g>
        <g opacity={rowX}>
          <Sym x={24} y={39} scale={0.22}>
            <Crystal x={0} y={0} />
          </Sym>
        </g>
        <rect x={38} y={22} width={barRc} height={4} fill={VOLT} fillOpacity={0.85} stroke="none" />
        <rect x={38} y={37} width={0.7 * tick + 0.001} height={4} fill={AMP} stroke="none" />
      </Svg>
      <T x={8} y={24} size={3} anchor="start" weight={600} o={rowRc}>
        阻容
      </T>
      <T x={8} y={39} size={3} anchor="start" weight={600} o={rowX}>
        晶振
      </T>
      <T x={38 + barRc + 1.5} y={24} size={2.8} anchor="start" weight={600} color={VOLT} o={enter(t, b.rcw + 1.2, 0.4)}>
        十几分钟
      </T>
      <T x={41.5} y={39} size={2.8} anchor="start" weight={600} color={AMP} o={enter(t, b.xdone, 0.4)}>
        一两秒
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "振荡器与 555 定时器",
  audio,
  timing,
  poster: 3.6,
  Stage,
}

export default function Oscillators555Film() {
  return <FilmPlayer film={film} />
}

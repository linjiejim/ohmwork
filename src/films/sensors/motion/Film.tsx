import { trace } from "@/lab/colors"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, M, Scene, Svg, T, V, enter, glide, span, type FilmDef, type StageProps } from "../../kit"
import { AMP, Box, GOOD, HArrow, HEAT, LINE, MUTED, Outro, VOLT, riseFn, rnd, sceneO } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

const ACC = trace.second
const GYR = trace.third
const rad = (d: number) => (d * Math.PI) / 180

/*
 * 运动与位置传感器, ~60 s. Scenes, each keyed to the words that introduce it:
 *   title → a phone turning, a balancing car leaning
 *   → accelerometer: a proof mass lags, the capacitor gaps change → at rest it reads 1 g
 *   → tilt splits gravity between two axes (atan2) → vibration makes the angle jump
 *   → gyroscope integrates and drifts → complementary filter keeps the best of both
 *   → Hall element and a magnet → quadrature encoder → "try it below".
 */
function Stage({ t, b, still }: StageProps) {
  const A = span(t, 0.25, b.acc - 0.15, 0.4, 0.3)
  const S = [
    sceneO(t, b.acc, b.g),
    sceneO(t, b.g, b.tilt),
    sceneO(t, b.tilt, b.shake),
    sceneO(t, b.shake, b.gyro),
    sceneO(t, b.gyro, b.fuse),
    sceneO(t, b.fuse, b.hall),
    sceneO(t, b.hall, b.enc),
    sceneO(t, b.enc, b.outro),
  ]
  const outro = enter(t, b.outro - 0.3, 0.4)
  return (
    <>
      <Scene o={A}>
        <Title t={t} b={b} still={still} />
      </Scene>
      <Scene o={S[0]}>
        <Mass t={t} b={b} still={still} />
      </Scene>
      <Scene o={S[1]}>
        <Rest t={t} b={b} />
      </Scene>
      <Scene o={S[2]}>
        <Tilt t={t} b={b} />
      </Scene>
      <Scene o={S[3]}>
        <Shake t={t} b={b} still={still} />
      </Scene>
      <Scene o={S[4]}>
        <Gyro t={t} b={b} />
      </Scene>
      <Scene o={S[5]}>
        <Fuse t={t} b={b} />
      </Scene>
      <Scene o={S[6]}>
        <Hall t={t} b={b} still={still} />
      </Scene>
      <Scene o={S[7]}>
        <Encoder t={t} b={b} still={still} />
      </Scene>
      <Scene o={outro}>
        <Outro t={t} still={still} at={b.outro} hintAt={b.try} hint="倾斜实验台里的板子，看加速度怎么分到两根轴上" />
      </Scene>
    </>
  )
}

// ── title ────────────────────────────────────────────────────────────────────

function Title({ t, b, still }: StageProps) {
  const rise = riseFn(t, still)
  const phone = enter(t, b.phone, 0.5)
  const car = enter(t, b.car, 0.5)
  const turn = still ? 90 : glide(t, b.phone + 1.2, 0, 90, 1.0)
  const lean = still ? 12 : 14 * Math.sin((t - b.car) * 1.8)
  return (
    <>
      <T x={50} y={9} size={7} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
        运动与位置传感器
      </T>
      <Svg>
        <Box x={8} y={17} w={38} h={28} o={enter(t, b.phone - 0.2, 0.5)} />
        <Box x={54} y={17} w={38} h={28} o={enter(t, b.car - 0.2, 0.5)} />
        <g opacity={phone} transform={`rotate(${turn} 27 30)`}>
          <rect x={22.5} y={22} width={9} height={16} rx={1.4} />
          <path d="M25.5 36 h3" />
        </g>
        <g opacity={car} transform={`rotate(${lean} 73 40)`}>
          <rect x={69} y={22} width={8} height={14} rx={1.2} />
          <circle cx={73} cy={40} r={3.6} />
        </g>
        <path d="M62 43.6 H84" opacity={car} stroke={LINE} />
      </Svg>
      <T x={27} y={47.5} size={2.4} color={MUTED} o={enter(t, b.phone + 0.3, 0.5)}>
        横屏还是竖屏
      </T>
      <T x={73} y={47.5} size={2.4} color={MUTED} o={enter(t, b.car + 0.3, 0.5)}>
        歪了多少
      </T>
    </>
  )
}

// ── proof mass ──────────────────────────────────────────────────────────────

function spring(x0: number, x1: number, y: number, amp = 1.2, n = 6) {
  let d = `M${x0} ${y}`
  const step = (x1 - x0) / (n + 1)
  for (let i = 0; i < n; i++) d += `L${x0 + step * (i + 0.5)} ${y + (i % 2 ? amp : -amp)}`
  return d + `L${x1} ${y}`
}

function Mass({ t, b, still }: StageProps) {
  const frame = enter(t, b.acc, 0.5)
  const mass = enter(t, b.mass, 0.5)
  const push = enter(t, b.lag - 0.4, 0.5)
  const shift = still ? -6 : glide(t, b.lag - 0.2, 0, -6, 0.5)
  const cx = 50 + shift
  const cap = enter(t, b.cap, 0.5)
  const L = 33
  const R = 67
  const mw = 12
  return (
    <>
      <Svg>
        <path d={`M${L} 17 H${R} V43 H${L} Z`} opacity={frame} />
        <g opacity={mass}>
          <rect x={cx - mw / 2} y={24} width={mw} height={12} rx={1} fill="var(--muted)" />
          <path d={spring(L, cx - mw / 2, 30)} />
          <path d={spring(cx + mw / 2, R, 30)} />
        </g>
        <g opacity={cap} strokeWidth={0.7}>
          <path d={`M${L + 1.8} 25 V35`} stroke={VOLT} />
          <path d={`M${cx - mw / 2 - 1.2} 25.5 V34.5`} stroke={VOLT} />
          <path d={`M${R - 1.8} 25 V35`} stroke={VOLT} />
          <path d={`M${cx + mw / 2 + 1.2} 25.5 V34.5`} stroke={VOLT} />
        </g>
        <g opacity={push}>
          <HArrow x0={40} x1={60} y={12} p={1} color={HEAT} />
        </g>
      </Svg>
      <T x={50} y={9} size={3.4} weight={600} o={span(t, b.acc, b.lag - 0.4, 0.5, 0.4)}>
        加速度计
      </T>
      <T x={50} y={47.5} size={2.6} color={MUTED} o={mass}>
        硅片里一个被细梁悬着的质量块
      </T>
      <T x={50} y={8.5} size={2.6} color={HEAT} weight={600} o={push}>
        芯片往右加速
      </T>
      <T x={cx} y={20.5} size={2.4} color={MUTED} o={enter(t, b.lag, 0.5)}>
        质量块滞后
      </T>
      <T x={L - 3} y={27.5} size={2.4} anchor="end" color={VOLT} weight={600} o={cap}>
        空隙变小
      </T>
      <T x={L - 3} y={32.5} size={2.4} anchor="end" color={VOLT} weight={600} o={cap}>
        电容变大
      </T>
      <T x={R + 3} y={27.5} size={2.4} anchor="start" color={MUTED} o={cap}>
        空隙变大
      </T>
      <T x={R + 3} y={32.5} size={2.4} anchor="start" color={MUTED} o={cap}>
        电容变小
      </T>
    </>
  )
}

// ── at rest: 1 g ────────────────────────────────────────────────────────────

function Rest({ t, b }: Pick<StageProps, "t" | "b">) {
  const board = enter(t, b.g, 0.5)
  const grav = enter(t, b.rest, 0.5)
  const one = enter(t, b.one, 0.5)
  const rows = [
    ["X", "0.00 g", MUTED],
    ["Y", "0.00 g", MUTED],
    ["Z", "1.00 g", AMP],
  ] as const
  return (
    <>
      <Svg>
        <g opacity={board}>
          <rect x={14} y={30} width={32} height={3.5} rx={0.6} fill="var(--muted)" />
          <path d="M20 33.5 V37 M40 33.5 V37" />
        </g>
        <Draw d="M30 26 V14" p={grav} stroke={HEAT} />
        <path d="M28.6 16 L30 14 L31.4 16" stroke={HEAT} opacity={grav} />
        <path d="M30 40 V51" stroke={HEAT} opacity={grav} />
        <path d="M28.6 49 L30 51 L31.4 49" stroke={HEAT} opacity={grav} />
        <path d="M60 18 V46" stroke={LINE} strokeWidth={0.2} opacity={board} />
      </Svg>
      <T x={30} y={10} size={2.4} color={HEAT} o={grav}>
        托着它的力 ↑
      </T>
      <T x={36} y={47} size={2.4} anchor="start" color={HEAT} weight={600} o={enter(t, b.one, 0.5)}>
        重力 1 g
      </T>
      <T x={19} y={41} size={2.4} color={MUTED} o={board}>
        静止的板子
      </T>
      {rows.map(([axis, val, c], i) => (
        <T key={axis} x={66} y={22 + i * 8} size={3.4} anchor="start" color={c} weight={axis === "Z" ? 600 : 400} o={enter(t, b.rest + i * 0.3, 0.5)} className="tabular">
          {axis} 轴{"  "}
          <span style={{ opacity: axis === "Z" ? one : 1 }}>
            <M>{axis === "Z" && one < 0.5 ? "—" : val}</M>
          </span>
        </T>
      ))}
    </>
  )
}

// ── tilt ────────────────────────────────────────────────────────────────────

function Tilt({ t, b }: Pick<StageProps, "t" | "b">) {
  const th = glide(t, b.tiltw, 0, 30, 1.2)
  const L = 22
  const P = [34, 17]
  const u = [Math.cos(rad(th)), Math.sin(rad(th))]
  const n = [-Math.sin(rad(th)), Math.cos(rad(th))]
  const gx = Math.sin(rad(th)) * L
  const gz = Math.cos(rad(th)) * L
  const comps = enter(t, b.tiltw + 0.8, 0.5)
  const at = enter(t, b.atan, 0.5)
  const arrow = (x0: number, y0: number, dx: number, dy: number, c: string, o: number) => {
    const len = Math.hypot(dx, dy) || 1
    const ex = dx / len
    const ey = dy / len
    const x1 = x0 + dx
    const y1 = y0 + dy
    return (
      <g stroke={c} opacity={o}>
        <path d={`M${x0} ${y0} L${x1} ${y1}`} />
        <path d={`M${x1 - ex * 1.2 - ey * 0.8} ${y1 - ey * 1.2 + ex * 0.8} L${x1} ${y1} L${x1 - ex * 1.2 + ey * 0.8} ${y1 - ey * 1.2 - ex * 0.8}`} />
      </g>
    )
  }
  return (
    <>
      <Svg>
        <path d={`M${P[0] - u[0] * 14 - n[0] * 1.6} ${P[1] - u[1] * 14 - n[1] * 1.6} L${P[0] + u[0] * 14 - n[0] * 1.6} ${P[1] + u[1] * 14 - n[1] * 1.6}`} strokeWidth={1.2} opacity={enter(t, b.tilt, 0.5)} />
        {arrow(P[0], P[1], 0, L, HEAT, enter(t, b.tilt + 0.3, 0.5))}
        {arrow(P[0], P[1], u[0] * gx, u[1] * gx, ACC, comps)}
        {arrow(P[0], P[1], n[0] * gz, n[1] * gz, GYR, comps)}
      </Svg>
      <T x={P[0] + 3} y={P[1] + L + 2} size={2.4} anchor="start" color={HEAT} o={enter(t, b.tilt + 0.3, 0.5)}>
        重力
      </T>
      <T x={67} y={14} size={2.4} anchor="start" color={MUTED} o={enter(t, b.tiltw, 0.5)}>
        倾斜 <M>{Math.round(th)}°</M>
      </T>
      <T x={67} y={22} size={3.6} anchor="start" color={ACC} weight={600} o={comps} className="tabular">
        <V>a</V>
        <sub style={{ fontSize: "0.6em" }}>x</sub> <M>{(Math.sin(rad(th))).toFixed(2)} g</M>
      </T>
      <T x={67} y={30} size={3.6} anchor="start" color={GYR} weight={600} o={comps} className="tabular">
        <V>a</V>
        <sub style={{ fontSize: "0.6em" }}>z</sub> <M>{(Math.cos(rad(th))).toFixed(2)} g</M>
      </T>
      <T x={67} y={42} size={3.2} anchor="start" weight={600} o={at}>
        <M>θ = atan2(</M>
        <V>a</V>
        <sub style={{ fontSize: "0.6em" }}>x</sub>
        <M>, </M>
        <V>a</V>
        <sub style={{ fontSize: "0.6em" }}>z</sub>
        <M>)</M>
      </T>
    </>
  )
}

// ── vibration ───────────────────────────────────────────────────────────────

function Shake({ t, b, still }: StageProps) {
  const X0 = 36
  const X1 = 92
  const go = enter(t, b.shakew, 0.4)
  const prog = Math.min(1, Math.max(0, (t - b.shakew) / 4.0))
  const n = 70
  const noise = enter(t, b.jump - 0.3, 0.8)
  let d = ""
  for (let i = 0; i <= n * prog; i++) {
    const x = X0 + ((X1 - X0) * i) / n
    const y = 30 + (rnd(i, 7) - 0.5) * 22 * noise
    d += `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`
  }
  const jx = still ? 0 : (rnd(Math.floor(t * 20), 1) - 0.5) * 1.2
  return (
    <>
      <Svg>
        <g transform={`translate(${jx} 0)`} opacity={enter(t, b.shake, 0.4)}>
          <rect x={10} y={26} width={20} height={4} rx={0.6} fill="var(--muted)" />
          <path d="M8 22 l-2 2 M8 32 l-2 -2 M32 22 l2 2 M32 32 l2 -2" strokeWidth={0.3} />
        </g>
        <Draw d={`M${X0} 46 H${X1 + 2} M${X0} 46 V12`} p={enter(t, b.shake + 0.3, 0.6)} />
        <path d={`M${X0} 30 H${X1}`} stroke={LINE} strokeWidth={0.2} opacity={go} />
        <path d={d} stroke={ACC} strokeWidth={0.4} opacity={go} />
      </Svg>
      <T x={20} y={39} size={2.6} weight={600} o={enter(t, b.shakew, 0.4)}>
        振动
      </T>
      <T x={X0 + 1} y={9} size={2.4} anchor="start" color={MUTED} o={enter(t, b.shake + 0.3, 0.5)}>
        算出的角度
      </T>
      <T x={X1} y={50} size={2.4} anchor="end" color={MUTED} o={enter(t, b.shake + 0.3, 0.5)}>
        时间
      </T>
      <T x={X1 - 2} y={13} size={3} anchor="end" weight={600} color={HEAT} o={noise}>
        角度乱跳
      </T>
      <T x={X1 + 1} y={30} size={2.2} anchor="start" color={MUTED} o={go}>
        真实
      </T>
    </>
  )
}

// ── gyro drift ──────────────────────────────────────────────────────────────

const GX0 = 18
const GX1 = 84
const GY0 = 44
const GY1 = 12

function Gyro({ t, b }: Pick<StageProps, "t" | "b">) {
  const chain = enter(t, b.gyro, 0.5)
  const sum = enter(t, b.sum, 0.5)
  const draw = enter(t, b.sum + 0.2, 3.2)
  const drift = enter(t, b.drift - 0.3, 0.5)
  const gy = (deg: number) => GY0 - (deg / 30) * (GY0 - GY1)
  const N = 40
  let d = ""
  for (let i = 0; i <= N * draw; i++) {
    const p = i / N
    d += `${i ? "L" : "M"}${(GX0 + (GX1 - GX0) * p).toFixed(2)} ${gy(30 * p).toFixed(2)}`
  }
  return (
    <>
      <T x={GX0} y={7.5} size={2.8} anchor="start" weight={600} o={chain}>
        <span style={{ color: GYR }}>角速度</span>
        <span style={{ opacity: sum }}>
          <span className="text-muted-foreground"> → 累加 → </span>
          角度
        </span>
      </T>
      <T x={52} y={28} size={2.8} color={MUTED} o={span(t, b.gyro + 0.4, b.sum, 0.5, 0.3)}>
        测的是转得有多快，单位：度每秒
      </T>
      <Svg>
        <Draw d={`M${GX0} ${GY0} H${GX1 + 2}`} p={chain} />
        <Draw d={`M${GX0} ${GY0} V${GY1 - 2}`} p={chain} />
        <path d={`M${GX0} ${GY0} H${GX1}`} stroke={GOOD} strokeWidth={0.4} opacity={sum} />
        <path d={d} stroke={GYR} strokeWidth={0.55} />
        <path d={`M${GX1 + 3} ${gy(0)} V${gy(30)}`} stroke={HEAT} opacity={drift} />
      </Svg>
      <T x={GX0 + 2} y={GY0 + 3.4} size={2.2} anchor="start" color={MUTED} o={chain}>
        0
      </T>
      <T x={GX1} y={GY0 + 3.4} size={2.2} color={MUTED} o={enter(t, b.drift - 0.3, 0.5)}>
        一分钟
      </T>
      <T x={GX0 - 1.5} y={gy(30)} size={2.2} anchor="end" color={MUTED} o={drift} className="tabular">
        <M>30°</M>
      </T>
      <T x={GX1} y={GY0 - 3} size={2.4} anchor="end" color={GOOD} o={sum}>
        真实角度：没动
      </T>
      <T x={GX1 + 5.5} y={(gy(0) + gy(30)) / 2} size={3} anchor="start" weight={600} color={HEAT} o={drift}>
        漂
      </T>
    </>
  )
}

// ── complementary filter ────────────────────────────────────────────────────

function Fuse({ t, b }: Pick<StageProps, "t" | "b">) {
  const X0 = 14
  const X1 = 66
  const base = 28
  const axes = enter(t, b.fusew, 0.6)
  const ac = enter(t, b.fusew + 0.3, 0.5)
  const draw = enter(t, b.fusew + 0.4, 2.0)
  const fused = enter(t, b.fusew + 1.6, 2.0)
  const N = 70
  const path = (f: (p: number) => number, k: number) => {
    let d = ""
    for (let i = 0; i <= N * k; i++) {
      const p = i / N
      d += `${i ? "L" : "M"}${(X0 + (X1 - X0) * p).toFixed(2)} ${f(p).toFixed(2)}`
    }
    return d
  }
  const accY = (p: number) => base + (rnd(Math.round(p * N), 2) - 0.5) * 7
  const gyrY = (p: number) => base - p * 14
  const fuY = (p: number) => base + 0.7 * Math.sin(p * 7)
  return (
    <>
      <Svg>
        <Draw d={`M${X0} 46 H${X1 + 2} M${X0} 46 V12`} p={axes} />
        <path d={`M${X0} ${base} H${X1}`} stroke={LINE} strokeWidth={0.2} opacity={ac} />
        <path d={path(accY, draw)} stroke={ACC} strokeWidth={0.3} opacity={ac} />
        <path d={path(gyrY, draw)} stroke={GYR} strokeWidth={0.45} opacity={ac} />
        <path d={path(fuY, fused)} stroke={GOOD} strokeWidth={0.8} />
      </Svg>
      <T x={X1} y={50} size={2.2} anchor="end" color={MUTED} o={axes}>
        时间
      </T>
      <T x={72} y={14} size={2.6} anchor="start" weight={600} color={GYR} o={enter(t, b.short - 0.1, 0.5)}>
        陀螺仪
      </T>
      <T x={72} y={19} size={2.2} anchor="start" color={MUTED} o={enter(t, b.short - 0.1, 0.5)}>
        短期准，长期漂
      </T>
      <T x={72} y={26} size={2.6} anchor="start" weight={600} color={ACC} o={enter(t, b.long - 0.1, 0.5)}>
        加速度计
      </T>
      <T x={72} y={31} size={2.2} anchor="start" color={MUTED} o={enter(t, b.long - 0.1, 0.5)}>
        长期对，短期抖
      </T>
      <T x={72} y={40} size={2.6} anchor="start" weight={600} color={GOOD} o={fused}>
        互补滤波
      </T>
      <T x={72} y={45} size={2.2} anchor="start" color={MUTED} o={fused}>
        取两者之长
      </T>
    </>
  )
}

// ── Hall element ────────────────────────────────────────────────────────────

function Hall({ t, b, still }: StageProps) {
  const chip = enter(t, b.hallw, 0.5)
  const mx = still ? 46 : glide(t, b.mag, 84, 46, 1.8)
  const near = mx < 58
  const flip = enter(t, b.mag + 1.4, 0.3)
  const mo = enter(t, b.mag - 0.3, 0.5)
  return (
    <>
      <Svg>
        <rect x={16} y={14} width={14} height={14} rx={1.4} opacity={chip} />
        <path d="M20 28 v4 M23 28 v4 M26 28 v4" opacity={chip} />
        <g opacity={mo}>
          <rect x={mx - 6} y={16} width={6} height={10} fill={HEAT} stroke="none" opacity={0.85} />
          <rect x={mx} y={16} width={6} height={10} fill={AMP} stroke="none" opacity={0.85} />
        </g>
        <path d={`M28 48 H92`} stroke={LINE} opacity={chip} />
        <path d={`M28 ${near ? 41 : 48} H92`} stroke={near ? GOOD : MUTED} strokeWidth={0.7} opacity={chip} />
      </Svg>
      <T x={23} y={36} size={2.8} weight={600} o={chip}>
        霍尔元件
      </T>
      <T x={mx} y={11.5} size={2.4} color={MUTED} o={mo}>
        磁铁
      </T>
      <T x={16} y={44.5} size={2.6} anchor="start" color={MUTED} o={chip}>
        输出
      </T>
      <T x={84} y={34} size={4} weight={600} color={near ? GOOD : MUTED} o={chip}>
        {near ? "高" : "低"}
      </T>
      <T x={56} y={34} size={2.4} color={MUTED} o={flip}>
        磁铁一靠近，输出翻转
      </T>
    </>
  )
}

// ── quadrature encoder ──────────────────────────────────────────────────────

function Encoder({ t, b, still }: StageProps) {
  const disc = enter(t, b.encw, 0.5)
  const spin = still ? 0 : (t - b.encw) * 40
  const bOn = enter(t, b.quad - 0.2, 0.5)
  const dirAt = b.dir - 0.9
  const dirO = enter(t, dirAt, 0.5)
  const period = 12
  const ph = still ? 0 : (t - b.encw) * 8
  // the marker rides one rising edge of A (the waves scroll left at 8 units/s)
  const ph0 = still ? 0 : (dirAt - b.encw) * 8
  const edge0 = 46 - ph0 + period * Math.ceil((60 - 46 + ph0) / period)
  const markX = edge0 - (ph - ph0)
  // a square wave on 46…92, high while (x − 46 + ph − shift) mod period < period/2; edges at their exact x
  const wave = (y: number, shift: number) => {
    const half = period / 2
    const lvl = (x: number) => ((((x - 46 + ph - shift) % period) + period) % period < half ? y - 3 : y + 3)
    let x = 46
    let d = `M46 ${lvl(46)}`
    while (x < 92) {
      const p = (((x - 46 + ph - shift) % half) + half) % half
      const nx = Math.min(92, x + (half - p || half))
      d += `H${nx.toFixed(2)}`
      if (nx < 92) d += `V${lvl(nx + 0.001)}`
      x = nx
    }
    return d
  }
  return (
    <>
      <Svg>
        <g opacity={disc}>
          <circle cx={22} cy={30} r={13} />
          <circle cx={22} cy={30} r={2} />
          <g transform={`rotate(${spin} 22 30)`} strokeWidth={0.5}>
            {Array.from({ length: 16 }, (_, i) => {
              const a = (i / 16) * Math.PI * 2
              return <path key={i} d={`M${22 + Math.cos(a) * 9} ${30 + Math.sin(a) * 9} L${22 + Math.cos(a) * 12.2} ${30 + Math.sin(a) * 12.2}`} />
            })}
          </g>
        </g>
        <path d={wave(22, 0)} stroke={ACC} strokeLinecap="butt" opacity={disc} />
        <path d={wave(38, period / 4)} stroke={GYR} strokeLinecap="butt" opacity={bOn} />
        <g opacity={dirO}>
          <path d={`M${markX} 17 V43`} stroke={HEAT} strokeWidth={0.3} />
        </g>
      </Svg>
      <T x={22} y={47.5} size={2.6} weight={600} o={disc}>
        增量式编码器
      </T>
      <T x={44} y={22} size={2.6} anchor="end" color={ACC} weight={600} o={disc}>
        A
      </T>
      <T x={44} y={38} size={2.6} anchor="end" color={GYR} weight={600} o={bOn}>
        B
      </T>
      <T x={74} y={11} size={2.6} weight={600} o={bOn}>
        错开四分之一周期
      </T>
      <T x={74} y={50} size={2.8} weight={600} color={HEAT} o={dirO}>
        A 上升时看 B：先后就是方向
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "运动与位置传感器",
  audio,
  timing,
  poster: 4.0,
  Stage,
}

export default function MotionFilm() {
  return <FilmPlayer film={film} />
}


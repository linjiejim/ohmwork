import { trace } from "@/lab/colors"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, Scene, Svg, T, easeInOut, enter, lerp, span, type FilmDef, type StageProps } from "../../kit"
import { Box, LINE, MUTED, Outro, Sw, along, gnd, head, stepPath, vzig } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

const VOLT = trace.voltage
const AMP = trace.current
const GOOD = trace.good
const CLK = trace.second

/*
 * I²C 总线, ~55 s. Scenes, each keyed to the words that introduce it:
 *   title → devices on two shared wires (SDA, SCL), master and slaves, an address called down the bus
 *   → one transfer on the two wires: start, address bits, the ninth-clock ACK, stop
 *   → open-drain: the device only pulls low, the pull-up resistor lifts the line slowly → "try it below".
 */
function Stage({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.6) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)
  const lift = (at: number) => (still ? 0 : -easeInOut((t - at) / 0.45) * 2)

  const bus = span(t, 0.25, b.start - 0.45)
  const wave = span(t, b.start - 0.2, b.pullup - 0.45)
  const pull = span(t, b.pullup - 0.2, b.outro - 0.45)

  return (
    <>
      <Scene o={bus} dy={lift(b.start - 0.45)}>
        <Bus t={t} b={b} rise={rise} />
      </Scene>
      <Scene o={wave}>
        <Transfer t={t} b={b} />
      </Scene>
      <Scene o={pull}>
        <PullUp t={t} b={b} still={still} />
      </Scene>
      <Outro t={t} b={b} still={still} hint="拨一拨地址，看一次传输怎么走" tryAt={b.tryit} />
    </>
  )
}

// ── the bus ──────────────────────────────────────────────────────────────────

const SCL_Y = 21
const SDA_Y = 27
const CENTERS = [30, 48, 66, 84]
const NAMES = ["主机", "屏幕", "温度", "加速度"]
const ADDRS = ["", "0x3C", "0x48", "0x68"]

function Bus({ t, b, rise }: Pick<StageProps, "t" | "b"> & { rise: (at: number, d?: number) => number }) {
  const lines = enter(t, b.two, 0.8)
  const par = (i: number) => enter(t, b.par + i * 0.18, 0.4)
  const dev = (i: number) => enter(t, b.devs + (i === 0 ? -0.8 : i * 0.25), 0.5)
  const call = Math.min(1, Math.max(0, (t - b.shout) / Math.max(0.3, b.match - b.shout)))
  const matched = enter(t, b.match, 0.3)
  const answered = enter(t, b.reply, 0.3)
  const pk = along([[30, SDA_Y], [66, SDA_Y]], call)
  const back = along([[66, SDA_Y], [30, SDA_Y]], Math.min(1, Math.max(0, (t - b.reply) / 0.9)))
  const dim = (i: number) => (i === 1 || i === 3 ? 1 - 0.65 * matched : 1)
  return (
    <>
      <Svg>
        <Draw d={`M22 ${SCL_Y}H95`} p={lines} stroke={CLK} strokeWidth={0.5} />
        <Draw d={`M22 ${SDA_Y}H95`} p={lines} stroke={VOLT} strokeWidth={0.5} />
        {CENTERS.map((c, i) => (
          <g key={c} opacity={dim(i)}>
            <Box x={c - 7} y={36} w={14} h={9} o={dev(i)} color={i === 0 && t > b.mst ? VOLT : undefined} strokeWidth={i === 0 && t > b.mst ? 0.5 : undefined} />
            <Draw d={`M${c - 2.5} 36V${SCL_Y}`} p={par(i)} stroke={CLK} />
            <Draw d={`M${c + 2.5} 36V${SDA_Y}`} p={par(i)} stroke={VOLT} />
            <circle cx={c - 2.5} cy={SCL_Y} r={0.7} fill={CLK} stroke="none" opacity={par(i)} />
            <circle cx={c + 2.5} cy={SDA_Y} r={0.7} fill={VOLT} stroke="none" opacity={par(i)} />
          </g>
        ))}
        {/* the target lights up, the others stay quiet */}
        <rect x={66 - 7} y={36} width={14} height={9} rx={1} fill="none" stroke={GOOD} strokeWidth={0.6} opacity={matched} />
        <path d={head(66, SDA_Y, 1, 1.2)} opacity={0} />
        <g opacity={answered * (1 - enter(t, b.reply + 1.2, 0.3))}>
          <path d={`M66 ${SDA_Y + 3}H33`} stroke={AMP} strokeWidth={0.45} />
          <path d={head(33, SDA_Y + 3, -1, 1.2)} stroke={AMP} strokeWidth={0.45} />
        </g>
        <circle cx={back[0]} cy={SDA_Y + 3} r={0.8} fill={AMP} stroke="none" opacity={answered * (1 - enter(t, b.reply + 1.2, 0.3))} />
      </Svg>
      <T x={50} y={9} size={6.4} weight={600} o={enter(t, 0.3, 0.6) * (1 - enter(t, b.lines - 0.1, 0.4))} dy={rise(0.3)}>
        I²C 总线
      </T>
      <T x={20} y={SCL_Y} size={2.4} anchor="end" weight={600} color={CLK} o={enter(t, b.scl, 0.4) * lines}>
        SCL 时钟线
      </T>
      <T x={20} y={SDA_Y} size={2.4} anchor="end" weight={600} color={VOLT} o={enter(t, b.sda, 0.4) * lines}>
        SDA 数据线
      </T>
      {CENTERS.map((c, i) => (
        <T key={c} x={c} y={40.5} size={2.6} weight={i === 0 ? 600 : 400} color={i === 0 ? undefined : MUTED} o={dev(i) * dim(i)}>
          {NAMES[i]}
        </T>
      ))}
      <T x={30} y={32.2} size={2.4} weight={600} color={VOLT} o={enter(t, b.mst, 0.3) * 0 + enter(t, b.mst, 0.3)} dy={0}>
        {""}
      </T>
      <T x={30} y={49} size={2.4} weight={600} color={VOLT} o={enter(t, b.mst, 0.4)}>
        主机
      </T>
      <T x={66} y={49} size={2.4} color={MUTED} o={enter(t, b.slv, 0.4) * (1 - enter(t, b.addr, 0.3)) } >
        从机
      </T>
      {[1, 2, 3].map((i) => (
        <T key={i} x={CENTERS[i]} y={49} size={2.4} color={i === 2 && matched > 0.5 ? GOOD : MUTED} weight={i === 2 && matched > 0.5 ? 600 : 400} o={enter(t, b.addr + (i - 1) * 0.2, 0.4) * dim(i) * (i === 2 ? 1 : 1)} className="tabular">
          {ADDRS[i]}
        </T>
      ))}
      {call > 0 && call < 1 && (
        <T x={pk[0]} y={SDA_Y - 3.5} size={2.4} weight={600} className="tabular rounded-sm border border-input bg-background px-[0.5em] py-[0.3em]">
          0x48
        </T>
      )}
      <T x={66} y={SCL_Y - 3.2} size={2.4} weight={600} color={GOOD} o={matched * (1 - enter(t, b.reply + 1.2, 0.3))}>
        对上号
      </T>
      <T x={39.5} y={SDA_Y + 6.2} size={2.4} weight={600} color={AMP} o={answered * (1 - enter(t, b.reply + 1.2, 0.3))}>
        回应
      </T>
    </>
  )
}

// ── one transfer ─────────────────────────────────────────────────────────────

const ADDR_BITS = [1, 0, 0, 1, 0, 0, 0, 0] // 0x48 << 1 | W
const SLOTS = 13
const OFF = 2 // idle time before the start condition, drawn so the lanes are not bare
const SLOT = 5.2
const X0 = 16 + OFF * SLOT // x of time 0
const cx = (s: number) => X0 + s * SLOT
const SCL: [number, number][] = [[-OFF, 1], [0, 1], [1.5, 0]]
for (let k = 0; k < 9; k++) SCL.push([2.5 + k, 1], [3 + k, 0])
SCL.push([11.5, 1])
const SDA: [number, number][] = [[-OFF, 1], [0, 1], [1, 0]]
{
  const bits = [...ADDR_BITS, 0]
  bits.forEach((v, k) => {
    if (SDA[SDA.length - 1][1] !== v) SDA.push([2.15 + k, v]) // a beat after SCL falls
  })
  SDA.push([12, 1])
}
const SCL_HI = 17
const SCL_LO = 25
const SDA_HI = 33
const SDA_LO = 41

function Transfer({ t, b }: Pick<StageProps, "t" | "b">) {
  const lin = (a: number, c: number, from: number, to: number) => lerp(from, to, Math.min(1, Math.max(0, (t - a) / Math.max(0.01, c - a))))
  const cur =
    t < b.fall - 0.1
      ? lin(b.start + 0.1, b.start + 1.5, -OFF, 0.95)
      : t < b.bits
        ? lin(b.fall - 0.1, b.startC + 0.4, 0.95, 2)
        : t < b.nine - 0.2
          ? lin(b.bits, b.nine - 0.2, 2, 10)
          : t < b.ackW + 0.3
            ? lin(b.nine - 0.2, b.ackW + 0.3, 10, 11)
            : lin(b.ackW + 0.3, b.ackW + 1.6, 11, SLOTS)
  const lanes = enter(t, b.start, 0.5)
  const sp = (a: number, o = 0) => enter(t, a, 0.35) * o
  const bands = enter(t, b.hold - 0.1, 0.4)
  const ack = enter(t, b.ackW - 0.1, 0.4)
  const startTint = enter(t, b.startC - 0.2, 0.3) * (1 - enter(t, b.bits - 0.1, 0.4))
  return (
    <>
      <Svg>
        <path d={`M${cx(-OFF)} ${SCL_LO + 2}H${cx(SLOTS)}`} stroke={LINE} opacity={lanes} />
        <path d={`M${cx(-OFF)} ${SDA_LO + 2}H${cx(SLOTS)}`} stroke={LINE} opacity={lanes} />
        {/* the start condition */}
        <rect x={cx(0.6)} y={SCL_HI - 4} width={cx(1.9) - cx(0.6)} height={SDA_LO - SCL_HI + 8} rx={1} fill="var(--selected)" stroke="none" opacity={startTint} />
        {/* SCL is high: the data must hold still */}
        {ADDR_BITS.map((_, k) => (
          <rect key={k} x={cx(2.5 + k)} y={SCL_HI - 1.2} width={SLOT * 0.5} height={SDA_LO - SCL_HI + 4.2} fill="var(--selected)" stroke="none" opacity={bands * (cx(3 + k) <= cx(cur) ? 1 : 0)} />
        ))}
        {/* idle: both lines sit high all the way across, until SDA falls */}
        <g opacity={1 - enter(t, b.fall - 0.15, 0.3)}>
          <Draw d={`M${cx(-OFF)} ${SCL_HI}H${cx(SLOTS)}`} p={lin(b.start + 0.1, b.start + 1.7, 0, 1)} stroke={CLK} strokeWidth={0.5} />
          <Draw d={`M${cx(-OFF)} ${SDA_HI}H${cx(SLOTS)}`} p={lin(b.start + 0.1, b.start + 1.7, 0, 1)} stroke={VOLT} strokeWidth={0.5} />
        </g>
        {lanes > 0 && <path d={stepPath(SCL, SLOTS, X0, SLOT, SCL_HI, SCL_LO, cur)} stroke={CLK} strokeWidth={0.5} opacity={lanes} />}
        {lanes > 0 && <path d={stepPath(SDA, SLOTS, X0, SLOT, SDA_HI, SDA_LO, cur)} stroke={VOLT} strokeWidth={0.5} opacity={lanes} />}
        {/* the receiver pulls SDA low in the ninth bit */}
        {cur > 10.05 && <path d={`M${cx(10)} ${SDA_LO}H${cx(Math.min(cur, 11))}`} stroke={GOOD} strokeWidth={0.8} opacity={ack} />}
        <g opacity={sp(b.startC, 1) * (1 - enter(t, b.bits - 0.1, 0.4))}>
          <path d={`M${cx(1)} ${SDA_HI - 3.5}V${SDA_HI - 1.5}`} stroke={VOLT} strokeWidth={0.4} />
          <path d={head(cx(1), SDA_HI - 1.2, 2, 1.1)} stroke={VOLT} strokeWidth={0.4} />
        </g>
      </Svg>
      <T x={cx(-OFF) - 2} y={(SCL_HI + SCL_LO) / 2} size={2.6} anchor="end" weight={600} color={CLK} o={lanes}>
        SCL
      </T>
      <T x={cx(-OFF) - 2} y={(SDA_HI + SDA_LO) / 2} size={2.6} anchor="end" weight={600} color={VOLT} o={lanes}>
        SDA
      </T>
      <T x={50} y={9} size={3} color={MUTED} o={enter(t, b.start + 0.1, 0.4) * (1 - enter(t, b.fall - 0.2, 0.3))}>
        空闲：两根线都是高
      </T>
      <T x={50} y={49.5} size={2.8} color={MUTED} o={enter(t, b.fall, 0.4) * (1 - enter(t, b.bits - 0.1, 0.4))}>
        SCL 为高时，SDA 由高变低
      </T>
      <T x={cx(1.25)} y={10} size={2.4} weight={600} o={sp(b.startC, 1)} color={VOLT}>
        起始
      </T>
      <T x={cx(5.5)} y={10} size={2.4} color={MUTED} o={sp(b.bitW - 0.4, 1) * (cur > 3 ? 1 : 0)}>
        7 位地址
      </T>
      <T x={cx(9.5)} y={10} size={2.4} color={MUTED} o={enter(t, b.nine - 0.6, 0.4) * (cur > 9.1 ? 1 : 0)}>
        读写
      </T>
      <T x={cx(10.5)} y={10} size={2.4} weight={600} color={GOOD} o={enter(t, b.nine, 0.4)}>
        应答
      </T>
      <T x={cx(12.2)} y={10} size={2.4} color={MUTED} o={enter(t, b.ackW + 1.3, 0.4)}>
        停止
      </T>
      {[...ADDR_BITS, 0].map((v, k) => (
        <T key={k} x={cx(2.5 + k)} y={47} size={3} weight={600} color={k === 8 ? GOOD : VOLT} o={enter(t, lerp(b.bits, b.nine - 0.2, k / 8) + 0.3, 0.25) * (cur > 3 + k - 0.3 ? 1 : 0) * (k === 8 ? ack : 1)} className="tabular">
          {v}
        </T>
      ))}
      <T x={cx(5.5)} y={13.4} size={2.2} color={CLK} o={bands * 0.9}>
        SCL 为高：SDA 不许动
      </T>
      <T x={cx(10.5)} y={SDA_LO + 6.3} size={2.2} color={GOOD} o={ack * 0.0} >
        从机拉低
      </T>
    </>
  )
}

// ── open-drain and the pull-up ───────────────────────────────────────────────

function PullUp({ t, b, still }: StageProps) {
  const RC = 0.4
  const lows: [number, number][] = [[b.od + 0.9, b.od + 2.0], [b.pu + 0.9, b.pu + 1.7]]
  const vAt = (s: number) => {
    let v = 1
    let rel = -Infinity
    for (const [a, c] of lows) {
      if (s >= a && s < c) return 0
      if (s >= c) rel = c
    }
    if (rel > -Infinity) v = 1 - Math.exp(-(s - rel) / RC)
    return v
  }
  const v = vAt(t)
  const driven = lows.some(([a, c]) => t >= a && t < c)
  const left = enter(t, b.pullup, 0.5)
  const rr = enter(t, b.pu - 0.1, 0.4)
  const s0 = b.od - 0.2
  const s1 = b.outro - 0.4
  const wx = (s: number) => lerp(54, 93, (s - s0) / (s1 - s0))
  const lane = enter(t, b.od - 0.1, 0.5)
  let d = ""
  const end = Math.min(t, s1)
  for (let s = s0; s <= end; s += 0.05) d += `${d ? "L" : "M"}${wx(s)} ${lerp(34, 18, vAt(s))}`
  const c = v > 0.5 ? VOLT : MUTED
  const flow: [number, number][] = [[24, 10], [24, 30], [24, 44]]
  return (
    <>
      <Svg>
        <g opacity={left}>
          <path d="M19 8H29" stroke={VOLT} strokeWidth={0.5} />
          <path d={`M24 8V10`} stroke={VOLT} />
          <path d={vzig(24, 10, 24)} strokeWidth={0.32 + rr * 0.2} stroke={rr > 0.5 ? VOLT : undefined} />
          <path d="M24 24V32" stroke={c} strokeWidth={0.45} />
          <path d="M24 28H44" stroke={c} strokeWidth={0.45} />
          <circle cx={24} cy={28} r={0.7} fill={c} stroke="none" />
          <circle cx={44} cy={28} r={1} fill={c} stroke="none" />
          <Sw x={24} y0={32} y1={44} closed={driven ? 1 : 0} />
          <path d={gnd(24, 44)} />
        </g>
        {driven &&
          Array.from({ length: 7 }, (_, i) => {
            const [x, y] = along(flow, (i / 7 + (still ? 0 : t * 0.5)) % 1)
            return <circle key={i} cx={x} cy={y} r={0.5} fill={AMP} stroke="none" opacity={left} />
          })}
        <g opacity={lane}>
          <path d="M54 34H93M54 18H93" stroke={LINE} strokeDasharray="0.6 0.8" />
          <path d={d} stroke={VOLT} strokeWidth={0.55} />
        </g>
        {d && end > s0 && <circle cx={wx(end)} cy={lerp(34, 18, vAt(end))} r={0.8} fill={VOLT} stroke="none" opacity={lane} />}
      </Svg>
      <T x={31} y={8} size={2.4} anchor="start" color={VOLT} o={left}>
        3.3 V
      </T>
      <T x={29} y={17} size={2.6} anchor="start" weight={rr > 0.5 ? 600 : 400} color={rr > 0.5 ? undefined : MUTED} o={left}>
        上拉电阻
      </T>
      <T x={29} y={38} size={2.4} anchor="start" color={MUTED} o={left}>
        器件：只会拉低
      </T>
      <T x={44} y={24.5} size={2.4} color={MUTED} o={left}>
        总线
      </T>
      <T x={51} y={18} size={2.2} anchor="end" color={MUTED} o={lane}>
        高
      </T>
      <T x={51} y={34} size={2.2} anchor="end" color={MUTED} o={lane}>
        低
      </T>
      <T x={73} y={12} size={2.6} color={MUTED} o={lane * (1 - rr)}>
        拉低：一下就到
      </T>
      <T x={73} y={12} size={2.6} weight={600} color={VOLT} o={rr}>
        拉高：电阻慢慢充
      </T>
      <T x={73} y={44} size={2.4} color={MUTED} o={enter(t, b.pu + 0.8)}>
        电阻越大，边沿越慢
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "I²C 总线",
  audio,
  timing,
  poster: 7.2,
  Stage,
}

export default function I2cFilm() {
  return <FilmPlayer film={film} />
}

import { trace } from "@/lab/colors"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, Scene, Svg, T, easeInOut, enter, lerp, span, type FilmDef, type StageProps } from "../../kit"
import { Box, LINE, MUTED, Outro, head, levelAt, rnd, stepPath } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

const VOLT = trace.voltage
const AMP = trace.current
const GOOD = trace.good
const BAD = trace.power

/*
 * UART 串口, ~55 s. Scenes, each keyed to the words that introduce it:
 *   title → two devices, two crossed wires, bits travelling → TX to RX, shared ground
 *   → no clock wire, two clocks that agree on a speed
 *   → one frame drawn bit by bit (idle, start, eight data bits LSB first, stop), the bit time, sampling mid-bit
 *   → the receiver's clock drifts and samples the wrong bits → "try it below".
 */
function Stage({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.6) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)
  const lift = (at: number) => (still ? 0 : -easeInOut((t - at) / 0.45) * 2)

  const link = span(t, 0.25, b.async - 0.45)
  const clocks = span(t, b.async - 0.2, b.idle - 0.45)
  const frame = span(t, b.idle - 0.2, b.mismatch - 0.45)
  const bad = span(t, b.mismatch - 0.2, b.outro - 0.45)

  return (
    <>
      <Scene o={link} dy={lift(b.async - 0.45)}>
        <Link t={t} b={b} still={still} rise={rise} />
      </Scene>
      <Scene o={clocks}>
        <Clocks t={t} b={b} still={still} />
      </Scene>
      <Scene o={frame}>
        <Frame t={t} b={b} mode="frame" />
      </Scene>
      <Scene o={bad}>
        <Frame t={t} b={b} mode="drift" />
      </Scene>
      <Outro t={t} b={b} still={still} hint="改一改字符和波特率，看一帧怎么变" tryAt={b.tryit} />
    </>
  )
}

// ── two devices, two crossed wires ───────────────────────────────────────────

const AX = 30 // right edge of device A
const BX = 70 // left edge of device B
const TXY = 27
const RXY = 34
const GY = 42

function Link({ t, b, rise }: StageProps & { rise: (at: number, d?: number) => number }) {
  const boxes = enter(t, b.intro + 0.6, 0.6)
  const wires = enter(t, b.two, 0.7)
  const txOn = enter(t, b.tx, 0.4)
  const rxOn = enter(t, b.rx, 0.4)
  const g = enter(t, b.gnd, 0.6)
  const bitsOn = enter(t, b.oneByOne - 0.2, 0.4)
  // bits slide along each wire, one after another
  const bits = (dir: 1 | -1, k0: number, y0: number, y1: number) =>
    Array.from({ length: 7 }, (_, i) => {
      const p = (i / 7 + t * 0.09) % 1
      const x = dir === 1 ? lerp(AX, BX, p) : lerp(BX, AX, p)
      const y = dir === 1 ? lerp(y0, y1, p) : lerp(y1, y0, p)
      const v = rnd(Math.floor(t * 0.09 + (dir === 1 ? p : 1 - p) * 0 + i) + i, k0) > 0.5
      return { x, y, v, i, p }
    })
  const a = bits(1, 1, TXY, RXY)
  const c = bits(-1, 2, TXY, RXY)
  return (
    <>
      <Svg>
        <Box x={10} y={18} w={20} h={29} o={boxes} />
        <Box x={BX} y={18} w={20} h={29} o={boxes} />
        {/* A.TX → B.RX and B.TX → A.RX cross */}
        <Draw d={`M${AX} ${TXY}L${BX} ${RXY}`} p={wires} stroke={txOn > 0.5 ? VOLT : "var(--foreground)"} strokeWidth={txOn > 0.5 ? 0.5 : 0.32} />
        <Draw d={`M${BX} ${TXY}L${AX} ${RXY}`} p={wires} stroke={rxOn > 0.5 ? AMP : "var(--foreground)"} strokeWidth={rxOn > 0.5 ? 0.5 : 0.32} />
        <path d={head(BX, RXY, 1, 1.2)} opacity={txOn} stroke={VOLT} strokeWidth={0.4} />
        <path d={head(AX, RXY, -1, 1.2)} opacity={rxOn} stroke={AMP} strokeWidth={0.4} />
        <Draw d={`M${AX} ${GY}H${BX}`} p={g} stroke={GOOD} strokeWidth={0.5} />
        <g opacity={bitsOn * (1 - g * 0)}>
          {a.map((d) => (
            <circle key={`a${d.i}`} cx={d.x} cy={d.y} r={0.7} fill={d.v ? VOLT : "var(--faint-foreground)"} stroke="none" opacity={Math.min(1, d.p * 8, (1 - d.p) * 8)} />
          ))}
          {c.map((d) => (
            <circle key={`c${d.i}`} cx={d.x} cy={d.y} r={0.7} fill={d.v ? AMP : "var(--faint-foreground)"} stroke="none" opacity={Math.min(1, d.p * 8, (1 - d.p) * 8)} />
          ))}
        </g>
        <g opacity={g} stroke={GOOD}>
          <path d={`M20 47V50M17.5 50H22.5`} strokeWidth={0} />
        </g>
      </Svg>
      <T x={50} y={9} size={6.4} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
        UART 串口
      </T>
      <T x={20} y={22} size={2.6} color={MUTED} o={boxes}>
        设备 A
      </T>
      <T x={80} y={22} size={2.6} color={MUTED} o={boxes}>
        设备 B
      </T>
      {([[26, "TX", TXY, VOLT, txOn], [26, "RX", RXY, AMP, rxOn]] as const).map(([x, s, y, c, o]) => (
        <T key={`a${s}`} x={x} y={y} size={2.6} anchor="end" weight={600} color={o > 0.5 ? c : undefined} o={enter(t, b.intro + 1.4)}>
          {s}
        </T>
      ))}
      {([[74, "TX", TXY, AMP, rxOn], [74, "RX", RXY, VOLT, txOn]] as const).map(([x, s, y, c, o]) => (
        <T key={`b${s}`} x={x} y={y} size={2.6} anchor="start" weight={600} color={o > 0.5 ? c : undefined} o={enter(t, b.intro + 1.4)}>
          {s}
        </T>
      ))}
      <T x={50} y={38} size={2.4} color={VOLT} o={txOn * (1 - rxOn)} dy={0}>
        发送 → 对方接收
      </T>
      <T x={50} y={GY + 4} size={2.6} weight={600} color={GOOD} o={g}>
        共地
      </T>
      <T x={50} y={53 - 3.5} size={2.6} color={MUTED} o={enter(t, b.two, 0.4) * (1 - txOn)}>
        两根线，一位一位地发
      </T>
    </>
  )
}

// ── no clock: two clocks agreeing on a speed ─────────────────────────────────

function Clocks({ t, b, still }: StageProps) {
  const o = enter(t, b.async, 0.5)
  const nc = enter(t, b.noclk - 0.1, 0.4)
  const sp = enter(t, b.speed - 0.1, 0.5)
  const ang = still ? 0.6 : t * 1.4
  const Clock = ({ cx, phase }: { cx: number; phase: number }) => (
    <g>
      <circle cx={cx} cy={26} r={9} fill="var(--background)" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2
        return <path key={i} d={`M${cx + Math.sin(a) * 7.4} ${26 - Math.cos(a) * 7.4}L${cx + Math.sin(a) * 8.4} ${26 - Math.cos(a) * 8.4}`} strokeWidth={0.2} />
      })}
      <path d={`M${cx} 26L${cx + Math.sin(ang + phase) * 6} ${26 - Math.cos(ang + phase) * 6}`} stroke={sp > 0.5 ? GOOD : "var(--foreground)"} strokeWidth={0.5} />
      <circle cx={cx} cy={26} r={0.7} fill="var(--foreground)" stroke="none" />
    </g>
  )
  return (
    <>
      <Svg>
        <g opacity={o}>
          <Clock cx={24} phase={0} />
          <Clock cx={76} phase={0} />
        </g>
        {/* the clock wire that is not there */}
        <g opacity={nc * (1 - sp)}>
          <path d="M36 26H64" strokeDasharray="1.2 1.2" stroke={MUTED} />
          <path d="M47 22.5L53 29.5M53 22.5L47 29.5" stroke={BAD} strokeWidth={0.6} />
        </g>
        <g opacity={sp}>
          <path d="M45 24.6H55M45 27.4H55" stroke={GOOD} strokeWidth={0.5} />
        </g>
      </Svg>
      <T x={24} y={40} size={2.6} color={MUTED} o={o}>
        设备 A 自己的钟
      </T>
      <T x={76} y={40} size={2.6} color={MUTED} o={o}>
        设备 B 自己的钟
      </T>
      <T x={50} y={34.5} size={2.8} weight={600} color={BAD} o={nc * (1 - sp)}>
        没有时钟线
      </T>
      <T x={50} y={34.5} size={2.8} weight={600} color={GOOD} o={sp}>
        约好同一个速度
      </T>
      <T x={50} y={47} size={4.2} weight={600} o={sp} className="tabular">
        9600 波特
      </T>
    </>
  )
}

// ── one frame ────────────────────────────────────────────────────────────────

const DATA = [1, 0, 0, 0, 0, 0, 1, 0] // 'A' = 0x41, low bit first
const FRAME: [number, number][] = [[0, 1], [1, 0]]
{
  DATA.forEach((v, i) => {
    if (FRAME[FRAME.length - 1][1] !== v) FRAME.push([2 + i, v])
  })
  if (FRAME[FRAME.length - 1][1] !== 1) FRAME.push([10, 1])
}
const SLOTS = 12
const X0 = 12
const SLOT = 6.4
const YHI = 20
const YLO = 32
const cx = (slot: number) => X0 + slot * SLOT

function Frame({ t, b, mode }: Pick<StageProps, "t" | "b"> & { mode: "frame" | "drift" }) {
  const drift = mode === "drift"
  const lin = (a: number, c: number, from: number, to: number) => lerp(from, to, Math.min(1, Math.max(0, (t - a) / (c - a))))
  let cur = SLOTS
  if (!drift) {
    cur =
      t < b.start - 1.0
        ? lin(b.idle, b.idleW + 0.6, 0, 1)
        : t < b.d8
          ? lin(b.start - 1.0, b.start + 0.5, 1, 2)
          : t < b.stop - 0.4
            ? lin(b.d8, b.stop - 0.4, 2, 10)
            : lin(b.stop - 0.4, b.stop + 0.6, 10, 11.5)
    if (t > b.stop + 0.6) cur = lin(b.stop + 0.6, b.stop + 1.2, 11.5, SLOTS)
  }
  const laneO = drift ? 1 : enter(t, b.idle - 0.1, 0.4)
  const spans = drift ? 0 : enter(t, b.start - 0.9, 0.4) * (1 - enter(t, b.baudW - 0.2, 0.3))
  const dLabels = drift ? 0 : enter(t, b.d8, 0.4) * (1 - enter(t, b.mid + 3.4, 0.4))
  const bit = drift ? 0 : enter(t, b.baudW + 0.2, 0.4) * (1 - enter(t, b.edge - 0.2, 0.3))
  const edgeO = drift ? 0 : enter(t, b.edge - 0.1, 0.4)
  // sample ticks: every bit time after the start edge, in the middle of each bit
  const r = drift ? lerp(1, 1.12, easeInOut((t - b.off) / 1.4)) : 1
  const tickAt = (k: number) => (drift ? b.off - 0.2 + k * 0.1 : b.mid + k * 0.12)
  const ticks = Array.from({ length: 10 }, (_, k) => {
    const p = 1 + (k + 0.5) * r
    const slot = Math.floor(p + 1e-9)
    const v = levelAt(FRAME, p)
    return { k, p, slot, v, o: enter(t, tickAt(k), 0.3), wrong: slot !== k + 1 }
  })
  const cutting = drift ? 1 : 0
  return (
    <>
      <Svg>
        {/* start bit tint */}
        <rect x={cx(1)} y={YHI - 4} width={SLOT} height={YLO - YHI + 8} fill="var(--selected)" stroke="none" opacity={enter(t, b.start - 0.9, 0.4) * (drift ? 1 : 1)} />
        <path d={`M${cx(0)} ${YLO + 3}H${cx(SLOTS)}`} stroke={LINE} opacity={laneO} />
        {laneO > 0 && <path d={stepPath(FRAME, SLOTS, X0, SLOT, YHI, YLO, cur)} stroke={VOLT} strokeWidth={0.55} opacity={laneO} />}
        {/* while idle the line just sits high, all the way across; it gives way when the start bit comes */}
        {!drift && <Draw d={`M${cx(0)} ${YHI}H${cx(SLOTS)}`} p={lin(b.idle, b.idleW + 1.4, 0, 1)} stroke={VOLT} strokeWidth={0.55} opacity={1 - enter(t, b.start - 1.0, 0.3)} />}
        {/* slot boundaries */}
        <g opacity={laneO * 0.9} stroke={LINE} strokeWidth={0.15} strokeDasharray="0.6 0.8">
          {Array.from({ length: SLOTS + 1 }, (_, i) => (i <= cur ? <path key={i} d={`M${cx(i)} ${YHI - 4}V${YLO + 3}`} /> : null))}
        </g>
        {/* the bit time */}
        <g opacity={bit} stroke={VOLT} strokeWidth={0.3}>
          <path d={`M${cx(1)} ${YHI - 5.5}V${YHI - 6.5}H${cx(2)}V${YHI - 5.5}`} />
        </g>
        {/* the falling edge the receiver waits for */}
        <g opacity={edgeO}>
          <path d={`M${cx(1)} ${YHI - 4}V${YHI - 8}`} stroke={AMP} strokeWidth={0.4} />
          <path d={head(cx(1), YLO + 3, 2, 1.2)} stroke={AMP} strokeWidth={0.4} />
        </g>
        {ticks.map((tk) => (
          <g key={tk.k} opacity={tk.o * (tk.p <= SLOTS ? 1 : 0)}>
            <path d={`M${cx(tk.p)} ${YHI - 3}V${YLO + 3}`} stroke={drift && tk.wrong ? BAD : AMP} strokeWidth={0.3} strokeDasharray="0.8 0.8" />
            <circle cx={cx(tk.p)} cy={tk.v ? YHI : YLO} r={0.9} fill={drift && tk.wrong ? BAD : AMP} stroke="none" />
          </g>
        ))}
      </Svg>
      {/* the two levels */}
      <T x={X0 - 1.8} y={YHI} size={2.3} anchor="end" color={MUTED} o={laneO}>
        高
      </T>
      <T x={X0 - 1.8} y={YLO} size={2.3} anchor="end" color={MUTED} o={laneO}>
        低
      </T>
      {/* span labels */}
      <T x={cx(0.5)} y={YHI - 6.5} size={2.3} color={MUTED} o={spans * enter(t, b.idleW)}>
        空闲
      </T>
      <T x={cx(1.5)} y={YHI - 6.5} size={2.3} weight={600} color={VOLT} o={spans * enter(t, b.start - 0.6)}>
        起始
      </T>
      <T x={cx(6)} y={YHI - 6.5} size={2.6} color={MUTED} o={spans * enter(t, b.d8)}>
        8 个数据位
      </T>
      <T x={cx(10.5)} y={YHI - 6.5} size={2.3} weight={600} color={VOLT} o={spans * enter(t, b.stop - 0.1)}>
        停止
      </T>
      <T x={cx(1.5)} y={YHI - 8.5} size={2.4} weight={600} color={VOLT} o={bit} className="tabular">
        104 μs
      </T>
      <T x={cx(7.4)} y={YHI - 8.5} size={2.6} color={MUTED} o={bit * enter(t, b.b96)}>
        9600 波特：每位 1 ÷ 9600 秒
      </T>
      <T x={cx(1) + 1.2} y={YHI - 10.5} size={2.4} anchor="start" color={AMP} o={edgeO}>
        下降沿：开始计时
      </T>
      {Array.from({ length: 8 }, (_, i) => (
        <T key={i} x={cx(2.5 + i)} y={YLO + 7} size={2.2} color={i === 0 && t > b.lsb ? VOLT : MUTED} weight={i === 0 && t > b.lsb ? 600 : 400} o={dLabels * enter(t, i === 0 ? b.d8 : lerp(b.d8, b.stop - 0.4, i / 8), 0.25)}>
          {`D${i}`}
        </T>
      ))}
      <T x={cx(2.5)} y={YLO + 11} size={2.2} anchor="start" color={VOLT} o={enter(t, b.lsb) * dLabels}>
        低位先发
      </T>
      {/* what the receiver reads */}
      {ticks.map((tk) => (
        <T key={`d${tk.k}`} x={cx(tk.p)} y={YLO + 10} size={3.4} weight={600} color={drift && tk.wrong ? BAD : AMP} o={tk.o * (tk.p <= SLOTS ? 1 : 0) * (dLabels > 0.4 ? 0 : 1) * (drift ? 1 : enter(t, b.mid + 3.4, 0.4))} className="tabular">
          {tk.v}
        </T>
      ))}
      <T x={50} y={YLO + 11} size={3} color={MUTED} o={drift ? 0 : enter(t, b.idle + 0.3, 0.4) * (1 - enter(t, b.start - 0.9, 0.3))}>
        空闲：线路一直是高电平
      </T>
      <T x={50} y={YLO + 11} size={3} color={MUTED} o={drift ? 0 : enter(t, b.start - 0.7, 0.4) * (1 - enter(t, b.d8 - 0.3, 0.3))}>
        发一个字节：先拉低一位
      </T>
      <T x={50} y={YLO + 16} size={2.6} color={MUTED} o={drift ? 0 : enter(t, b.mid + 3.6, 0.5)}>
        每位的正中间，电平最稳
      </T>
      <T x={50} y={50} size={2.8} color={MUTED} o={drift ? enter(t, b.off, 0.4) * (1 - enter(t, b.garble - 0.1, 0.3)) : 0}>
        接收端的速度略慢，采样点越走越偏
      </T>
      <T x={50} y={50} size={3.6} weight={600} color={BAD} o={drift ? enter(t, b.garble, 0.4) : 0}>
        读错了位：收到的是乱码
      </T>
      <T x={50} y={9} size={2.8} color={MUTED} o={cutting * enter(t, b.mismatch, 0.4)}>
        两边的速度不一样
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "UART 串口",
  audio,
  timing,
  poster: 4.8,
  Stage,
}

export default function UartFilm() {
  return <FilmPlayer film={film} />
}

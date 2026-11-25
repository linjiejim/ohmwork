import * as React from "react"
import { trace } from "@/lab/colors"
import { FilmPlayer } from "../../FilmPlayer"
import { Draw, Scene, Svg, T, easeInOut, enter, glide, lerp, span, type FilmDef, type StageProps } from "../../kit"
import { Box, LINE, MUTED, Outro, along, head, stepPath } from "../shared"
import timing from "./timing.json"
import audio from "./audio.mp3"

const VOLT = trace.voltage
const AMP = trace.current
const GOOD = trace.good
const CLK = trace.second
const CS = trace.third

/*
 * SPI 总线, ~65 s. Scenes, each keyed to the words that introduce it:
 *   title → master and slave joined by four wires (SCK, MOSI, MISO, CS)
 *   → three slaves share three wires, each has its own chip select; pull one low
 *   → two shift registers in a ring: eight clocks swap a byte (the bits really travel)
 *   → reading means sending a dummy byte
 *   → the four modes as four clock lanes with their sampling edges
 *   → speed bars; no address, no ACK → "try it below".
 */
function Stage({ t, b, still }: StageProps) {
  const rise = (at: number, d = 1.6) => (still ? 0 : (1 - enter(t, at, 0.5)) * d)
  const lift = (at: number) => (still ? 0 : -easeInOut((t - at) / 0.45) * 2)

  const link = span(t, 0.25, b.sel - 0.45)
  const select = span(t, b.sel - 0.2, b.shift - 0.45)
  const shift = span(t, b.shift - 0.2, b.read - 0.45)
  const read = span(t, b.read - 0.2, b.mode - 0.45)
  // the four modes only all show up on "四种", so they stay a little longer
  const mode = span(t, b.mode - 0.2, b.speed - 0.15)
  const speed = span(t, b.speed + 0.1, b.outro - 0.45)

  return (
    <>
      <Scene o={link} dy={lift(b.sel - 0.45)}>
        <Link t={t} b={b} still={still} rise={rise} />
      </Scene>
      <Scene o={select}>
        <Select t={t} b={b} still={still} />
      </Scene>
      <Scene o={shift}>
        <Shift t={t} b={b} />
      </Scene>
      <Scene o={read}>
        <Read t={t} b={b} />
      </Scene>
      <Scene o={mode}>
        <Modes t={t} b={b} />
      </Scene>
      <Scene o={speed}>
        <Speed t={t} b={b} />
      </Scene>
      <Outro t={t} b={b} still={still} hint="点一下时钟，看两个寄存器怎么换字节" tryAt={b.tryit} />
    </>
  )
}

// ── master and slave, four wires ─────────────────────────────────────────────

const WIRES = [
  { key: "sck", y: 24, color: CLK, label: "SCK 时钟", dir: 1 },
  { key: "mosi", y: 30, color: VOLT, label: "MOSI 发出", dir: 1 },
  { key: "miso", y: 36, color: AMP, label: "MISO 收回", dir: -1 },
  { key: "cs", y: 42, color: CS, label: "CS 片选", dir: 1 },
] as const

function Link({ t, b, still, rise }: StageProps & { rise: (at: number, d?: number) => number }) {
  const boxes = enter(t, b.intro + 1.0, 0.6)
  return (
    <>
      <Svg>
        <Box x={8} y={19} w={20} h={29} o={boxes} />
        <Box x={72} y={19} w={20} h={29} o={boxes} />
        {WIRES.map((w) => {
          const p = enter(t, b[w.key], 0.6)
          // each wire draws itself in the direction its data travels
          const d = w.dir === 1 ? `M28 ${w.y}H72` : `M72 ${w.y}H28`
          return (
            <g key={w.key}>
              <Draw d={d} p={p} stroke={w.color} strokeWidth={0.5} />
              <path d={w.dir === 1 ? head(72, w.y, 1, 1.2) : head(28, w.y, -1, 1.2)} stroke={w.color} strokeWidth={0.45} opacity={enter(t, b[w.key] + 0.4, 0.25)} />
              {/* a few pulses riding the wire */}
              {p > 0.99 &&
                Array.from({ length: 4 }, (_, i) => {
                  const q = (i / 4 + (still ? 0 : t * 0.22)) % 1
                  const [x, y] = along(w.dir === 1 ? [[30, w.y], [70, w.y]] : [[70, w.y], [30, w.y]], q)
                  const on = w.key === "cs" ? 0 : w.key === "sck" ? 1 : (Math.floor(i + t * 0.22 * 4 + 0) % 2) * 0 + 1
                  return on ? <circle key={i} cx={x} cy={y} r={0.5} fill={w.color} stroke="none" opacity={Math.min(1, q * 8, (1 - q) * 8)} /> : null
                })}
            </g>
          )
        })}
      </Svg>
      <T x={50} y={9} size={6.4} weight={600} o={enter(t, 0.3, 0.6)} dy={rise(0.3)}>
        SPI 总线
      </T>
      <T x={50} y={15} size={2.8} color={MUTED} o={enter(t, b.fast, 0.5)} dy={rise(b.fast, 1)}>
        高速的同步通信
      </T>
      <T x={18} y={33.5} size={3.2} weight={600} o={boxes}>
        主机
      </T>
      <T x={82} y={33.5} size={3.2} weight={600} o={boxes}>
        从机
      </T>
      {WIRES.map((w) => (
        <T key={w.key} x={50} y={w.y - 2.4} size={2.3} weight={600} color={w.color} o={enter(t, b[w.key] + 0.1, 0.4)}>
          {w.label}
        </T>
      ))}
    </>
  )
}

// ── chip select ──────────────────────────────────────────────────────────────

function Select({ t, b }: Pick<StageProps, "t" | "b" | "still">) {
  const SC = [22, 50, 78]
  const base = enter(t, b.sel, 0.5)
  const cs = (i: number) => enter(t, b.selW + i * 0.25, 0.5)
  const low = enter(t, b.lowW, 0.25)
  const picked = 1
  const lowOf = (i: number) => (i === picked ? low : 0)
  return (
    <>
      <Svg>
        <Box x={10} y={7} w={80} h={9} o={base} />
        {SC.map((c, i) => (
          <Box key={c} x={c - 11} y={38} w={22} h={10} o={base} color={lowOf(i) > 0.5 ? CS : undefined} strokeWidth={lowOf(i) > 0.5 ? 0.6 : undefined} />
        ))}
        {/* the three shared wires, drawn as one line */}
        <Draw d={`M12 16V25H72`} p={base} stroke="var(--foreground)" strokeWidth={0.9} opacity={0.55} />
        {[16, 44, 72].map((x) => (
          <Draw key={x} d={`M${x} 25V38`} p={base} stroke="var(--foreground)" strokeWidth={0.9} opacity={0.55} />
        ))}
        {/* one select wire each */}
        {SC.map((c, i) => (
          <g key={c}>
            <Draw d={`M${c + 6} 16V38`} p={cs(i)} stroke={lowOf(i) > 0.5 ? CS : LINE} strokeWidth={lowOf(i) > 0.5 ? 0.7 : 0.45} />
            <circle cx={c + 6} cy={16} r={0.7} fill={lowOf(i) > 0.5 ? CS : "var(--border)"} stroke="none" opacity={cs(i)} />
          </g>
        ))}
        {low > 0.5 &&
          Array.from({ length: 4 }, (_, i) => {
            const [x, y] = along([[44, 25], [44, 38]], (i / 4 + t * 0.6) % 1)
            return <circle key={i} cx={x} cy={y} r={0.5} fill={VOLT} stroke="none" opacity={low} />
          })}
      </Svg>
      <T x={20} y={11.5} size={2.8} weight={600} anchor="start" o={base}>
        主机
      </T>
      {SC.map((c, i) => (
        <T key={c} x={c} y={43} size={2.8} weight={lowOf(i) > 0.5 ? 600 : 400} color={lowOf(i) > 0.5 ? undefined : MUTED} o={base}>
          {`从机 ${i + 1}`}
        </T>
      ))}
      {/* sits between the trunk and the first select wire, so no line runs through it */}
      <T x={20} y={21.5} size={2.3} color={MUTED} o={base}>
        三根线共用
      </T>
      {SC.map((c, i) => (
        <T key={c} x={c + 7.5} y={31} size={2.3} anchor="start" weight={600} color={lowOf(i) > 0.5 ? CS : MUTED} o={cs(i)}>
          {`CS${i + 1}${lowOf(i) > 0.5 ? " 低" : " 高"}`}
        </T>
      ))}
      <T x={50} y={52} size={2.6} color={CS} weight={600} o={low * 0.0} >
        {""}
      </T>
    </>
  )
}

// ── two shift registers in a ring ────────────────────────────────────────────

const M_BITS = [1, 0, 1, 0, 0, 1, 0, 1] // 0xA5
const S_BITS = [0, 0, 1, 1, 1, 1, 0, 0] // 0x3C
const CW = 4.6
const MX = 8
const SX = 55.2
const RY = 24
const cm = (i: number) => MX + CW * (i + 0.5)
const cs = (i: number) => SX + CW * (i + 0.5)
const LOOP: [number, number][] = [[cs(7), RY], [96, RY], [96, 40], [4, 40], [4, RY], [cm(0), RY]]

function pos(origin: "m" | "s", j: number, kf: number): [number, number] {
  const u = j + kf
  if (origin === "m") {
    if (u < 7) return [cm(u), RY]
    if (u < 8) return [lerp(cm(7), cs(0), u - 7), RY]
    return [cs(u - 8), RY]
  }
  if (u < 7) return [cs(u), RY]
  if (u < 8) return along(LOOP, u - 7)
  return [cm(u - 8), RY]
}

function Shift({ t, b }: Pick<StageProps, "t" | "b">) {
  const t0 = b.tick + 0.2
  const t1 = b.eightW + 0.5
  const sp = (t1 - t0) / 8
  let kf = 0
  for (let i = 0; i < 8; i++) kf += easeInOut((t - t0 - i * sp) / (0.7 * sp))
  const regs = enter(t, b.shift, 0.5)
  const mstO = enter(t, b.mst, 0.4)
  const ring = enter(t, b.ring - 0.2, 0.6)
  const tok = enter(t, b.shift + 0.5, 0.5)
  const clk = enter(t, b.tick - 0.1, 0.4)
  const done = enter(t, b.done, 0.4)
  const n = Math.min(8, Math.round(kf))
  return (
    <>
      <Svg>
        {Array.from({ length: 8 }, (_, i) => (
          <React.Fragment key={i}>
            <rect x={MX + CW * i} y={RY - 3.6} width={CW} height={7.2} fill="var(--background)" stroke={done > 0.5 ? GOOD : undefined} opacity={mstO} />
            <rect x={SX + CW * i} y={RY - 3.6} width={CW} height={7.2} fill="var(--background)" stroke={done > 0.5 ? GOOD : undefined} opacity={regs} />
          </React.Fragment>
        ))}
        {/* MOSI across the top, MISO round the bottom */}
        <Draw d={`M${MX + 8 * CW} ${RY}H${SX}`} p={ring} stroke={VOLT} strokeWidth={0.5} />
        <path d={head(SX, RY, 1, 1.1)} stroke={VOLT} strokeWidth={0.45} opacity={ring} />
        <Draw d={`M${SX + 8 * CW} ${RY}H96V40H4V${RY}H${MX}`} p={ring} stroke={AMP} strokeWidth={0.5} />
        <path d={head(MX, RY, 1, 1.1)} stroke={AMP} strokeWidth={0.45} opacity={ring} />
        <g opacity={clk}>
          <path d={`M43 ${RY - 9}V${RY - 7}`} strokeWidth={0} />
        </g>
      </Svg>
      <T x={MX + 4 * CW} y={15} size={3} weight={600} o={mstO}>
        主机
      </T>
      <T x={SX + 4 * CW} y={15} size={3} weight={600} o={regs}>
        从机
      </T>
      <T x={50} y={RY - 4.8} size={2.2} color={VOLT} o={ring}>
        MOSI
      </T>
      <T x={50} y={43} size={2.2} color={AMP} o={ring}>
        MISO
      </T>
      {M_BITS.map((v, j) => {
        const [x, y] = pos("m", j, kf)
        return (
          <T key={`m${j}`} x={x} y={y} size={3} weight={600} color={VOLT} o={tok} className="tabular">
            {v}
          </T>
        )
      })}
      {S_BITS.map((v, j) => {
        const [x, y] = pos("s", j, kf)
        return (
          <T key={`s${j}`} x={x} y={y} size={3} weight={600} color={AMP} o={tok} className="tabular">
            {v}
          </T>
        )
      })}
      <T x={50} y={RY + 12} size={3} weight={600} color={CLK} o={clk} className="tabular">
        {`时钟 ${n} / 8`}
      </T>
      <T x={MX + 4 * CW} y={RY + 8} size={2.4} color={MUTED} o={mstO * (1 - done)} className="tabular">
        0xA5
      </T>
      <T x={SX + 4 * CW} y={RY + 8} size={2.4} color={MUTED} o={regs * (1 - done)} className="tabular">
        0x3C
      </T>
      <T x={MX + 4 * CW} y={RY + 8} size={2.8} weight={600} color={AMP} o={done} className="tabular">
        0x3C
      </T>
      <T x={SX + 4 * CW} y={RY + 8} size={2.8} weight={600} color={VOLT} o={done} className="tabular">
        0xA5
      </T>
      <T x={50} y={49} size={3} weight={600} color={GOOD} o={done}>
        交换完成：各拿到对方的字节
      </T>
    </>
  )
}

// ── reading = sending a dummy byte ───────────────────────────────────────────

function Read({ t, b }: Pick<StageProps, "t" | "b">) {
  const o = enter(t, b.read, 0.5)
  const arrows = enter(t, b.noread - 0.2, 0.5)
  const dum = enter(t, b.dummy - 0.1, 0.4)
  const run = (y: number, dir: 1 | -1) =>
    Array.from({ length: 5 }, (_, i) => {
      const [x, yy] = along(dir === 1 ? [[32, y], [68, y]] : [[68, y], [32, y]], (i / 5 + t * 0.3) % 1)
      return { x, yy, i }
    })
  return (
    <>
      <Svg>
        <Box x={8} y={16} w={22} h={28} o={o} />
        <Box x={70} y={16} w={22} h={28} o={o} />
        <Draw d="M30 25H70" p={arrows} stroke={VOLT} strokeWidth={0.5} />
        <path d={head(70, 25, 1, 1.2)} stroke={VOLT} strokeWidth={0.45} opacity={arrows} />
        <Draw d="M70 35H30" p={arrows} stroke={AMP} strokeWidth={0.5} />
        <path d={head(30, 35, -1, 1.2)} stroke={AMP} strokeWidth={0.45} opacity={arrows} />
        {arrows > 0.99 &&
          run(25, 1).map((d) => <circle key={`a${d.i}`} cx={d.x} cy={d.yy} r={0.6} fill={VOLT} stroke="none" opacity={dum > 0.5 ? 0.5 : 1} />)}
        {arrows > 0.99 && run(35, -1).map((d) => <circle key={`b${d.i}`} cx={d.x} cy={d.yy} r={0.6} fill={AMP} stroke="none" />)}
      </Svg>
      <T x={19} y={30} size={3.2} weight={600} o={o}>
        主机
      </T>
      <T x={81} y={30} size={3.2} weight={600} o={o}>
        从机
      </T>
      <T x={50} y={21} size={2.5} color={VOLT} o={arrows}>
        发出一个字节
      </T>
      <T x={50} y={39.5} size={2.5} color={AMP} o={arrows}>
        同时收回一个字节
      </T>
      <T x={50} y={49} size={3} o={dum}>
        <span className="tabular">
          <span style={{ color: VOLT, fontWeight: 600 }}>0x00</span>
          <span style={{ color: MUTED }}> 占位 → 换回 </span>
          <span style={{ color: AMP, fontWeight: 600 }}>想读的数据</span>
        </span>
      </T>
    </>
  )
}

// ── the four modes ───────────────────────────────────────────────────────────

const NOTE = ["空闲低，上升沿采样", "空闲低，下降沿采样", "空闲高，下降沿采样", "空闲高，上升沿采样"]

function Modes({ t, b }: Pick<StageProps, "t" | "b">) {
  const cells = [0, 1, 2, 3].map((m) => {
    const col = m % 2 === 0 ? 0 : 1
    const row = m < 2 ? 0 : 1
    const appear = m % 2 === 0 ? enter(t, b.mode - 0.15 + (m === 2 ? 0.5 : 0), 0.5) : enter(t, b.four - 0.2 + (m === 3 ? 0.3 : 0), 0.5)
    // modes 0 and 2 stand alone in the middle at first, then make room for 1 and 3
    return { m, gx: col ? 54 : glide(t, b.four - 0.8, 31, 8, 0.6), gy: row ? 30 : 8, appear, cpol: m >> 1, cpha: m & 1 }
  })
  return (
    <>
      <Svg>
        {cells.map(({ m, gx, gy, appear, cpol, cpha }) => {
          const x0 = gx + 3
          const slot = 4
          const yHi = gy + 6
          const yLo = gy + 13
          const idle = cpol
          const pts: [number, number][] = [[0, idle]]
          for (let i = 0; i < 3; i++) pts.push([1 + 2 * i, 1 - idle], [2 + 2 * i, idle])
          const samples = [0, 1, 2].map((i) => (cpha === 0 ? 1 + 2 * i : 2 + 2 * i))
          const edgeO = enter(t, b.edgeW - 0.1 + (m % 2 === 1 ? b.four - b.edgeW + 0.3 : 0), 0.4)
          return (
            <g key={m} opacity={appear}>
              <rect x={gx} y={gy} width={38} height={19.5} rx={1} fill="var(--background)" stroke={LINE} />
              <path d={stepPath(pts, 7, x0, slot, yHi, yLo)} stroke={CLK} strokeWidth={0.5} />
              {samples.map((s, i) => {
                const lvl = pts.filter((p) => p[0] <= s).slice(-1)[0][1]
                return (
                  <g key={i} opacity={edgeO}>
                    <path d={`M${x0 + s * slot} ${yHi - 1.5}V${yLo + 1.5}`} stroke={AMP} strokeWidth={0.25} strokeDasharray="0.7 0.7" />
                    <circle cx={x0 + s * slot} cy={(yHi + yLo) / 2} r={0.8} fill={AMP} stroke="none" />
                    {lvl > -1 && null}
                  </g>
                )
              })}
            </g>
          )
        })}
      </Svg>
      {cells.map(({ m, gx, gy, appear }) => (
        <React.Fragment key={m}>
          <T x={gx + 2} y={gy + 3} size={2.4} weight={600} anchor="start" o={appear}>
            {`模式 ${m}`}
          </T>
          <T x={gx + 19} y={gy + 17.5} size={2.1} color={MUTED} o={appear * enter(t, m % 2 === 0 ? b.mode + 0.9 : b.four, 0.5)}>
            {NOTE[m]}
          </T>
        </React.Fragment>
      ))}
      <T x={50} y={52} size={2.4} color={MUTED} o={enter(t, b.four + 0.4, 0.5) * 0}>
        {""}
      </T>
    </>
  )
}

// ── speed ────────────────────────────────────────────────────────────────────

function Speed({ t, b }: Pick<StageProps, "t" | "b">) {
  const o = enter(t, b.speed, 0.5)
  const fast = easeInOut((t - (b.speed + 0.8)) / Math.max(1.5, b.mhz + 0.8 - (b.speed + 0.8)))
  const slow = easeInOut((t - (b.speed + 0.2)) / 0.6)
  const none = enter(t, b.noaddr, 0.4)
  return (
    <>
      <Svg>
        <g opacity={o}>
          <path d="M22 14V38" stroke={LINE} />
        </g>
        <rect x={22.4} y={17} width={lerp(0, 6, slow)} height={6} rx={0.8} fill={AMP} stroke="none" opacity={o} />
        <rect x={22.4} y={29} width={lerp(0, 66, fast)} height={6} rx={0.8} fill={VOLT} stroke="none" opacity={o} />
        {/* the break: not to scale */}
        <g opacity={fast > 0.95 ? 1 : 0} stroke="var(--background)" strokeWidth={1}>
          <path d="M58 28V36M60 28V36" />
        </g>
      </Svg>
      <T x={20} y={20} size={3} anchor="end" weight={600} o={o}>
        I²C
      </T>
      <T x={20} y={32} size={3} anchor="end" weight={600} o={o}>
        SPI
      </T>
      <T x={30} y={20} size={2.8} anchor="start" color={AMP} weight={600} o={slow} className="tabular">
        400 kHz
      </T>
      <T x={89} y={25.5} size={2.8} anchor="end" color={VOLT} weight={600} o={enter(t, b.mhz, 0.4)} className="tabular">
        几十 MHz
      </T>
      <T x={50} y={44} size={2.8} color={MUTED} o={none}>
        <span className="inline-flex gap-[1.6em]">
          <span>没有地址</span>
          <span>没有应答</span>
          <span>推挽输出，边沿陡</span>
        </span>
      </T>
    </>
  )
}

export const film: FilmDef = {
  title: "SPI 总线",
  audio,
  timing,
  poster: 5.2,
  Stage,
}

export default function SpiFilm() {
  return <FilmPlayer film={film} />
}

import * as React from "react"
import { catVar } from "@/lib/categorical"
import { Button, ControlField, Lab, LabControls, LabNote, LabReadouts, LabStage, Label, PlayButton, Readout, SliderField, TAU, formatSI, trace, usePlayback, useTime } from "@/lab"
import { C0, Canvas, formatLength } from "./kit"

const F_MIN = 1e5
const F_MAX = 1e11
const DECADES = 6

const LICENSED = catVar("purple")
const FREE = catVar("teal")

interface Band {
  id: string
  /** Text on the quick-jump button; bands without one are only found by dragging. */
  chip?: string
  /** 0: licensed services (upper row). 1: licence-free bands (lower row). */
  row: 0 | 1
  /** [low, high] in Hz. A service may own several pieces. */
  ranges: [number, number][]
  /** Where the button lands. */
  jump: number
  note: string
}

/* Allocations differ by country; these are the commonly quoted edges. */
const BANDS: Band[] = [
  {
    id: "mw",
    chip: "中波广播",
    row: 0,
    ranges: [[526.5e3, 1606.5e3]],
    jump: 1e6,
    note: "中波广播（526.5–1606.5 kHz）：调幅电台。波长几百米，能贴着地面绕过山丘，夜里还会被电离层反射到上千公里外。",
  },
  {
    id: "nfc",
    chip: "NFC",
    row: 1,
    ranges: [[13.553e6, 13.567e6]],
    jump: 13.56e6,
    note: "13.56 MHz：NFC 和公交卡、门禁卡。波长 22 m，读卡距离却只有几厘米，靠的是两个线圈之间的磁场耦合，不是辐射出去的电磁波。",
  },
  {
    id: "fm",
    chip: "调频广播",
    row: 0,
    ranges: [[87.5e6, 108e6]],
    jump: 98e6,
    note: "调频广播（87.5–108 MHz）：波长约 3 m，基本只能传到看得见的范围，所以每座城市都有自己的发射塔。",
  },
  {
    id: "433",
    chip: "433 MHz",
    row: 1,
    ranges: [[433.05e6, 434.79e6]],
    jump: 433.92e6,
    note: "433 MHz 免许可频段（433.05–434.79 MHz）：车钥匙、遥控插座、无线门铃。绕射好，但整段只有 1.74 MHz 宽，传不快。",
  },
  {
    id: "868",
    chip: "868 MHz",
    row: 1,
    ranges: [[863e6, 870e6]],
    jump: 868e6,
    note: "868 MHz（863–870 MHz）：欧洲的免许可频段，LoRa 和无线抄表在用。中国的 LoRa 设备多用 470–510 MHz。",
  },
  {
    id: "915",
    chip: "915 MHz",
    row: 1,
    ranges: [[902e6, 928e6]],
    jump: 915e6,
    note: "915 MHz（902–928 MHz）：美洲的免许可频段，LoRa、Z-Wave 在用。在中国和欧洲，这一段分给了别的业务，不能随便用。",
  },
  {
    id: "gnss",
    chip: "GPS L1",
    row: 0,
    ranges: [[1559e6, 1610e6]],
    jump: 1575.42e6,
    note: "卫星导航 L1（1575.42 MHz）：GPS L1 和北斗 B1C 都以它为中心。卫星在两万公里外，信号到地面时比噪声还弱，要靠扩频才能捞出来。",
  },
  {
    id: "cell",
    chip: "蜂窝",
    row: 0,
    ranges: [
      [703e6, 960e6],
      [1710e6, 2200e6],
      [2300e6, 2400e6],
      [2496e6, 2690e6],
      [3300e6, 4200e6],
      [4400e6, 5000e6],
    ],
    jump: 1.8e9,
    note: "蜂窝移动通信（2G–5G）：各国分配不同，大致集中在 700–960 MHz、1.7–2.7 GHz 和 3.3–5 GHz。运营商买下执照，独占使用。",
  },
  {
    id: "2g4",
    chip: "2.4 GHz",
    row: 1,
    ranges: [[2400e6, 2483.5e6]],
    jump: 2.45e9,
    note: "2.4 GHz 免许可频段（2400–2483.5 MHz）：全球通用。Wi-Fi、蓝牙、Zigbee、无线鼠标和微波炉，都挤在这 83.5 MHz 里。",
  },
  {
    id: "wifi5",
    chip: "5 GHz Wi-Fi",
    row: 1,
    ranges: [[5150e6, 5850e6]],
    jump: 5.5e9,
    note: "5 GHz Wi-Fi（5150–5850 MHz，各国开放的子段不同）：可用带宽是 2.4 GHz 频段的好几倍，更快也更清净，但穿墙更差。",
  },
  {
    id: "mmw",
    chip: "5G 毫米波",
    row: 0,
    ranges: [[24.25e9, 29.5e9]],
    jump: 28e9,
    note: "5G 毫米波（24.25–29.5 GHz 一带）：单个信道就有几百 MHz 宽，速率极高，但一堵墙、一棵树就能挡住。",
  },
  {
    id: "60g",
    row: 1,
    ranges: [[57e9, 66e9]],
    jump: 60e9,
    note: "60 GHz 免许可频段（57–66 GHz）：WiGig 和手势、存在检测雷达。氧气会吸收这个频率，又穿不了墙，基本只在一个房间里用。",
  },
  {
    id: "radar",
    row: 0,
    ranges: [[76e9, 81e9]],
    jump: 77e9,
    note: "车载毫米波雷达（76–81 GHz）：波长不到 4 mm，一整排天线可以直接做在芯片封装上。",
  },
]

/* ITU band names. Each runs from the previous `to` up to its own. */
const ITU = [
  { to: 3e5, code: "LF", name: "低频（长波）", note: "低频（长波）：波长上千米，沿地面能传几千公里，用于导航和授时。可用带宽极小，传不了多少数据。" },
  { to: 3e6, code: "MF", name: "中频（中波）", note: "中频：除了中波广播，还有航海通信和业余无线电。波长几百米，天线只能是铁塔或长线。" },
  { to: 3e7, code: "HF", name: "高频（短波）", note: "高频（短波）：能被电离层反射回地面，一跳上千公里。短波广播、远洋通信、业余无线电在用。" },
  { to: 3e8, code: "VHF", name: "甚高频", note: "甚高频：对讲机、航空通信、调频广播。电离层不再反射，基本按视距传播。" },
  { to: 3e9, code: "UHF", name: "特高频", note: "特高频：电视、对讲机、手机、Wi-Fi、蓝牙都在这里。天线只有几厘米到几十厘米，穿墙绕射还过得去，是最拥挤的一段。" },
  { to: 3e10, code: "SHF", name: "超高频", note: "超高频（厘米波）：卫星电视、雷达、点对点微波。带宽充裕，但几乎只走直线，怕遮挡。" },
  { to: Infinity, code: "EHF", name: "极高频（毫米波）", note: "极高频（毫米波）：带宽极大，但雨、墙甚至树叶都会明显削弱信号，只适合短距离或对准了的波束。" },
]
const ITU_EDGES = [F_MIN, 3e5, 3e6, 3e7, 3e8, 3e9, 3e10, F_MAX]

/** One slider step is 1.4%, so a band narrower than that is still "hit" when the frequency lands right beside it. */
const NEAR = 1.015

function findBand(f: number): { band: Band; inside: boolean } | undefined {
  const order = [...BANDS.filter((b) => b.row === 1), ...BANDS.filter((b) => b.row === 0)]
  const inside = order.find((b) => b.ranges.some(([lo, hi]) => f >= lo && f <= hi))
  if (inside) return { band: inside, inside: true }
  const near = order.find((b) => b.ranges.some(([lo, hi]) => f >= lo / NEAR && f <= hi * NEAR))
  return near ? { band: near, inside: false } : undefined
}

/** What a quarter-wave antenna of this size looks like in practice. */
function antennaSize(quarter: number): string {
  if (quarter >= 100) return "上百米的铁塔"
  if (quarter >= 10) return "几十米高的塔"
  if (quarter >= 1) return "几米长的拉杆"
  if (quarter >= 0.1) return "一根小棒"
  if (quarter >= 0.01) return "能画在电路板上"
  if (quarter >= 0.001) return "指甲盖上能放一排"
  return "能做进芯片封装"
}

const TICKS = ["100 kHz", "1 MHz", "10 MHz", "100 MHz", "1 GHz", "10 GHz", "100 GHz"]

/** The radio spectrum on a log axis: who lives where, and a cursor at the current frequency. */
function SpectrumStrip({ f, activeId }: { f: number; activeId?: string }) {
  const ituIndex = ITU.findIndex((b) => f < b.to)
  return (
    <Canvas height={78} label="100 kHz 到 100 GHz 的无线电频谱：上排是需要执照的业务，下排是免许可频段，竖线是当前频率">
      {(w) => {
        const x0 = 16
        const pw = w - 32
        const fx = (hz: number) => x0 + (Math.log10(hz / F_MIN) / DECADES) * pw
        const sparse = pw < 420
        const cx = fx(f)
        return (
          <>
            {/* ITU band names */}
            {ITU.map((b, i) => (
              <Label key={b.code} x={(fx(ITU_EDGES[i]) + fx(ITU_EDGES[i + 1])) / 2} y={13} size={12} weight={i === ituIndex ? 600 : 400} color={i === ituIndex ? "var(--foreground)" : "var(--faint-foreground)"}>
                {b.code}
              </Label>
            ))}
            {ITU_EDGES.slice(1, -1).map((edge) => (
              <line key={edge} x1={fx(edge)} x2={fx(edge)} y1={3} y2={56} stroke="var(--border)" strokeWidth={1} />
            ))}
            {/* the two rows */}
            <rect x={x0} y={20} width={pw} height={14} rx={2} fill="var(--muted)" stroke="none" />
            <rect x={x0} y={38} width={pw} height={14} rx={2} fill="var(--muted)" stroke="none" />
            {BANDS.flatMap((b) =>
              b.ranges.map(([lo, hi], i) => {
                const width = Math.max(3, fx(hi) - fx(lo))
                return (
                  <rect
                    key={`${b.id}${i}`}
                    x={(fx(lo) + fx(hi)) / 2 - width / 2}
                    y={b.row === 0 ? 20 : 38}
                    width={width}
                    height={14}
                    rx={1.5}
                    fill={b.row === 0 ? LICENSED : FREE}
                    opacity={b.id === activeId ? 1 : 0.4}
                    stroke="none"
                  />
                )
              }),
            )}
            {/* frequency axis */}
            <line x1={x0} x2={x0 + pw} y1={56} y2={56} stroke="var(--input)" strokeWidth={1} />
            {TICKS.map((text, i) => {
              const x = x0 + (pw * i) / DECADES
              const labelled = !sparse || i % 2 === 0
              return (
                <g key={text}>
                  <line x1={x} x2={x} y1={56} y2={labelled ? 61 : 59} stroke="var(--input)" strokeWidth={1} />
                  {labelled && (
                    <Label x={i === 0 ? x - 6 : i === DECADES ? x + 6 : x} y={74} size={12} anchor={i === 0 ? "start" : i === DECADES ? "end" : "middle"} color="var(--faint-foreground)">
                      {text}
                    </Label>
                  )}
                </g>
              )
            })}
            {/* cursor */}
            <line x1={cx} x2={cx} y1={18} y2={56} strokeWidth={1.5} />
            <path d={`M${cx - 4} 16H${cx + 4}L${cx} 22Z`} fill="currentColor" strokeWidth={1} />
          </>
        )
      }}
    </Canvas>
  )
}

/** A sine wave drifting to the right over a ruler. The ruler re-ranges by decades so 1–10 wavelengths are always on screen. */
function TravellingWave({ wavelength, playing }: { wavelength: number; playing: boolean }) {
  const t = useTime(playing)
  const span = 10 ** Math.ceil(Math.log10(wavelength))
  const cycles = span / wavelength
  return (
    <Canvas height={104} label={`一列向右传播的电磁波，波长 ${formatLength(wavelength)}，画面宽 ${formatLength(span)}`}>
      {(w) => {
        const x0 = 16
        const pw = w - 32
        const lpx = pw / cycles
        const shift = t * 0.12 * pw
        const n = 240
        let d = ""
        for (let i = 0; i <= n; i++) {
          const x = (pw * i) / n
          const y = 52 - 18 * Math.sin((TAU * (x - shift)) / lpx)
          d += `${i ? "L" : "M"}${(x0 + x).toFixed(1)} ${y.toFixed(1)}`
        }
        return (
          <>
            <Label x={x0} y={12} anchor="start" size={12} muted>
              一个波长 λ = {formatLength(wavelength)}
            </Label>
            <path d={`M${x0} 22H${x0 + lpx}M${x0} 18V26M${x0 + lpx} 18V26`} stroke="var(--muted-foreground)" strokeWidth={1.25} />
            <line x1={x0} x2={x0 + pw} y1={52} y2={52} stroke="var(--border)" strokeWidth={1} />
            <path d={d} stroke={trace.voltage} strokeWidth={2} />
            {/* ruler */}
            <line x1={x0} x2={x0 + pw} y1={82} y2={82} stroke="var(--input)" strokeWidth={1} />
            {Array.from({ length: 11 }, (_, i) => {
              const x = x0 + (pw * i) / 10
              return <line key={i} x1={x} x2={x} y1={82} y2={i % 5 === 0 ? 88 : 85} stroke="var(--input)" strokeWidth={1} />
            })}
            <Label x={x0} y={101} anchor="start" size={12} color="var(--faint-foreground)">
              0
            </Label>
            <Label x={x0 + pw / 2} y={101} size={12} color="var(--faint-foreground)">
              {formatLength(span / 2)}
            </Label>
            <Label x={x0 + pw} y={101} anchor="end" size={12} color="var(--faint-foreground)">
              {formatLength(span)}
            </Label>
          </>
        )
      }}
    </Canvas>
  )
}

/** Frequency → wavelength → antenna size, on a map of who uses which part of the spectrum. */
export function WavelengthLab() {
  const [f, setF] = React.useState(2.45e9)
  const playback = usePlayback()
  const wavelength = C0 / f
  const hit = findBand(f)
  const itu = ITU.find((b) => f < b.to) ?? ITU[ITU.length - 1]
  return (
    <Lab title="频率、波长与频谱" hint="拖动频率，或者点一个常见频段：看波长怎么变，这个频率被谁占着。" actions={<PlayButton playback={playback} />} onReset={() => setF(2.45e9)}>
      <LabStage>
        <div className="flex flex-col gap-4">
          <TravellingWave wavelength={wavelength} playing={playback.playing} />
          <div>
            <SpectrumStrip f={f} activeId={hit?.band.id} />
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: LICENSED }} />
                上排：需要执照的业务
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: FREE }} />
                下排：免许可频段
              </span>
            </div>
          </div>
        </div>
      </LabStage>
      <LabControls columns={1}>
        <SliderField label="频率 f" value={f} onChange={setF} min={F_MIN} max={F_MAX} log format={(v) => formatSI(v, "Hz", 6)} />
        <ControlField label="跳到常见频段">
          {BANDS.filter((b) => b.chip).map((b) => (
            <Button key={b.id} size="sm" aria-pressed={hit?.band.id === b.id && hit.inside} className={hit?.band.id === b.id ? "border-foreground" : undefined} onClick={() => setF(b.jump)}>
              <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: b.row === 0 ? LICENSED : FREE }} />
              {b.chip}
            </Button>
          ))}
        </ControlField>
      </LabControls>
      <LabReadouts>
        <Readout label="波长 λ = c ÷ f" value={formatLength(wavelength)} color={trace.voltage} />
        <Readout label="λ/4 天线" value={formatLength(wavelength / 4)} sub={antennaSize(wavelength / 4)} />
        <Readout label="λ/10" value={formatLength(wavelength / 10)} sub="导线比这长就按射频对待" />
        <Readout label="所在频段" value={itu.code} sub={itu.name} />
      </LabReadouts>
      <LabNote>{hit ? `${hit.inside ? "" : "当前频率紧挨着这一段。"}${hit.band.note}` : itu.note}</LabNote>
    </Lab>
  )
}

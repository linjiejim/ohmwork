import * as React from "react"
import { ControlField, Lab, LabControls, LabNote, LabReadouts, LabStage, Readout, Select, SliderField, SwitchField, formatSI, percent, sig, trace, useWidth } from "@/lab"

/*
 * Power budget of the lesson's running project, a battery-powered
 * temperature / humidity logger. Every load is either working or idle:
 *
 *   I_avg = Σ ( I_work · d + I_idle · (1 − d) ),   d = t_on / T
 *
 * Loads that follow the wake cycle use d = t_on / T; an always-on load
 * (a power LED, an MCU that never sleeps) uses d = 1.
 * Runtime = capacity / I_avg. The currents are typical orders of magnitude.
 */
const MCU_RUN = 5e-3
const MCU_SLEEP = 2e-6
const SENSOR_RUN = 1e-3
const SENSOR_IDLE = 0.2e-6
const OLED_RUN = 15e-3
const OLED_IDLE = 10e-6
const RADIO_RUN = 80e-3
const RADIO_IDLE = 5e-6
const LED_RUN = 2e-3

const BATTERIES = [
  // a coin cell's internal resistance (ten ohms and up) limits the pulse it can deliver
  { value: "cr2032", label: "CR2032 纽扣电池（约 220 mAh）", name: "CR2032", mah: 220, pulse: 15e-3 },
  { value: "aa", label: "两节 5 号电池（约 2500 mAh）", name: "两节 5 号电池", mah: 2500, pulse: Infinity },
  { value: "18650", label: "18650 锂电池（约 2600 mAh）", name: "18650", mah: 2600, pulse: Infinity },
]

interface Row {
  id: "mcu" | "sensor" | "oled" | "radio" | "led"
  name: string
  on: boolean
  /** Share of the average current spent working / idling, in amps. */
  work: number
  idle: number
  /** Current while working, for the peak. */
  peak: number
}

function duration(hours: number): string {
  if (hours < 1) return `${sig(hours * 60, 2)} 分钟`
  if (hours < 72) return `${sig(hours, 3)} 小时`
  const days = hours / 24
  if (days < 730) return `${sig(days, 3)} 天`
  return `${sig(days / 365, 3)} 年`
}

const fmtPeriod = (s: number) => (s < 60 ? `${sig(s, 3)} s` : s < 3600 ? `${sig(s / 60, 3)} 分钟` : `${sig(s / 3600, 3)} 小时`)

const ROW_H = 38

/** Horizontal bars: each load's share of the average current, split into working and idle parts. */
function ShareBars({ rows, total }: { rows: Row[]; total: number }) {
  const [ref, width] = useWidth<HTMLDivElement>(560)
  const w = Math.max(200, width)
  const top = rows.reduce((best, r) => (r.on && r.work + r.idle > best.work + best.idle ? r : best), rows[0])
  return (
    <div ref={ref} className="mx-auto w-full max-w-xl min-w-0">
      <svg width={w} height={rows.length * ROW_H} viewBox={`0 0 ${w} ${rows.length * ROW_H}`} role="img" aria-label="各模块占平均电流的比例" className="block max-w-full select-none">
        {rows.map((r, i) => {
          const y = i * ROW_H
          const sum = r.on ? r.work + r.idle : 0
          const workW = total > 0 ? (w * (r.on ? r.work : 0)) / total : 0
          const idleW = total > 0 ? (w * (r.on ? r.idle : 0)) / total : 0
          return (
            <g key={r.id} opacity={r.on ? 1 : 0.45}>
              <text x={0} y={y + 14} className="fill-foreground text-small">
                {r.name}
                {r.on && r.id === top.id ? " · 最多" : ""}
              </text>
              <text x={w} y={y + 14} textAnchor="end" className="tabular fill-muted-foreground text-caption">
                {r.on ? `${formatSI(sum, "A")} · ${percent(total > 0 ? sum / total : 0)}` : "没装"}
              </text>
              <rect x={0} y={y + 21} width={w} height={9} rx={2} fill="var(--border)" />
              {workW > 0 && <rect x={0} y={y + 21} width={Math.max(1.5, workW)} height={9} rx={2} fill={trace.current} />}
              {idleW > 0 && <rect x={workW} y={y + 21} width={Math.max(1.5, Math.min(idleW, w - workW))} height={9} rx={2} fill={trace.current} opacity={0.4} />}
            </g>
          )
        })}
      </svg>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-4 rounded-xs" style={{ background: trace.current }} />
          工作时花掉的
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-4 rounded-xs opacity-40" style={{ background: trace.current }} />
          待机时花掉的
        </span>
      </p>
    </div>
  )
}

/** Duty-cycled loads on a small battery: who eats the average current, and how long the cell lasts. */
export function PowerBudgetLab() {
  const [period, setPeriod] = React.useState(60)
  const [tOn, setTOn] = React.useState(0.2)
  const [battery, setBattery] = React.useState("cr2032")
  const [sleep, setSleep] = React.useState(true)
  const [sensor, setSensor] = React.useState(true)
  const [oled, setOled] = React.useState(false)
  const [radio, setRadio] = React.useState(false)
  const [led, setLed] = React.useState(false)

  const d = Math.min(1, tOn / period)
  const rows: Row[] = [
    { id: "mcu", name: "单片机", on: true, work: sleep ? MCU_RUN * d : MCU_RUN, idle: sleep ? MCU_SLEEP * (1 - d) : 0, peak: MCU_RUN },
    { id: "sensor", name: "温湿度传感器", on: sensor, work: SENSOR_RUN * d, idle: SENSOR_IDLE * (1 - d), peak: SENSOR_RUN },
    { id: "oled", name: "OLED 屏幕", on: oled, work: OLED_RUN * d, idle: OLED_IDLE * (1 - d), peak: OLED_RUN },
    { id: "radio", name: "无线模块", on: radio, work: RADIO_RUN * d, idle: RADIO_IDLE * (1 - d), peak: RADIO_RUN },
    { id: "led", name: "电源指示灯", on: led, work: LED_RUN, idle: 0, peak: LED_RUN },
  ]
  const active = rows.filter((r) => r.on)
  const avg = active.reduce((s, r) => s + r.work + r.idle, 0)
  const peak = active.reduce((s, r) => s + r.peak, 0)
  const idleShare = active.reduce((s, r) => s + r.idle, 0) / avg
  const cell = BATTERIES.find((b) => b.value === battery) ?? BATTERIES[0]
  const hours = cell.mah / (avg * 1000)
  const top = active.reduce((best, r) => (r.work + r.idle > best.work + best.idle ? r : best), active[0])
  const share = percent((top.work + top.idle) / avg)

  let tone: "neutral" | "good" | "warn" | "bad" = hours >= 365 * 24 ? "good" : "neutral"
  let note: string
  if (peak > cell.pulse) {
    tone = "bad"
    note = `醒来时的峰值电流有 ${formatSI(peak, "A")}。纽扣电池的内阻有十几欧以上，一般只供得出十几毫安的脉冲；电流再大，电压就被拉垮，单片机直接复位。要么换电池，要么关掉大电流的模块。`
  } else if (top.id === "mcu" && !sleep) {
    tone = "warn"
    note = `单片机一直醒着，光它自己就要 5 mA，占平均电流的 ${share}。让它在两次测量之间休眠，是电池供电设计的第一步。`
  } else if (top.id === "led") {
    tone = "warn"
    note = `一颗常亮的指示灯要 2 mA，是单片机休眠电流的 1000 倍，占了平均电流的 ${share}。电池供电的板子上，指示灯只在需要时闪一下。`
  } else if (top.id === "radio") {
    note = `无线模块每次只工作 ${formatSI(tOn, "s")}，却占了平均电流的 ${share}。攒几次数据再一起发，或者缩短每次联网的时间，续航马上变长。`
  } else if (top.id === "oled") {
    note = `屏幕点亮时要 15 mA，占平均电流的 ${share}。平时让它熄灭，有人按键时再亮几秒。`
  } else if (idleShare > 0.5) {
    note = `现在大半的电花在待机上（占 ${percent(idleShare)}）。再拉长唤醒间隔也省不了多少，该盯的是每个器件的待机电流，还有稳压器自己的静态电流。`
  } else {
    note = `耗电最多的是${top.name}醒着的那 ${formatSI(tOn, "s")}，占平均电流的 ${share}。把唤醒间隔拉长，或者让每次工作更快结束，续航还能再涨。`
  }
  if (tone !== "bad" && hours > 5 * 365 * 24) note += " 算出来超过 5 年：到这个程度，电池的自放电和寿命才是瓶颈，实际撑不了这么久。"

  return (
    <Lab
      title="温湿度记录器的功耗预算"
      hint="开关各个模块，调唤醒间隔和每次工作多久，看平均电流和续航怎么变。电流取的是典型量级。"
      onReset={() => {
        setPeriod(60)
        setTOn(0.2)
        setBattery("cr2032")
        setSleep(true)
        setSensor(true)
        setOled(false)
        setRadio(false)
        setLed(false)
      }}
    >
      <LabStage>
        <ShareBars rows={rows} total={avg} />
      </LabStage>
      <LabControls columns={3}>
        <SliderField label="每隔多久醒来一次" value={period} onChange={setPeriod} min={1} max={3600} log format={fmtPeriod} />
        <SliderField label="每次醒来工作多久" value={tOn} onChange={setTOn} min={0.01} max={5} log unit="s" />
        <ControlField label="电池">
          <Select aria-label="电池" className="w-full" value={battery} onValueChange={setBattery} options={BATTERIES.map((b) => ({ value: b.value, label: b.label }))} />
        </ControlField>
        <SwitchField label="单片机空闲时休眠" hint="运行 5 mA，休眠 2 μA" checked={sleep} onChange={setSleep} />
        <SwitchField label="温湿度传感器" hint="测量 1 mA，待机 0.2 μA" checked={sensor} onChange={setSensor} />
        <SwitchField label="OLED 屏幕（醒来时点亮）" hint="点亮 15 mA，熄灭 10 μA" checked={oled} onChange={setOled} />
        <SwitchField label="无线模块（醒来时联网）" hint="收发 80 mA，休眠 5 μA（Wi-Fi 的量级）" checked={radio} onChange={setRadio} />
        <SwitchField label="电源指示灯（常亮）" hint="2 mA，一直亮着" checked={led} onChange={setLed} />
      </LabControls>
      <LabReadouts>
        <Readout label="醒着的时间占比" value={percent(d, d < 0.1 ? 2 : 0)} />
        <Readout label="平均电流" value={formatSI(avg, "A")} color={trace.current} />
        <Readout label="醒来时的峰值电流" value={formatSI(peak, "A")} />
        <Readout label={`续航（${cell.name}）`} value={duration(hours)} sub={`留三成余量：${duration(hours * 0.7)}`} />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

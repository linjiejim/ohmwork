import * as React from "react"
import { ControlField, Lab, LabControls, LabNote, LabReadouts, LabStage, Plot, Readout, Segmented, SliderField, formatSI, sig, trace } from "@/lab"

/** Typical cells, same numbers as the table in the lesson. */
const PRESETS = [
  { value: "cr2032", label: "CR2032", cap: 220, volt: 3 },
  { value: "aa", label: "5 号", cap: 2500, volt: 1.5 },
  { value: "18650", label: "18650", cap: 3000, volt: 3.7 },
  { value: "bank", label: "充电宝", cap: 10000, volt: 3.7 },
]

const HOURS_PER_YEAR = 8760

/** Hours as the unit a person would say: 分钟, 小时, 天 or 年. */
function duration(hours: number): string {
  if (hours < 1) return `${sig(hours * 60, 3)} 分钟`
  if (hours < 48) return `${sig(hours, 3)} 小时`
  if (hours < HOURS_PER_YEAR) return `${sig(hours / 24, 3)} 天`
  return `${sig(hours / HOURS_PER_YEAR, 3)} 年`
}

/** The time axis is logarithmic; its ticks sit on durations people know by heart. */
const TIME_TICKS: [number, string][] = [
  [1 / 60, "1 分钟"],
  [1, "1 小时"],
  [24, "1 天"],
  [720, "30 天"],
  [8760, "1 年"],
  [87600, "10 年"],
  [876000, "100 年"],
]
const timeLabel = (hours: number) => TIME_TICKS.find(([t]) => Math.abs(hours / t - 1) < 1e-9)?.[1] ?? duration(hours)

/** Runtime = capacity ÷ load current, energy = capacity × voltage. The line on the log–log plot is the whole trade-off. */
export function BatteryLifeLab() {
  const [cap, setCap] = React.useState(3000) // mAh
  const [volt, setVolt] = React.useState(3.7) // V
  const [load, setLoad] = React.useState(0.1) // A

  const hours = cap / (load * 1000)
  const energy = (cap / 1000) * volt // Wh
  const power = volt * load // W
  const preset = PRESETS.find((b) => b.cap === cap && b.volt === volt)
  const sum = `${sig(cap, 3)} mAh ÷ ${formatSI(load, "A")} = ${duration(hours)}`

  let tone: "neutral" | "warn" = "neutral"
  let note: string
  if (preset?.value === "cr2032" && load > 0.003) {
    // the ideal formula is furthest from the truth here: a coin cell's internal resistance is far too high for this
    tone = "warn"
    note = `${sum}，但这只是照公式算的。纽扣电池内阻大，只适合平均电流很小（几 mA 以内）的负载。电流这么大，电压会被拉低，实际放出的容量远小于标称值。`
  } else if (hours < 1) {
    tone = "warn"
    note = `${sum}。不到 1 小时就放完。放电这么急，多数电池实际能放出的容量比标称值少，还会明显发热。`
  } else if (hours > 5 * HOURS_PER_YEAR) {
    tone = "warn"
    note = `${sum}。这只是算出来的数：电池放着不用也会慢慢掉电（自放电），实际撑不了这么久。`
  } else {
    note = `${sum}。电池里一共存着 ${formatSI(energy, "Wh")} 的能量，负载每小时用掉 ${formatSI(power, "Wh")}。`
  }

  return (
    <Lab
      title="电池续航估算"
      hint="选一种电池，再拖动负载电流。电流每小 10 倍，续航就长 10 倍。"
      onReset={() => {
        setCap(3000)
        setVolt(3.7)
        setLoad(0.1)
      }}
    >
      <LabStage>
        <Plot
          height={230}
          x={{ min: 0.01, max: 2000, log: true, label: "负载电流 (mA)", format: (x) => sig(x, 3) }}
          y={{ min: 1 / 60, max: 3e6, log: true, label: "续航时间", ticks: TIME_TICKS.map(([t]) => t), format: timeLabel }}
          series={[{ fn: (x) => cap / x, label: `${sig(cap, 3)} mAh 电池的续航`, color: trace.second }]}
          markers={[{ x: load * 1000, y: hours, label: duration(hours), color: trace.second }]}
        />
      </LabStage>
      <LabControls columns={3}>
        {/* four options don't fit a half-width column on mid-size screens, so the presets get a row of their own */}
        <div className="col-span-full">
          <ControlField label="常见电池">
            <Segmented
              aria-label="常见电池"
              size="sm"
              value={preset?.value ?? ""}
              onValueChange={(id) => {
                const b = PRESETS.find((x) => x.value === id)
                if (!b) return
                setCap(b.cap)
                setVolt(b.volt)
              }}
              options={PRESETS.map((b) => ({ value: b.value, label: b.label }))}
            />
          </ControlField>
        </div>
        <SliderField label="负载电流" value={load} onChange={setLoad} min={0.00001} max={2} log unit="A" color={trace.current} />
        <SliderField label="电池容量" value={cap} onChange={setCap} min={100} max={20000} log format={(c) => `${sig(c, 3)} mAh`} />
        <SliderField label="电池电压" value={volt} onChange={setVolt} min={1.2} max={12} step={0.1} unit="V" color={trace.voltage} />
      </LabControls>
      <LabReadouts>
        <Readout label="续航 = 容量 ÷ 电流" value={duration(hours)} sub={hours >= 48 ? `${sig(hours, 3)} 小时` : undefined} />
        <Readout label="电池能量 = 容量 × 电压" value={formatSI(energy, "Wh")} />
        <Readout label="负载功率 = 电压 × 电流" value={formatSI(power, "W")} color={trace.power} />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

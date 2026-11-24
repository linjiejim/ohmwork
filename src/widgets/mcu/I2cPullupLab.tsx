import * as React from "react"
import { ControlField, Lab, LabControls, LabNote, LabReadouts, LabStage, Plot, Readout, Segmented, SliderField, formatSI, trace } from "@/lab"

const VDD = 3.3
/** The I²C spec measures rise time from 30 % to 70 % of VDD: t = RC · ln(0.7 / 0.3) ≈ 0.8473 · RC. */
const K_RISE = Math.log(0.7 / 0.3)
/** Low level the spec guarantees, and the current a standard / fast-mode device must be able to sink at it. */
const V_OL = 0.4
const I_SINK_MAX = 3e-3
/** Time window of the plot, ns. */
const T_MAX = 2000

const MODES = {
  std: { name: "标准模式", rate: "100 kHz", limit: 1000 },
  fast: { name: "快速模式", rate: "400 kHz", limit: 300 },
} as const

/**
 * The rising edge of an I²C line: the pull-up charges the bus capacitance, so
 * the edge is an RC curve. Rise time (30 % → 70 %) must stay under the limit
 * of the chosen speed; too small a resistor instead overloads the drivers.
 */
export function I2cPullupLab() {
  const [r, setR] = React.useState(4700)
  const [cPf, setCPf] = React.useState(100)
  const [mode, setMode] = React.useState<keyof typeof MODES>("std")

  const { name, limit } = MODES[mode]
  const tau = r * cPf * 1e-3 // ns: Ω × pF = 1e-12 s
  const t30 = -Math.log(0.7) * tau
  const t70 = -Math.log(0.3) * tau
  const rise = K_RISE * tau
  const sink = (VDD - V_OL) / r
  const slow = rise > limit
  const overload = sink > I_SINK_MAX

  let tone: "good" | "warn" | "bad" = "good"
  let note = `上升时间 ${formatSI(rise * 1e-9, "s")}，在${name}的 ${limit} ns 以内；拉低时灌电流 ${formatSI(sink, "A")}，也没超过 3 mA。这组取值可以用。`
  if (overload) {
    tone = "bad"
    note = `上拉太小：器件拉低总线时要吸收 ${formatSI(sink, "A")}，超过规范的 3 mA，低电平可能压不到 0.4 V 以下。`
  } else if (slow) {
    tone = "warn"
    note = `上升时间 ${formatSI(rise * 1e-9, "s")}，超过${name}的 ${limit} ns 上限：电平还没爬过高电平门限，时钟就该变了。减小上拉电阻，或者降低速率。`
  }

  return (
    <Lab
      title="上拉电阻与上升沿"
      hint="器件一松手，上拉电阻就给总线电容充电。调电阻和电容，看上升沿有多慢。"
      onReset={() => {
        setR(4700)
        setCPf(100)
        setMode("std")
      }}
    >
      <LabStage>
        <Plot
          height={220}
          x={{ min: 0, max: T_MAX, label: "时间 (ns)", format: (v) => String(Math.round(v)) }}
          y={{ min: 0, max: 4.2, label: "SCL 电压 (V)", ticks: [0, 1, 2, 3, 4] }}
          series={[{ fn: (t) => VDD * (1 - Math.exp(-t / tau)), label: "松手后的上升沿", color: trace.voltage }]}
          lines={[
            { y: 0.7 * VDD, label: "70%" },
            { y: 0.3 * VDD, label: "30%" },
            { x: t30 + limit, label: "最迟在这里到 70%", color: slow ? trace.power : trace.good },
          ]}
          markers={[
            { x: t30, y: 0.3 * VDD, color: trace.voltage },
            { x: t70, y: 0.7 * VDD, color: trace.voltage },
          ]}
        />
        <p className="mt-2 text-caption text-muted-foreground">两个圆点是电压升到 30% 和 70% 的时刻，它们之间的间隔就是上升时间。</p>
      </LabStage>
      <LabControls columns={3}>
        <SliderField label="上拉电阻" value={r} onChange={setR} min={470} max={22000} log snap="E12" unit="Ω" />
        <SliderField label="总线电容" value={cPf} onChange={setCPf} min={10} max={400} step={10} format={(v) => `${v} pF`} />
        <ControlField label="速率">
          <Segmented
            aria-label="速率"
            value={mode}
            onValueChange={setMode}
            options={[
              { value: "std", label: "100 kHz" },
              { value: "fast", label: "400 kHz" },
            ]}
          />
        </ControlField>
      </LabControls>
      <LabReadouts>
        <Readout label="上升时间 ≈ 0.8473 RC" value={formatSI(rise * 1e-9, "s")} color={trace.voltage} />
        <Readout label={`${name}上限`} value={`${limit} ns`} color={slow ? trace.power : trace.good} sub={slow ? "超了" : "满足"} />
        <Readout label="拉低时的灌电流" value={formatSI(sink, "A")} color={trace.current} sub={overload ? "超过 3 mA" : "上限 3 mA"} />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

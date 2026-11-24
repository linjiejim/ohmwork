import * as React from "react"
import { Ground, Junction, Lab, LabControls, LabNote, LabReadouts, LabStage, Label, Plot, Port, Rail, Readout, Resistor, Schematic, SliderField, Wire, fixed, formatSI, sig, trace } from "@/lab"

/** The classic part: 10 kΩ at 25 °C, B = 3950 K. */
const R25 = 10_000
const B = 3950
const T25 = 298.15
const VCC = 3.3
/** 12-bit ADC referenced to the same 3.3 V. */
const LEVELS = 4096

const T_MIN = -20
const T_MAX = 100

/** NTC resistance at `tc` °C, from the B-parameter equation. */
const ntc = (tc: number) => R25 * Math.exp(B * (1 / (tc + 273.15) - 1 / T25))
/** Temperature in °C at which the NTC has resistance `r`: the same equation, inverted. */
const tempOf = (r: number) => 1 / (1 / T25 + Math.log(r / R25) / B) - 273.15
/** Divider output: NTC on top, fixed resistor to ground, so the voltage rises with temperature. */
const divider = (tc: number, rf: number) => (VCC * rf) / (ntc(tc) + rf)

const R_COLOR = trace.second

/**
 * NTC thermistor in a divider: the B equation, the S-shaped output, and why
 * the fixed resistor should match the NTC near the temperature you care about.
 */
export function NtcLab() {
  const [temp, setTemp] = React.useState(25)
  const [rf, setRf] = React.useState(10_000)

  const r = ntc(temp)
  const v = divider(temp, rf)
  const i = VCC / (r + rf)
  const code = Math.min(LEVELS - 1, Math.floor((v / VCC) * LEVELS))
  // what the firmware does: code → resistance → temperature
  const rBack = rf * (LEVELS / Math.max(code, 1) - 1)
  const tBack = tempOf(rBack)
  // slope of the output here, in volts per °C, then in ADC codes per °C
  const tk = temp + 273.15
  const slope = (VCC * rf * r * (B / (tk * tk))) / (r + rf) ** 2
  const codesPerDeg = slope / (VCC / LEVELS)
  const selfHeat = i * i * r
  // the temperature where the NTC equals the fixed resistor (output = half the supply)
  const tEqual = tempOf(rf)

  // one way of printing the sensitivity, so the readout and the sentence below always agree
  const perDeg = codesPerDeg >= 10 ? fixed(codesPerDeg, 0) : sig(codesPerDeg, 2)
  const hot = selfHeat > 0.5e-3
  const tone = codesPerDeg < 10 || hot ? "warn" : codesPerDeg >= 30 ? "good" : "neutral"
  const main =
    codesPerDeg >= 30
      ? `这一段最灵敏：温度变 1 °C，ADC 读数变 ${perDeg} 个码，能分辨约 ${sig(1 / codesPerDeg, 2)} °C。`
      : codesPerDeg >= 10
        ? `温度变 1 °C，读数变 ${perDeg} 个码，够用。离「NTC = R」的温度（${fixed(tEqual, 0)} °C）越远，曲线越平。`
        : `曲线在这里已经变平：1 °C 只对应 ${perDeg} 个码，分辨率掉到约 ${sig(1 / codesPerDeg, 2)} °C。想在这个温度附近测得细，固定电阻要换成接近 NTC 此刻阻值（${formatSI(r, "Ω")}）的。`
  const heat = hot ? `另外 NTC 自己在耗散 ${formatSI(selfHeat, "W")}：固定电阻太小，电流大，自热会把读数抬高。` : ""

  return (
    <Lab
      title="NTC 测温实验台"
      hint="拖温度，看阻值和分压输出怎么走。再换一换固定电阻 R，看 S 形曲线最陡的那一段搬到哪里。"
      onReset={() => {
        setTemp(25)
        setRf(10_000)
      }}
    >
      <LabStage>
        <div className="grid items-center gap-x-6 gap-y-4 @xl:grid-cols-[auto_minmax(0,1fr)]">
          {/*
            Layout (190 × 228), everything on the line x = 70:
            rail (70, 34) · NTC centre (70, 70), terminals (70, 40) / (70, 100) · node (70, 120)
            fixed R centre (70, 170), terminals (70, 140) / (70, 200) · ground at (70, 200)
            output wire (70, 120) → port (130, 120); part labels on the left, output on the right.
          */}
          <Schematic width={190} height={228} label="NTC 在上、固定电阻在下的分压电路，中点接 ADC">
            <Rail x={70} y={34} label="3.3 V" />
            <Wire points={[[70, 34], [70, 40]]} current={i} scale={0.002} />
            <Resistor x={70} y={70} rot={90} label="NTC" value={formatSI(r, "Ω")} labelSide="left" color={R_COLOR} />
            {/* thermistor mark: a slanted line with a flat tail */}
            <path d="M60 81L82 59H89" stroke={R_COLOR} />
            <Wire points={[[70, 100], [70, 140]]} current={i} scale={0.002} />
            <Wire points={[[70, 120], [130, 120]]} />
            <Junction x={70} y={120} />
            <Port x={130} y={120} label="ADC" />
            <Label x={102} y={111} color={trace.voltage}>
              {fixed(v, 2)} V
            </Label>
            <Resistor x={70} y={170} rot={90} label="R" value={formatSI(rf, "Ω")} labelSide="left" />
            <Ground x={70} y={200} />
          </Schematic>
          <div className="grid min-w-0 gap-3">
            <Plot
              height={180}
              x={{ min: T_MIN, max: T_MAX, label: "温度 (°C)" }}
              y={{ min: 300, max: 300_000, log: true, label: "阻值 (Ω)" }}
              series={[
                { fn: ntc, label: "NTC 阻值（纵轴是对数）", color: R_COLOR },
                { fn: () => rf, label: "固定电阻 R", color: trace.ref, dashed: true },
              ]}
              markers={[{ x: temp, y: r, label: formatSI(r, "Ω"), color: R_COLOR }]}
            />
            <Plot
              height={180}
              x={{ min: T_MIN, max: T_MAX, label: "温度 (°C)" }}
              y={{ min: 0, max: VCC, ticks: [0, 1, 2, 3], label: "分压输出 (V)" }}
              series={[{ fn: (t) => divider(t, rf), label: "分压输出", color: trace.voltage }]}
              lines={[{ x: tEqual, label: "NTC = R" }]}
              markers={[{ x: temp, y: v, label: `${fixed(v, 2)} V`, color: trace.voltage }]}
            />
          </div>
        </div>
      </LabStage>
      <LabControls>
        <SliderField label="温度" value={temp} onChange={setTemp} min={T_MIN} max={T_MAX} step={1} format={(t) => `${fixed(t, 0)} °C`} />
        <SliderField label="固定电阻 R" value={rf} onChange={setRf} min={1000} max={100_000} log snap="E12" unit="Ω" />
      </LabControls>
      <LabReadouts>
        <Readout label="NTC 阻值" value={formatSI(r, "Ω")} color={R_COLOR} />
        <Readout label="分压输出" value={`${fixed(v, 3)} V`} color={trace.voltage} />
        <Readout label="ADC 读数（12 位）" value={String(code)} sub={`反算温度 ${fixed(tBack, 2)} °C`} />
        <Readout label="这里的灵敏度" value={`${perDeg} 码/°C`} sub={`1 个码 ≈ ${sig(1 / codesPerDeg, 2)} °C`} />
        <Readout label="NTC 自热功率" value={formatSI(selfHeat, "W")} color={trace.power} />
      </LabReadouts>
      <LabNote tone={tone}>
        {main}
        {heat}
      </LabNote>
    </Lab>
  )
}

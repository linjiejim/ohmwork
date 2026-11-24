import * as React from "react"
import { ControlField, Ground, Junction, Lab, LabControls, LabNote, LabReadouts, LabStage, Label, Meter, Plot, Rail, Readout, Resistor, Schematic, Segmented, SliderField, Wire, fixed, formatSI, percent, sig, trace } from "@/lab"

/** Foil strain gauge: 350 Ω, gauge factor 2. */
const R0 = 350
const GF = 2
/** Bridge excitation (also the HX711's analog supply, so the reading is ratiometric). */
const VEX = 5
/** This load cell: 500 με at its rated 5 kg, i.e. 1 mV/V as a full bridge. */
const STRAIN_PER_KG = 100e-6
const RATED_KG = 5
const MAX_KG = 6
/** HX711, channel A at gain 128: full scale ±0.5 · AVDD / 128 maps to ±2^23. */
const HX_COUNTS_PER_VOLT = (128 * 2 ** 24) / VEX
/** The naive alternative: gauge + fixed resistor as a divider into a 12-bit ADC referenced to 5 V. */
const ADC_LEVELS = 4096

type Mode = "quarter" | "half" | "full"
const MODES: { value: Mode; label: string; name: string; gain: number }[] = [
  { value: "quarter", label: "1/4 桥", name: "四分之一桥", gain: 1 },
  { value: "half", label: "半桥", name: "半桥", gain: 2 },
  { value: "full", label: "全桥", name: "全桥", gain: 4 },
]

const deltaR = (kg: number) => R0 * GF * STRAIN_PER_KG * kg

/** How each arm moves: +1 stretched, −1 compressed, 0 a fixed resistor. Order: R1 R2 R3 R4. */
function armSigns(mode: Mode): [number, number, number, number] {
  if (mode === "quarter") return [0, 1, 0, 0]
  if (mode === "half") return [-1, 1, 0, 0]
  return [-1, 1, 1, -1]
}

/** Differential output: left midpoint (between R1 and R2) minus right midpoint (between R3 and R4). */
function bridgeOut(mode: Mode, kg: number) {
  const [r1, r2, r3, r4] = armSigns(mode).map((s) => R0 + s * deltaR(kg))
  return VEX * (r2 / (r1 + r2) - r4 / (r3 + r4))
}

const STRETCH = trace.voltage
const SQUEEZE = trace.third
const MODE_COLOR: Record<Mode, string> = { quarter: trace.third, half: trace.second, full: trace.voltage }
const group = (n: number) => Math.round(n).toLocaleString("en-US")

/**
 * Strain gauges in a Wheatstone bridge: a weight changes 350 Ω by a fraction
 * of an ohm, the bridge turns that into millivolts around zero, and the HX711
 * turns millivolts into hundreds of counts per gram.
 */
export function WheatstoneLab() {
  const [kg, setKg] = React.useState(2)
  const [mode, setMode] = React.useState<Mode>("full")

  const dR = deltaR(kg)
  const signs = armSigns(mode)
  const ohms = signs.map((s) => R0 + s * dR)
  const vOut = bridgeOut(mode, kg)
  const iLeft = VEX / (ohms[0] + ohms[1])
  const iRight = VEX / (ohms[2] + ohms[3])
  const counts = vOut * HX_COUNTS_PER_VOLT
  const countsPerGram = bridgeOut(mode, 0.001) * HX_COUNTS_PER_VOLT
  const dividerCode = Math.min(ADC_LEVELS - 1, Math.floor(((R0 + dR) / (2 * R0 + dR)) * ADC_LEVELS + 1e-9))
  const dividerMoved = dividerCode - ADC_LEVELS / 2
  const current = MODES.find((m) => m.value === mode) ?? MODES[2]

  const arm = (index: number) => {
    const s = signs[index]
    return {
      label: `R${index + 1}${s > 0 ? " 拉伸" : s < 0 ? " 压缩" : ""}`,
      value: s === 0 ? `${R0} Ω` : `${fixed(ohms[index], 2)} Ω`,
      color: s > 0 ? STRETCH : s < 0 ? SQUEEZE : undefined,
    }
  }

  const overload = kg > RATED_KG
  const note = overload
    ? `超过了额定的 ${RATED_KG} kg：金属弹性体可能留下永久变形，卸掉重物后零点也回不去。选称重传感器要留余量。`
    : kg === 0
      ? "空载：四个桥臂都是 350 Ω，左右两个中点的电压相等，输出 0 V。这就是电桥平衡。"
      : `${sig(kg)} kg 只让应变片的阻值变了 ${percent(dR / R0, 3)}（${formatSI(dR, "Ω")}）。直接分压再用 12 位 ADC 读，读数${dividerMoved === 0 ? "还停在 2048，完全看不出来" : `只从 2048 变成 ${dividerCode}`}；${current.name}配上 HX711，同样的变化是 ${group(counts)} 个计数。`

  return (
    <Lab
      title="电桥称重实验台"
      hint="加重量，看应变片的阻值只动了小数点后面，电桥却给出清楚的毫伏信号。再切换接法，比一比灵敏度。"
      onReset={() => {
        setKg(2)
        setMode("full")
      }}
    >
      <LabStage>
        <div className="grid items-center gap-x-6 gap-y-4 @xl:grid-cols-[auto_minmax(0,1fr)]">
          {/*
            Layout (300 × 228). Two dividers side by side, a meter between their midpoints.
            Top rail y = 40 (supply at (150, 40)), bottom rail y = 200 (ground at (150, 200)).
            Left leg x = 90: R1 centre (90, 80), terminals (90, 50) / (90, 110); midpoint (90, 120);
              R2 centre (90, 160), terminals (90, 130) / (90, 190). Labels to the left.
            Right leg x = 210: R3 centre (210, 80), R4 centre (210, 160), midpoint (210, 120). Labels to the right.
            Meter centre (150, 120), terminals (120, 120) / (180, 120), captions above it.
          */}
          <Schematic width={300} height={228} label="四个电阻组成的惠斯通电桥，两个中点之间接电压表">
            <Rail x={150} y={40} label="5 V" />
            <Wire points={[[150, 40], [90, 40], [90, 50]]} current={iLeft} scale={0.01} />
            <Wire points={[[150, 40], [210, 40], [210, 50]]} current={iRight} scale={0.01} />
            <Junction x={150} y={40} />

            <Resistor x={90} y={80} rot={90} labelSide="left" {...arm(0)} />
            <Wire points={[[90, 110], [90, 130]]} current={iLeft} scale={0.01} />
            <Resistor x={90} y={160} rot={90} labelSide="left" {...arm(1)} />

            <Resistor x={210} y={80} rot={90} {...arm(2)} />
            <Wire points={[[210, 110], [210, 130]]} current={iRight} scale={0.01} />
            <Resistor x={210} y={160} rot={90} {...arm(3)} />

            <Wire points={[[90, 120], [120, 120]]} />
            <Wire points={[[180, 120], [210, 120]]} />
            <Junction x={90} y={120} />
            <Junction x={210} y={120} />
            <Meter x={150} y={120} letter="V" label="差分输出" value={formatSI(vOut, "V")} />
            <Label x={106} y={113}>
              +
            </Label>
            <Label x={194} y={113}>
              −
            </Label>

            <Wire points={[[90, 190], [90, 200], [150, 200]]} current={iLeft} scale={0.01} />
            <Wire points={[[210, 190], [210, 200], [150, 200]]} current={iRight} scale={0.01} />
            <Junction x={150} y={200} />
            <Ground x={150} y={200} />
          </Schematic>
          <Plot
            height={228}
            x={{ min: 0, max: MAX_KG, label: "重量 (kg)" }}
            y={{ min: 0, max: 8, label: "电桥输出 (mV)" }}
            series={MODES.map((m) => ({
              fn: (x: number) => bridgeOut(m.value, x) * 1000,
              label: m.label,
              color: MODE_COLOR[m.value],
              dashed: m.value !== mode,
              width: m.value === mode ? 2.5 : 1.5,
            }))}
            lines={[{ x: RATED_KG, label: "额定 5 kg" }]}
            markers={[{ x: kg, y: vOut * 1000, label: formatSI(vOut, "V"), color: MODE_COLOR[mode] }]}
          />
        </div>
      </LabStage>
      <LabControls>
        <SliderField label="重量" value={kg} onChange={setKg} min={0} max={MAX_KG} step={0.05} format={(v) => `${sig(v)} kg`} />
        <ControlField label="电桥接法">
          <Segmented value={mode} onValueChange={setMode} options={MODES.map(({ value, label }) => ({ value, label }))} aria-label="电桥接法" />
        </ControlField>
      </LabControls>
      <LabReadouts>
        <Readout label="受拉应变片的阻值" value={`${fixed(R0 + dR, 2)} Ω`} color={STRETCH} sub={`只变了 ${percent(dR / R0, 3)}`} />
        <Readout label="电桥差分输出" value={formatSI(vOut, "V")} sub={`灵敏度是 1/4 桥的 ${current.gain} 倍`} />
        <Readout label="HX711 读数（×128，24 位）" value={group(counts)} sub={`每克约 ${fixed(countsPerGram, 0)} 个计数`} />
        <Readout label="直接分压 + 12 位 ADC" value={String(dividerCode)} sub={dividerMoved === 0 ? "和空载一样，没变" : `比空载多 ${dividerMoved} 个码`} />
      </LabReadouts>
      <LabNote tone={overload ? "warn" : "neutral"}>{note}</LabNote>
    </Lab>
  )
}

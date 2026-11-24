import * as React from "react"
import { ControlField, Lab, LabControls, LabNote, LabReadouts, LabStage, Plot, Readout, Segmented, SliderField, clamp, fixed, sig, trace } from "@/lab"

type Kind = "voltage" | "power"

const R_MIN = 0.001
const R_MAX = 1000

/** "2 倍", "0.707 倍", "1/1000": small ratios read better as fractions. */
function times(x: number): string {
  return x >= 0.1 ? `${sig(x, 3)} 倍` : `1/${sig(1 / x, 3)}`
}

/** "+6.0 dB" / "−3.0 dB" / "0.0 dB". */
function signedDb(db: number): string {
  const v = Math.round(db * 10) / 10 || 0
  return `${v > 0 ? "+" : ""}${fixed(v, 1)} dB`
}

/** What a round dB value means, when the current value is close to one. */
const LANDMARKS: [number, string][] = [
  [0, "0 dB 就是 1 倍：没有放大，也没有衰减。"],
  [3, "+3 dB：功率翻倍，电压是 1.41 倍。"],
  [-3, "−3 dB：功率减半，电压剩 0.707 倍。RC 滤波器的截止频率就定义在这一点。"],
  [6, "+6 dB：电压翻倍，功率是 4 倍。"],
  [-6, "−6 dB：电压减半，功率剩 1/4。"],
  [10, "+10 dB：功率 10 倍，电压约 3.16 倍。"],
  [-10, "−10 dB：功率剩 1/10，电压约 0.316 倍。"],
  [20, "+20 dB：电压 10 倍，功率 100 倍。"],
  [-20, "−20 dB：电压剩 1/10，功率剩 1/100。"],
  [40, "+40 dB：电压 100 倍，功率 1 万倍。"],
  [-40, "−40 dB：电压剩 1/100，功率剩 1 万分之一。"],
  [60, "+60 dB：电压 1000 倍，功率 100 万倍。"],
  [-60, "−60 dB：电压剩 1/1000，功率剩 100 万分之一。"],
]

/** Ratio ↔ decibels, for voltage ratios (20·log) and power ratios (10·log). The two sliders are the same position on two scales. */
export function DecibelLab() {
  const [kind, setKind] = React.useState<Kind>("voltage")
  const [ratio, setRatio] = React.useState(2)

  const k = kind === "voltage" ? 20 : 10
  const db = k * Math.log10(ratio)
  // the same dB figure, read as a voltage ratio and as a power ratio (power ∝ voltage²)
  const vRatio = kind === "voltage" ? ratio : Math.sqrt(ratio)
  const pRatio = kind === "voltage" ? ratio * ratio : ratio

  const landmark = LANDMARKS.find(([v]) => Math.abs(db - v) < 0.25)
  const note = landmark
    ? landmark[1]
    : `${signedDb(db)}：电压是原来的 ${times(vRatio)}，功率是原来的 ${times(pRatio)}。${db > 0 ? "正的 dB 表示放大。" : "负的 dB 表示衰减。"}`

  return (
    <Lab
      title="倍数和分贝互相换算"
      hint="两个滑块是同一个位置的两种刻度：上面按倍数（对数刻度），下面按 dB（均匀刻度）。再切换电压比和功率比，看同样的倍数对应多少 dB。"
      onReset={() => {
        setKind("voltage")
        setRatio(2)
      }}
    >
      <LabStage>
        <Plot
          height={240}
          x={{ min: R_MIN, max: R_MAX, log: true, label: "倍数", ticks: [0.01, 1, 100], format: (v) => `×${sig(v, 3)}` }}
          y={{ min: -60, max: 60, label: "分贝 (dB)", ticks: [-60, -40, -20, 0, 20, 40, 60] }}
          series={[
            { fn: (x) => 20 * Math.log10(x), label: "电压比：20·lg(倍数)", color: trace.voltage, dashed: kind !== "voltage", width: kind === "voltage" ? 2.5 : 1.5 },
            { fn: (x) => 10 * Math.log10(x), label: "功率比：10·lg(倍数)", color: trace.power, dashed: kind !== "power", width: kind === "power" ? 2.5 : 1.5 },
          ]}
          lines={[{ x: ratio }, { y: db }]}
          markers={[{ x: ratio, y: db, color: kind === "voltage" ? trace.voltage : trace.power }]}
        />
      </LabStage>
      <LabControls columns={1}>
        <ControlField label="这个倍数指的是">
          <Segmented
            aria-label="这个倍数指的是"
            value={kind}
            onValueChange={setKind}
            options={[
              { value: "voltage", label: "电压比" },
              { value: "power", label: "功率比" },
            ]}
          />
        </ControlField>
        <SliderField label="倍数" value={ratio} onChange={setRatio} min={R_MIN} max={R_MAX} log format={(v) => `× ${sig(v, 3)}`} />
        <SliderField
          label="分贝"
          value={db}
          onChange={(v) => setRatio(clamp(Number((10 ** (v / k)).toPrecision(4)), R_MIN, R_MAX))}
          min={-3 * k}
          max={3 * k}
          step={0.5}
          format={signedDb}
        />
      </LabControls>
      <LabReadouts>
        <Readout label="分贝值" value={signedDb(db)} sub={`${k} × lg(${sig(ratio, 3)})`} />
        <Readout label="相当于电压" value={times(vRatio)} color={trace.voltage} />
        <Readout label="相当于功率" value={times(pRatio)} color={trace.power} />
      </LabReadouts>
      <LabNote>{note}</LabNote>
    </Lab>
  )
}

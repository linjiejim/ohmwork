import * as React from "react"
import { ControlField, Lab, LabControls, LabNote, LabReadouts, LabStage, Plot, Readout, Segmented, SliderField, dbV, fixed, formatSI, sig, trace } from "@/lab"

const A0 = 1e5 // open-loop gain at DC: 100 dB, typical for all three parts

const PARTS = {
  LM358: 1e6,
  TL072: 3e6,
  NE5532: 10e6,
} as const
type Part = keyof typeof PARTS

/**
 * Gain–bandwidth trade-off of a non-inverting amplifier built on a one-pole op-amp:
 * A(f) = A0 / (1 + j·f/fp), fp = GBW / A0, closed loop = A / (1 + A/G).
 */
export function GainBandwidthLab() {
  const [gain, setGain] = React.useState(100)
  const [part, setPart] = React.useState<Part>("LM358")

  const gbw = PARTS[part]
  const fp = gbw / A0
  const dc = A0 / (1 + A0 / gain) // a hair under the set gain, because A0 is finite
  const fc = fp * (1 + A0 / gain) // −3 dB point ≈ GBW / gain
  const openLoop = (f: number) => dbV(A0 / Math.hypot(1, f / fp))
  const closedLoop = (f: number) => dbV(dc / Math.hypot(1, f / fc))
  const at20k = dc / Math.hypot(1, 20e3 / fc)
  const audioOk = fc >= 20e3

  return (
    <Lab
      title="增益越高，带宽越窄"
      hint="把增益往上拖，看平坦的那一段怎么变短；再换一只更快的运放。"
      onReset={() => {
        setGain(100)
        setPart("LM358")
      }}
    >
      <LabStage>
        <Plot
          height={250}
          x={{ min: 10, max: 1e8, log: true, label: "频率 (Hz)" }}
          y={{ min: -20, max: 120, label: "增益 (dB)", ticks: [-20, 0, 20, 40, 60, 80, 100, 120] }}
          series={[
            { fn: openLoop, label: "运放自己的开环增益", color: trace.ref, dashed: true },
            { fn: closedLoop, label: "接成放大器后的增益", color: trace.voltage },
          ]}
          // the dot is the −3 dB point; its value is in the readout (a label here would sit on the open-loop line)
          markers={[{ x: fc, y: dbV(dc) - 3, color: trace.voltage }]}
          lines={[{ x: 20e3, label: "20 kHz" }]}
        />
      </LabStage>
      <LabControls>
        <SliderField label="设定的增益" value={gain} onChange={setGain} min={1} max={1000} log format={(v) => `${sig(v)} 倍`} color={trace.voltage} />
        <ControlField label="运放型号">
          <Segmented
            aria-label="运放型号"
            value={part}
            onValueChange={setPart}
            options={[
              { value: "LM358", label: "LM358" },
              { value: "TL072", label: "TL072" },
              { value: "NE5532", label: "NE5532" },
            ]}
          />
        </ControlField>
      </LabControls>
      <LabReadouts>
        <Readout label="增益带宽积 GBW" value={formatSI(gbw, "Hz")} sub={part} />
        <Readout label="设定的增益" value={`${sig(gain)} 倍`} sub={`${fixed(dbV(gain), 1)} dB`} />
        <Readout label="带宽（−3 dB）" value={formatSI(fc, "Hz")} color={trace.voltage} sub="≈ GBW ÷ 增益" />
        <Readout label="20 kHz 处的实际增益" value={`${sig(at20k)} 倍`} />
      </LabReadouts>
      <LabNote tone={audioOk ? "neutral" : "warn"}>
        {audioOk
          ? `${sig(gain)} 倍 × ${formatSI(fc, "Hz")} ≈ ${formatSI(gbw, "Hz")}：增益和带宽的乘积基本不变。带宽内增益是平的，过了带宽就沿着开环增益那条线往下掉。`
          : `带宽只剩 ${formatSI(fc, "Hz")}，够不到 20 kHz：音频的高音到这里只被放大 ${sig(at20k)} 倍，而不是 ${sig(gain)} 倍。换一只 GBW 更高的运放，或者分成两级放大。`}
      </LabNote>
    </Lab>
  )
}

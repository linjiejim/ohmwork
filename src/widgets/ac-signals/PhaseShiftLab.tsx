import * as React from "react"
import { Lab, LabControls, LabNote, LabReadouts, LabStage, Plot, Readout, SliderField, SwitchField, TAU, formatSI, sig, trace } from "@/lab"

/** Both waves are 1 kHz, 1 V: one period is 1 ms, so the time shift is easy to read off. */
const PERIOD_MS = 1
const WINDOW_MS = 2
const N = 400

/** Two equal sine waves and the phase between them: shows phase as a shift in time, and what adding them gives. */
export function PhaseShiftLab() {
  const [phase, setPhase] = React.useState(90)
  const [showSum, setShowSum] = React.useState(false)

  const rad = (phase * Math.PI) / 180
  const { a, b, sum } = React.useMemo(() => {
    const a: [number, number][] = []
    const b: [number, number][] = []
    const sum: [number, number][] = []
    for (let k = 0; k <= N; k++) {
      const t = (WINDOW_MS * k) / N
      const va = Math.sin((TAU * t) / PERIOD_MS)
      const vb = Math.sin((TAU * t) / PERIOD_MS + rad)
      a.push([t, va])
      b.push([t, vb])
      sum.push([t, va + vb])
    }
    return { a, b, sum }
  }, [rad])

  const shift = (Math.abs(phase) / 360) * PERIOD_MS * 1e-3 // seconds
  // two equal sines add to one sine of amplitude 2·cos(φ/2); rounding hides the 1e-16 left over at 180°
  const sumAmp = Math.round(2 * Math.abs(Math.cos(rad / 2)) * 1e6) / 1e6
  // the crest of A in the second cycle, and the crest of B that belongs to it
  const crestA = 1.25 * PERIOD_MS
  const crestB = crestA - (phase / 360) * PERIOD_MS

  const relation = phase === 0 ? "同相" : Math.abs(phase) === 180 ? "反相" : phase > 0 ? "B 超前" : "B 滞后"
  let note: string
  if (phase === 0) note = "同相：两个波形完全重合，同时到达波峰。把它们加起来，幅度翻倍。"
  else if (Math.abs(phase) === 180) note = "反相：A 到波峰时 B 正好在波谷。把它们加起来，处处为 0，完全抵消。"
  else
    note = `B ${phase > 0 ? "超前" : "滞后"} A ${sig(Math.abs(phase))}°：B 的波峰比 A ${phase > 0 ? "早" : "晚"}到 ${formatSI(shift, "s")}，也就是 ${sig(Math.abs(phase) / 360, 3)} 个周期。两者相加的幅度是 ${formatSI(sumAmp, "V")}。`

  return (
    <Lab
      title="相位差"
      hint="A 和 B 都是 1 kHz、幅度 1 V 的正弦波。拖动相位，看 B 的波峰（圆点）相对 A 往前还是往后挪。"
      onReset={() => {
        setPhase(90)
        setShowSum(false)
      }}
    >
      <LabStage>
        <Plot
          height={230}
          x={{ min: 0, max: WINDOW_MS, label: "时间 (ms)" }}
          y={{ min: -2.2, max: 2.2, label: "电压 (V)", ticks: [-2, -1, 0, 1, 2] }}
          series={[
            { points: a, label: "A（参考）", color: trace.voltage },
            { points: b, label: "B", color: trace.second },
            ...(showSum ? [{ points: sum, label: "A + B", color: trace.third, dashed: true }] : []),
          ]}
          markers={[
            { x: crestA, y: 1, color: trace.voltage },
            { x: crestB, y: 1, color: trace.second },
          ]}
        />
      </LabStage>
      <LabControls>
        <SliderField label="B 相对 A 的相位" value={phase} onChange={setPhase} min={-180} max={180} step={5} unit="°" color={trace.second} />
        <SwitchField label="显示 A + B" hint="两个信号叠加后的波形" checked={showSum} onChange={setShowSum} />
      </LabControls>
      <LabReadouts>
        <Readout label="相位差" value={`${sig(Math.abs(phase))}°`} sub={relation} color={trace.second} />
        <Readout label="时间差" value={formatSI(shift, "s")} sub="相位差 ÷ 360° × 周期" />
        <Readout label="A + B 的幅度" value={formatSI(sumAmp, "V")} sub="同相时 2 V，反相时 0" color={trace.third} />
      </LabReadouts>
      <LabNote>{note}</LabNote>
    </Lab>
  )
}

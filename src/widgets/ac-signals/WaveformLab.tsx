import * as React from "react"
import { ControlField, Lab, LabControls, LabNote, LabReadouts, LabStage, Plot, Readout, Segmented, SliderField, TAU, Tex, formatSI, sig, tex, trace } from "@/lab"

type Shape = "sine" | "square" | "triangle"

/** The screen always shows the same 4 ms, so a higher frequency packs more cycles into it. */
const WINDOW_MS = 4

const volts = (v: number) => formatSI(v, "V")

/** The waveform as [time in ms, volts]. Square and triangle waves get exact corner points so edges stay sharp. */
function waveform(shape: Shape, amp: number, offset: number, freq: number, duty: number): [number, number][] {
  const period = 1000 / freq
  const pts: [number, number][] = []
  if (shape === "sine") {
    const n = 800
    for (let k = 0; k <= n; k++) {
      const t = (WINDOW_MS * k) / n
      pts.push([t, offset + amp * Math.sin((TAU * t) / period)])
    }
    return pts
  }
  if (shape === "triangle") {
    // a corner every quarter period: centre, top, centre, bottom … (the plot clips what runs past the window)
    const levels = [0, 1, 0, -1]
    for (let k = 0; (k - 1) * (period / 4) < WINDOW_MS; k++) pts.push([(k * period) / 4, offset + amp * levels[k % 4]])
    return pts
  }
  const hi = offset + amp
  const lo = offset - amp
  for (let k = 0; k * period < WINDOW_MS; k++) {
    const t0 = k * period
    const fall = t0 + duty * period
    pts.push([t0, hi], [fall, hi], [fall, lo], [t0 + period, lo])
  }
  return pts
}

/** A function generator feeding a scope: pick a shape, set amplitude / frequency / offset, read Vpp, RMS, period and mean. */
export function WaveformLab() {
  const [shape, setShape] = React.useState<Shape>("sine")
  const [amp, setAmp] = React.useState(3)
  const [freq, setFreq] = React.useState(500)
  const [offset, setOffset] = React.useState(0)
  const [dutyPct, setDutyPct] = React.useState(50)

  const duty = dutyPct / 100
  const points = React.useMemo(() => waveform(shape, amp, offset, freq, duty), [shape, amp, offset, freq, duty])

  const vmax = offset + amp
  const vmin = offset - amp
  // mean = the DC part; the AC part's RMS depends on the shape; the two add like the sides of a right triangle
  const mean = shape === "square" ? offset + amp * (2 * duty - 1) : offset
  const acRms = shape === "sine" ? amp / Math.SQRT2 : shape === "triangle" ? amp / Math.sqrt(3) : 2 * amp * Math.sqrt(duty * (1 - duty))
  const rms = Math.hypot(mean, acRms)
  const period = 1 / freq

  const unipolar = vmin >= -1e-9
  const rmsHint =
    amp === 0
      ? "直流的有效值就是它本身"
      : Math.abs(mean) > 1e-9
        ? `其中交流部分 ${volts(acRms)}`
        : shape === "sine"
          ? "幅度 × 0.707"
          : shape === "triangle"
            ? "幅度 × 0.577"
            : "方波：等于幅度"

  let tone: "neutral" | "good" = "neutral"
  let note: React.ReactNode
  if (amp === 0) {
    note = `幅度是 0，波形成了一条平线：这就是 ${volts(offset)} 的直流，电压不再随时间变化。`
  } else if (unipolar && vmax <= 3.3 + 1e-9) {
    tone = "good"
    note = "整条波形都落在 0–3.3 V 之间，没有负电压，可以直接送进 3.3 V 单片机的 ADC 引脚。"
  } else if (shape === "square") {
    note = `方波在一个周期里有 ${sig(dutyPct, 3)}% 的时间停在 ${volts(vmax)}，其余时间停在 ${volts(vmin)}，所以平均值是 ${volts(mean)}。`
  } else if (unipolar) {
    note = `偏置把整条波形抬到了 0 V 以上：电压还在起伏，但方向不再改变。有效值 ${volts(rms)} 把直流部分也算了进去。`
  } else if (offset !== 0) {
    note = `波形以 ${volts(offset)} 为中心上下摆动，平均值就是这个偏置。有效值 ${volts(rms)} 由直流和交流两部分合成。`
  } else if (shape === "sine") {
    note = (
      <>
        正弦波的有效值是幅度的 0.707 倍：<Tex>{String.raw`${tex.si(amp, "V")} \times 0.707 = ${tex.si(rms, "V")}`}</Tex>。它让电阻发的热，和 {volts(rms)} 的直流一样多。
      </>
    )
  } else {
    note = (
      <>
        三角波的有效值是幅度的 0.577 倍：<Tex>{String.raw`${tex.si(amp, "V")} \times 0.577 = ${tex.si(rms, "V")}`}</Tex>。幅度相同时，它发的热比正弦波少。
      </>
    )
  }

  return (
    <Lab
      title="波形参数实验台"
      hint="换波形，调幅度、频率和偏置。两条横虚线是波形的最高点和最低点，间距就是峰峰值；竖虚线标出一个周期。"
      onReset={() => {
        setShape("sine")
        setAmp(3)
        setFreq(500)
        setOffset(0)
        setDutyPct(50)
      }}
    >
      <LabStage>
        <Plot
          height={250}
          x={{ min: 0, max: WINDOW_MS, label: "时间 (ms)" }}
          y={{ min: -8, max: 8, label: "电压 (V)", ticks: [-8, -4, 0, 4, 8] }}
          series={[
            { points, label: "电压", color: trace.voltage },
            {
              points: [
                [0, mean],
                [WINDOW_MS, mean],
              ],
              label: "平均值",
              color: trace.second,
              dashed: true,
              width: 1.5,
            },
          ]}
          lines={amp > 0 ? [{ x: period * 1000, label: `周期 ${formatSI(period, "s")}` }, { y: vmax, label: `最高 ${volts(vmax)}` }, { y: vmin }] : []}
        />
      </LabStage>
      <LabControls>
        <ControlField label="波形">
          <Segmented
            aria-label="波形"
            value={shape}
            onValueChange={setShape}
            options={[
              { value: "sine", label: "正弦波" },
              { value: "square", label: "方波" },
              { value: "triangle", label: "三角波" },
            ]}
          />
        </ControlField>
        <SliderField label="幅度（峰值）" value={amp} onChange={setAmp} min={0} max={5} step={0.05} unit="V" color={trace.voltage} />
        <SliderField label="频率" value={freq} onChange={setFreq} min={250} max={2500} step={50} unit="Hz" />
        <SliderField label="直流偏置" value={offset} onChange={setOffset} min={-3} max={3} step={0.05} unit="V" color={trace.second} />
        <SliderField label="占空比（只对方波有效）" value={dutyPct} onChange={setDutyPct} min={5} max={95} step={1} unit="%" disabled={shape !== "square"} />
      </LabControls>
      <LabReadouts>
        <Readout label="峰峰值" value={volts(2 * amp)} sub={`${volts(vmin)} 到 ${volts(vmax)}`} color={trace.voltage} />
        <Readout label="有效值" value={volts(rms)} sub={rmsHint} />
        <Readout label="周期" value={formatSI(period, "s")} sub={<Tex>{`1/${tex.si(freq, "Hz")}`}</Tex>} />
        <Readout label="平均值" value={volts(mean)} sub={shape === "square" ? "随占空比变化" : "等于直流偏置"} color={trace.second} />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

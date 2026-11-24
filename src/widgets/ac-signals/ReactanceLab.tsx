import * as React from "react"
import { Lab, LabControls, LabNote, LabReadouts, LabStage, Plot, Readout, SliderField, TAU, clamp, formatSI, sig, trace } from "@/lab"

/** A plain resistor to compare against: its line is flat. */
const R_REF = 1000
const Y_MIN = 0.1
const Y_MAX = 1e7

const ohms = (v: number) => formatSI(v, "Ω")

/** A large multiple in words a reader can take in: "250 倍", "1.9 万倍", "25 亿倍". */
function many(x: number): string {
  return x >= 1e8 ? `${sig(x / 1e8, 2)} 亿倍` : x >= 1e4 ? `${sig(x / 1e4, 2)} 万倍` : `${sig(x, 2)} 倍`
}

/** Reactance of one capacitor and one inductor across frequency, on log-log axes, next to a resistor that doesn't care. */
export function ReactanceLab() {
  const [freq, setFreq] = React.useState(1000)
  const [cap, setCap] = React.useState(100e-9)
  const [ind, setInd] = React.useState(10e-3)

  const xc = (f: number) => 1 / (TAU * f * cap)
  const xl = (f: number) => TAU * f * ind
  const xcNow = xc(freq)
  const xlNow = xl(freq)
  const ratio = xcNow / xlNow

  const hz = formatSI(freq, "Hz")
  let note: string
  if (ratio >= 100) note = `${hz} 对这两只元件算低频：容抗 ${ohms(xcNow)}，是感抗 ${ohms(xlNow)} 的 ${many(ratio)}。这个频率的信号容易穿过电感，难以穿过电容。`
  else if (ratio <= 0.01) note = `${hz} 对这两只元件算高频：感抗 ${ohms(xlNow)}，是容抗 ${ohms(xcNow)} 的 ${many(1 / ratio)}。这个频率的信号容易穿过电容，难以穿过电感。`
  else note = `${hz} 时两者的电抗相差不到 100 倍（容抗 ${ohms(xcNow)}，感抗 ${ohms(xlNow)}）。两条线相交的那个频率，是第 4 课要讲的谐振频率。`

  return (
    <Lab
      title="容抗和感抗随频率怎么变"
      hint="拖动频率，看圆点沿两条线移动；再换电容和电感的大小，看整条线上下平移。两个坐标轴都是对数刻度。"
      onReset={() => {
        setFreq(1000)
        setCap(100e-9)
        setInd(10e-3)
      }}
    >
      <LabStage>
        <Plot
          height={270}
          x={{ min: 10, max: 1e6, log: true, label: "频率 (Hz)" }}
          y={{ min: Y_MIN, max: Y_MAX, log: true, label: "电抗 (Ω)" }}
          series={[
            { fn: xc, label: "容抗 Xc", color: trace.second },
            { fn: xl, label: "感抗 XL", color: trace.third },
            { fn: () => R_REF, label: "1 kΩ 电阻（对比）", color: trace.ref, dashed: true, width: 1.5 },
          ]}
          lines={[{ x: freq, label: formatSI(freq, "Hz") }]}
          markers={[
            { x: freq, y: clamp(xcNow, Y_MIN, Y_MAX), color: trace.second },
            { x: freq, y: clamp(xlNow, Y_MIN, Y_MAX), color: trace.third },
          ]}
        />
      </LabStage>
      <LabControls columns={3}>
        <SliderField label="频率 f" value={freq} onChange={setFreq} min={10} max={1e6} log unit="Hz" />
        <SliderField label="电容 C" value={cap} onChange={setCap} min={1e-9} max={10e-6} log snap="E12" unit="F" color={trace.second} />
        <SliderField label="电感 L" value={ind} onChange={setInd} min={100e-6} max={100e-3} log snap="E12" unit="H" color={trace.third} />
      </LabControls>
      <LabReadouts>
        <Readout label="容抗 Xc" value={ohms(xcNow)} sub="1 ÷ (2πfC)" color={trace.second} />
        <Readout label="感抗 XL" value={ohms(xlNow)} sub="2πfL" color={trace.third} />
        <Readout label="对比：电阻" value={ohms(R_REF)} sub="和频率无关" color={trace.ref} />
      </LabReadouts>
      <LabNote>{note}</LabNote>
    </Lab>
  )
}

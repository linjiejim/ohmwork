import * as React from "react"
import { Lab, LabControls, LabNote, LabReadouts, LabStage, Plot, Readout, SliderField, TAU, fixed, formatSI, trace } from "@/lab"

const VCC = 5
const MID = 2.5
const SWING = 2 // the clean signal is a sine between 0.5 V and 4.5 V
const WINDOW = 40 // ms: two periods
const PERIOD = 20
const SAMPLES = 480
const EXPECTED = 4 // a clean signal crosses the middle four times in two periods

/** One fixed stretch of white noise in −1…1 (same every render, so the picture holds still). */
const NOISE = (() => {
  let seed = 20251124
  return Array.from({ length: SAMPLES + 1 }, () => {
    // mulberry32
    seed = (seed + 0x6d2b79f5) | 0
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return (((x ^ (x >>> 14)) >>> 0) / 4294967296) * 2 - 1
  })
})()

/** A comparator with two thresholds: it flips high above the upper one and low below the lower one. */
export function SchmittLab() {
  const [hyst, setHyst] = React.useState(0)
  const [noise, setNoise] = React.useState(0.3)

  const upper = MID + hyst / 2
  const lower = MID - hyst / 2

  const { input, output, flips } = React.useMemo(() => {
    const input: [number, number][] = []
    const output: [number, number][] = []
    let high = false
    let flips = 0
    for (let k = 0; k <= SAMPLES; k++) {
      const t = (WINDOW * k) / SAMPLES
      // starts at the bottom of the sine, so the output starts low
      const v = MID - SWING * Math.cos((TAU * t) / PERIOD) + noise * NOISE[k]
      if (!high && v > upper) {
        high = true
        flips++
      } else if (high && v < lower) {
        high = false
        flips++
      }
      input.push([t, v])
      output.push([t, high ? VCC : 0])
    }
    return { input, output, flips }
  }, [noise, upper, lower])

  const extra = flips - EXPECTED
  let tone: "neutral" | "good" | "warn" | "bad"
  let note: string
  if (extra > 0) {
    tone = "bad"
    note = `输入在门限附近被噪声带着来回越线，输出跟着多翻了 ${extra} 次。单片机会把这些毛刺当成很多次按键或很多个脉冲。${hyst === 0 ? "把迟滞加上去。" : "迟滞还不够宽，继续加。"}`
  } else if (hyst === 0) {
    tone = "neutral"
    note = "输入很干净，一个门限也只翻转 4 次。把噪声加回来再看。"
  } else if (hyst < 2 * noise) {
    tone = "warn"
    note = `这一段没有出错，但迟滞（${formatSI(hyst, "V")}）还小于噪声的峰峰值（${formatSI(2 * noise, "V")}），换一段噪声就可能误翻转。`
  } else {
    tone = "good"
    note = `迟滞 ${formatSI(hyst, "V")} 比噪声的峰峰值（${formatSI(2 * noise, "V")}）宽：越过上门限翻上去之后，要一路掉到下门限才会翻回来，噪声够不着。代价是翻转的时刻稍微晚一点。`
  }

  return (
    <Lab
      title="施密特触发器：带迟滞的比较器"
      hint="迟滞为 0 时就是普通比较器。把迟滞往上拖，看输出的毛刺什么时候消失。"
      onReset={() => {
        setHyst(0)
        setNoise(0.3)
      }}
    >
      <LabStage>
        <Plot
          height={250}
          x={{ min: 0, max: WINDOW, label: "时间 (ms)" }}
          y={{ min: -0.5, max: 5.5, label: "电压 (V)", ticks: [0, 1, 2, 3, 4, 5] }}
          series={[
            { points: input, label: "输入（带噪声）", color: trace.voltage, width: 1.5 },
            { points: output, label: "输出", color: trace.second, step: true },
            { fn: () => upper, label: hyst === 0 ? "门限" : "上、下门限", color: trace.ref, dashed: true, width: 1.25 },
            { fn: () => lower, color: trace.ref, dashed: true, width: 1.25 },
          ]}
        />
      </LabStage>
      <LabControls>
        <SliderField label="迟滞宽度（上下门限之差）" value={hyst} onChange={setHyst} min={0} max={3} step={0.05} format={(v) => `${fixed(v, 2)} V`} />
        <SliderField label="噪声幅度（峰值）" value={noise} onChange={setNoise} min={0} max={0.6} step={0.02} format={(v) => `${fixed(v, 2)} V`} color={trace.voltage} />
      </LabControls>
      <LabReadouts>
        <Readout label="上门限" value={`${fixed(upper, 2)} V`} />
        <Readout label="下门限" value={`${fixed(lower, 2)} V`} />
        <Readout label="输出翻转次数" value={`${flips} 次`} color={trace.second} sub={`干净的信号应为 ${EXPECTED} 次`} />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

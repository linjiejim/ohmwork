import * as React from "react"
import { Lab, LabControls, LabNote, LabReadouts, LabStage, Plot, Readout, SliderField, Tex, fixed, percent, trace } from "@/lab"
import { gaussianNoise, stdDev } from "./noise"

/** Samples drawn on screen. */
const SHOWN = 200
/** Longest averaging window (2^6). */
const MAX_N = 64
/** The true temperature jumps at this sample, to show what averaging costs. */
const STEP_AT = 70
const T_BEFORE = 25
const T_AFTER = 27

// One fixed noise record (standard deviation ≈ 1). The first MAX_N samples are
// history from before the plot starts, so every averaging window is full.
const NOISE = gaussianNoise(2024, 4096)
const NOISE_STD = stdDev(NOISE)

/** Standard deviation of the N-sample moving average of the record, measured for N = 1, 2, 4 … 64. */
const AVERAGED_STD = [0, 1, 2, 3, 4, 5, 6].map((k) => {
  const n = 2 ** k
  const out: number[] = []
  let sum = 0
  for (let i = 0; i < NOISE.length; i++) {
    sum += NOISE[i]
    if (i >= n) sum -= NOISE[i - n]
    if (i >= n - 1) out.push(sum / n)
  }
  return stdDev(out)
})

const truth = (i: number) => (i < STEP_AT ? T_BEFORE : T_AFTER)

/**
 * Noisy readings and their moving average: more samples per average means
 * less jitter (≈ 1/√N), and a slower answer when the real value changes.
 */
export function AveragingLab() {
  const [sigma, setSigma] = React.useState(0.4)
  const [k, setK] = React.useState(4)
  const n = 2 ** k

  const { rawPts, avgPts } = React.useMemo(() => {
    // reading number i (i may be negative: readings taken before the plot starts)
    const reading = (i: number) => truth(i) + sigma * NOISE[i + MAX_N]
    const rawPts: [number, number][] = []
    const avgPts: [number, number][] = []
    for (let i = 0; i < SHOWN; i++) {
      let sum = 0
      for (let j = i - n + 1; j <= i; j++) sum += reading(j)
      rawPts.push([i, reading(i)])
      avgPts.push([i, sum / n])
    }
    return { rawPts, avgPts }
  }, [sigma, n])

  const rawJitter = sigma * NOISE_STD
  const avgJitter = sigma * AVERAGED_STD[k]
  const ratio = AVERAGED_STD[k] / NOISE_STD
  const theory = 1 / Math.sqrt(n)

  const note =
    sigma === 0
      ? "噪声调到了 0：这时平均没有任何好处，只剩下「反应变慢」这一个代价。"
      : n === 1
        ? "没有做平均：每次读数都带着全部噪声，但真实温度一变，读数马上跟上。"
        : (
          <>
            {n} 次平均把抖动压到原来的 {percent(ratio)}（理论值 <Tex>{String.raw`1/\sqrt{${n}} = ${percent(theory).replace("%", String.raw`\%`)}`}</Tex>）。代价是反应变慢：第 {STEP_AT} 次采样时温度突然升了 2 °C，平均值要再过 {n} 次采样才完全跟上。
          </>
        )

  return (
    <Lab
      title="多次采样取平均"
      hint="细线是每次的原始读数，粗线是最近 N 次的平均。加大 N，看抖动变小，也看它跟上温度突变要多久。"
      onReset={() => {
        setSigma(0.4)
        setK(4)
      }}
    >
      <LabStage>
        <Plot
          height={240}
          x={{ min: 0, max: SHOWN, label: "采样次数 (次)" }}
          y={{ min: 22, max: 30, label: "读数 (°C)" }}
          series={[
            { points: rawPts, label: "原始读数", color: trace.second, width: 1 },
            { points: avgPts, label: `最近 ${n} 次的平均`, color: trace.voltage, width: 2.5 },
            {
              points: [
                [0, T_BEFORE],
                [STEP_AT, T_AFTER],
                [SHOWN, T_AFTER],
              ],
              step: true,
              label: "真实温度",
              color: trace.ref,
              dashed: true,
            },
          ]}
        />
      </LabStage>
      <LabControls>
        <SliderField label="噪声大小（标准差）" value={sigma} onChange={setSigma} min={0} max={1} step={0.05} format={(v) => `${fixed(v, 2)} °C`} color={trace.second} />
        <SliderField label="平均次数 N" value={k} onChange={setK} min={0} max={6} step={1} format={(v) => `${2 ** v} 次`} color={trace.voltage} />
      </LabControls>
      <LabReadouts>
        <Readout label="原始读数的抖动" value={`±${fixed(rawJitter, 2)} °C`} color={trace.second} />
        <Readout label="平均后的抖动" value={`±${fixed(avgJitter, 2)} °C`} color={trace.voltage} />
        <Readout label="降到原来的" value={percent(ratio)} sub={
            <>
              理论 <Tex>{String.raw`1/\sqrt{${n}} = ${percent(theory).replace("%", String.raw`\%`)}`}</Tex>
            </>
          } />
        <Readout label="跟上变化需要" value={`${n} 次采样`} />
      </LabReadouts>
      <LabNote tone={n >= 32 && sigma > 0 ? "warn" : "neutral"}>{note}</LabNote>
    </Lab>
  )
}

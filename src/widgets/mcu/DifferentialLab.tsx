import * as React from "react"
import { Button, ControlField, Lab, LabControls, LabNote, LabReadouts, LabStage, Plot, Readout, SliderField, fixed, trace } from "@/lab"
import { smoothNoise } from "./shared"

/** The bits being sent, one after another. */
const BITS = [1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 1, 0, 0, 1, 0, 1] as const
/** Waveform samples per bit. */
const SPB = 20
/** Single-ended signalling: 0 V / 3.3 V, receiver threshold half way. */
const V_HIGH = 3.3
const V_TH = V_HIGH / 2
/** Differential pair: each line swings ±1 V around 2.5 V, in opposite directions, so A − B is ±2 V. */
const V_CM = 2.5
const V_SWING = 1
const FIRST_SEED = 1
const Y_AXIS = { min: -5, max: 8, ticks: [-4, 0, 4, 8] }
const X_TICKS = [0, 4, 8, 12, 16]

/** Interference picked up along the cable, scaled so its largest excursion is exactly 1. Repeatable for a given seed. */
function noiseShape(seed: number): number[] {
  const raw: number[] = []
  for (let i = 0; i <= BITS.length * SPB; i++) {
    const t = i / SPB
    raw.push(0.6 * smoothNoise(t * 0.9, seed * 3 + 1) + 0.4 * smoothNoise(t * 2.7, seed * 3 + 2))
  }
  const peak = Math.max(...raw.map(Math.abs)) || 1
  return raw.map((v) => v / peak)
}

/** A row of received bits; the wrong ones are underlined and coloured. */
function BitRow({ label, bits }: { label: string; bits: number[] }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="w-16 shrink-0 text-caption text-muted-foreground">{label}</span>
      <span className="tabular flex flex-wrap gap-x-2 text-body font-medium">
        {[0, 4, 8, 12].map((g) => (
          <span key={g}>
            {bits.slice(g, g + 4).map((b, k) =>
              b === BITS[g + k] ? (
                <span key={k}>{b}</span>
              ) : (
                <span key={k} className="text-destructive underline decoration-2 underline-offset-4">
                  {b}
                </span>
              ),
            )}
          </span>
        ))}
      </span>
    </div>
  )
}

/**
 * The same interference on a single wire and on a differential pair. On one
 * wire it pushes bits across the threshold; on the pair it lands on both
 * lines alike and drops out of the difference.
 */
export function DifferentialLab() {
  const [amp, setAmp] = React.useState(2.5)
  const [seed, setSeed] = React.useState(FIRST_SEED)

  const shape = React.useMemo(() => noiseShape(seed), [seed])
  const single: [number, number][] = []
  const lineA: [number, number][] = []
  const lineB: [number, number][] = []
  const diff: [number, number][] = []
  shape.forEach((n, i) => {
    const bit = BITS[Math.min(BITS.length - 1, Math.floor(i / SPB))]
    const x = i / SPB
    const swing = bit ? V_SWING : -V_SWING
    const a = V_CM + swing + amp * n
    const b = V_CM - swing + amp * n
    single.push([x, bit * V_HIGH + amp * n])
    lineA.push([x, a])
    lineB.push([x, b])
    diff.push([x, a - b])
  })
  // both receivers look at the middle of each bit
  const centre = (k: number) => k * SPB + SPB / 2
  const singleRx = BITS.map((_, k) => (single[centre(k)][1] > V_TH ? 1 : 0))
  const diffRx = BITS.map((_, k) => (diff[centre(k)][1] > 0 ? 1 : 0))
  const singleErrors = singleRx.filter((b, k) => b !== BITS[k]).length
  const diffErrors = diffRx.filter((b, k) => b !== BITS[k]).length
  const wrong = BITS.map((_, k) => k).filter((k) => singleRx[k] !== BITS[k])

  let tone: "neutral" | "good" | "bad" = "good"
  let note: string
  if (singleErrors > 0) {
    tone = "bad"
    note = `单端：噪声把 ${singleErrors} 位推过了 1.65 V 的门限，读错了（红点）。差分：同样的噪声同时加在 A 和 B 上，一相减就消掉，${diffErrors === 0 ? "一位没错" : `错了 ${diffErrors} 位`}。`
  } else if (amp > V_TH) {
    tone = "neutral"
    note = `噪声峰值 ${fixed(amp, 1)} V，已经大到能越过单端的门限，只是这一组恰好没碰上采样时刻。换一组噪声再看。`
  } else {
    note = `噪声峰值 ${fixed(amp, 1)} V，还够不着单端信号的门限（高、低电平离门限各 1.65 V），两种方式都没读错。继续加大。`
  }

  return (
    <Lab
      title="单端信号和差分信号"
      hint="两种方式传同样的 16 位，线上叠加同样的噪声。加大噪声，看谁先出错。"
      onReset={() => {
        setAmp(2.5)
        setSeed(FIRST_SEED)
      }}
    >
      <LabStage>
        <div className="flex flex-col gap-4">
          <Plot
            height={180}
            x={{ min: 0, max: BITS.length, ticks: X_TICKS }}
            y={{ ...Y_AXIS, label: "单端：一根信号线对地的电压 (V)" }}
            series={[{ points: single, label: "信号 + 噪声", color: trace.voltage }]}
            lines={[{ y: V_TH, label: "判决门限 1.65 V" }]}
            markers={wrong.map((k) => ({ x: k + 0.5, y: single[centre(k)][1], color: trace.power }))}
            ariaLabel="单端信号叠加噪声后的波形"
          />
          <Plot
            height={200}
            x={{ min: 0, max: BITS.length, label: "时间 (位)", ticks: X_TICKS }}
            y={{ ...Y_AXIS, label: "差分：两根线各自的电压，以及它们的差 (V)" }}
            series={[
              { points: lineA, label: "A", color: trace.voltage, width: 1.5 },
              { points: lineB, label: "B", color: trace.second, width: 1.5 },
              { points: diff, label: "A − B（接收端只看它）", color: trace.good, width: 2.5 },
            ]}
            ariaLabel="差分对 A、B 叠加同样噪声后的波形，以及 A 减 B"
          />
          <div className="flex flex-col gap-1">
            <BitRow label="发送" bits={[...BITS]} />
            <BitRow label="单端收到" bits={singleRx} />
            <BitRow label="差分收到" bits={diffRx} />
          </div>
        </div>
      </LabStage>
      <LabControls>
        <SliderField label="共模噪声幅度（峰值）" value={amp} onChange={setAmp} min={0} max={4} step={0.1} unit="V" color={trace.power} />
        <ControlField label="噪声">
          <Button onClick={() => setSeed((s) => s + 1)}>换一组噪声</Button>
        </ControlField>
      </LabControls>
      <LabReadouts>
        <Readout label="单端误码" value={`${singleErrors} / ${BITS.length} 位`} color={trace.power} />
        <Readout label="差分误码" value={`${diffErrors} / ${BITS.length} 位`} color={trace.good} />
        <Readout label="差分电压 A − B" value="±2 V" sub="不随噪声变化" />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

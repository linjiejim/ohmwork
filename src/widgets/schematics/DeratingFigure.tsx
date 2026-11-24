import { Plot, trace } from "@/lab"

/*
 * Static figure: how much heat the teaching LDO (OW1117-3.3, θJA = 90 °C/W) may dissipate
 * at each ambient temperature, P = (TJ − TA) / θJA, for TJ = 125 °C (recommended) and 150 °C (absolute maximum).
 */
const THETA = 90
const allowed = (tjMax: number) => (ta: number) => Math.max(0, (tjMax - ta) / THETA)

export function DeratingFigure() {
  return (
    <Plot
      height={220}
      x={{ min: -40, max: 150, label: "环境温度 TA (°C)" }}
      y={{ min: 0, max: 2.2, label: "允许的发热 (W)" }}
      series={[
        { fn: allowed(125), label: "结温不超过 125 °C（推荐）", color: trace.power },
        { fn: allowed(150), label: "结温不超过 150 °C（极限）", color: trace.ref, dashed: true },
      ]}
      markers={[{ x: 40, y: allowed(125)(40), label: "40 °C 时约 0.94 W", color: trace.power }]}
      ariaLabel="降额曲线：环境温度越高，稳压器允许的发热越小，按推荐结温 125 °C 计，25 °C 时约 1.1 W，125 °C 时降到 0"
    />
  )
}

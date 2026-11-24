import * as React from "react"
import { Capacitor, Ground, Inductor, Junction, Lab, LabControls, LabNote, LabReadouts, LabStage, Plot, Port, Readout, Resistor, Schematic, SliderField, TAU, Wire, formatSI, percent, sig, trace } from "@/lab"

/** About 5 cm of wire, and a pin plus a scope probe at the far end. */
const L = 50e-9
const C = 20e-12
/** The logic swing, and what a 3.3 V pin usually tolerates (supply + 0.3 V). */
const VDD = 3.3
const V_LIMIT = 3.6

const W0 = 1 / Math.sqrt(L * C)
const Z0 = Math.sqrt(L / C)
const F0 = W0 / TAU
/** Time axis in ns; the edge leaves the driver at EDGE_NS. */
const WINDOW_NS = 60
const EDGE_NS = 5
const DT_NS = 0.05

/** Voltage across C, t seconds after a 0 → 1 step into the series R-L-C. Closed form for every damping ratio. */
function stepResponse(t: number, zeta: number): number {
  if (t <= 0) return 0
  const a = zeta * W0
  if (Math.abs(zeta - 1) < 1e-3) return 1 - Math.exp(-a * t) * (1 + a * t)
  if (zeta < 1) {
    const wd = W0 * Math.sqrt(1 - zeta * zeta)
    return 1 - Math.exp(-a * t) * (Math.cos(wd * t) + (a / wd) * Math.sin(wd * t))
  }
  const s = W0 * Math.sqrt(zeta * zeta - 1)
  const s1 = -a + s
  const s2 = -a - s
  return 1 - (s2 * Math.exp(s1 * t) - s1 * Math.exp(s2 * t)) / (s2 - s1)
}

/** A fast logic edge into stray L and C: overshoot and ringing, and the series resistor that tames them. */
export function RingingLab() {
  const [r, setR] = React.useState(22)

  const zeta = r / (2 * Z0)
  const q = Z0 / r
  const { points, rise } = React.useMemo(() => {
    const points: [number, number][] = []
    let t10 = Number.NaN
    let t90 = Number.NaN
    let prev = 0
    for (let k = 0; k * DT_NS <= WINDOW_NS + 1e-9; k++) {
      const ns = k * DT_NS
      const y = stepResponse((ns - EDGE_NS) * 1e-9, zeta)
      // first crossings of 10% and 90%, interpolated between samples
      if (Number.isNaN(t10) && y >= 0.1) t10 = ns - (DT_NS * (y - 0.1)) / (y - prev || 1)
      if (Number.isNaN(t90) && y >= 0.9) t90 = ns - (DT_NS * (y - 0.9)) / (y - prev || 1)
      prev = y
      points.push([ns, VDD * y])
    }
    return { points, rise: (t90 - t10) * 1e-9 }
  }, [zeta])

  const overshoot = zeta < 1 ? Math.exp((-Math.PI * zeta) / Math.sqrt(1 - zeta * zeta)) : 0
  const peak = VDD * (1 + overshoot)
  const ringing = zeta < 1
  const riseText = Number.isFinite(rise) ? formatSI(rise, "s") : `超过 ${WINDOW_NS} ns`
  const rText = formatSI(r, "Ω")

  let tone: "good" | "warn" | "bad"
  let note: string
  if (overshoot > 0.3) {
    tone = "bad"
    note = `R = ${rText}，Q = ${sig(q, 2)}：电压一路冲到 ${formatSI(peak, "V")} 才回头，又来回振荡了好几个周期。3.3 V 芯片的引脚一般只允许到 ${V_LIMIT} V，超出的部分会灌进引脚的保护二极管。`
  } else if (peak > V_LIMIT) {
    tone = "warn"
    note = `R = ${rText}：还有 ${percent(overshoot, 1)} 的过冲，峰值 ${formatSI(peak, "V")}，仍然高于 ${V_LIMIT} V。再加大一点电阻就能压住。`
  } else if (zeta <= 1.2) {
    tone = "good"
    note = `R = ${rText}：${overshoot < 0.0005 ? "没有过冲" : `过冲只有 ${percent(overshoot, 1)}`}，边沿干净，上升时间 ${riseText}。电阻到 2√(L/C) = ${formatSI(2 * Z0, "Ω")} 时，刚好不再振荡。`
  } else {
    tone = "warn"
    note = `R = ${rText}：振铃没有了，但边沿被拖慢到 ${riseText}。电阻再大，高速信号的电平还没到位，下一位数据就来了。`
  }

  /*
   * Schematic, 290 × 170. Signal path along y=60.
   *   driver port (30, 60), name above it
   *   R centre (90, 60) → terminals (60, 60) and (120, 60); labels above
   *   L centre (170, 60) → terminals (140, 60) and (200, 60); labels above
   *   node (230, 60); receiver port (260, 60), name above it
   *   C centre (230, 110) rot 90 → terminals (230, 80) and (230, 140); labels to its left (x ≤ 210), under the inductor
   *   ground hangs from (230, 140) down to y=158
   */
  return (
    <Lab title="边沿上的振铃" hint="驱动端输出一个 0 → 3.3 V 的理想跳变。拖动回路里的电阻，看接收端的波形从剧烈振荡变得干净，再变得迟缓。" onReset={() => setR(22)}>
      <LabStage>
        <Schematic width={290} height={170} label="驱动端经过串联电阻和走线电感，接到带有对地电容的接收端">
          <Wire
            points={[
              [30, 60],
              [60, 60],
            ]}
          />
          <Wire
            points={[
              [120, 60],
              [140, 60],
            ]}
          />
          <Wire
            points={[
              [200, 60],
              [260, 60],
            ]}
          />
          <Wire
            points={[
              [230, 60],
              [230, 80],
            ]}
          />
          <Resistor x={90} y={60} label="回路电阻" value={rText} />
          <Inductor x={170} y={60} label="走线电感" value={formatSI(L, "H")} />
          <Capacitor x={230} y={110} rot={90} label="负载电容" value={formatSI(C, "F")} labelSide="left" />
          <Junction x={230} y={60} />
          <Ground x={230} y={140} />
          <Port x={30} y={60} label="驱动端" side="top" />
          <Port x={260} y={60} label="接收端" side="top" color={trace.voltage} />
        </Schematic>
        <Plot
          className="mt-4"
          height={250}
          x={{ min: 0, max: WINDOW_NS, label: "时间 (ns)" }}
          y={{ min: -0.5, max: 7, label: "电压 (V)", ticks: [0, 2, 4, 6] }}
          series={[
            {
              points: [
                [0, 0],
                [EDGE_NS, 0],
                [EDGE_NS, VDD],
                [WINDOW_NS, VDD],
              ],
              label: "驱动端（理想跳变）",
              color: trace.ref,
              dashed: true,
            },
            { points, label: "接收端实际看到的", color: trace.voltage },
          ]}
          lines={[{ y: V_LIMIT, label: `引脚上限 ${V_LIMIT} V`, color: trace.power }]}
        />
      </LabStage>
      <LabControls columns={1}>
        <SliderField label="回路电阻 R（驱动脚内阻 + 外加的串联电阻）" value={r} onChange={setR} min={4.7} max={330} log snap="E12" unit="Ω" />
      </LabControls>
      <LabReadouts>
        <Readout label="峰值电压" value={formatSI(peak, "V")} sub={`过冲 ${percent(overshoot, 1)}`} color={trace.voltage} />
        <Readout label="Q 值" value={sig(q, 2)} sub="√(L/C) ÷ R" />
        <Readout label="振铃频率" value={ringing ? formatSI(F0 * Math.sqrt(1 - zeta * zeta), "Hz") : "不振荡"} sub={ringing ? `LC 的谐振频率 ${formatSI(F0, "Hz")}` : "阻尼足够大"} />
        <Readout label="上升时间" value={riseText} sub="从 10% 到 90%" />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

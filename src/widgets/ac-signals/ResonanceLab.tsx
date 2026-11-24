import * as React from "react"
import { Capacitor, Inductor, Lab, LabControls, LabNote, LabReadouts, LabStage, Plot, Readout, Resistor, Schematic, SliderField, Source, TAU, Tex, Wire, formatSI, logspace, sig, trace } from "@/lab"

const F_MIN = 1e3
const F_MAX = 1e6

/** Series RLC driven by a 1 V source: the voltage across R (∝ current) against frequency, with f0, Q and the −3 dB bandwidth. */
export function ResonanceLab() {
  const [l, setL] = React.useState(1e-3)
  const [c, setC] = React.useState(10e-9)
  const [r, setR] = React.useState(33)

  const f0 = 1 / (TAU * Math.sqrt(l * c))
  const q = Math.sqrt(l / c) / r
  const bw = f0 / q
  // the two frequencies where the response is 1/√2: f0·(√(1 + 1/4Q²) ∓ 1/2Q)
  const half = 1 / (2 * q)
  const f1 = f0 * (Math.hypot(1, half) - half)
  const f2 = f0 * (Math.hypot(1, half) + half)

  const curve = React.useMemo(() => {
    // |V_R / V_in| = R / |Z|, with Z = R + j(XL − Xc)
    const h = (f: number) => r / Math.hypot(r, TAU * f * l - 1 / (TAU * f * c))
    const fs = logspace(F_MIN, F_MAX, 300)
    // a high-Q peak is narrower than one pixel: add points that close in on f0 geometrically so it is never skipped
    for (let k = 0; k <= 120; k++) {
      const d = (0.05 * 1.08 ** k) / (2 * q)
      fs.push(f0 * (1 + d))
      if (d < 1) fs.push(f0 * (1 - d))
    }
    fs.push(f0)
    return fs
      .filter((f) => f >= F_MIN && f <= F_MAX)
      .sort((a, b) => a - b)
      .map((f): [number, number] => [f, h(f)])
  }, [l, c, r, f0, q])

  const qText = sig(q, 3)
  let tone: "neutral" | "warn" = "neutral"
  let note: string
  if (q < 0.5) {
    tone = "warn"
    note = `Q 只有 ${qText}：电阻太大，能量刚开始在电感和电容之间来回，就被电阻耗掉了。曲线只剩一个平缓的鼓包，已经挑不出某一个频率。`
  } else if (q >= 50) {
    tone = "warn"
    note = `Q = ${qText}：峰尖得像一根针，只放行 f₀ 附近 ${formatSI(bw, "Hz")} 宽的频率。代价是谐振时电感、电容两端的电压各是输入的 Q 倍：1 V 的信号源会在电容上产生 ${formatSI(q, "V")}。`
  } else {
    note = `谐振频率 ${formatSI(f0, "Hz")}，Q = ${qText}：输出掉到峰值 0.707 倍的两个频率相距 ${formatSI(bw, "Hz")}。减小 R，峰变尖；增大 R，峰变宽。`
  }

  /*
   * Schematic, 280 × 185. Loop: top wire y=50, bottom wire y=170.
   *   source centre (40, 110) rot 90 → terminals (40, 80) and (40, 140); labels to its right, inside the loop (x ≥ 62)
   *   L centre (100, 50) → terminals (70, 50) and (130, 50); labels above
   *   C centre (180, 50) → terminals (150, 50) and (210, 50); labels above
   *   R centre (250, 110) rot 90 → terminals (250, 80) and (250, 140); labels to its left, inside the loop (x ≤ 234)
   */
  return (
    <Lab
      title="串联 RLC 谐振"
      hint="改 L 或 C，峰会左右移动；改 R，峰的位置不动，但会变尖或变宽。峰上那段粗横线是 −3 dB 带宽。"
      onReset={() => {
        setL(1e-3)
        setC(10e-9)
        setR(33)
      }}
    >
      <LabStage>
        <div className="grid items-center gap-x-6 gap-y-4 @2xl:grid-cols-[auto_minmax(0,1fr)]">
          <Schematic width={280} height={185} label="信号源、电感、电容、电阻串成一个回路">
            <Wire
              points={[
                [40, 80],
                [40, 50],
                [70, 50],
              ]}
            />
            <Wire
              points={[
                [130, 50],
                [150, 50],
              ]}
            />
            <Wire
              points={[
                [210, 50],
                [250, 50],
                [250, 80],
              ]}
            />
            <Wire
              points={[
                [250, 140],
                [250, 170],
                [40, 170],
                [40, 140],
              ]}
            />
            <Source x={40} y={110} rot={90} kind="ac" label="信号源" value="峰值 1 V" />
            <Inductor x={100} y={50} label="L" value={formatSI(l, "H")} />
            <Capacitor x={180} y={50} label="C" value={formatSI(c, "F")} />
            <Resistor x={250} y={110} rot={90} label="R" value={formatSI(r, "Ω")} labelSide="left" />
          </Schematic>
          <Plot
            height={250}
            x={{ min: F_MIN, max: F_MAX, log: true, label: "频率 (Hz)" }}
            y={{ min: 0, max: 1.25, label: "R 上的电压 ÷ 输入电压", ticks: [0, 0.25, 0.5, 0.75, 1] }}
            series={[
              { points: curve, label: "R 上的电压（和回路电流成正比）", color: trace.voltage },
              {
                points: [
                  [f1, Math.SQRT1_2],
                  [f2, Math.SQRT1_2],
                ],
                label: `−3 dB 带宽 ${formatSI(bw, "Hz")}`,
                color: trace.second,
                width: 3,
              },
            ]}
            lines={[{ x: f0, label: `f₀ ${formatSI(f0, "Hz")}` }]}
            markers={[
              { x: f1, y: Math.SQRT1_2, color: trace.second },
              { x: f2, y: Math.SQRT1_2, color: trace.second },
            ]}
          />
        </div>
      </LabStage>
      <LabControls columns={3}>
        <SliderField label="电感 L" value={l} onChange={setL} min={100e-6} max={10e-3} log snap="E12" unit="H" />
        <SliderField label="电容 C" value={c} onChange={setC} min={1e-9} max={1e-6} log snap="E12" unit="F" />
        <SliderField label="电阻 R" value={r} onChange={setR} min={1} max={1000} log snap="E12" unit="Ω" />
      </LabControls>
      <LabReadouts>
        <Readout label="谐振频率 f₀" value={formatSI(f0, "Hz")} sub={<Tex>{String.raw`1/(2\pi\sqrt{LC})`}</Tex>} />
        <Readout label="Q 值" value={qText} sub={<Tex>{String.raw`\sqrt{L/C}/R`}</Tex>} />
        <Readout label="带宽" value={formatSI(bw, "Hz")} sub={<Tex>{"f_0/Q"}</Tex>} color={trace.second} />
        <Readout label="谐振时 C 上的电压" value={formatSI(q, "V")} sub="输入 1 V 的 Q 倍" />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

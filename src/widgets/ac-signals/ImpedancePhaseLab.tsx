import * as React from "react"
import { Capacitor, ControlField, Inductor, Lab, LabControls, LabNote, LabReadouts, LabStage, Plot, Readout, Resistor, Schematic, Segmented, SliderField, Source, TAU, Tex, Wire, fixed, formatSI, tex, trace } from "@/lab"

type Kind = "r" | "c" | "l" | "rc"

/** Fixed parts, the same values the lesson's worked examples use. */
const R = 1000
const C = 100e-9
const L = 10e-3
/** The source: 1 V peak. */
const VP = 1
/** The current trace is drawn at 3/4 height so it stays visible when it lies on top of the voltage. */
const I_DRAWN = 0.75
const N = 400

const ohms = (v: number) => formatSI(v, "Ω")

/** One element across an AC source: who peaks first, the voltage or the current, and by how much. */
export function ImpedancePhaseLab() {
  const [kind, setKind] = React.useState<Kind>("c")
  const [freq, setFreq] = React.useState(1000)

  const xc = 1 / (TAU * freq * C)
  const xl = TAU * freq * L
  // |Z| and how far the current runs ahead of the voltage (degrees; negative = behind)
  const z = kind === "r" ? R : kind === "c" ? xc : kind === "l" ? xl : Math.hypot(R, xc)
  const lead = kind === "r" ? 0 : kind === "c" ? 90 : kind === "l" ? -90 : (Math.atan2(xc, R) * 180) / Math.PI
  const ip = VP / z

  const { v, i } = React.useMemo(() => {
    const v: [number, number][] = []
    const i: [number, number][] = []
    const rad = (lead * Math.PI) / 180
    for (let k = 0; k <= N; k++) {
      const x = (2 * k) / N // time in periods
      v.push([x, Math.sin(TAU * x)])
      i.push([x, I_DRAWN * Math.sin(TAU * x + rad)])
    }
    return { v, i }
  }, [lead])

  const hz = formatSI(freq, "Hz")
  const amps = formatSI(ip, "A")
  const phaseText = lead === 0 ? "同相" : `电流${lead > 0 ? "超前" : "滞后"} ${fixed(Math.abs(lead), kind === "rc" ? 1 : 0)}°`
  const nearShort = z < 5

  let note: React.ReactNode
  if (kind === "r") {
    note = `电阻：电流和电压同时到达波峰。不管频率怎么变，阻抗都是 ${ohms(R)}，电流峰值都是 ${amps}。`
  } else if (kind === "c") {
    note = nearShort
      ? `电容：${hz} 时容抗只剩 ${ohms(xc)}，对这么高的频率它近乎短路，1 V 就推出 ${amps} 的电流。相位关系不变，电流仍然超前 90°。`
      : `电容：电流比电压早四分之一个周期到达波峰（超前 90°）。${hz} 时容抗 ${ohms(xc)}，电流峰值 ${amps}。`
  } else if (kind === "l") {
    note = nearShort
      ? `电感：${hz} 时感抗只剩 ${ohms(xl)}，对这么低的频率它近乎一根导线，1 V 就推出 ${amps} 的电流。相位关系不变，电流仍然滞后 90°。`
      : `电感：电流比电压晚四分之一个周期到达波峰（滞后 90°）。${hz} 时感抗 ${ohms(xl)}，电流峰值 ${amps}。`
  } else {
    note =
      xc > 3 * R
        ? `容抗 ${ohms(xc)} 比电阻大得多，总阻抗 ${ohms(z)} 主要由电容决定。电流超前 ${fixed(lead, 1)}°，整体更像一只电容。`
        : xc < R / 3
          ? `容抗只有 ${ohms(xc)}，比电阻小得多，总阻抗 ${ohms(z)} 几乎就是电阻。电流只超前 ${fixed(lead, 1)}°，整体更像一只电阻。`
          : (
            <>
              串联后的阻抗是 <Tex>{String.raw`\sqrt{R^2 + X_C^2} = ${tex.si(z, "Ω")}`}</Tex>，不是直接相加的 {ohms(R + xc)}。电流超前 {fixed(lead, 1)}°，落在电阻的 0° 和电容的 90° 之间。
            </>
          )
  }

  /*
   * Schematic, 250 × 185. Loop: top wire y=50, bottom wire y=170.
   *   source  centre (40, 110) rot 90 → terminals (40, 80) and (40, 140); labels to its right, inside the loop (x ≥ 62)
   *   element centre (180, 110) rot 90 → terminals (180, 80) and (180, 140); labels to its right (x ≥ 195)
   *   RC only: R centre (110, 50) → terminals (80, 50) and (140, 50); labels above (baselines y=20 and 35)
   */
  const element =
    kind === "l" ? (
      <Inductor x={180} y={110} rot={90} label="L" value={formatSI(L, "H")} />
    ) : kind === "r" ? (
      <Resistor x={180} y={110} rot={90} label="R" value={ohms(R)} />
    ) : (
      <Capacitor x={180} y={110} rot={90} label="C" value={formatSI(C, "F")} />
    )

  return (
    <Lab
      title="电压和电流，谁先到波峰"
      hint="换一种元件接到交流信号源上，对比两条曲线的波峰（圆点）谁在前。再拖频率，看电流大小和相位各自怎么变。"
      onReset={() => {
        setKind("c")
        setFreq(1000)
      }}
    >
      <LabStage>
        <div className="grid items-center gap-x-6 gap-y-4 @xl:grid-cols-[auto_minmax(0,1fr)]">
          <Schematic width={250} height={185} label="交流信号源接着被测元件的回路">
            {kind === "rc" ? (
              <>
                <Wire
                  points={[
                    [40, 80],
                    [40, 50],
                    [80, 50],
                  ]}
                />
                <Wire
                  points={[
                    [140, 50],
                    [180, 50],
                    [180, 80],
                  ]}
                />
                <Resistor x={110} y={50} label="R" value={ohms(R)} />
              </>
            ) : (
              <Wire
                points={[
                  [40, 80],
                  [40, 50],
                  [180, 50],
                  [180, 80],
                ]}
              />
            )}
            <Wire
              points={[
                [180, 140],
                [180, 170],
                [40, 170],
                [40, 140],
              ]}
            />
            <Source x={40} y={110} rot={90} kind="ac" label="信号源" value="峰值 1 V" />
            {element}
          </Schematic>
          <Plot
            height={220}
            x={{ min: 0, max: 2, label: "时间 (周期)", ticks: [0, 0.5, 1, 1.5, 2] }}
            y={{ min: -1.25, max: 1.25, label: "电压和电流（各按自身峰值缩放）", ticks: [-1, 0, 1] }}
            series={[
              { points: v, label: `电压，峰值 ${formatSI(VP, "V")}`, color: trace.voltage },
              { points: i, label: `电流，峰值 ${amps}`, color: trace.current, dashed: true },
            ]}
            markers={[
              { x: 1.25, y: 1, color: trace.voltage },
              { x: 1.25 - lead / 360, y: I_DRAWN, color: trace.current },
            ]}
          />
        </div>
      </LabStage>
      <LabControls>
        <ControlField label="接在信号源上的元件">
          <Segmented
            aria-label="接在信号源上的元件"
            value={kind}
            onValueChange={setKind}
            options={[
              { value: "r", label: "电阻" },
              { value: "c", label: "电容" },
              { value: "l", label: "电感" },
              { value: "rc", label: "RC 串联" },
            ]}
          />
        </ControlField>
        <SliderField label="频率 f" value={freq} onChange={setFreq} min={10} max={1e6} log unit="Hz" />
      </LabControls>
      <LabReadouts>
        <Readout label="阻抗大小 |Z|" value={ohms(z)} sub={kind === "rc" ? <Tex>{String.raw`\sqrt{R^2 + X_C^2}`}</Tex> : kind === "c" ? "容抗 Xc" : kind === "l" ? "感抗 XL" : "电阻 R"} />
        <Readout label="电流峰值" value={amps} sub={<Tex>{String.raw`1\,\mathrm{V} / |Z|`}</Tex>} color={trace.current} />
        <Readout label="相位" value={phaseText} sub={lead === 0 ? "波峰同时到" : lead > 0 ? "电流的波峰先到" : "电流的波峰后到"} />
      </LabReadouts>
      <LabNote tone={nearShort ? "warn" : "neutral"}>{note}</LabNote>
    </Lab>
  )
}

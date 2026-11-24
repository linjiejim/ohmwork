import * as React from "react"
import { Capacitor, ControlField, Ground, Junction, Lab, LabControls, LabNote, LabReadouts, LabStage, Plot, Port, Readout, Resistor, Schematic, Segmented, SliderField, TAU, Wire, dbV, fixed, formatSI, percent, sig, trace } from "@/lab"

type Kind = "lp" | "hp"

const DB_FLOOR = -60
const N = 400

/** A large multiple in words a reader can take in: "63 倍", "1.9 万倍". */
function many(x: number): string {
  return x >= 1e4 ? `${sig(x / 1e4, 2)} 万倍` : `${sig(x, 2)} 倍`
}

/** |Vout / Vin| and the phase of Vout relative to Vin (degrees) for a first-order RC filter at f / fc = u. */
function response(kind: Kind, u: number) {
  const gain = (kind === "lp" ? 1 : u) / Math.hypot(1, u)
  const phase = ((kind === "lp" ? -Math.atan(u) : Math.atan(1 / u)) * 180) / Math.PI
  return { gain, phase }
}

/** First-order RC low-pass / high-pass: the Bode plot with the input frequency on it, and what the output looks like in time. */
export function RcFilterLab() {
  const [kind, setKind] = React.useState<Kind>("lp")
  const [r, setR] = React.useState(1500)
  const [c, setC] = React.useState(100e-9)
  const [freq, setFreq] = React.useState(1000)

  const fc = 1 / (TAU * r * c)
  const u = freq / fc
  const { gain, phase } = response(kind, u)
  const gainDb = dbV(gain)
  // rounded for display; "|| 0" turns −0 into 0 so a flat response never reads "−0.0"
  const dbShown = Math.round(gainDb * 10) / 10 || 0
  const phaseShown = Math.round(phase * 10) / 10 || 0

  const { vin, vout } = React.useMemo(() => {
    const vin: [number, number][] = []
    const vout: [number, number][] = []
    const rad = (phase * Math.PI) / 180
    for (let k = 0; k <= N; k++) {
      const x = (2 * k) / N // time in periods of the input
      vin.push([x, Math.sin(TAU * x)])
      vout.push([x, gain * Math.sin(TAU * x + rad)])
    }
    return { vin, vout }
  }, [gain, phase])

  const hz = formatSI(freq, "Hz")
  const fcText = formatSI(fc, "Hz")
  const times = gain >= 0.001 ? `${sig(gain, 3)} 倍` : "不到 0.001 倍"
  const left = gain >= 0.001 ? `只剩输入的 ${sig(gain, 3)} 倍` : "还不到输入的千分之一"
  const passed = gain > 0.9995 ? "输出和输入几乎一样大" : `输出是输入的 ${percent(gain, 1)}`
  const lp = kind === "lp"
  // how far the input is from the cut-off, on the side where this filter attenuates
  const into = lp ? u : 1 / u

  let tone: "neutral" | "good" | "warn" = "neutral"
  let note: string
  if (into <= 0.2) {
    tone = "good"
    note = lp
      ? `${hz} 远低于截止频率 ${fcText}：电容的容抗比电阻大得多，信号几乎原样通过，${passed}。`
      : `${hz} 远高于截止频率 ${fcText}：电容的容抗比电阻小得多，信号几乎原样通过，${passed}。`
  } else if (into < 5) {
    note = `${hz} 在截止频率 ${fcText} 附近：输出是输入的 ${times}（${fixed(dbShown, 1)} dB），并且${lp ? "滞后" : "超前"} ${fixed(Math.abs(phase), 0)}°。正好在截止频率上时是 0.707 倍、45°。`
  } else {
    tone = "warn"
    note = lp
      ? `${hz} 是截止频率 ${fcText} 的 ${many(u)}，输出${left}。在这一段，频率每升高 10 倍，输出就缩小到 1/10（−20 dB）。`
      : `截止频率 ${fcText} 是 ${hz} 的 ${many(1 / u)}，输出${left}。在这一段，频率每降低 10 倍，输出就缩小到 1/10（−20 dB）。`
  }

  /*
   * Schematic, 270 × 160. Signal path along y=50.
   *   Vin port (30, 50), name above it
   *   series part centre (100, 50) → terminals (70, 50) and (130, 50); labels above (baselines y≈20 and 35)
   *   output node (170, 50); Vout port (230, 50), name above it
   *   shunt part centre (170, 100) rot 90 → terminals (170, 70) and (170, 130); labels to its right (x ≥ 186)
   *   ground hangs from (170, 130) down to y=148
   */
  const rText = formatSI(r, "Ω")
  const cText = formatSI(c, "F")

  return (
    <Lab
      title="RC 滤波器实验台"
      hint="拖动输入频率，看圆点沿着曲线走；再改 R 或 C，看截止频率 fc（竖虚线，曲线在这里降到 −3 dB）左右移动。"
      onReset={() => {
        setKind("lp")
        setR(1500)
        setC(100e-9)
        setFreq(1000)
      }}
    >
      <LabStage>
        <div className="grid items-center gap-x-6 gap-y-4 @2xl:grid-cols-[auto_minmax(0,1fr)]">
          <Schematic width={270} height={160} label={lp ? "RC 低通滤波器：电阻串在信号路径上，电容从输出接到地" : "RC 高通滤波器：电容串在信号路径上，电阻从输出接到地"}>
            <Wire
              points={[
                [30, 50],
                [70, 50],
              ]}
            />
            <Wire
              points={[
                [130, 50],
                [230, 50],
              ]}
            />
            <Wire
              points={[
                [170, 50],
                [170, 70],
              ]}
            />
            {lp ? (
              <>
                <Resistor x={100} y={50} label="R" value={rText} />
                <Capacitor x={170} y={100} rot={90} label="C" value={cText} />
              </>
            ) : (
              <>
                <Capacitor x={100} y={50} label="C" value={cText} />
                <Resistor x={170} y={100} rot={90} label="R" value={rText} />
              </>
            )}
            <Junction x={170} y={50} />
            <Ground x={170} y={130} />
            <Port x={30} y={50} label="Vin" side="top" />
            <Port x={230} y={50} label="Vout" side="top" color={trace.voltage} />
          </Schematic>
          <Plot
            height={230}
            x={{ min: 10, max: 1e6, log: true, label: "频率 (Hz)" }}
            y={{ min: DB_FLOOR, max: 10, label: "增益 (dB)", ticks: [-60, -40, -20, 0] }}
            series={[{ fn: (f) => dbV(response(kind, f / fc).gain), label: "输出 ÷ 输入", color: trace.voltage }]}
            lines={[{ x: fc, label: `fc ${fcText}` }]}
            markers={[
              { x: fc, y: -3.01, color: trace.ref },
              { x: freq, y: Math.max(gainDb, DB_FLOOR), color: trace.voltage },
            ]}
          />
        </div>
      </LabStage>
      <LabControls>
        <ControlField label="滤波器类型">
          <Segmented
            aria-label="滤波器类型"
            value={kind}
            onValueChange={setKind}
            options={[
              { value: "lp", label: "低通" },
              { value: "hp", label: "高通" },
            ]}
          />
        </ControlField>
        <SliderField label="输入频率 f" value={freq} onChange={setFreq} min={10} max={1e6} log unit="Hz" color={trace.voltage} />
        <SliderField label="电阻 R" value={r} onChange={setR} min={100} max={100e3} log snap="E12" unit="Ω" />
        <SliderField label="电容 C" value={c} onChange={setC} min={1e-9} max={10e-6} log snap="E12" unit="F" />
      </LabControls>
      <LabStage>
        <Plot
          height={200}
          x={{ min: 0, max: 2, label: "时间 (输入信号的周期)", ticks: [0, 0.5, 1, 1.5, 2] }}
          y={{ min: -1.2, max: 1.2, label: "电压 (V)", ticks: [-1, -0.5, 0, 0.5, 1] }}
          series={[
            { points: vin, label: "输入 Vin，峰值 1 V", color: trace.ref, dashed: true },
            { points: vout, label: `输出 Vout，峰值 ${formatSI(gain, "V")}`, color: trace.voltage },
          ]}
        />
      </LabStage>
      <LabReadouts>
        <Readout label="截止频率 fc" value={fcText} sub="1 ÷ (2πRC)" />
        <Readout label="增益" value={times} sub={`${fixed(dbShown, 1)} dB`} color={trace.voltage} />
        <Readout label="相移" value={`${fixed(phaseShown, 1)}°`} sub={phaseShown === 0 ? "几乎同步" : phaseShown < 0 ? "输出滞后于输入" : "输出超前于输入"} />
        <Readout label="时间常数 RC" value={formatSI(r * c, "s")} />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

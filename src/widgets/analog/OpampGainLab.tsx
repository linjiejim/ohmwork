import * as React from "react"
import { ControlField, Ground, Junction, Lab, LabControls, LabNote, LabReadouts, LabStage, Label, OpAmp, Plot, Port, Readout, Resistor, Schematic, Segmented, SliderField, TAU, Tex, Wire, clamp, dbV, fixed, formatSI, sig, tex, trace } from "@/lab"

const RAIL = 5 // ±5 V supply, output swings rail to rail
const WINDOW = 2 // ms: two periods of a 1 kHz sine
const SAMPLES = 400

type Mode = "inv" | "non" | "fol"

/** Inverting / non-inverting / follower: gain set by two resistors, output clipped at the supply rails. */
export function OpampGainLab() {
  const [mode, setMode] = React.useState<Mode>("inv")
  const [rf, setRf] = React.useState(47e3)
  const [rin, setRin] = React.useState(10e3)
  const [amp, setAmp] = React.useState(0.5)

  const gain = mode === "inv" ? -rf / rin : mode === "non" ? 1 + rf / rin : 1
  const ideal = Math.abs(gain) * amp
  const clipping = ideal > RAIL + 1e-9
  const peak = Math.min(ideal, RAIL)

  const { input, wanted, output } = React.useMemo(() => {
    const input: [number, number][] = []
    const wanted: [number, number][] = []
    const output: [number, number][] = []
    for (let k = 0; k <= SAMPLES; k++) {
      const t = (WINDOW * k) / SAMPLES
      const vi = amp * Math.sin(TAU * t)
      input.push([t, vi])
      wanted.push([t, gain * vi])
      output.push([t, clamp(gain * vi, -RAIL, RAIL)])
    }
    return { input, wanted, output }
  }, [gain, amp])

  let tone: "neutral" | "bad" = "neutral"
  let note: React.ReactNode
  if (clipping) {
    tone = "bad"
    note = `输出本该摆到 ±${formatSI(ideal, "V")}，可电源只有 ±5 V：超出的部分被削平了（削顶失真）。减小输入幅度，或者把增益调低。`
  } else if (mode === "inv") {
    note =
      rf < rin ? (
        <>
          增益 <Tex>{String.raw`= -\frac{R_f}{R_{\mathrm{in}}} = ${tex.num(sig(gain))}`}</Tex>：Rf 比 Rin 小，输出比输入还小。反相放大器也能当衰减器用。
        </>
      ) : (
        <>
          增益 <Tex>{String.raw`= -\frac{R_f}{R_{\mathrm{in}}} = -\frac{${tex.si(rf, "Ω")}}{${tex.si(rin, "Ω")}} = ${tex.num(sig(gain))}`}</Tex>：输出是输入的 {sig(-gain)} 倍，而且上下颠倒。
        </>
      )
  } else if (mode === "non") {
    note = (
      <>
        增益 <Tex>{String.raw`= 1 + \frac{R_f}{R_{\mathrm{in}}} = 1 + \frac{${tex.si(rf, "Ω")}}{${tex.si(rin, "Ω")}} = ${tex.num(sig(gain))}`}</Tex>：输出和输入同相，增益最小也是 1。
      </>
    )
  } else {
    note = "输出原样跟着输入走：增益是 1，不放大电压，只负责替信号源出电流。Rf 和 Rin 在这个电路里用不上。"
  }

  const rfText = formatSI(rf, "Ω")
  const rinText = formatSI(rin, "Ω")

  return (
    <Lab
      title="运放放大电路实验台"
      hint="切换电路，调 Rf 和 Rin 改变增益；再把输入幅度加大，直到输出撞上电源轨。"
      onReset={() => {
        setMode("inv")
        setRf(47e3)
        setRin(10e3)
        setAmp(0.5)
      }}
    >
      <LabStage>
        <div className="grid items-center gap-x-6 gap-y-4 @xl:grid-cols-[auto_minmax(0,1fr)]">
          {/*
           * Op-amp centre (180, 110), − on top: − (140, 96), + (140, 124), output (224, 110).
           * Feedback path leaves the output at (234, 110), runs along y = 50 and comes down to the − node (130, 96).
           * Rin (90, 96): ends (60, 96) and (120, 96). Rf (180, 50): ends (150, 50) and (210, 50).
           * The two modes swap what sits on Rin's left end (40, 96) and on the + input (≈ 100–110, 124).
           */}
          <Schematic width={300} height={170} label={mode === "inv" ? "反相放大电路" : mode === "non" ? "同相放大电路" : "电压跟随器"}>
            <OpAmp x={180} y={110} />
            <Wire points={[[224, 110], [256, 110]]} />
            <Junction x={234} y={110} />
            <Port x={256} y={110} label="Vout" color={trace.voltage} />
            {mode === "fol" ? (
              <Wire points={[[140, 96], [130, 96], [130, 50], [234, 50], [234, 110]]} />
            ) : (
              <>
                <Wire points={[[120, 96], [140, 96]]} />
                <Wire points={[[130, 96], [130, 50], [150, 50]]} />
                <Wire points={[[210, 50], [234, 50], [234, 110]]} />
                <Junction x={130} y={96} />
                <Resistor x={180} y={50} label="Rf" value={rfText} />
                <Resistor x={90} y={96} label="Rin" value={rinText} />
              </>
            )}
            {mode === "inv" ? (
              <>
                <Wire points={[[40, 96], [60, 96]]} />
                <Port x={40} y={96} label="Vin" side="top" color={trace.second} />
                <Wire points={[[140, 124], [110, 124], [110, 134]]} />
                <Ground x={110} y={134} />
                <Label x={138} y={116} anchor="end" muted>
                  虚地
                </Label>
              </>
            ) : (
              <>
                <Wire points={[[100, 124], [140, 124]]} />
                <Port x={100} y={124} label="Vin" side="left" color={trace.second} />
              </>
            )}
            {mode === "non" && (
              <>
                <Wire points={[[60, 96], [40, 96], [40, 106]]} />
                <Ground x={40} y={106} />
              </>
            )}
          </Schematic>
          <Plot
            height={230}
            x={{ min: 0, max: WINDOW, label: "时间 (ms)" }}
            y={{ min: -7.5, max: 7.5, label: "电压 (V)", ticks: [-5, -2.5, 0, 2.5, 5] }}
            series={[
              { points: input, label: "输入 Vin", color: trace.second, dashed: true },
              { points: output, label: "输出 Vout", color: trace.voltage },
              ...(clipping ? [{ points: wanted, label: "本该有的输出", color: trace.voltage, dashed: true, width: 1.25 }] : []),
              {
                points: [
                  [0, RAIL],
                  [WINDOW, RAIL],
                ],
                label: "电源轨 ±5 V",
                color: trace.ref,
                dashed: true,
                width: 1.25,
              },
              {
                points: [
                  [0, -RAIL],
                  [WINDOW, -RAIL],
                ],
                color: trace.ref,
                dashed: true,
                width: 1.25,
              },
            ]}
          />
        </div>
      </LabStage>
      <LabControls>
        <ControlField label="电路">
          <Segmented
            aria-label="电路类型"
            value={mode}
            onValueChange={setMode}
            options={[
              { value: "inv", label: "反相" },
              { value: "non", label: "同相" },
              { value: "fol", label: "跟随" },
            ]}
          />
        </ControlField>
        <SliderField label="输入幅度（峰值）" value={amp} onChange={setAmp} min={0.1} max={3} step={0.1} unit="V" color={trace.second} />
        <SliderField label="反馈电阻 Rf" value={rf} onChange={setRf} min={1e3} max={1e6} log snap="E12" unit="Ω" disabled={mode === "fol"} />
        <SliderField label="输入电阻 Rin" value={rin} onChange={setRin} min={1e3} max={100e3} log snap="E12" unit="Ω" disabled={mode === "fol"} />
      </LabControls>
      <LabReadouts>
        <Readout label="电压增益" value={`${sig(gain)} 倍`} sub={`${fixed(dbV(Math.abs(gain)), 1)} dB${gain < 0 ? "，反相" : ""}`} />
        <Readout label="输出峰值" value={formatSI(peak, "V")} color={trace.voltage} sub={clipping ? `本该 ${formatSI(ideal, "V")}` : undefined} />
        <Readout label="输入阻抗" value={mode === "inv" ? rinText : "极高"} sub={mode === "inv" ? "信号源要推动 Rin" : "信号直接进同相端"} />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

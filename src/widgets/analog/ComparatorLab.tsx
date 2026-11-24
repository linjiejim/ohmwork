import * as React from "react"
import { ControlField, Lab, LabControls, LabNote, LabReadouts, LabStage, Label, OpAmp, Plot, Port, Rail, Readout, Schematic, Segmented, SliderField, TAU, Wire, clamp, dbV, fixed, formatSI, percent, sig, trace } from "@/lab"

const RAIL = 5 // supply rails are ±5 V; the output cannot go past them
const AMP = 3 // input sine amplitude, volts
const PERIOD = 20 // ms (50 Hz)
const WINDOW = 40 // ms shown: two periods
const SAMPLES = 800

type Feed = "plus" | "minus"

const vin = (t: number) => AMP * Math.sin((TAU * t) / PERIOD)
const gainText = (a: number) => (a >= 10000 ? `${sig(a / 10000)} 万倍` : `${sig(a)} 倍`)

/** An op-amp with no feedback: Vout = A·(V+ − V−), clipped at the rails. With A ≈ 100 000 that is a comparator. */
export function ComparatorLab() {
  const [vref, setVref] = React.useState(1)
  const [gain, setGain] = React.useState(100000)
  const [feed, setFeed] = React.useState<Feed>("plus")

  const output = React.useMemo(() => {
    const pts: [number, number][] = []
    for (let k = 0; k <= SAMPLES; k++) {
      const t = (WINDOW * k) / SAMPLES
      const diff = feed === "plus" ? vin(t) - vref : vref - vin(t)
      pts.push([t, clamp(gain * diff, -RAIL, RAIL)])
    }
    return pts
  }, [vref, gain, feed])

  // share of the time the signal is above the reference
  const above = vref >= AMP ? 0 : vref <= -AMP ? 1 : 0.5 - Math.asin(vref / AMP) / Math.PI
  const positive = feed === "plus" ? above : 1 - above
  const stuck = above === 0 || above === 1
  const linear = RAIL / gain

  let tone: "neutral" | "warn" = "neutral"
  let note: string
  if (gain < 1000) {
    tone = "warn"
    note = `开环增益只有 ${gainText(gain)}：输入差要到 ±${formatSI(linear, "V")} 输出才顶到电源轨，波形还带着输入的形状。真实运放的增益在 10 万倍上下，这段过渡窄到看不见。`
  } else if (stuck) {
    note = `参考电压${vref > 0 ? "高过了输入的最高点（+3 V）" : "低过了输入的最低点（−3 V）"}：两个输入端谁高谁低从不改变，输出一直停在 ${positive === 1 ? "+5 V" : "−5 V"}。`
  } else if (feed === "plus") {
    note = `Vin 高于 ${fixed(vref, 1)} V 时，同相端（+）比反相端（−）高，输出跳到 +5 V；低于时掉到 −5 V。中间没有别的状态。`
  } else {
    note = `信号换到了反相端（−）：Vin 高于 ${fixed(vref, 1)} V 时输出反而掉到 −5 V，低于时才是 +5 V。`
  }

  return (
    <Lab
      title="开环运放当比较器"
      hint="拖动参考电压，看输出在哪里翻转；再把开环增益调小，看它为什么不再像比较器。"
      onReset={() => {
        setVref(1)
        setGain(100000)
        setFeed("plus")
      }}
    >
      <LabStage>
        <div className="grid items-center gap-x-6 gap-y-4 @xl:grid-cols-[auto_minmax(0,1fr)]">
          {/*
           * Op-amp centre (134, 85): upper input (94, 71), lower input (94, 99), output (178, 85).
           * Supply pins leave the triangle's sloped edges at x = 134: top edge y ≈ 70, bottom edge y ≈ 100.
           */}
          <Schematic width={262} height={156} label="没有反馈的运放：一个输入端接信号，另一个接参考电压">
            <Wire points={[[24, 71], [94, 71]]} />
            <Wire points={[[24, 99], [94, 99]]} />
            <Wire points={[[178, 85], [214, 85]]} />
            <Wire points={[[134, 45], [134, 70]]} />
            <Wire points={[[134, 100], [134, 125]]} />
            <Rail x={134} y={45} label="+5 V" />
            <path d="M126 125H142" />
            <Label x={134} y={142}>
              −5 V
            </Label>
            <OpAmp x={134} y={85} plusOnTop={feed === "plus"} />
            <Port x={24} y={71} color={trace.voltage} />
            <Port x={24} y={99} />
            <Port x={214} y={85} label="Vout" color={trace.second} />
            <Label x={56} y={62} color={trace.voltage}>
              Vin
            </Label>
            <Label x={56} y={118} muted>
              Vref = {fixed(vref, 1)} V
            </Label>
          </Schematic>
          <Plot
            height={230}
            x={{ min: 0, max: WINDOW, label: "时间 (ms)" }}
            y={{ min: -6, max: 6, label: "电压 (V)", ticks: [-5, -2.5, 0, 2.5, 5] }}
            series={[
              { fn: vin, label: "输入 Vin", color: trace.voltage },
              { fn: () => vref, label: "参考 Vref", color: trace.ref, dashed: true },
              { points: output, label: "输出 Vout", color: trace.second },
            ]}
          />
        </div>
      </LabStage>
      <LabControls columns={3}>
        <SliderField label="参考电压 Vref" value={vref} onChange={setVref} min={-4} max={4} step={0.1} format={(v) => `${fixed(v, 1)} V`} />
        <SliderField label="开环增益 A" value={gain} onChange={setGain} min={1} max={1000000} log format={gainText} />
        <ControlField label="信号 Vin 接到">
          <Segmented
            aria-label="信号接到哪个输入端"
            value={feed}
            onValueChange={setFeed}
            options={[
              { value: "plus", label: "同相端 +" },
              { value: "minus", label: "反相端 −" },
            ]}
          />
        </ControlField>
      </LabControls>
      <LabReadouts>
        <Readout label="开环增益" value={gainText(gain)} sub={`${fixed(dbV(gain), 0)} dB`} />
        <Readout label="不饱和的输入差" value={`±${formatSI(linear, "V")}`} sub="超出就顶到电源轨" />
        <Readout label="输出为正的时间" value={percent(positive)} color={trace.second} />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

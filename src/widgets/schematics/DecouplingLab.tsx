import * as React from "react"
import { Capacitor, Inductor, Junction, Lab, LabControls, LabNote, LabReadouts, LabStage, Label, Plot, Readout, Schematic, SliderField, Source, Tex, Wire, formatSI, percent, rk4, tex, trace } from "@/lab"

/*
 * Simplified model of a chip's supply pin.
 *
 *   regulator (ideal 3.3 V) ── R_S ── L (supply trace) ──┬── node v (the chip's VDD pin)
 *                                                        ├── C_DIE (the chip's own capacitance)
 *                                                        ├── ESR ── C (decoupling capacitor)
 *                                                        └── i_chip(t) (the chip, a current pulse)
 *
 *   L di/dt = V0 − R_S·i − v
 *   C_DIE dv/dt = i − i_chip − (v − vc) / ESR
 *   C dvc/dt = (v − vc) / ESR
 *
 * Integrated with RK4 at 0.02 ns (the ESR × C_DIE corner is 0.06 ns), sampled every 1 ns.
 * The capacitor's own inductance (ESL) and the trace between it and the pin are left out.
 */
const V0 = 3.3
const R_S = 0.3
const C_DIE = 2e-9
const ESR = 0.03
/** The pulse: starts at 20 ns, 2 ns edges, 40 ns flat top. */
const T0 = 20e-9
const TR = 2e-9
const TW = 40e-9
const T_END = 300e-9
const H = 0.02e-9
const PER_SAMPLE = 50
/** Slider floor that means "no capacitor fitted". */
const NONE = 1e-9

function pulse(t: number, amp: number) {
  if (t < T0) return 0
  if (t < T0 + TR) return (amp * (t - T0)) / TR
  if (t < T0 + TR + TW) return amp
  if (t < T0 + 2 * TR + TW) return amp * (1 - (t - T0 - TR - TW) / TR)
  return 0
}

/** Pin voltage over time, in [ns, V] pairs, plus its lowest and highest value. */
function simulate(c: number, l: number, amp: number) {
  const f = (t: number, [i, v, vc]: number[]) => {
    const ic = c > 0 ? (v - vc) / ESR : 0
    return [(V0 - R_S * i - v) / l, (i - pulse(t, amp) - ic) / C_DIE, c > 0 ? ic / c : 0]
  }
  let y = [0, V0, V0]
  let t = 0
  let min = V0
  let max = V0
  const points: [number, number][] = [[0, V0]]
  const steps = Math.round(T_END / H)
  for (let k = 1; k <= steps; k++) {
    y = rk4(f, t, y, H)
    t = k * H
    min = Math.min(min, y[1])
    max = Math.max(max, y[1])
    if (k % PER_SAMPLE === 0) points.push([t * 1e9, y[1]])
  }
  return { points, min, max }
}

/** A chip draws a sudden current pulse; the decoupling capacitor and the supply trace decide how far its pin voltage dips. */
export function DecouplingLab() {
  const [cap, setCap] = React.useState(100e-9)
  const [l, setL] = React.useState(10e-9)
  const [amp, setAmp] = React.useState(0.1)

  const none = cap < NONE * 1.1
  const c = none ? 0 : cap
  const { points, min, max } = React.useMemo(() => simulate(c, l, amp), [c, l, amp])
  const drop = V0 - min
  const over = max - V0
  const share = drop / V0
  const charge = amp * (TW + TR)
  const tone = share <= 0.05 ? "good" : share <= 0.1 ? "warn" : "bad"

  let note: string
  if (tone === "good") {
    note = none
      ? `没装去耦电容，但脉冲只有 ${formatSI(amp, "A")}、走线电感只有 ${formatSI(l, "H")}，跌落 ${formatSI(drop, "V")}，还在 5% 以内。电流再大一点就扛不住了。`
      : `${formatSI(c, "F")} 的电容把这口电流垫上了：电源脚只跌了 ${formatSI(drop, "V")}（${percent(share, 1)}），芯片感觉不到。`
  } else if (tone === "warn") {
    note = `电源脚跌了 ${formatSI(drop, "V")}，超过 3.3 V 的 5%。${none ? "装一只 100 nF 试试。" : "电容再大一些，或者让稳压器离芯片近一点。"}`
  } else {
    note = `电源脚跌到 ${formatSI(Math.max(0, min), "V")}，少了 ${percent(share)}。${none ? "电流全靠走线送过来，被电感挡住了。" : "电容太小，垫不住这么大一口电流。"}芯片可能复位，ADC 读数也会乱。`
  }
  if (over > 0.05 * V0) note += ` 电流停下的瞬间，电压还会往上冲到 ${formatSI(max, "V")}：这是走线电感和电容在来回振荡。`

  return (
    <Lab
      title="去耦电容仿真"
      hint="芯片在 20 ns 时突然抽一口电流。把去耦电容拖到「不装」，再加大走线电感和电流，看电源脚上的电压。"
      onReset={() => {
        setCap(100e-9)
        setL(10e-9)
        setAmp(0.1)
      }}
    >
      <LabStage>
        <div className="grid items-center gap-x-6 gap-y-4 @2xl:grid-cols-[auto_minmax(0,1fr)]">
          {/*
            Source (40, 95) rot 90: + at (40, 65), − at (40, 125); text right from x 62.
            Trace inductor (95, 40): (65…125); wires (40, 65)–(40, 40)–(65, 40) and (125, 40)–(250, 40)–(250, 65); junction (150, 40).
            Decoupling cap (150, 95): (150, 65…125), wire (150, 40)–(150, 65); text right from x 170.
            Chip as a current source (250, 95): (250, 65…125), arrow down; text right from x 272.
            Return wire (40, 125)–(40, 150)–(250, 150)–(250, 125), with (150, 125)–(150, 150) and a junction at (150, 150).
            "VDD" node name at (200, 32).
          */}
          <Schematic width={320} height={165} label="稳压器经走线电感给芯片供电，芯片电源脚旁接一只去耦电容到地">
            <Wire points={[[40, 65], [40, 40], [65, 40]]} />
            <Wire points={[[125, 40], [250, 40], [250, 65]]} />
            <Junction x={150} y={40} />
            <Wire points={[[150, 40], [150, 65]]} dashed={none} />
            <Wire points={[[40, 125], [40, 150], [250, 150], [250, 125]]} />
            <Wire points={[[150, 125], [150, 150]]} dashed={none} />
            <Junction x={150} y={150} />
            <Source x={40} y={95} rot={90} label="稳压器" value="3.3 V" />
            <Inductor x={95} y={40} label="走线电感" value={formatSI(l, "H")} />
            <Capacitor x={150} y={95} rot={90} label="去耦电容" value={none ? "不装" : formatSI(c, "F")} dim={none} />
            <Source x={250} y={95} rot={90} kind="current" label="芯片" value={formatSI(amp, "A")} />
            <Label x={200} y={32} color={trace.voltage} weight={500}>
              VDD
            </Label>
          </Schematic>
          <Plot
            height={220}
            x={{ min: 0, max: 300, label: "时间 (ns)" }}
            y={{ min: 2, max: 4.4, label: "芯片电源脚电压 (V)" }}
            series={[
              { points, label: "电源脚电压", color: trace.voltage },
              // the ±5% band as series, not labelled reference lines: a label would sit on the trace near 3.3 V
              { fn: () => V0 * 0.95, label: "±5% 界限", color: trace.ref, dashed: true, width: 1.25 },
              { fn: () => V0 * 1.05, color: trace.ref, dashed: true, width: 1.25 },
            ]}
            lines={[{ x: T0 * 1e9, label: "开始抽电流" }]}
            markers={[{ x: points.reduce((best, p) => (p[1] < best[1] ? p : best), points[0])[0], y: min, color: trace.voltage }]}
          />
        </div>
      </LabStage>
      <LabControls columns={3}>
        <SliderField label="去耦电容" value={cap} onChange={setCap} min={NONE} max={10e-6} log format={(v) => (v < NONE * 1.1 ? "不装" : formatSI(v, "F"))} />
        <SliderField label="走线电感" value={l} onChange={setL} min={1e-9} max={30e-9} log unit="H" />
        <SliderField label="脉冲电流" value={amp} onChange={setAmp} min={0.01} max={0.3} step={0.01} unit="A" color={trace.current} />
      </LabControls>
      <LabReadouts>
        <Readout label="最低电压" value={formatSI(min, "V")} color={trace.voltage} />
        <Readout label="最大跌落" value={formatSI(drop, "V")} sub={`3.3 V 的 ${percent(share, 1)}`} />
        <Readout label="一次抽走的电荷 Q" value={formatSI(charge, "C")} sub={<Tex>{String.raw`${tex.si(amp, "A")} \times 42\,\mathrm{ns}`}</Tex>} />
        <Readout label={<>粗估 <Tex>{"Q/C"}</Tex></>} value={none ? "没有电容" : formatSI(charge / c, "V")} sub="只靠电容供电时的跌落" />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

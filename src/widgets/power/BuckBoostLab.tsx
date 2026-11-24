import * as React from "react"
import {
  Capacitor,
  ControlField,
  Diode,
  Inductor,
  Junction,
  Lab,
  LabControls,
  LabNote,
  LabReadouts,
  LabStage,
  Label,
  PlayButton,
  Plot,
  Readout,
  Resistor,
  Schematic,
  Segmented,
  SliderField,
  Source,
  Switch,
  Tex,
  Wire,
  clamp,
  fixed,
  formatSI,
  percent,
  sig,
  tex,
  trace,
  usePlayback,
  useTime,
} from "@/lab"

type Mode = "buck" | "boost"
type Phase = "on" | "off" | "idle"

interface Preset {
  vin: number
  d: number
  l: number
  f: number
  i: number
}

/** Everyday designs: 12 V → 5 V at 1 A, and one lithium cell → 5 V at 0.5 A. */
const PRESETS: Record<Mode, Preset> = {
  buck: { vin: 12, d: 0.42, l: 22e-6, f: 500e3, i: 1 },
  boost: { vin: 3.7, d: 0.26, l: 10e-6, f: 500e3, i: 0.5 },
}
/** The boost duty cycle stops at 0.85: 1 / (1 − D) runs away beyond that. */
const RANGE: Record<Mode, { vin: [number, number]; d: [number, number] }> = {
  buck: { vin: [5, 24], d: [0.1, 0.9] },
  boost: { vin: [2.5, 12], d: [0.1, 0.85] },
}
/** Switching periods per real second in the slow-motion replay. */
const REPLAY_SPEED = 0.4
/** Current that makes the dots on the wires look fast. */
const I_SCALE = 3

interface Operating {
  /** Continuous conduction: the inductor current never reaches zero. */
  ccm: boolean
  vout: number
  /** What the ideal (continuous-mode) formula gives. */
  ideal: number
  iMin: number
  iPeak: number
  /** Average inductor current. */
  iAvg: number
  /** Fraction of the period during which the inductor current falls. */
  d2: number
}

/*
 * Lossless converter with a fixed duty cycle (no feedback loop) feeding a
 * constant load current. In continuous mode the textbook formulas hold. When
 * half the ripple exceeds the average inductor current the converter is in
 * discontinuous mode, and the output follows from charge balance instead.
 */
function solve(mode: Mode, vin: number, d: number, l: number, f: number, iOut: number): Operating {
  if (mode === "buck") {
    const ideal = d * vin
    const ripple = ((vin - ideal) * d) / (l * f)
    if (iOut >= ripple / 2) return { ccm: true, vout: ideal, ideal, iMin: iOut - ripple / 2, iPeak: iOut + ripple / 2, iAvg: iOut, d2: 1 - d }
    const vout = vin / (1 + (2 * l * f * iOut) / (d * d * vin))
    const iPeak = ((vin - vout) * d) / (l * f)
    const d2 = Math.min(1 - d, ((vin - vout) * d) / vout)
    return { ccm: false, vout, ideal, iMin: 0, iPeak, iAvg: iOut, d2 }
  }
  const ideal = vin / (1 - d)
  const ripple = (vin * d) / (l * f)
  const iAvg = iOut / (1 - d)
  if (iAvg >= ripple / 2) return { ccm: true, vout: ideal, ideal, iMin: iAvg - ripple / 2, iPeak: iAvg + ripple / 2, iAvg, d2: 1 - d }
  const vout = vin * (1 + (vin * d * d) / (2 * l * f * iOut))
  const d2 = Math.min(1 - d, (vin * d) / (vout - vin))
  return { ccm: false, vout, ideal, iMin: 0, iPeak: ripple, iAvg: (ripple * (d + d2)) / 2, d2 }
}

/** Round up to 1, 2 or 5 times a power of ten: an axis limit that only moves in big steps. */
function niceCeil(v: number) {
  if (!(v > 0)) return 1
  const mag = 10 ** Math.floor(Math.log10(v))
  const n = v / mag
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag
}

/** Buck and boost converters: the two switch states, the switch-node square wave and the inductor's triangle current. */
export function BuckBoostLab() {
  const [mode, setMode] = React.useState<Mode>("buck")
  const [vinRaw, setVin] = React.useState(PRESETS.buck.vin)
  const [dRaw, setD] = React.useState(PRESETS.buck.d)
  const [l, setL] = React.useState(PRESETS.buck.l)
  const [f, setF] = React.useState(PRESETS.buck.f)
  const [iOut, setIOut] = React.useState(PRESETS.buck.i)
  const playback = usePlayback()
  const time = useTime(playback.playing)

  const load = (m: Mode) => {
    const p = PRESETS[m]
    setMode(m)
    setVin(p.vin)
    setD(p.d)
    setL(p.l)
    setF(p.f)
    setIOut(p.i)
  }

  const range = RANGE[mode]
  const vin = clamp(vinRaw, range.vin[0], range.vin[1])
  const d = clamp(dRaw, range.d[0], range.d[1])
  const buck = mode === "buck"
  const op = solve(mode, vin, d, l, f, iOut)
  const ripple = op.iPeak - op.iMin
  const rippleRatio = ripple / op.iAvg
  const hasIdle = op.d2 < 1 - d - 1e-9

  // two switching periods, time in μs
  const period = 1e6 / f
  const current: [number, number][] = []
  const node: [number, number][] = []
  for (let n = 0; n < 2; n++) {
    const t0 = n * period
    current.push([t0, op.iMin], [t0 + d * period, op.iPeak])
    node.push([t0, buck ? vin : 0], [t0 + d * period, buck ? 0 : op.vout])
    if (hasIdle) {
      current.push([t0 + (d + op.d2) * period, 0])
      node.push([t0 + (d + op.d2) * period, buck ? op.vout : vin])
    }
  }
  current.push([2 * period, op.iMin])
  node.push([2 * period, node[node.length - 1][1]])

  // where the slow-motion replay is right now
  const cycles = (time * REPLAY_SPEED) % 2
  const frac = cycles % 1
  const phase: Phase = frac < d ? "on" : frac < d + op.d2 ? "off" : "idle"
  const iL = phase === "on" ? op.iMin + (ripple * frac) / d : phase === "off" ? op.iPeak - (ripple * (frac - d)) / Math.max(op.d2, 1e-9) : 0
  const iSwitch = phase === "on" ? iL : 0
  const iDiode = phase === "off" ? iL : 0
  // what the inductor (buck) or the diode (boost) delivers, minus what the load takes
  const iCap = (buck ? iL : iDiode) - iOut
  const cursor = cycles * period

  const vMax = buck ? 25 : niceCeil(op.vout * 1.1)
  const iMax = niceCeil(op.iPeak * 1.1)
  const xAxis = { min: 0, max: 2 * period, ticks: [0, 0.5, 1, 1.5, 2].map((n) => n * period), format: (v: number) => sig(v, 3) }

  const caption = {
    on: buck ? "开关导通：输入给电感充能，电流上升" : "开关导通：电感接在输入两端，储存能量",
    off: buck ? "开关关断：电感经二极管续流，电流下降" : "开关关断：电感把能量推向输出",
    idle: "电感电流已经降到 0：只剩电容给负载供电",
  }[phase]

  let tone: "neutral" | "good" | "warn" | "bad" = "good"
  let note: React.ReactNode
  if (!op.ccm) {
    const runaway = !buck && op.vout > 4 * op.ideal
    tone = runaway ? "bad" : "warn"
    note = (
      <>
        负载电流太小，电感电流每个周期都掉到 0，进入断续模式。输出不再是{" "}
        <Tex>{`${buck ? String.raw`D \times V_{\mathrm{in}}` : String.raw`\frac{V_{\mathrm{in}}}{1 - D}`} = ${tex.si(op.ideal, "V")}`}</Tex>，而是升到 {formatSI(op.vout, "V")}。
        {runaway ? "没有反馈的 Boost 在轻载时输出会一路飙升，直到击穿开关管和电容。" : "真实芯片靠反馈自动把占空比调小，输出才稳得住。"}
      </>
    )
  } else if (!buck && d > 0.75) {
    tone = "warn"
    note = `升压 ${sig(1 / (1 - d), 2)} 倍。公式里没算损耗：实际电路升到 4 倍以上效率就明显下降，而且电感电流 ${formatSI(op.iAvg, "A")} 远大于输出电流 ${formatSI(iOut, "A")}。`
  } else if (rippleRatio > 0.6) {
    tone = "warn"
    note = `纹波电流是平均电流的 ${percent(rippleRatio)}，偏大：峰值电流高，输出纹波也大。加大电感，或者提高开关频率。`
  } else if (rippleRatio < 0.1) {
    tone = "neutral"
    note = `纹波只有平均电流的 ${percent(rippleRatio)}，很平，但电感选大了：体积、成本和响应速度都吃亏。`
  } else {
    note = `纹波电流是平均电流的 ${percent(rippleRatio)}，在常用的 20%–40% 附近。选电感时，饱和电流要大于峰值 ${formatSI(op.iPeak, "A")}。`
  }

  return (
    <Lab
      title="Buck / Boost 实验台"
      hint="电路图用慢动作重放开关的两个状态。调占空比看输出电压，调电感和频率看电流纹波，再把负载电流拖到很小。"
      actions={<PlayButton playback={playback} />}
      onReset={() => load("buck")}
    >
      <LabStage>
        <div className="grid items-center gap-x-6 gap-y-4 @2xl:grid-cols-[auto_minmax(0,1fr)]">
          {/*
           * Layout (340 × 212). Top rail y = 50, bottom rail y = 170.
           * Shared: source (30, 110) vertical: + (30, 80), − (30, 140);
           *         capacitor (250, 110) vertical: (250, 80), (250, 140);
           *         load (320, 110) vertical: (320, 80), (320, 140); switch node at (140, 50).
           * Buck:  switch (90, 50): (60, 50), (120, 50); inductor (190, 50): (160, 50), (220, 50);
           *        diode (140, 110) pointing up: anode (140, 140), cathode (140, 80).
           * Boost: inductor (90, 50): (60, 50), (120, 50); diode (190, 50): anode (160, 50), cathode (220, 50);
           *        switch (140, 110) vertical: (140, 80), (140, 140).
           */}
          <Schematic width={340} height={212} label={buck ? "Buck 降压电路：开关、续流二极管、电感、输出电容和负载" : "Boost 升压电路：电感、接地的开关、二极管、输出电容和负载"}>
            {buck ? (
              <>
                <Wire points={[[30, 80], [30, 50], [60, 50]]} current={iSwitch} scale={I_SCALE} />
                <Wire points={[[120, 50], [140, 50]]} current={iSwitch} scale={I_SCALE} />
                <Wire points={[[140, 50], [160, 50]]} current={iL} scale={I_SCALE} />
                <Wire points={[[220, 50], [250, 50]]} current={iL} scale={I_SCALE} />
                <Wire points={[[250, 170], [140, 170]]} current={iL} scale={I_SCALE} />
                <Wire points={[[140, 170], [30, 170], [30, 140]]} current={iSwitch} scale={I_SCALE} />
                <Wire points={[[140, 170], [140, 140]]} current={iDiode} scale={I_SCALE} />
                <Wire points={[[140, 80], [140, 50]]} current={iDiode} scale={I_SCALE} />
                <Switch x={90} y={50} closed={phase === "on"} />
                <Label x={90} y={26}>开关</Label>
                <Inductor x={190} y={50} label="电感" value={formatSI(l, "H")} />
                <Diode x={140} y={110} rot={270} label="二极管" dim={phase !== "off"} />
              </>
            ) : (
              <>
                <Wire points={[[30, 80], [30, 50], [60, 50]]} current={iL} scale={I_SCALE} />
                <Wire points={[[120, 50], [140, 50]]} current={iL} scale={I_SCALE} />
                <Wire points={[[140, 50], [140, 80]]} current={iSwitch} scale={I_SCALE} />
                <Wire points={[[140, 140], [140, 170]]} current={iSwitch} scale={I_SCALE} />
                <Wire points={[[140, 50], [160, 50]]} current={iDiode} scale={I_SCALE} />
                <Wire points={[[220, 50], [250, 50]]} current={iDiode} scale={I_SCALE} />
                <Wire points={[[250, 170], [140, 170]]} current={iDiode} scale={I_SCALE} />
                <Wire points={[[140, 170], [30, 170], [30, 140]]} current={iL} scale={I_SCALE} />
                <Inductor x={90} y={50} label="电感" value={formatSI(l, "H")} />
                <Switch x={140} y={110} rot={90} closed={phase === "on"} />
                <Label x={126} y={114} anchor="end">
                  开关
                </Label>
                <Diode x={190} y={50} label="二极管" dim={phase !== "off"} />
              </>
            )}
            <Wire points={[[250, 50], [320, 50], [320, 80]]} current={iOut} scale={I_SCALE} />
            <Wire points={[[320, 140], [320, 170], [250, 170]]} current={iOut} scale={I_SCALE} />
            <Wire points={[[250, 50], [250, 80]]} current={iCap} scale={I_SCALE} />
            <Wire points={[[250, 140], [250, 170]]} current={iCap} scale={I_SCALE} />
            <Source kind="dc" x={30} y={110} rot={90} label="输入" value={formatSI(vin, "V")} />
            <Capacitor x={250} y={110} rot={90} label="电容" labelSide="left" />
            <Resistor x={320} y={110} rot={90} />
            {/* placed by hand, lower than the default, so the value clears the capacitor's plates */}
            <Label x={304} y={118} anchor="end">
              负载
            </Label>
            <Label x={304} y={134} anchor="end" muted>
              {formatSI(iOut, "A")}
            </Label>
            <Junction x={140} y={50} />
            <Junction x={250} y={50} />
            <Junction x={140} y={170} />
            <Junction x={250} y={170} />
            <Label x={140} y={40} muted>
              SW
            </Label>
            <Label x={285} y={40} color={trace.voltage}>
              {formatSI(op.vout, "V")}
            </Label>
            <Label x={170} y={200} muted>
              {caption}
            </Label>
          </Schematic>
          <div className="flex min-w-0 flex-col gap-2">
            <Plot
              height={150}
              x={xAxis}
              y={{ min: 0, max: vMax, label: "电压 (V)" }}
              series={[
                { points: node, step: true, label: "开关节点 SW", color: trace.voltage },
                { points: [[0, op.vout], [2 * period, op.vout]], label: "输出", color: trace.second, dashed: true, width: 1.5 },
                { points: [[0, vin], [2 * period, vin]], label: "输入", color: trace.ref, dashed: true, width: 1.5 },
              ]}
              lines={[{ x: cursor }]}
            />
            <Plot
              height={170}
              x={{ ...xAxis, label: "时间 (μs)" }}
              y={{ min: 0, max: iMax, label: "电感电流 (A)" }}
              series={[
                { points: current, label: "电感电流", color: trace.current },
                { points: [[0, op.iAvg], [2 * period, op.iAvg]], label: "平均值", color: trace.ref, dashed: true, width: 1.5 },
              ]}
              lines={[{ x: cursor }]}
              markers={[{ x: cursor, y: iL, color: trace.current }]}
            />
          </div>
        </div>
      </LabStage>
      <LabControls columns={3}>
        <ControlField label="电路">
          <Segmented
            aria-label="电路"
            value={mode}
            onValueChange={load}
            options={[
              { value: "buck", label: "Buck 降压" },
              { value: "boost", label: "Boost 升压" },
            ]}
          />
        </ControlField>
        <SliderField label="占空比 D" value={d} onChange={setD} min={range.d[0]} max={range.d[1]} step={0.01} format={(v) => percent(v)} />
        <SliderField label="输入电压" value={vin} onChange={setVin} min={range.vin[0]} max={range.vin[1]} step={0.1} unit="V" />
        <SliderField label="电感 L" value={l} onChange={setL} min={2.2e-6} max={100e-6} log snap="E12" unit="H" />
        <SliderField label="开关频率 f" value={f} onChange={setF} min={100e3} max={2e6} log unit="Hz" />
        <SliderField label="负载电流" value={iOut} onChange={setIOut} min={0.05} max={3} step={0.05} unit="A" color={trace.current} />
      </LabControls>
      <LabReadouts>
        <Readout
          label="输出电压"
          value={formatSI(op.vout, "V")}
          color={trace.voltage}
          sub={
            !op.ccm ? (
              `理想公式给出 ${formatSI(op.ideal, "V")}`
            ) : buck ? (
              <Tex>{String.raw`D \times V_{\mathrm{in}} = ${percent(d).replace("%", String.raw`\%`)} \times ${tex.si(vin, "V")}`}</Tex>
            ) : (
              <Tex>{String.raw`V_{\mathrm{in}} / (1 - D) = ${tex.si(vin, "V")} / ${tex.num(fixed(1 - d, 2))}`}</Tex>
            )
          }
        />
        <Readout label="电感纹波电流 ΔI" value={formatSI(ripple, "A")} color={trace.current} sub={`平均电流 ${formatSI(op.iAvg, "A")}`} />
        <Readout label="电感峰值电流" value={formatSI(op.iPeak, "A")} />
        <Readout label="导通模式" value={op.ccm ? "连续" : "断续"} sub={op.ccm ? "电感电流始终大于 0" : "每个周期都掉到 0"} />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

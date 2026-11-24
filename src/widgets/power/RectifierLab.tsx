import * as React from "react"
import {
  Capacitor,
  ControlField,
  Diode,
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
  TAU,
  Wire,
  formatSI,
  percent,
  trace,
  usePlayback,
  useTime,
} from "@/lab"

type Mode = "half" | "bridge"

const MAINS_HZ = 50
/** Transformer secondary: 9 V RMS. */
const V_PEAK = 9 * Math.SQRT2
/** Forward drop of one silicon rectifier diode. */
const V_DIODE = 0.7
/** Two mains cycles on screen (seconds). */
const WINDOW = 0.04
const STEPS = 800
const DT = WINDOW / STEPS
/** Real electrolytic values in μF; index 0 means "no capacitor". */
const CAPS_UF = [0, 4.7, 10, 22, 47, 100, 220, 470, 1000, 2200, 4700]
/** What a 5 V regulator of the 7805 kind needs at its input. */
const REGULATOR_MIN = 7
/** Simulated seconds per real second: one sweep of the window takes 10 s. */
const SLOW_MOTION = 0.004
/** Current that makes the dots on the wires look fast. */
const I_SCALE = 0.5

interface Sim {
  /** [time in ms, volts] */
  input: [number, number][]
  output: [number, number][]
  /** Current through the rectifier at each sample (0 while the diodes are off). */
  diode: number[]
  avg: number
  min: number
  max: number
  /** Fraction of a cycle during which the diodes conduct. */
  conduction: number
}

/*
 * Ideal transformer, diodes with a fixed drop, capacitor C across load R.
 * While |vin| − drop is above the capacitor voltage the diodes conduct and
 * the capacitor follows it; otherwise the capacitor discharges into the load
 * (exact exponential per step). One mains cycle runs before the window so the
 * picture starts in steady state.
 */
function simulate(mode: Mode, c: number, r: number): Sim {
  const drop = mode === "bridge" ? 2 * V_DIODE : V_DIODE
  const input: [number, number][] = []
  const output: [number, number][] = []
  const diode: number[] = []
  let vc = 0
  for (let k = -STEPS / 2; k <= STEPS; k++) {
    const t = k * DT
    const vin = V_PEAK * Math.sin(TAU * MAINS_HZ * t)
    const rectified = Math.max(0, (mode === "bridge" ? Math.abs(vin) : vin) - drop)
    let id = 0
    if (c <= 0) {
      vc = rectified
      id = rectified / r
    } else {
      const decayed = vc * Math.exp(-DT / (r * c))
      if (rectified > 0 && rectified >= decayed) {
        // load current plus what it takes to charge the capacitor this fast
        id = Math.max(0, rectified / r + (c * (rectified - vc)) / DT)
        vc = rectified
      } else {
        vc = decayed
      }
    }
    if (k >= 0) {
      input.push([t * 1000, vin])
      output.push([t * 1000, vc])
      diode.push(id)
    }
  }
  // statistics over the last full mains cycle
  let min = Infinity
  let max = -Infinity
  let sum = 0
  let on = 0
  const from = STEPS / 2
  for (let k = from; k < STEPS; k++) {
    const v = output[k][1]
    min = Math.min(min, v)
    max = Math.max(max, v)
    sum += v
    if (diode[k] > 0) on++
  }
  return { input, output, diode, avg: sum / from, min, max, conduction: on / from }
}

/** Transformer secondary → rectifier → reservoir capacitor → load, with the waveform it produces. */
export function RectifierLab() {
  const [mode, setMode] = React.useState<Mode>("bridge")
  const [capIndex, setCapIndex] = React.useState(7)
  const [r, setR] = React.useState(100)
  const playback = usePlayback()
  const time = useTime(playback.playing)

  const capUf = CAPS_UF[Math.min(CAPS_UF.length - 1, Math.max(0, Math.round(capIndex)))]
  const c = capUf * 1e-6
  const hasCap = c > 0
  const sim = React.useMemo(() => simulate(mode, c, r), [mode, c, r])

  // the instant under the cursor
  const k = Math.min(STEPS, Math.floor(((time * SLOW_MOTION) % WINDOW) / DT))
  const tMs = sim.input[k][0]
  const vIn = sim.input[k][1]
  const vOut = sim.output[k][1]
  const iDiode = sim.diode[k]
  const iLoad = vOut / r
  const iCap = hasCap ? iDiode - iLoad : 0
  const positive = vIn >= 0
  const iPos = positive ? iDiode : 0
  const iNeg = positive ? 0 : iDiode

  const ripple = sim.max - sim.min
  const iAvg = sim.avg / r
  const rippleHz = mode === "bridge" ? 2 * MAINS_HZ : MAINS_HZ
  const estimate = hasCap ? iAvg / (rippleHz * c) : 0

  let tone: "good" | "warn" | "bad" = "good"
  let note: string
  if (!hasCap) {
    tone = "warn"
    note = `没接滤波电容：输出是一串「馒头波」，每个周期都掉到 0 V，平均只有 ${formatSI(sim.avg, "V")}。${mode === "half" ? "半波整流还把整个负半周浪费掉了。" : "这样的电没法直接给芯片用。"}`
  } else if (sim.min < REGULATOR_MIN) {
    tone = "bad"
    note = `纹波 ${formatSI(ripple, "V")}，谷底只剩 ${formatSI(sim.min, "V")}。后面如果接 5 V 稳压器（输入至少要 ${REGULATOR_MIN} V），谷底那一段它就稳不住了。换大电容，或者减小负载电流。`
  } else {
    note = `纹波 ${formatSI(ripple, "V")}，谷底 ${formatSI(sim.min, "V")}，比 5 V 稳压器需要的 ${REGULATOR_MIN} V 高，够用。二极管只在 ${percent(sim.conduction)} 的时间里导通，给电容补电；其余时间负载全靠电容供电。`
  }

  return (
    <Lab
      title="整流滤波实验台"
      hint="切换整流方式，调滤波电容和负载，看输出波形。电路图里亮着的二极管是此刻正在导通的。"
      actions={<PlayButton playback={playback} />}
      onReset={() => {
        setMode("bridge")
        setCapIndex(7)
        setR(100)
      }}
    >
      <LabStage>
        <div className="grid items-center gap-x-6 gap-y-4 @2xl:grid-cols-[auto_minmax(0,1fr)]">
          {/*
           * Layout (340 × 200). Top rail y = 40, bottom rail y = 180.
           * Capacitor (220, 110) vertical: + (220, 80), − (220, 140).
           * Load (300, 110) vertical: (300, 80), (300, 140).
           * Bridge: diodes point up (rot 270: anode below, cathode above).
           *   D1 (40, 70): (40, 100) → (40, 40)     D2 (140, 70): (140, 100) → (140, 40)
           *   D3 (40, 150): (40, 180) → (40, 120)   D4 (140, 150): (140, 180) → (140, 120)
           *   source (90, 110) horizontal: (60, 110), (120, 110), joined to the column midpoints.
           * Half wave: source (40, 110) vertical: (40, 80), (40, 140); D1 (90, 40): (60, 40) → (120, 40).
           */}
          <Schematic width={340} height={200} label={mode === "bridge" ? "变压器次级经四只二极管组成的整流桥，接滤波电容和负载" : "变压器次级经一只二极管半波整流，接滤波电容和负载"}>
            <Label x={260} y={30} color={trace.voltage}>
              {formatSI(vOut, "V")}
            </Label>
            {mode === "bridge" ? (
              <>
                <Wire points={[[60, 110], [40, 110]]} current={iPos - iNeg} scale={I_SCALE} />
                <Wire points={[[40, 110], [40, 100]]} current={iPos} scale={I_SCALE} />
                <Wire points={[[40, 120], [40, 110]]} current={iNeg} scale={I_SCALE} />
                <Wire points={[[140, 110], [120, 110]]} current={iPos - iNeg} scale={I_SCALE} />
                <Wire points={[[140, 120], [140, 110]]} current={iPos} scale={I_SCALE} />
                <Wire points={[[140, 110], [140, 100]]} current={iNeg} scale={I_SCALE} />
                <Wire points={[[40, 40], [140, 40]]} current={iPos} scale={I_SCALE} />
                <Wire points={[[140, 40], [220, 40]]} current={iDiode} scale={I_SCALE} />
                <Wire points={[[220, 180], [140, 180]]} current={iDiode} scale={I_SCALE} />
                <Wire points={[[140, 180], [40, 180]]} current={iNeg} scale={I_SCALE} />
                <Diode x={40} y={70} rot={270} label="D1" labelSide="left" dim={iPos <= 0} />
                <Diode x={140} y={70} rot={270} label="D2" dim={iNeg <= 0} />
                <Diode x={40} y={150} rot={270} label="D3" labelSide="left" dim={iNeg <= 0} />
                <Diode x={140} y={150} rot={270} label="D4" dim={iPos <= 0} />
                <Source kind="ac" x={90} y={110} label="变压器次级" value="9 V 交流" />
                <Label x={68} y={127} muted>
                  {positive ? "+" : "−"}
                </Label>
                <Label x={112} y={127} muted>
                  {positive ? "−" : "+"}
                </Label>
                <Junction x={40} y={110} />
                <Junction x={140} y={110} />
                <Junction x={140} y={40} />
                <Junction x={140} y={180} />
              </>
            ) : (
              <>
                <Wire points={[[40, 80], [40, 40], [60, 40]]} current={iDiode} scale={I_SCALE} />
                <Wire points={[[120, 40], [220, 40]]} current={iDiode} scale={I_SCALE} />
                <Wire points={[[220, 180], [40, 180], [40, 140]]} current={iDiode} scale={I_SCALE} />
                <Diode x={90} y={40} label="D1" dim={iDiode <= 0} />
                <Source kind="ac" x={40} y={110} rot={90} label="变压器次级" value="9 V 交流" />
                <Label x={26} y={89} muted>
                  {positive ? "+" : "−"}
                </Label>
                <Label x={26} y={141} muted>
                  {positive ? "−" : "+"}
                </Label>
              </>
            )}
            <Wire points={[[220, 40], [300, 40], [300, 80]]} current={iLoad} scale={I_SCALE} />
            <Wire points={[[300, 140], [300, 180], [220, 180]]} current={iLoad} scale={I_SCALE} />
            <g opacity={hasCap ? undefined : 0.3}>
              <Wire points={[[220, 40], [220, 80]]} current={iCap} scale={I_SCALE} />
              <Wire points={[[220, 140], [220, 180]]} current={iCap} scale={I_SCALE} />
              <Capacitor polarized x={220} y={110} rot={90} label="电容" value={hasCap ? formatSI(c, "F") : "不接"} labelSide="left" />
              <Junction x={220} y={40} />
              <Junction x={220} y={180} />
            </g>
            <Resistor x={300} y={110} rot={90} label="负载" value={formatSI(r, "Ω")} labelSide="left" />
          </Schematic>
          <Plot
            height={230}
            x={{ min: 0, max: 40, label: "时间 (ms)" }}
            y={{ min: -14, max: 14, label: "电压 (V)" }}
            series={[
              { points: sim.input, label: "变压器次级", color: trace.ref, dashed: true, width: 1.5 },
              { points: sim.output, label: hasCap ? "整流滤波后的输出" : "整流后的输出", color: trace.voltage },
            ]}
            lines={[{ x: tMs }]}
            markers={[{ x: tMs, y: vOut, color: trace.voltage }]}
          />
        </div>
      </LabStage>
      <LabControls columns={3}>
        <ControlField label="整流方式">
          <Segmented
            aria-label="整流方式"
            value={mode}
            onValueChange={setMode}
            options={[
              { value: "half", label: "半波" },
              { value: "bridge", label: "桥式全波" },
            ]}
          />
        </ControlField>
        <SliderField
          label="滤波电容"
          value={capIndex}
          onChange={setCapIndex}
          min={0}
          max={CAPS_UF.length - 1}
          step={1}
          format={(i) => {
            const uf = CAPS_UF[Math.min(CAPS_UF.length - 1, Math.max(0, Math.round(i)))]
            return uf > 0 ? formatSI(uf * 1e-6, "F") : "不接"
          }}
        />
        <SliderField label="负载电阻" value={r} onChange={setR} min={10} max={1000} log snap="E12" unit="Ω" />
      </LabControls>
      <LabReadouts>
        <Readout label="平均直流电压" value={formatSI(sim.avg, "V")} color={trace.voltage} />
        <Readout
          label="纹波峰峰值"
          value={formatSI(ripple, "V")}
          sub={!hasCap ? "没有电容，全幅波动" : estimate < sim.max ? `估算 I ÷ (f·C) ≈ ${formatSI(estimate, "V")}` : "电容太小，估算公式不适用"}
        />
        <Readout label="谷底电压" value={formatSI(sim.min, "V")} />
        <Readout label="平均负载电流" value={formatSI(iAvg, "A")} color={trace.current} />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

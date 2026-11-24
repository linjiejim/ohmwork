import * as React from "react"
import { Lab, LabControls, LabNote, LabReadouts, LabStage, Plot, Readout, SliderField, fixed, formatSI, percent, sig, trace } from "@/lab"
import { V_CUTOFF, formatHours, openCircuitVoltage } from "./battery-model"

const STEPS = 400
const CAPACITY_MAX = 5000

interface Discharge {
  /** [discharged capacity in mAh, volts] */
  open: [number, number][]
  loaded: [number, number][]
  /** Capacity delivered before the terminal voltage reaches the cut-off, mAh. */
  delivered: number
  /** Energy delivered, Wh. */
  energy: number
}

/*
 * Terminal voltage = open-circuit voltage(state of charge) − I × r, followed
 * from full until it reaches the cut-off voltage. The area under the loaded
 * curve is the energy the load actually gets.
 */
function discharge(capacity: number, current: number, r: number): Discharge {
  const open: [number, number][] = []
  const loaded: [number, number][] = []
  let delivered = 0
  let energy = 0
  let done = false
  let prevV = 0
  let prevX = 0
  for (let k = 0; k <= STEPS; k++) {
    const soc = 1 - k / STEPS
    const ocv = openCircuitVoltage(soc)
    const v = ocv - current * r
    const x = (1 - soc) * capacity
    open.push([x, ocv])
    if (!done) {
      if (v <= V_CUTOFF) {
        if (k > 0) {
          // the exact point where the curve crosses the cut-off line
          const xCut = prevX + ((prevV - V_CUTOFF) / (prevV - v)) * (x - prevX)
          loaded.push([xCut, V_CUTOFF])
          energy += (((prevV + V_CUTOFF) / 2) * (xCut - prevX)) / 1000
          delivered = xCut
        }
        done = true
      } else {
        loaded.push([x, v])
        if (k > 0) energy += (((prevV + v) / 2) * (x - prevX)) / 1000
        delivered = x
      }
    }
    prevV = v
    prevX = x
  }
  return { open, loaded, delivered, energy }
}

/** A lithium-ion cell discharging into a constant-current load: terminal voltage against capacity drawn. */
export function BatteryLab() {
  const [current, setCurrent] = React.useState(1)
  const [capacity, setCapacity] = React.useState(2500)
  const [r, setR] = React.useState(0.08)

  const sim = React.useMemo(() => discharge(capacity, current, r), [capacity, current, r])
  const cRate = current / (capacity / 1000)
  const sag = current * r
  const heat = current * current * r
  const fraction = sim.delivered / capacity
  const hours = sim.delivered / 1000 / current
  const dead = sim.delivered <= 0
  const average = dead ? 0 : sim.energy / (sim.delivered / 1000)

  let tone: "neutral" | "warn" | "bad" = "neutral"
  let note: string
  if (dead) {
    tone = "bad"
    note = `${formatSI(current, "A")} 流过 ${formatSI(r, "Ω")} 的内阻，压降就有 ${formatSI(sag, "V")}。一接上负载，端电压立刻低于 ${fixed(V_CUTOFF, 1)} V 的截止电压，保护板会马上切断，一点电也放不出来。`
  } else if (fraction < 0.9) {
    tone = "warn"
    note = `内阻上的压降 ${formatSI(sag, "V")} 让端电压提前碰到截止线，只放出了标称容量的 ${percent(fraction)}。剩下的电还在电池里，只是这么大的电流取不出来。`
  } else if (cRate > 2) {
    tone = "warn"
    note = `${sig(cRate, 2)}C 放电，超过了容量型电芯常见的 1C–2C 上限，要用动力型电芯才行。内阻发热 ${formatSI(heat, "W")}，电池会明显发烫。`
  } else {
    note = `带上负载后，端电压整体比空载低 ${formatSI(sag, "V")}（内阻发热 ${formatSI(heat, "W")}）。到 ${fixed(V_CUTOFF, 1)} V 截止时放出了标称容量的 ${percent(fraction)}。`
  }

  return (
    <Lab
      title="锂电池放电曲线"
      hint="加大负载电流或内阻，看端电压曲线怎么整体下沉，又在哪里提前碰到 3.0 V 截止线。"
      onReset={() => {
        setCurrent(1)
        setCapacity(2500)
        setR(0.08)
      }}
    >
      <LabStage>
        <Plot
          height={250}
          x={{ min: 0, max: CAPACITY_MAX, label: "已放出的容量 (mAh)", ticks: [0, 1000, 2000, 3000, 4000, 5000], format: (v) => String(Math.round(v)) }}
          y={{ min: 2.8, max: 4.4, label: "电压 (V)", format: (v) => fixed(v, 2) }}
          series={[
            { points: sim.open, label: "空载电压（开路）", color: trace.ref, dashed: true, width: 1.5 },
            { points: sim.loaded, label: "带负载的端电压", color: trace.voltage },
          ]}
          lines={[{ y: V_CUTOFF, label: `截止电压 ${fixed(V_CUTOFF, 1)} V`, color: trace.power }]}
          markers={dead ? [] : [{ x: sim.delivered, y: V_CUTOFF, label: `${Math.round(sim.delivered)} mAh`, color: trace.voltage }]}
        />
      </LabStage>
      <LabControls columns={3}>
        <SliderField
          label="负载电流"
          value={current}
          onChange={setCurrent}
          min={0.05}
          max={10}
          log
          color={trace.current}
          format={(v) => `${formatSI(v, "A")}（${sig(v / (capacity / 1000), 2)}C）`}
        />
        <SliderField label="电池容量" value={capacity} onChange={setCapacity} min={500} max={CAPACITY_MAX} step={100} format={(v) => `${Math.round(v)} mAh`} />
        <SliderField label="电池内阻" value={r} onChange={setR} min={0.02} max={0.5} log unit="Ω" />
      </LabControls>
      <LabReadouts>
        <Readout label="续航时间" value={formatHours(hours)} />
        <Readout label="放出的容量" value={`${Math.round(sim.delivered)} mAh`} sub={`标称容量的 ${percent(fraction)}`} />
        <Readout label="平均电压" value={dead ? "—" : `${fixed(average, 2)} V`} color={trace.voltage} />
        <Readout label="放出的能量" value={formatSI(sim.energy, "Wh")} sub="平均电压 × 容量" />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

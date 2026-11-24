import * as React from "react"
import { Lab, LabControls, LabNote, LabReadouts, LabStage, Label, PlayButton, Plot, Readout, Schematic, SliderField, fixed, formatSI, percent, sig, trace, usePlayback, useTime } from "@/lab"
import { V_FULL, formatHours, openCircuitVoltage } from "./battery-model"

/** The cell being charged: 2000 mAh. */
const CAPACITY = 2
/** Effective series resistance while charging (ohmic plus polarisation), in ohms. */
const R_CHARGE = 0.15
/** The charger stops when the current has fallen to this fraction of the set current. */
const TERMINATION = 0.1
const STEPS_PER_HOUR = 240
const HOURS = 5
const STEPS = HOURS * STEPS_PER_HOUR
/** Seconds the cursor takes to run along the curve, and how long it rests at the end. */
const SWEEP = 10
const HOLD = 2

interface Charge {
  /** [hours, volts] and [hours, amps], one sample every 15 s */
  voltage: [number, number][]
  current: [number, number][]
  soc: number[]
  /** Sample at which constant voltage takes over, and at which charging stops. */
  kCv: number
  kDone: number
}

/*
 * Constant current until the terminal voltage (open-circuit voltage + I × r)
 * reaches 4.2 V, then constant voltage: the current is whatever 4.2 V can
 * still push through r, and it decays as the cell fills. Stops at 1/10 of the
 * set current, after which the cell rests at its open-circuit voltage.
 */
function charge(iSet: number): Charge {
  const dt = 1 / STEPS_PER_HOUR
  const voltage: [number, number][] = []
  const current: [number, number][] = []
  const socs: number[] = []
  let soc = 0
  let kCv = -1
  let kDone = -1
  for (let k = 0; k <= STEPS; k++) {
    const ocv = openCircuitVoltage(soc)
    let i = 0
    let v = ocv
    if (kDone < 0) {
      i = iSet
      v = ocv + iSet * R_CHARGE
      if (v >= V_FULL) {
        v = V_FULL
        i = (V_FULL - ocv) / R_CHARGE
        if (kCv < 0) kCv = k
      }
      if (kCv >= 0 && i <= iSet * TERMINATION) {
        kDone = k
        i = 0
        v = ocv
      }
    }
    voltage.push([k * dt, v])
    current.push([k * dt, i])
    socs.push(soc)
    soc = Math.min(1, soc + (i * dt) / CAPACITY)
  }
  // both always happen inside the window for the slider's range; this only keeps the indices valid
  if (kCv < 0) kCv = STEPS
  if (kDone < 0) kDone = STEPS
  return { voltage, current, soc: socs, kCv, kDone }
}

/** CC/CV charging of a lithium-ion cell: voltage and current against time, with a cursor that replays one charge. */
export function ChargeLab() {
  const [iSet, setISet] = React.useState(1)
  const playback = usePlayback()
  const time = useTime(playback.playing)

  const sim = React.useMemo(() => charge(iSet), [iSet])
  const dt = 1 / STEPS_PER_HOUR
  const tCv = sim.kCv * dt
  const tDone = sim.kDone * dt
  const socCv = sim.soc[sim.kCv]
  const socEnd = sim.soc[sim.kDone]
  const cRate = iSet / CAPACITY

  // the cursor runs from empty to a little past "full", rests, and starts over
  const kEnd = Math.min(STEPS, sim.kDone + STEPS_PER_HOUR / 4)
  const k = Math.round(Math.min(1, (time % (SWEEP + HOLD)) / SWEEP) * kEnd)
  const tNow = k * dt
  const vNow = sim.voltage[k][1]
  const iNow = sim.current[k][1]
  const socNow = sim.soc[k]
  const stage = k < sim.kCv ? "恒流充电" : k < sim.kDone ? "恒压充电" : "已充满"

  let tone: "neutral" | "good" | "warn" = "good"
  let note: string
  if (cRate > 1) {
    tone = "warn"
    note = `${sig(cRate, 2)}C 充电，超过了大多数锂电池允许的 1C。电量才到 ${percent(socCv)}，电压就顶到了 4.2 V；电池发热大、老化快，低温下还可能析出金属锂，有安全风险。`
  } else if (cRate > 0.5) {
    tone = "neutral"
    note = `${sig(cRate, 2)}C 充电：电量到 ${percent(socCv)} 时电压就碰到 4.2 V，剩下的只能靠恒压阶段慢慢补。和 0.5C 相比电流大了，总时间却没有按比例缩短。`
  } else {
    note = `${sig(cRate, 2)}C 充电，比较温和：恒流阶段就能充到 ${percent(socCv)}，电池发热小，对寿命友好。`
  }

  return (
    <Lab
      title="锂电池的恒流恒压充电"
      hint="一节 2000 mAh 的锂电池从放空充到满。调充电电流，看恒流和恒压两个阶段各占多久。"
      actions={<PlayButton playback={playback} />}
      onReset={() => setISet(1)}
    >
      <LabStage>
        <div className="grid items-center gap-x-6 gap-y-4 @md:grid-cols-[auto_minmax(0,1fr)]">
          {/* Battery gauge (110 × 190): body 25–85 × 22–146, inner fill area 31–79 × 28–140, texts below. */}
          <Schematic width={110} height={190} label={`电池电量 ${percent(socNow)}，${stage}`}>
            <rect x={43} y={12} width={24} height={10} rx={2} />
            <rect x={25} y={22} width={60} height={124} rx={8} />
            <rect x={31} y={140 - 112 * socNow} width={48} height={112 * socNow} rx={3} fill={trace.good} stroke="none" />
            <Label x={55} y={166} weight={600}>
              {percent(socNow)}
            </Label>
            <Label x={55} y={184} muted>
              {stage}
            </Label>
          </Schematic>
          <div className="flex min-w-0 flex-col gap-2">
            <Plot
              height={160}
              x={{ min: 0, max: HOURS }}
              y={{ min: 2.8, max: 4.6, label: "电池端电压 (V)", format: (v) => fixed(v, 2) }}
              series={[
                { points: sim.voltage, label: "端电压", color: trace.voltage },
                { points: [[0, V_FULL], [HOURS, V_FULL]], label: "充电上限 4.2 V", color: trace.ref, dashed: true, width: 1.5 },
              ]}
              lines={[{ x: tCv }, { x: tNow }]}
              markers={[{ x: tNow, y: vNow, label: `${fixed(vNow, 2)} V`, color: trace.voltage }]}
            />
            <Plot
              height={170}
              x={{ min: 0, max: HOURS, label: "时间 (h)" }}
              y={{ min: 0, max: 4, label: "充电电流 (A)" }}
              series={[{ points: sim.current, label: "充电电流", color: trace.current }]}
              lines={[{ x: tCv, label: "转入恒压" }, { x: tNow }]}
              markers={[
                { x: tDone, y: 0, label: "充满，停止" },
                { x: tNow, y: iNow, label: formatSI(iNow, "A"), color: trace.current },
              ]}
            />
          </div>
        </div>
      </LabStage>
      <LabControls columns={1}>
        <SliderField
          label="充电电流"
          value={iSet}
          onChange={setISet}
          min={0.5}
          max={3}
          step={0.1}
          color={trace.current}
          format={(v) => `${formatSI(v, "A")}（${sig(v / CAPACITY, 2)}C）`}
        />
      </LabControls>
      <LabReadouts>
        <Readout label="恒流阶段" value={formatHours(tCv)} sub={`充到 ${percent(socCv)}`} />
        <Readout label="恒压阶段" value={formatHours(tDone - tCv)} sub={`再补 ${percent(socEnd - socCv)}`} />
        <Readout label="总充电时间" value={formatHours(tDone)} />
        <Readout label="截止电流" value={formatSI(iSet * TERMINATION, "A")} sub="设定电流的 1/10" />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

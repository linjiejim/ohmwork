import * as React from "react"
import { Battery, ControlField, Junction, Lab, LabControls, LabNote, LabReadouts, LabStage, Label, Readout, Resistor, Schematic, Segmented, SliderField, SwitchField, Wire, formatSI, parallel, percent, trace } from "@/lab"

type Mode = "series" | "parallel"

/** Battery voltage. 6 V with 1 kΩ, 2 kΩ and 3 kΩ gives the round numbers the lesson works through. */
const V = 6
/** Current that reads as "fast" on the wires: 6 mA, the largest branch current at the starting values. */
const SCALE = 0.006
const NAMES = ["R1", "R2", "R3"]

/**
 * Two or three resistors on a 6 V battery, wired in series or in parallel.
 * Series: I = V / ΣR, each drop is I·R. Parallel: each branch carries V / R, the total is their sum.
 */
export function SeriesParallelLab() {
  const [mode, setMode] = React.useState<Mode>("series")
  const [three, setThree] = React.useState(true)
  const [r1, setR1] = React.useState(1000)
  const [r2, setR2] = React.useState(2000)
  const [r3, setR3] = React.useState(3000)

  const series = mode === "series"
  const rs = three ? [r1, r2, r3] : [r1, r2]
  const req = series ? rs.reduce((sum, r) => sum + r, 0) : parallel(...rs)
  const total = V / req
  const parts = rs.map((r, k) => ({ name: NAMES[k], r, v: series ? total * r : V, i: series ? total : V / r }))
  const [p1, p2, p3] = parts
  const i3 = p3 ? p3.i : 0

  const biggest = parts.reduce((a, b) => (b.r > a.r ? b : a))
  const smallest = parts.reduce((a, b) => (b.r < a.r ? b : a))
  const allEqual = biggest.r === smallest.r
  const count = three ? "三" : "两"
  const sumText = parts.map((p) => formatSI(p.r, "Ω")).join(" + ")

  let note: string
  if (series) {
    note = allEqual
      ? `串联：同一股 ${formatSI(total, "A")} 的电流依次流过每只电阻。${count}只电阻一样大，6 V 被平分，每只 ${formatSI(p1.v, "V")}。等效电阻 ${sumText} = ${formatSI(req, "Ω")}。`
      : `串联：同一股 ${formatSI(total, "A")} 的电流依次流过每只电阻。${biggest.name} 最大，分到的电压最多（${formatSI(biggest.v, "V")}）。等效电阻 ${sumText} = ${formatSI(req, "Ω")}。`
  } else {
    note = allEqual
      ? `并联：每只电阻两端都是 6 V。${count}只相同的电阻并联，电流平分，等效电阻 ${formatSI(req, "Ω")} 正好是单只的${three ? "三分之一" : "一半"}。`
      : `并联：每只电阻两端都是 6 V。${smallest.name} 最小，流过的电流最大（${formatSI(smallest.i, "A")}）。等效电阻 ${formatSI(req, "Ω")}，比最小的 ${smallest.name}（${formatSI(smallest.r, "Ω")}）还小。`
  }

  return (
    <Lab
      title="串联与并联实验台"
      hint="切换接法，再拖动阻值。蓝点越快电流越大，橙色数字是每只电阻两端的电压。"
      onReset={() => {
        setMode("series")
        setThree(true)
        setR1(1000)
        setR2(2000)
        setR3(3000)
      }}
    >
      <LabStage>
        {/* the schematic is 340 wide, so the bars only sit beside it at full lesson width */}
        <div className="grid items-center gap-x-6 gap-y-4 @2xl:grid-cols-[auto_minmax(0,1fr)]">
          {series ? (
            /*
             * One loop. Battery (30, 110): + at (30, 80), − at (30, 140). Top wire y = 50, return wire y = 170, right side x = 320.
             * R1 (100, 50): 70…130. R2 (190, 50): 160…220. R3 (280, 50): 250…310. Name and value above, voltage and current below.
             */
            <Schematic width={340} height={190} label={`${count}只电阻串联后接在 6 V 电池上`}>
              <Wire points={[[30, 80], [30, 50], [70, 50]]} current={total} scale={SCALE} />
              <Wire points={[[130, 50], [160, 50]]} current={total} scale={SCALE} />
              {three ? (
                <>
                  <Wire points={[[220, 50], [250, 50]]} current={total} scale={SCALE} />
                  <Wire points={[[310, 50], [320, 50], [320, 170], [30, 170], [30, 140]]} current={total} scale={SCALE} />
                </>
              ) : (
                <Wire points={[[220, 50], [320, 50], [320, 170], [30, 170], [30, 140]]} current={total} scale={SCALE} />
              )}
              <Battery x={30} y={110} rot={90} value="6 V" />
              {parts.map((p, k) => (
                <React.Fragment key={p.name}>
                  <Resistor x={100 + k * 90} y={50} label={p.name} value={formatSI(p.r, "Ω")} />
                  <Label x={100 + k * 90} y={75} color={trace.voltage}>
                    {formatSI(p.v, "V")}
                  </Label>
                  <Label x={100 + k * 90} y={90} color={trace.current}>
                    {formatSI(p.i, "A")}
                  </Label>
                </React.Fragment>
              ))}
              <Label x={175} y={157} color={trace.current}>
                回路电流 I = {formatSI(total, "A")}
              </Label>
            </Schematic>
          ) : (
            /*
             * Rails at y = 50 and y = 170. Battery (30, 110): + at (30, 80), − at (30, 140).
             * Branches at x = 100, 180, 260: resistor (x, 110) with terminals (x, 80) and (x, 140).
             * Four lines of text right of each branch (x + 14 … x + 66), clear of the next branch at x + 73.
             */
            <Schematic width={340} height={190} label={`${count}只电阻并联后接在 6 V 电池上`}>
              <Label x={65} y={38} color={trace.current}>
                I = {formatSI(total, "A")}
              </Label>
              <Wire points={[[30, 80], [30, 50], [100, 50]]} current={total} scale={SCALE} />
              <Wire points={[[100, 50], [100, 80]]} current={p1.i} scale={SCALE} />
              <Wire points={[[100, 140], [100, 170]]} current={p1.i} scale={SCALE} />
              {three ? (
                <>
                  <Wire points={[[100, 50], [180, 50]]} current={p2.i + i3} scale={SCALE} />
                  <Wire points={[[180, 50], [180, 80]]} current={p2.i} scale={SCALE} />
                  <Wire points={[[180, 140], [180, 170]]} current={p2.i} scale={SCALE} />
                  <Wire points={[[180, 50], [260, 50], [260, 80]]} current={i3} scale={SCALE} />
                  <Wire points={[[260, 140], [260, 170], [180, 170]]} current={i3} scale={SCALE} />
                  <Wire points={[[180, 170], [100, 170]]} current={p2.i + i3} scale={SCALE} />
                  <Junction x={180} y={50} />
                  <Junction x={180} y={170} />
                </>
              ) : (
                <>
                  <Wire points={[[100, 50], [180, 50], [180, 80]]} current={p2.i} scale={SCALE} />
                  <Wire points={[[180, 140], [180, 170], [100, 170]]} current={p2.i} scale={SCALE} />
                </>
              )}
              <Wire points={[[100, 170], [30, 170], [30, 140]]} current={total} scale={SCALE} />
              <Junction x={100} y={50} />
              <Junction x={100} y={170} />
              <Battery x={30} y={110} rot={90} value="6 V" />
              {parts.map((p, k) => (
                <React.Fragment key={p.name}>
                  <Resistor x={100 + k * 80} y={110} rot={90} />
                  <Label x={114 + k * 80} y={92} anchor="start">
                    {p.name}
                  </Label>
                  <Label x={114 + k * 80} y={107} anchor="start" muted>
                    {formatSI(p.r, "Ω")}
                  </Label>
                  <Label x={114 + k * 80} y={122} anchor="start" color={trace.voltage}>
                    {formatSI(p.v, "V")}
                  </Label>
                  <Label x={114 + k * 80} y={137} anchor="start" color={trace.current}>
                    {formatSI(p.i, "A")}
                  </Label>
                </React.Fragment>
              ))}
            </Schematic>
          )}
          {/* how the shared quantity is split: voltage in series, current in parallel */}
          <div className="min-w-0">
            <p className="text-small font-medium">{series ? "电源的 6 V 怎么分" : `总电流 ${formatSI(total, "A")} 怎么分`}</p>
            <p className="text-caption text-muted-foreground">{series ? "阻值越大，分到的电压越多。" : "阻值越小，分到的电流越多。"}</p>
            <ul className="mt-3 grid gap-2.5">
              {parts.map((p) => {
                const share = series ? p.v / V : p.i / total
                return (
                  <li key={p.name} className="grid grid-cols-[1.75rem_minmax(0,1fr)_7rem] items-center gap-2 text-small">
                    <span className="font-medium">{p.name}</span>
                    <span aria-hidden className="h-2 overflow-hidden rounded-full bg-input">
                      <span className="block h-full rounded-full" style={{ width: `${share * 100}%`, background: series ? trace.voltage : trace.current }} />
                    </span>
                    <span className="tabular text-right text-muted-foreground">
                      {series ? formatSI(p.v, "V") : formatSI(p.i, "A")} · {percent(share)}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </LabStage>
      <LabControls>
        <ControlField label="接法">
          <Segmented
            aria-label="接法"
            value={mode}
            onValueChange={setMode}
            options={[
              { value: "series", label: "串联" },
              { value: "parallel", label: "并联" },
            ]}
          />
        </ControlField>
        <SwitchField label="接入第三只电阻 R3" checked={three} onChange={setThree} />
        <SliderField label="电阻 R1" value={r1} onChange={setR1} min={100} max={10000} log snap="E24" unit="Ω" />
        <SliderField label="电阻 R2" value={r2} onChange={setR2} min={100} max={10000} log snap="E24" unit="Ω" />
        <SliderField label="电阻 R3" value={r3} onChange={setR3} min={100} max={10000} log snap="E24" unit="Ω" disabled={!three} />
      </LabControls>
      <LabReadouts>
        <Readout label="电源电压" value={formatSI(V, "V")} color={trace.voltage} />
        <Readout label={series ? "等效电阻 = 各电阻相加" : "等效电阻 = 倒数相加再取倒数"} value={formatSI(req, "Ω")} />
        <Readout label="总电流 = 电压 ÷ 等效电阻" value={formatSI(total, "A")} color={trace.current} />
      </LabReadouts>
      <LabNote>{note}</LabNote>
    </Lab>
  )
}

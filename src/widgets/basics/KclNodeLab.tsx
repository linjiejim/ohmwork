import * as React from "react"
import { Arrow, Junction, Lab, LabControls, LabNote, LabReadouts, LabStage, Port, Readout, Schematic, SliderField, Wire, formatSI, trace } from "@/lab"

/** Current that reads as "fast" on the wires. The sliders stop at 10 mA. */
const SCALE = 0.005

/**
 * One node, three branches. Set the current coming in (I1) and the current one
 * branch takes away (I2); KCL fixes the third: I3 = I1 − I2. When I2 is the
 * larger, I3 turns negative: its real direction is into the node.
 */
export function KclNodeLab() {
  // sliders work in mA so the steps stay exact (0.5 mA), the model in amps
  const [in1, setIn1] = React.useState(5)
  const [out2, setOut2] = React.useState(3)
  const i1 = in1 / 1000
  const i2 = out2 / 1000
  const i3 = i1 - i2
  const reversed = i3 < 0
  const mA = (v: number) => formatSI(v / 1000, "A")

  let note: string
  if (i1 === 0 && i2 === 0) note = "三条支路都没有电流。0 = 0 + 0，定律照样成立。"
  else if (i3 === 0) note = `流进 ${formatSI(i1, "A")}，全部从支路 2 流走，支路 3 上没有电流。`
  else if (i2 === 0) note = `支路 2 上没有电流，流进来的 ${formatSI(i1, "A")} 全部从支路 3 流走。`
  else if (reversed) {
    const lead = i1 === 0 ? `I1 是 0，支路 2 却要流走 ${formatSI(i2, "A")}。这些电流` : `支路 2 要流走 ${formatSI(i2, "A")}，比 I1 送来的 ${formatSI(i1, "A")} 还多。差的 ${formatSI(-i3, "A")} `
    note = `${lead}只能由支路 3 补进来：I3 算出来是负数，说明它的实际方向和图上假设的相反，是流进节点的。`
  } else note = `流进节点 ${formatSI(i1, "A")}，流出 ${formatSI(i2, "A")} + ${formatSI(i3, "A")}。进多少，出多少，节点上不会攒下电荷。`

  return (
    <Lab
      title="节点上的电流"
      hint="调 I1 和 I2，I3 会自己变成让进出相等的那个值。"
      onReset={() => {
        setIn1(5)
        setOut2(3)
      }}
    >
      <LabStage>
        {/*
          Node at (140, 75). I1 arrives from (30, 75); I2 leaves along the top to (270, 30); I3 along the bottom to (270, 120).
          Arrows with their values: I1 under its wire (y = 89), I2 and I3 inside the fork (y = 42 and y = 108).
        */}
        <Schematic width={300} height={150} label="一个节点连着三条支路：一条流入，两条流出">
          <Wire points={[[30, 75], [140, 75]]} current={i1} scale={SCALE} />
          <Wire points={[[140, 75], [140, 30], [270, 30]]} current={i2} scale={SCALE} />
          <Wire points={[[140, 75], [140, 120], [270, 120]]} current={i3} scale={SCALE} />
          <Junction x={140} y={75} />
          <Port x={30} y={75} />
          <Port x={270} y={30} />
          <Port x={270} y={120} />
          <Arrow from={[55, 89]} to={[115, 89]} label={`I1 = ${formatSI(i1, "A")}`} color={trace.current} />
          <Arrow from={[175, 42]} to={[235, 42]} label={`I2 = ${formatSI(i2, "A")}`} color={trace.current} />
          {reversed ? (
            <Arrow from={[235, 108]} to={[175, 108]} label={`流入 ${formatSI(-i3, "A")}`} color={trace.current} />
          ) : (
            <Arrow from={[175, 108]} to={[235, 108]} label={`I3 = ${formatSI(i3, "A")}`} color={trace.current} labelSide={-1} />
          )}
        </Schematic>
      </LabStage>
      <LabControls>
        <SliderField label="流进节点的 I1" value={in1} onChange={setIn1} min={0} max={10} step={0.5} format={mA} color={trace.current} />
        <SliderField label="支路 2 流走的 I2" value={out2} onChange={setOut2} min={0} max={10} step={0.5} format={mA} color={trace.current} />
      </LabControls>
      <LabReadouts>
        <Readout label="I1（流入）" value={formatSI(i1, "A")} color={trace.current} />
        <Readout label="I2（流出）" value={formatSI(i2, "A")} color={trace.current} />
        <Readout label="I3 = I1 − I2" value={formatSI(i3, "A")} color={trace.current} sub={reversed ? "负号：实际是流入" : "流出"} />
      </LabReadouts>
      <LabNote tone={reversed ? "warn" : "neutral"}>{note}</LabNote>
    </Lab>
  )
}

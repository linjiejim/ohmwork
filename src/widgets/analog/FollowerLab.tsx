import * as React from "react"
import { Ground, Junction, Lab, LabControls, LabNote, LabReadouts, LabStage, Label, OpAmp, Plot, Rail, Readout, Resistor, Schematic, SliderField, SwitchField, Wire, formatSI, parallel, percent, trace } from "@/lab"

const VS = 5
const R1 = 10e3
const R2 = 10e3
const V_OPEN = (VS * R2) / (R1 + R2) // 2.5 V with nothing connected
const I_MAX = 0.02 // what this op-amp's output can deliver

/** The divider feeding the load directly: the load sits in parallel with R2. */
const direct = (rl: number) => {
  const lower = parallel(R2, rl)
  return (VS * lower) / (R1 + lower)
}
/** Through a follower: the output copies the tap, until the output current limit. */
const buffered = (rl: number) => Math.min(V_OPEN, I_MAX * rl)

/** A loaded voltage divider, with and without a voltage follower in between. */
export function FollowerLab() {
  const [rl, setRl] = React.useState(1000)
  const [buffer, setBuffer] = React.useState(false)

  const v = buffer ? buffered(rl) : direct(rl)
  const iLoad = v / rl
  const tap = buffer ? V_OPEN : v
  const limited = buffer && I_MAX * rl < V_OPEN
  const drop = 1 - v / V_OPEN
  const color = buffer ? trace.good : trace.voltage

  let tone: "neutral" | "good" | "warn" = "neutral"
  let note: string
  if (buffer && limited) {
    tone = "warn"
    note = `${formatSI(rl, "Ω")} 的负载在 2.5 V 下要 ${formatSI(V_OPEN / rl, "A")}，超过了这只运放 20 mA 的输出能力，电压掉到 ${formatSI(v, "V")}。跟随器也不是什么都带得动。`
  } else if (buffer) {
    tone = "good"
    note = `运放的输入端不取电流，分压点稳稳停在 2.5 V；输出端跟着它也是 2.5 V，负载要的 ${formatSI(iLoad, "A")} 全部由运放的电源提供。`
  } else if (drop > 0.05) {
    tone = "warn"
    note = `负载和 R2 并联，下面这一臂从 10 kΩ 变成了 ${formatSI(parallel(R2, rl), "Ω")}，电压从 2.5 V 掉到 ${formatSI(v, "V")}（少了 ${percent(drop)}）。`
  } else {
    note = `负载比分压电阻大得多，只抽走 ${formatSI(iLoad, "A")}，电压只掉了 ${percent(drop, 1)}。负载越小，掉得越多。`
  }

  return (
    <Lab
      title="分压器带负载：直接接和加跟随器"
      hint="先把负载电阻往小拖，看电压怎么掉下去；再打开跟随器。"
      onReset={() => {
        setRl(1000)
        setBuffer(false)
      }}
    >
      <LabStage>
        <div className="grid items-center gap-x-6 gap-y-4 @xl:grid-cols-[auto_minmax(0,1fr)]">
          {/*
           * Divider on x = 60: rail (60, 30), R1 (60, 60), tap (60, 95), R2 (60, 130), ground (60, 160).
           * Load RL (232, 140): top (232, 110), bottom (232, 170).
           * Follower: op-amp (150, 109), + on top → + (110, 95), − (110, 123), output (194, 109);
           * its supply pin meets the sloped top edge at (150, 94).
           */}
          <Schematic width={300} height={196} label={buffer ? "分压器经过电压跟随器再接负载" : "分压器直接接负载"}>
            <Rail x={60} y={30} label="5 V" />
            <Resistor x={60} y={60} rot={90} label="R1" value="10 kΩ" labelSide="left" />
            <Wire points={[[60, 90], [60, 100]]} />
            <Resistor x={60} y={130} rot={90} label="R2" value="10 kΩ" labelSide="left" />
            <Ground x={60} y={160} />
            <Junction x={60} y={95} />
            <Resistor x={232} y={140} rot={90} label="RL" value={formatSI(rl, "Ω")} />
            <Ground x={232} y={170} />
            {buffer ? (
              <>
                <Wire points={[[60, 95], [110, 95]]} current={0} scale={0.002} />
                <Wire points={[[150, 56], [150, 94]]} current={iLoad} scale={0.002} />
                <Rail x={150} y={56} label="5 V" />
                <Wire points={[[194, 109], [194, 152], [100, 152], [100, 123], [110, 123]]} />
                <Wire points={[[194, 109], [232, 109], [232, 110]]} current={iLoad} scale={0.002} />
                <OpAmp x={150} y={109} plusOnTop />
                <Junction x={194} y={109} />
                <Label x={88} y={87} color={trace.voltage}>
                  {formatSI(tap, "V")}
                </Label>
                <Label x={240} y={99} color={color}>
                  {formatSI(v, "V")}
                </Label>
              </>
            ) : (
              <>
                <Wire points={[[60, 95], [232, 95], [232, 110]]} current={iLoad} scale={0.002} />
                <Label x={146} y={86} color={color}>
                  {formatSI(v, "V")}
                </Label>
              </>
            )}
          </Schematic>
          <Plot
            height={220}
            x={{ min: 10, max: 1e6, log: true, label: "负载电阻 (Ω)" }}
            y={{ min: 0, max: 3, label: "负载上的电压 (V)" }}
            series={[
              { fn: direct, label: "直接接负载", color: trace.voltage, dashed: buffer },
              { fn: buffered, label: "经过跟随器", color: trace.good, dashed: !buffer },
            ]}
            markers={[{ x: rl, y: v, color }]}
          />
        </div>
      </LabStage>
      <LabControls>
        <SliderField label="负载电阻 RL" value={rl} onChange={setRl} min={10} max={1e6} log snap="E12" unit="Ω" />
        <SwitchField label="接入电压跟随器" checked={buffer} onChange={setBuffer} hint="在分压点和负载之间加一级运放" />
      </LabControls>
      <LabReadouts>
        <Readout label="空载时的分压" value={formatSI(V_OPEN, "V")} />
        <Readout label="负载上的电压" value={formatSI(v, "V")} color={color} />
        <Readout label="从分压点抽走的电流" value={buffer ? "≈ 0" : formatSI(iLoad, "A")} color={trace.current} sub={buffer ? "运放输入端不取电流" : "全部流进负载"} />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

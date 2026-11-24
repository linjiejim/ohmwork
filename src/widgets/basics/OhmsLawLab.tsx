import * as React from "react"
import { Battery, Lab, LabControls, LabNote, LabReadouts, LabStage, Label, Plot, Readout, Resistor, Schematic, SliderField, Tex, Wire, formatSI, tex, trace } from "@/lab"

/** Battery + resistor loop beside its I–V line: change V or R, watch the current and the operating point move. */
export function OhmsLawLab({ compact }: { /** Shorter version for the home page. */ compact?: boolean }) {
  const [v, setV] = React.useState(6)
  const [r, setR] = React.useState(330)
  const i = v / r
  return (
    <Lab
      title="欧姆定律实验台"
      hint={compact ? undefined : "拖动滑块：电压升高或电阻减小，电流都会变大。蓝点的快慢代表电流大小。"}
      onReset={() => {
        setV(6)
        setR(330)
      }}
    >
      <LabStage>
        <div className="grid items-center gap-x-6 gap-y-4 @xl:grid-cols-[auto_minmax(0,1fr)]">
          <Schematic width={250} height={180} label="一节电池接一只电阻组成的回路">
            <Label x={125} y={19} color={trace.current}>
              I = {formatSI(i, "A")}
            </Label>
            <Wire points={[[40, 60], [40, 30], [210, 30], [210, 60]]} current={i} scale={0.05} />
            <Wire points={[[210, 120], [210, 150], [40, 150], [40, 120]]} current={i} scale={0.05} />
            <Battery x={40} y={90} rot={90} label="电池" value={formatSI(v, "V")} />
            <Resistor x={210} y={90} rot={90} label="电阻" value={formatSI(r, "Ω")} labelSide="left" />
          </Schematic>
          <Plot
            height={compact ? 170 : 200}
            x={{ min: 0, max: 12, label: "电压 (V)" }}
            y={{ min: 0, max: 120, label: "电流 (mA)" }}
            series={[{ fn: (x) => (x / r) * 1000, label: `这只 ${formatSI(r, "Ω")} 电阻的伏安特性`, color: trace.current }]}
            markers={[{ x: v, y: i * 1000, label: formatSI(i, "A"), color: trace.current }]}
          />
        </div>
      </LabStage>
      <LabControls>
        <SliderField label="电压 V" value={v} onChange={setV} min={0} max={12} step={0.1} unit="V" color={trace.voltage} />
        <SliderField label="电阻 R" value={r} onChange={setR} min={100} max={10000} log snap="E12" unit="Ω" />
      </LabControls>
      {compact ? (
        <LabNote>
          <Tex>{`I = \\frac{V}{R} = \\frac{${tex.si(v, "V")}}{${tex.si(r, "Ω")}} = ${tex.si(i, "A")}`}</Tex>
        </LabNote>
      ) : (
        <LabReadouts>
          <Readout label="电压 V" value={formatSI(v, "V")} color={trace.voltage} />
          <Readout label="电阻 R" value={formatSI(r, "Ω")} />
          <Readout label={<>电流 <Tex>{"I = V/R"}</Tex></>} value={formatSI(i, "A")} color={trace.current} />
        </LabReadouts>
      )}
    </Lab>
  )
}

import * as React from "react"
import { catVar } from "@/lib/categorical"
import { Battery, Lab, LabControls, LabNote, LabReadouts, LabStage, Label, Readout, Resistor, Schematic, SliderField, Switch, SwitchField, Wire, formatSI, lerp, trace } from "@/lab"

const WATER = catVar("teal")

/** The water analogy next to the real thing: pump ↔ battery, narrow pipe ↔ resistor, valve ↔ switch. */
export function WaterCircuitLab() {
  const [v, setV] = React.useState(6)
  const [r, setR] = React.useState(300)
  const [on, setOn] = React.useState(true)
  const i = on ? v / r : 0
  // the narrow pipe gets thinner as resistance grows (log scale, like the slider)
  const bore = lerp(13, 2.5, Math.log(r / 100) / Math.log(20))
  return (
    <Lab
      title="水路和电路"
      hint="左边是水，右边是电。调电压和电阻，再把回路断开试试。"
      onReset={() => {
        setV(6)
        setR(300)
        setOn(true)
      }}
    >
      <LabStage>
        <div className="flex flex-wrap justify-center gap-x-10 gap-y-4">
          <figure>
            <Schematic width={250} height={180} label="水泵推着水流过一段细管的闭合水路">
              <path d="M40 30H210V150H40Z" stroke="var(--input)" strokeWidth={16} />
              {/* the narrow section, with funnels at both ends */}
              <path d="M210 58V122" stroke="var(--sunken)" strokeWidth={18} strokeLinecap="butt" />
              <path d={`M202 58H218L${210 + bore / 2} 72V108L218 122H202L${210 - bore / 2} 108V72Z`} fill="var(--input)" stroke="none" />
              <Wire points={[[40, 150], [40, 30], [210, 30], [210, 150], [40, 150]]} current={i} scale={0.06} color="none" dotColor={WATER} />
              {/* valve */}
              <path d="M116 22L134 38V22L116 38Z" fill={on ? "var(--background)" : "currentColor"} />
              <Label x={125} y={14} muted>
                阀门{on ? "（开）" : "（关）"}
              </Label>
              {/* pump */}
              <circle cx={40} cy={90} r={17} fill="var(--background)" />
              <path d="M33 96L40 82L47 96Z" fill={WATER} stroke="none" />
              <Label x={64} y={86} anchor="start">
                水泵
              </Label>
              <Label x={64} y={102} anchor="start" muted>
                提供水压
              </Label>
              <Label x={194} y={86} anchor="end">
                细管
              </Label>
              <Label x={194} y={102} anchor="end" muted>
                阻碍水流
              </Label>
            </Schematic>
            <figcaption className="mt-1 text-center text-caption text-muted-foreground">水路：水泵 → 细管 → 回到水泵</figcaption>
          </figure>
          <figure>
            <Schematic width={250} height={180} label="电池、开关和电阻组成的闭合电路">
              <Wire points={[[40, 60], [40, 30], [95, 30]]} current={i} scale={0.06} />
              <Wire points={[[155, 30], [210, 30], [210, 60]]} current={i} scale={0.06} />
              <Wire points={[[210, 120], [210, 150], [40, 150], [40, 120]]} current={i} scale={0.06} />
              <Switch x={125} y={30} closed={on} onClick={() => setOn((o) => !o)} label="开关" labelSide="bottom" />
              <Battery x={40} y={90} rot={90} label="电池" value="提供电压" />
              <Resistor x={210} y={90} rot={90} label="电阻" value="阻碍电流" labelSide="left" />
            </Schematic>
            <figcaption className="mt-1 text-center text-caption text-muted-foreground">电路：电池 → 电阻 → 回到电池</figcaption>
          </figure>
        </div>
      </LabStage>
      <LabControls columns={3}>
        <SliderField label="电压（水压）" value={v} onChange={setV} min={1} max={12} step={0.5} unit="V" color={trace.voltage} />
        <SliderField label="电阻（管子越细越大）" value={r} onChange={setR} min={100} max={2000} log unit="Ω" />
        <SwitchField label="接通回路" checked={on} onChange={setOn} />
      </LabControls>
      <LabReadouts>
        <Readout label="电压" value={formatSI(v, "V")} color={trace.voltage} />
        <Readout label="电阻" value={formatSI(r, "Ω")} />
        <Readout label="电流" value={formatSI(i, "A")} color={trace.current} />
      </LabReadouts>
      <LabNote tone={on ? "neutral" : "warn"}>
        {on
          ? `${formatSI(v, "V")} 的电压推着电荷流过 ${formatSI(r, "Ω")} 的电阻，形成 ${formatSI(i, "A")} 的电流。`
          : "回路断开了：电池的电压还在，但电荷无路可走，电流是 0。"}
      </LabNote>
    </Lab>
  )
}

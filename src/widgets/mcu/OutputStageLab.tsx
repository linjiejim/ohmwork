import * as React from "react"
import {
  ControlField,
  Ground,
  Junction,
  Lab,
  LabControls,
  LabNote,
  LabReadouts,
  LabStage,
  Label,
  Mosfet,
  Port,
  Rail,
  Readout,
  Resistor,
  Schematic,
  Segmented,
  SwitchField,
  Wire,
  formatSI,
  trace,
} from "@/lab"

const VDD = 3.3
const R_PULL = 4700

/**
 * The two transistors behind an output pin. Push-pull drives both ways;
 * open-drain can only pull low, so a "1" needs an external pull-up — without
 * one the pin is left floating.
 */
export function OutputStageLab() {
  const [kind, setKind] = React.useState<"pp" | "od">("pp")
  const [out, setOut] = React.useState<"1" | "0">("1")
  const [pullup, setPullup] = React.useState(false)

  const pOn = kind === "pp" && out === "1"
  const nOn = out === "0"
  const pin: "high" | "low" | "float" = nOn ? "low" : pOn || pullup ? "high" : "float"
  // the only current in this picture: pull-up → pin → lower transistor → ground
  const i = nOn && pullup ? VDD / R_PULL : 0
  const pinText = pin === "high" ? "3.3 V" : pin === "low" ? "0 V" : "悬空"
  const upper = kind === "od" ? "不用" : pOn ? "导通" : "关断"
  const lower = nOn ? "导通" : "关断"

  let tone: "neutral" | "good" | "warn" = "neutral"
  let note: string
  if (kind === "pp") {
    note =
      out === "1"
        ? `推挽输出 1：上管导通，把引脚接到 3.3 V，可以向外供电流（拉电流）。${pullup ? "外接的上拉这时不起作用。" : ""}`
        : `推挽输出 0：下管导通，把引脚接到地，可以吸收流进来的电流（灌电流）。${pullup ? `上拉电阻上白白流着 ${formatSI(i, "A")}。` : ""}`
  } else if (out === "0") {
    note = `开漏输出 0：下管导通，引脚被拉到地。${pullup ? `上拉电阻上流过 ${formatSI(i, "A")}。` : ""}`
  } else if (pullup) {
    tone = "good"
    note = "开漏输出 1：下管关断，芯片「放手」，由外面的上拉电阻把引脚拉到 3.3 V。"
  } else {
    tone = "warn"
    note = "开漏输出 1，却没有上拉：没有管子导通，引脚处于高阻，电平没人决定。开漏输出必须配上拉电阻。"
  }

  /*
   * Layout (300 × 200). Chip boundary: dashed box x 16–150, y 6–194.
   *   control box x 24–44, y 66–146 → gates at (56, 76) and (56, 136)
   *   P-MOSFET (86, 76) flipped: source (100, 46) on the rail, drain (100, 106)
   *   N-MOSFET (86, 136): drain (100, 106), source (100, 166) on ground
   *   output node (100, 106) → pad (150, 106) → (200, 106) → port (250, 106)
   *   external pull-up (200, 76) vertical: A (200, 46) on its rail, B (200, 106)
   */
  return (
    <Lab
      title="推挽输出和开漏输出"
      hint="切换输出类型，让程序写 1 或 0，看哪只管子导通、引脚是什么电平。"
      onReset={() => {
        setKind("pp")
        setOut("1")
        setPullup(false)
      }}
    >
      <LabStage>
        <Schematic width={300} height={200} label="输出引脚内部的上管和下管，以及外接的上拉电阻">
          <rect x={16} y={6} width={134} height={188} rx={6} stroke="var(--input)" strokeDasharray="4 4" />
          <Label x={24} y={21} anchor="start" muted>
            芯片内部
          </Label>
          <rect x={24} y={66} width={20} height={80} rx={3} />
          <Label x={34} y={162} muted>
            控制
          </Label>
          <Wire points={[[44, 76], [56, 76]]} />
          <Wire points={[[44, 136], [56, 136]]} />
          <Rail x={100} y={46} label="3.3 V" />
          <Mosfet type="p" flip x={86} y={76} dim={!pOn} />
          <Mosfet type="n" x={86} y={136} dim={!nOn} />
          {/* names beside the transistors (kept out of the parts so they do not fade with them) */}
          <Label x={114} y={73} anchor="start">
            上管
          </Label>
          <Label x={114} y={88} anchor="start" muted>
            {upper}
          </Label>
          <Label x={114} y={133} anchor="start">
            下管
          </Label>
          <Label x={114} y={148} anchor="start" muted>
            {lower}
          </Label>
          <Ground x={100} y={166} />
          <Wire points={[[100, 106], [250, 106]]} />
          <Junction x={100} y={106} />
          <rect x={146} y={102} width={8} height={8} fill="var(--background)" />
          {pullup && (
            <>
              <Rail x={200} y={46} label="3.3 V" />
              <Resistor x={200} y={76} rot={90} label="外接上拉" value={formatSI(R_PULL, "Ω")} />
              <Junction x={200} y={106} />
              <Wire points={[[200, 46], [200, 106], [100, 106], [100, 166]]} current={i} scale={0.0007} color="none" />
            </>
          )}
          <Port x={250} y={106} label="引脚" />
          <Label x={200} y={130} color={pin === "float" ? undefined : trace.voltage} muted={pin === "float"}>
            {pinText}
          </Label>
        </Schematic>
      </LabStage>
      <LabControls columns={3}>
        <ControlField label="输出类型">
          <Segmented
            aria-label="输出类型"
            value={kind}
            onValueChange={setKind}
            options={[
              { value: "pp", label: "推挽" },
              { value: "od", label: "开漏" },
            ]}
          />
        </ControlField>
        <ControlField label="程序往引脚写">
          <Segmented
            aria-label="程序往引脚写"
            value={out}
            onValueChange={setOut}
            options={[
              { value: "1", label: "1" },
              { value: "0", label: "0" },
            ]}
          />
        </ControlField>
        <SwitchField label="外接上拉电阻" checked={pullup} onChange={setPullup} />
      </LabControls>
      <LabReadouts>
        <Readout label="上管" value={upper} />
        <Readout label="下管" value={lower} />
        <Readout label="引脚" value={pin === "high" ? "3.3 V（高）" : pin === "low" ? "0 V（低）" : "高阻（悬空）"} color={trace.voltage} />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

import { Bjt, Chip, Ground, Junction, Label, OpAmp, Port, Rail, Resistor, Schematic, Wire, chipPins, type ChipSpec } from "@/lab"

// RS latch body (250, 126), 50 × 110: R (211, 86), S (211, 166), Q (289, 86), Q̄ (250, 195)
const LATCH: ChipSpec = { x: 250, y: 126, w: 50, h: 110, pitch: 80, left: ["R", "S"], right: ["Q", ""], bottom: ["Q"] }
const PIN = chipPins(LATCH) // PIN.Q is the bottom pin (the later "Q" wins); the right-hand Q is at (289, 86)

/**
 * Simplified inside of a 555, for a static <Figure>:
 * a 5k–5k–5k divider makes 2/3 and 1/3 VCC, two comparators watch pins 6 and 2,
 * an RS latch remembers the state, a transistor discharges pin 7.
 *
 * Divider on x = 50: rail (50, 30), taps at (50, 100) and (50, 180), ground (50, 250).
 * Comparator A (150, 86), + on top: + (110, 72) ← pin 6, − (110, 100) ← 2/3 tap, output (194, 86).
 * Comparator B (150, 166), − on top: − (110, 152) ← pin 2, + (110, 180) ← 1/3 tap, output (194, 166).
 * Discharge transistor (286, 232): base (256, 232), collector (300, 202), emitter (300, 262).
 */
export function Timer555Inside() {
  return (
    <Schematic width={340} height={290} label="555 内部的简化框图：分压电阻、两个比较器、RS 触发器和放电管">
      <Rail x={50} y={30} label="8 电源" />
      <Resistor x={50} y={60} rot={90} value="5 kΩ" labelSide="left" />
      <Wire points={[[50, 90], [50, 110]]} />
      <Resistor x={50} y={140} rot={90} value="5 kΩ" labelSide="left" />
      <Wire points={[[50, 170], [50, 190]]} />
      <Resistor x={50} y={220} rot={90} value="5 kΩ" labelSide="left" />
      <Ground x={50} y={250} />
      <Label x={68} y={266} anchor="start" muted>
        1 地
      </Label>

      <Junction x={50} y={100} />
      <Wire points={[[50, 100], [110, 100]]} />
      <Label x={82} y={115} muted>
        2/3
      </Label>
      <Junction x={50} y={180} />
      <Wire points={[[50, 180], [110, 180]]} />
      <Label x={82} y={195} muted>
        1/3
      </Label>

      <Wire points={[[86, 72], [110, 72]]} />
      <Port x={86} y={72} label="6 阈值" side="top" />
      <OpAmp x={150} y={86} plusOnTop label="比较器 A" />
      <Wire points={[[194, 86], PIN.R]} />

      <Wire points={[[86, 152], [110, 152]]} />
      <Port x={86} y={152} label="2 触发" side="top" />
      <OpAmp x={150} y={166} label="比较器 B" />
      <Wire points={[[194, 166], PIN.S]} />

      <Chip {...LATCH} label="RS" sub="触发器" />
      {/* the bar that turns the bottom pin's "Q" into Q̄ */}
      <path d="M245.5 166.5H254.5" strokeWidth={1.25} />
      <Wire points={[[289, 86], [316, 86]]} />
      <Port x={316} y={86} label="3 输出" side="top" />

      <Wire points={[PIN.Q, [250, 232], [256, 232]]} />
      <Bjt x={286} y={232} />
      <Wire points={[[300, 202], [300, 190], [316, 190]]} />
      <Port x={316} y={190} label="7 放电" side="top" />
      <Ground x={300} y={262} />
    </Schematic>
  )
}

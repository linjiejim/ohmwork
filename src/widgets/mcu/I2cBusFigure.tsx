import { Chip, Junction, Label, Rail, Resistor, Schematic, Wire, chipPins, trace, type ChipSpec } from "@/lab"

/*
 * Layout (340 × 230).
 *   pull-ups: vertical resistors at (30, 60) and (60, 60): A ends (30, 30) and (60, 30) joined under the rail at (45, 30),
 *             B ends (30, 90) and (60, 90)
 *   SDA: from (60, 90) down to y 100, then right to x 320
 *   SCL: from (30, 90) down to y 130, then right to x 320 (it passes x 60 below the SDA corner, so nothing crosses there)
 *   chips: bodies y 160–220, centres x 120 / 205 / 290, top pins end at y 146: SDA at x − 15, SCL at x + 15
 *   each SDA pin wire crosses the SCL line (no dot) on its way up to y 100
 */
const CHIPS: (ChipSpec & { label: string; sub: string })[] = [
  { x: 120, y: 190, w: 70, h: 60, top: ["SDA", "SCL"], pitch: 30, label: "主机", sub: "单片机" },
  { x: 205, y: 190, w: 70, h: 60, top: ["SDA", "SCL"], pitch: 30, label: "从机", sub: "0x48" },
  { x: 290, y: 190, w: 70, h: 60, top: ["SDA", "SCL"], pitch: 30, label: "从机", sub: "0x3C" },
]
const SDA_Y = 100
const SCL_Y = 130

/** An I²C bus: every device hangs on the same two open-drain lines, which two resistors pull up. */
export function I2cBusFigure() {
  return (
    <Schematic width={340} height={230} label="一个主机和两个从机并联在 SDA、SCL 两根线上，两根线各有一只上拉电阻接到 3.3 V">
      <Wire points={[[30, 30], [60, 30]]} />
      <Rail x={45} y={30} label="3.3 V" />
      <Resistor x={30} y={60} rot={90} />
      <Resistor x={60} y={60} rot={90} label="上拉" value="4.7 kΩ × 2" />
      <Wire points={[[60, 90], [60, SDA_Y], [320, SDA_Y]]} color={trace.second} />
      <Wire points={[[30, 90], [30, SCL_Y], [320, SCL_Y]]} color={trace.voltage} />
      <Label x={320} y={SDA_Y - 6} anchor="end" color={trace.second}>
        SDA
      </Label>
      <Label x={320} y={SCL_Y - 6} anchor="end" color={trace.voltage}>
        SCL
      </Label>
      {CHIPS.map((chip) => {
        const pins = chipPins(chip)
        return (
          <g key={chip.x}>
            <Wire points={[pins.SDA, [pins.SDA[0], SDA_Y]]} color={trace.second} />
            <Junction x={pins.SDA[0]} y={SDA_Y} color={trace.second} />
            <Wire points={[pins.SCL, [pins.SCL[0], SCL_Y]]} color={trace.voltage} />
            <Junction x={pins.SCL[0]} y={SCL_Y} color={trace.voltage} />
            <Chip {...chip} />
          </g>
        )
      })}
    </Schematic>
  )
}

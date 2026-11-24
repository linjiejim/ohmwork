import { Chip, Label, Schematic, Wire, chipPins, trace, type ChipSpec } from "@/lab"

/*
 * Layout (320 × 135).
 *   MCU body x 25–115, y 30–120; right pins end at x 129: TX y 55, RX y 75, GND y 95
 *   module body x 205–295; left pins end at x 191: TX y 55, RX y 75, GND y 95
 *   the two data wires swap rows between x 150 and x 170
 */
const MCU: ChipSpec = { x: 70, y: 75, w: 90, h: 90, right: ["TX", "RX", "GND"] }
const MODULE: ChipSpec = { x: 250, y: 75, w: 90, h: 90, left: ["TX", "RX", "GND"] }

/** UART wiring between two devices: TX crosses over to RX, grounds are joined. */
export function UartWiringFigure() {
  const a = chipPins(MCU)
  const b = chipPins(MODULE)
  return (
    <Schematic width={320} height={135} label="单片机的 TX 接模块的 RX，单片机的 RX 接模块的 TX，两边的 GND 相连">
      <Wire points={[a.TX, [150, 55], [170, 75], b.RX]} color={trace.voltage} />
      <Wire points={[a.RX, [150, 75], [170, 55], b.TX]} color={trace.second} />
      <Wire points={[a.GND, b.GND]} />
      <Label x={160} y={112} muted>
        共地
      </Label>
      <Chip {...MCU} label="单片机" />
      <Chip {...MODULE} label="模块" />
    </Schematic>
  )
}

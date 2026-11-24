import { Label, Resistor, Schematic, Wire } from "@/lab"

/*
 * Static figure (340 × 110): the same resistor in the two drawing standards.
 *   American (ANSI) zigzag at (90, 60):  leads (40, 60)–(60, 60) and (120, 60)–(140, 60)
 *   GB / IEC rectangle   at (250, 60):  leads (200, 60)–(220, 60) and (280, 60)–(300, 60)
 *   designator + value above each part (y 30 / 45), the standard's name below (y 96)
 */
export function SymbolStylesFigure() {
  return (
    <Schematic width={340} height={110} label="同一只 10 kΩ 电阻的两种画法：左边美标折线，右边国标和 IEC 的矩形">
      <Wire points={[[40, 60], [60, 60]]} />
      <Wire points={[[120, 60], [140, 60]]} />
      <Resistor x={90} y={60} label="R1" value="10k" />
      <Label x={90} y={96} muted>
        美标（ANSI）
      </Label>
      <Wire points={[[200, 60], [220, 60]]} />
      <Wire points={[[280, 60], [300, 60]]} />
      <Resistor x={250} y={60} variant="iec" label="R1" value="10k" />
      <Label x={250} y={96} muted>
        国标 / IEC
      </Label>
    </Schematic>
  )
}

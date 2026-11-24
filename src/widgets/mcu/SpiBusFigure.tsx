import { Chip, Junction, Label, Schematic, Wire, chipPins, trace, type ChipSpec } from "@/lab"

/*
 * Layout (320 × 235).
 *   master body x 20–100, y 55–175; right pins end at x 114: CS1 y 75, SCK y 95, MOSI y 115, MISO y 135, CS2 y 155
 *   slave A body x 230–310, y 20–110; left pins end at x 216: CS y 35, SCK y 55, MOSI y 75, MISO y 95
 *   slave B body x 230–310, y 130–220; left pins end at x 216: MISO y 145, MOSI y 165, SCK y 185, CS y 205
 *   shared lines run on vertical trunks: SCK x 140 (y 55–185), MOSI x 160 (y 75–165), MISO x 180 (y 95–145)
 *   CS1 goes round the top (x 125, y 35), CS2 round the bottom (x 125, y 205): neither crosses a trunk
 *   crossings without a dot: the MOSI stub over the SCK trunk, the MISO stub over the SCK and MOSI trunks
 */
const MASTER: ChipSpec = { x: 60, y: 115, w: 80, h: 120, right: ["CS1", "SCK", "MOSI", "MISO", "CS2"] }
const SLAVE_A: ChipSpec = { x: 270, y: 65, w: 80, h: 90, left: ["CS", "SCK", "MOSI", "MISO"] }
const SLAVE_B: ChipSpec = { x: 270, y: 175, w: 80, h: 90, left: ["MISO", "MOSI", "SCK", "CS"] }

/** One SPI master, two slaves: three shared lines plus a chip-select wire of its own for each slave. */
export function SpiBusFigure() {
  const m = chipPins(MASTER)
  const a = chipPins(SLAVE_A)
  const b = chipPins(SLAVE_B)
  return (
    <Schematic width={320} height={235} label="一个 SPI 主机接两个从机：SCK、MOSI、MISO 三根线共用，每个从机各有一根片选线">
      {/* chip selects: one private wire per slave */}
      <Wire points={[m.CS1, [125, 75], [125, 35], a.CS]} />
      <Wire points={[m.CS2, [125, 155], [125, 205], b.CS]} />
      {/* shared lines: a stub from the master onto a trunk that reaches both slaves */}
      <Wire points={[m.SCK, [140, 95]]} color={trace.voltage} />
      <Wire points={[a.SCK, [140, 55], [140, 185], b.SCK]} color={trace.voltage} />
      <Junction x={140} y={95} color={trace.voltage} />
      <Wire points={[m.MOSI, [160, 115]]} color={trace.second} />
      <Wire points={[a.MOSI, [160, 75], [160, 165], b.MOSI]} color={trace.second} />
      <Junction x={160} y={115} color={trace.second} />
      <Wire points={[m.MISO, [180, 135]]} color={trace.third} />
      <Wire points={[a.MISO, [180, 95], [180, 145], b.MISO]} color={trace.third} />
      <Junction x={180} y={135} color={trace.third} />
      <Chip {...MASTER} />
      <Label x={42} y={119.5} weight={600}>
        主机
      </Label>
      <Chip {...SLAVE_A} />
      <Label x={288} y={69.5} weight={600}>
        Flash
      </Label>
      <Chip {...SLAVE_B} />
      <Label x={288} y={179.5} weight={600}>
        屏幕
      </Label>
    </Schematic>
  )
}

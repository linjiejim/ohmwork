import { Chip, Label, Schematic, Wire, chipPins, type ChipSpec } from "@/lab"
import { NetFlag } from "./kit"

/*
 * Static figure (340 × 150): the same connection drawn twice.
 *   Row 1 (y 45): U1 box 20…80 × 30…60, pin PB7 ends at (94, 45); U2 box 260…320, pin SDA ends at (246, 45);
 *     one wire between them; caption "直接画线" at (170, 37) above the wire.
 *   Row 2 (y 125): the same chips; stubs to (104, 125) and (236, 125), flags 104…144 and 196…236;
 *     caption "用同名的网络标号" at (170, 104), above the flags (which start at y 117).
 *   Designators above each box at y 22 / 102.
 */
const ROWS = [45, 125]
const left = (y: number): ChipSpec => ({ x: 50, y, w: 60, h: 30, right: ["PB7"] })
const right = (y: number): ChipSpec => ({ x: 290, y, w: 60, h: 30, left: ["SDA"] })

export function NetLabelFigure() {
  const [a, b] = ROWS
  const a1 = chipPins(left(a))
  const a2 = chipPins(right(a))
  const b1 = chipPins(left(b))
  const b2 = chipPins(right(b))
  return (
    <Schematic width={340} height={150} label="单片机的 PB7 和传感器的 SDA 脚：上面用一根导线相连，下面各挂一个名为 SDA 的网络标号，两种画法电气上一样">
      {ROWS.map((y) => (
        <g key={y}>
          <Chip {...left(y)} />
          <Chip {...right(y)} />
          <Label x={50} y={y - 23} weight={600}>
            U1
          </Label>
          <Label x={290} y={y - 23} weight={600}>
            U2
          </Label>
        </g>
      ))}
      <Wire points={[a1.PB7, a2.SDA]} />
      <Label x={170} y={37} size={12} muted>
        直接画线
      </Label>
      <Wire points={[b1.PB7, [104, b]]} />
      <NetFlag x={104} y={b} name="SDA" />
      <Wire points={[[236, b], b2.SDA]} />
      <NetFlag x={236} y={b} name="SDA" side="left" />
      <Label x={170} y={104} size={12} muted>
        用同名的网络标号
      </Label>
    </Schematic>
  )
}

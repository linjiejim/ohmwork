import { Ground, Label, Rail, Schematic, Wire } from "@/lab"

/*
 * Static figure (340 × 124): a supply symbol and four kinds of ground, one per column.
 *   columns x = 34, 102, 170, 238, 306
 *   supply: rail at (34, 50) (bar y 40, x 26…42), wire down to y 78; its name goes below like the grounds'
 *   grounds: wire (x, 36)–(x, 60), symbol hanging from (x, 60) down to y 78
 *   chassis ground drawn by hand: bar y 68 from x−10 to x+10, three teeth slanting down-left to y 76
 *   names at y 98, one-word meaning at y 114
 */
const COLS = [34, 102, 170, 238, 306]

export function PowerGroundFigure() {
  const [p, g, a, pg, c] = COLS
  return (
    <Schematic width={340} height={124} label="电源符号 3V3，以及 GND、AGND、PGND 和机壳地四种地符号">
      <Rail x={p} y={50} />
      <Wire points={[[p, 50], [p, 78]]} />
      <Label x={p} y={98}>
        3V3
      </Label>
      <Label x={p} y={114} size={12} muted>
        3.3 V 电源
      </Label>

      {[
        { x: g, name: "GND", sub: "通用地" },
        { x: a, name: "AGND", sub: "模拟地" },
        { x: pg, name: "PGND", sub: "功率地" },
      ].map((item) => (
        <g key={item.name}>
          <Wire points={[[item.x, 36], [item.x, 60]]} />
          <Ground x={item.x} y={60} />
          <Label x={item.x} y={98}>
            {item.name}
          </Label>
          <Label x={item.x} y={114} size={12} muted>
            {item.sub}
          </Label>
        </g>
      ))}

      <Wire points={[[c, 36], [c, 68]]} />
      <path d={`M${c - 10} 68H${c + 10}M${c - 10} 68L${c - 15} 76M${c} 68L${c - 5} 76M${c + 10} 68L${c + 5} 76`} />
      <Label x={c} y={98}>
        机壳地
      </Label>
      <Label x={c} y={114} size={12} muted>
        接金属外壳
      </Label>
    </Schematic>
  )
}

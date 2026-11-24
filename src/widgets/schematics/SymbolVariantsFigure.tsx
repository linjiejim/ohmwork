import { Diode, Label, Mosfet, OpAmp, Schematic, Wire } from "@/lab"

/*
 * Static figure (340 × 178): one part, several drawings.
 *   Left, plain N-MOSFET at (40, 80): gate (10, 80), drain (54, 50), source (54, 110); "Q1 / AO3400" right of it at x 68.
 *   Middle, the same with its body diode: MOSFET at (150, 80): gate (120, 80), drain (164, 50), source (164, 110);
 *     diode at (186, 80) rot 270: anode (186, 110) at the source, cathode (186, 50) at the drain;
 *     wires (164, 50)–(186, 50) and (164, 110)–(186, 110); "Q1 / AO3400" at x 198.
 *   Right, a dual op-amp drawn as two units: U1A at (295, 45), U1B at (295, 115);
 *     each spans x 255…339, y ±28; its unit name sits inside the triangle at (x − 1, y + 4.5).
 *   Captions on y 168.
 */
export function SymbolVariantsFigure() {
  return (
    <Schematic width={340} height={178} label="同一个器件的几种画法：MOSFET 画不画体二极管，一颗双运放拆成 U1A 和 U1B 两个单元">
      <Mosfet x={40} y={80} label="Q1" value="AO3400" />
      <Label x={47} y={168} size={12} muted>
        简化画法
      </Label>

      <Mosfet x={150} y={80} />
      <Diode x={186} y={80} rot={270} />
      <Wire points={[[164, 50], [186, 50]]} />
      <Wire points={[[164, 110], [186, 110]]} />
      <Label x={198} y={77} anchor="start">
        Q1
      </Label>
      <Label x={198} y={92} anchor="start" muted>
        AO3400
      </Label>
      <Label x={160} y={168} size={12} muted>
        带体二极管
      </Label>

      <OpAmp x={295} y={45} />
      <Label x={294} y={49.5} size={12}>
        U1A
      </Label>
      <OpAmp x={295} y={115} />
      <Label x={294} y={119.5} size={12}>
        U1B
      </Label>
      <Label x={295} y={168} size={12} muted>
        双运放 LM358
      </Label>
    </Schematic>
  )
}

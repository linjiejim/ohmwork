import { Diode, Ground, Junction, Meter, Mosfet, Port, Rail, Resistor, Schematic, Wire } from "@/lab"

/** Static picture: the usual N-MOS low-side switch for a motor, with gate resistor, pull-down and flyback diode. */
export function MosfetGateFigure() {
  /*
   * N-MOS (210,120): gate (180,120), drain (224,90), source (224,150).
   * Motor (224,60) vertical: terminals (224,30) / (224,90). Rail at (224,30).
   * Flyback diode (270,60) pointing up: cathode (270,30), anode (270,90).
   * Port (60,120) → Rg (120,120): terminals (90,120) / (150,120) → gate.
   * Pull-down (165,160) vertical: terminals (165,130) / (165,190), from the gate node (165,120) to the ground wire y = 190.
   */
  return (
    <Schematic width={330} height={216} label="N 沟道 MOSFET 低边开关驱动电机：栅极串联电阻、下拉电阻和续流二极管">
      <Wire points={[[60, 120], [90, 120]]} />
      <Wire points={[[150, 120], [180, 120]]} />
      <Wire points={[[165, 120], [165, 130]]} />
      <Wire points={[[165, 190], [224, 190]]} />
      <Wire points={[[224, 150], [224, 190]]} />
      <Wire points={[[224, 30], [270, 30]]} />
      <Wire points={[[224, 90], [270, 90]]} />
      <Junction x={165} y={120} />
      <Junction x={224} y={190} />
      <Junction x={224} y={30} />
      <Junction x={224} y={90} />
      <Rail x={224} y={30} label="12 V" />
      <Meter x={224} y={60} rot={90} letter="M" label="电机" labelSide="left" />
      <Diode x={270} y={60} rot={270} label="续流" value="二极管" />
      <Mosfet x={210} y={120} label="N-MOS" />
      <Ground x={224} y={190} />
      <Resistor x={120} y={120} label="Rg" value="100 Ω" />
      <Resistor x={165} y={160} rot={90} label="下拉" value="10 kΩ" labelSide="left" />
      <Port x={60} y={120} label="引脚" side="left" />
    </Schematic>
  )
}

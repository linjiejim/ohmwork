import { Bjt, Diode, Ground, Inductor, Junction, Port, Rail, Resistor, Schematic, Wire } from "@/lab"

/**
 * Static figure: the standard way a microcontroller pin drives a relay coil.
 * An NPN transistor switches the coil's low side; a diode across the coil
 * (cathode to the supply) gives the coil current somewhere to go at turn-off.
 *
 * Coordinates: 5 V rail at (160,40). Coil (160,80) vertical: (160,50) – (160,110).
 * Diode (100,80) rot 270: cathode (100,50) on top, anode (100,110) below.
 * Transistor at (146,160): base (116,160), collector (160,130), emitter (160,190).
 * Base resistor (86,160): (56,160) – (116,160). GPIO port at (50,160). Ground at (160,200).
 */
export function RelayDriverFigure() {
  return (
    <Schematic width={280} height={226} label="单片机引脚经过 1 kΩ 电阻驱动 NPN 三极管，三极管接在继电器线圈和地之间，线圈两端反向并联一只续流二极管">
      <Rail x={160} y={40} label="5 V" />
      <Wire points={[[160, 40], [160, 50]]} />
      <Wire points={[[100, 50], [160, 50]]} />
      <Wire points={[[100, 110], [160, 110]]} />
      <Wire points={[[160, 110], [160, 130]]} />
      <Wire points={[[160, 190], [160, 200]]} />
      <Wire points={[[50, 160], [56, 160]]} />
      <Junction x={160} y={50} />
      <Junction x={160} y={110} />
      <Inductor x={160} y={80} rot={90} label="继电器线圈" value="约 70 mA" />
      <Diode x={100} y={80} rot={270} label="续流二极管" value="1N4148" labelSide="left" />
      <Bjt x={146} y={160} label="S8050" />
      <Resistor x={86} y={160} label="1 kΩ" />
      <Port x={50} y={160} label="GPIO" side="left" />
      <Ground x={160} y={200} />
    </Schematic>
  )
}

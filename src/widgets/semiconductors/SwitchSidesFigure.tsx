import { Bjt, Ground, Lamp, Port, Rail, Resistor, Schematic, Wire } from "@/lab"

/** Static picture: NPN low-side switch next to PNP high-side switch. */
export function SwitchSidesFigure() {
  return (
    <div className="flex flex-wrap justify-center gap-x-10 gap-y-4">
      <figure>
        {/*
         * Rail (150,30) → lamp (150,60) vertical: terminals (150,30) / (150,90).
         * NPN (136,120): base (106,120), collector (150,90), emitter (150,150) → ground.
         * Port (26,120) → Rb (66,120): terminals (36,120) / (96,120) → base.
         */}
        <Schematic width={210} height={176} label="NPN 低边开关：负载接电源，三极管接在负载和地之间">
          <Wire points={[[26, 120], [36, 120]]} />
          <Wire points={[[96, 120], [106, 120]]} />
          <Rail x={150} y={30} label="VCC" />
          <Lamp x={150} y={60} rot={90} label="负载" />
          <Bjt x={136} y={120} label="NPN" />
          <Ground x={150} y={150} />
          <Resistor x={66} y={120} label="Rb" />
          <Port x={26} y={120} label="引脚" side="bottom" />
        </Schematic>
        <figcaption className="mt-1 text-center text-caption text-muted-foreground">低边开关（NPN）：引脚出高电平时导通</figcaption>
      </figure>
      <figure>
        {/*
         * Rail (150,30) → PNP flipped (136,70): emitter (150,40), base (106,70), collector (150,100).
         * Lamp (150,130) vertical: terminals (150,100) / (150,160) → ground.
         * Port (26,70) → Rb (66,70): terminals (36,70) / (96,70) → base.
         */}
        <Schematic width={210} height={186} label="PNP 高边开关：三极管接在电源和负载之间，负载另一端接地">
          <Wire points={[[26, 70], [36, 70]]} />
          <Wire points={[[96, 70], [106, 70]]} />
          <Wire points={[[150, 30], [150, 40]]} />
          <Rail x={150} y={30} label="VCC" />
          <Bjt x={136} y={70} type="pnp" flip label="PNP" />
          <Lamp x={150} y={130} rot={90} label="负载" />
          <Ground x={150} y={160} />
          <Resistor x={66} y={70} label="Rb" />
          <Port x={26} y={70} label="引脚" side="bottom" />
        </Schematic>
        <figcaption className="mt-1 text-center text-caption text-muted-foreground">高边开关（PNP）：引脚出低电平时导通</figcaption>
      </figure>
    </div>
  )
}

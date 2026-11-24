import * as React from "react"
import {
  Battery,
  ControlField,
  Inductor,
  Lab,
  LabControls,
  LabNote,
  LabReadouts,
  LabStage,
  Label,
  Lamp,
  Readout,
  Schematic,
  Segmented,
  Switch,
  SwitchField,
  Wire,
  formatSI,
  prefersReducedMotion,
  trace,
  useFrame,
} from "@/lab"

/** A common 5 V PCB relay: about 70 Ω of coil, so roughly 71 mA to hold it in. */
const V_COIL = 5
const R_COIL = 70
/** The load: a 12 V, 12 W lamp on its own supply. */
const V_LOAD = 12
const R_LAMP = 12
/** Seconds the armature takes to swing across (slowed down so it can be seen; a real one needs a few milliseconds). */
const TRAVEL = 0.12

type Contact = "no" | "nc"

/**
 * A relay as two separate circuits: a 5 V loop that energises the coil, and a
 * 12 V loop switched by the contacts. Nothing but the magnetic pull on the
 * armature links them.
 */
export function RelayLab() {
  const [pressed, setPressed] = React.useState(false)
  const [contact, setContact] = React.useState<Contact>("no")
  /** Armature position: 0 resting on the normally-closed contact, 1 pulled onto the normally-open one. */
  const [pos, setPos] = React.useState(0)
  const target = pressed ? 1 : 0
  useFrame((dt) => setPos((p) => (target > p ? Math.min(target, p + dt / TRAVEL) : Math.max(target, p - dt / TRAVEL))), pos !== target)

  const press = (on: boolean) => {
    setPressed(on)
    if (prefersReducedMotion()) setPos(on ? 1 : 0)
  }

  const iCoil = pressed ? V_COIL / R_COIL : 0
  // the armature only conducts while it actually rests on the contact the lamp is wired to
  const made = contact === "no" ? pos >= 1 : pos <= 0
  const iLoad = made ? V_LOAD / R_LAMP : 0
  const tipX = 185 - 30 * pos
  // where the armature crosses y = 100, for the dashed "mechanical link" from the coil
  const linkX = 178.2 - 16.5 * pos

  return (
    <Lab
      title="继电器：小电流控制大负载"
      hint="按住按键给线圈通电，看衔铁怎么动。再把灯改接到常闭触点试试。"
      onReset={() => {
        setPressed(false)
        setContact("no")
        setPos(0)
      }}
    >
      <LabStage>
        {/*
          Control loop (left): battery (30,110) + (30,80) − (30,140); push-button (70,40) from (40,40) to (100,40);
          coil (115,100) vertical from (115,70) to (115,130); bottom rail y = 170.
          Load loop (right): armature pivot (170,130); contacts 常开 (154,73) and 常闭 (186,73);
          lamp (225,40) from (195,40) to (255,40); battery (270,110) + (270,80) − (270,140).
          The two loops share no wire: the left one ends at x = 115, the right one starts at x = 154.
        */}
        <Schematic width={300} height={185} label="左边是 5 V 电源、按键和继电器线圈组成的控制回路，右边是 12 V 电源、灯和继电器触点组成的被控回路，两个回路之间没有导线相连">
          <rect x={100} y={50} width={120} height={96} rx={4} stroke="var(--muted-foreground)" strokeWidth={1.25} strokeDasharray="4 4" />
          <Label x={140} y={161} muted>
            继电器
          </Label>

          {/* control loop */}
          <Wire points={[[30, 80], [30, 40], [40, 40]]} current={iCoil} />
          <Wire points={[[100, 40], [115, 40], [115, 70]]} current={iCoil} />
          <Wire points={[[115, 130], [115, 170], [30, 170], [30, 140]]} current={iCoil} />
          <Battery x={30} y={110} rot={90} label={`${V_COIL} V`} />
          <Switch x={70} y={40} closed={pressed} onClick={() => press(!pressed)} ariaLabel={pressed ? "松开按键" : "按下按键"} />
          <Label x={70} y={18}>
            按键
          </Label>
          <Inductor x={115} y={100} rot={90} core color={pressed ? trace.current : undefined} />
          <Label x={131} y={127} anchor="start" muted>
            线圈
          </Label>
          {/* the pull on the armature: the only link between the two sides */}
          <path d={`M130 100H${(linkX - 4).toFixed(1)}`} stroke={pressed ? trace.current : "var(--muted-foreground)"} strokeWidth={1.25} strokeDasharray="3 4" />

          {/* load loop */}
          <Wire points={[[270, 80], [270, 40], [255, 40]]} current={iLoad} />
          <Wire points={contact === "no" ? [[195, 40], [154, 40], [154, 70.5]] : [[195, 40], [186, 40], [186, 70.5]]} current={iLoad} />
          <path d={contact === "no" ? "M186 70.5V60" : "M154 70.5V60"} opacity={0.4} />
          <Wire points={[[tipX, 75.4], [170, 127.5]]} current={iLoad} width={2.5} />
          <Wire points={[[170, 132.5], [170, 170], [270, 170], [270, 140]]} current={iLoad} />
          <circle cx={154} cy={73} r={2.5} opacity={contact === "no" ? 1 : 0.4} />
          <circle cx={186} cy={73} r={2.5} opacity={contact === "nc" ? 1 : 0.4} />
          <circle cx={170} cy={130} r={2.5} />
          <Lamp x={225} y={40} brightness={made ? 1 : 0} label="灯" />
          <Battery x={270} y={110} rot={90} label={`${V_LOAD} V`} labelSide="left" />
          <Label x={149} y={66} anchor="end" muted={contact !== "no"}>
            常开
          </Label>
          <Label x={191} y={66} anchor="start" muted={contact !== "nc"}>
            常闭
          </Label>
        </Schematic>
      </LabStage>
      <LabControls>
        <SwitchField label="按住按键" hint="给线圈通电" checked={pressed} onChange={press} />
        <ControlField label="灯接在">
          <Segmented
            aria-label="灯接在哪个触点"
            value={contact}
            onValueChange={setContact}
            options={[
              { value: "no", label: "常开触点" },
              { value: "nc", label: "常闭触点" },
            ]}
          />
        </ControlField>
      </LabControls>
      <LabReadouts>
        <Readout label="线圈电流（控制侧）" value={formatSI(iCoil, "A")} color={trace.current} />
        <Readout label="衔铁" value={pressed ? "吸合" : "释放"} />
        <Readout label="灯的电流（负载侧）" value={formatSI(iLoad, "A")} color={trace.current} sub={made ? "灯亮" : "灯灭"} />
      </LabReadouts>
      <LabNote tone={made ? "good" : "neutral"}>
        {contact === "no"
          ? pressed
            ? `按下按键：线圈流过约 ${formatSI(V_COIL / R_COIL, "A", 2)}，磁力把衔铁吸过来，常开触点闭合，${V_LOAD} V 回路接通，灯里流过 ${formatSI(V_LOAD / R_LAMP, "A")}。两个回路之间没有一根导线相连。`
            : "按键松开：线圈没电，弹簧把衔铁拉回常闭一侧，常开触点断开，灯灭。"
          : pressed
            ? "按下按键：衔铁被吸走，离开了常闭触点，灯灭。常闭的意思就是「平时接通，线圈通电才断开」。"
            : "线圈没电时，衔铁靠在常闭触点上，灯一直亮。需要「控制电路断电时负载也保持接通」的场合用它。"}
      </LabNote>
    </Lab>
  )
}

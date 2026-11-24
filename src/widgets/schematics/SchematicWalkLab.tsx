import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button, Capacitor, Chip, ControlField, Ground, Junction, Lab, LabControls, LabNote, LabStage, Label, Led, Rail, Resistor, Schematic, Segmented, Switch, Tex, Wire, chipPins, trace, type ChipSpec } from "@/lab"
import { NetFlag, NoConnect } from "./kit"

/*
 * A small, complete board: Micro-USB 5 V → AMS1117-3.3 → CH32V003, with a button, an LED
 * and an AHT20 sensor on I²C. Canvas 520 × 390. Far-apart parts are joined by net labels
 * (flags) and supply / ground symbols, the way real schematics are drawn.
 *
 * POWER (top left)
 *   J1 box 16…64 × 40…120; pins end at x 78: VBUS y 50, D− 70 (NC), D+ 90 (NC), GND 110 (ground hangs from the pin end)
 *   "J1" (40, 18), "Micro USB" (40, 33); "5V" text (91, 44) over the VBUS wire
 *   VBUS wire (78, 50)–(136, 50), junction (104, 50); C1 10 μF vertical at (104, 80) → ground (104, 110); text right from x 124
 *   U1 box 150…230 × 25…75: VIN (136, 50), VOUT (244, 50), GND (190, 89) → ground; "U1" (150, 17) and "AMS1117-3.3" (172, 17)
 *   VOUT wire (244, 50)–(310, 50), junction (264, 50); C2 22 μF at (264, 80) → ground (264, 110); text from x 284; rail 3V3 at (310, 50)
 * LED (top right)
 *   flag LED at (380, 50) pointing left (340…380); wire to R4 (390…450, y 50), text above; wire (450, 50)–(470, 50)
 *   D1 vertical at (470, 80): anode (470, 50), cathode (470, 110) → ground; text left, ending at x 446
 * BUTTON (bottom left)
 *   rail 3V3 at (30, 190); R3 10 kΩ at (30, 220), text right from x 46; junction (30, 250)
 *   SW1 at (30, 280) → ground (30, 310), text right from x 53; wire (30, 250)–(86, 250) to PC3
 * MCU
 *   U2 box 100…240 × 200…300: PC3 (86, 250); PC4 (254, 230), PC2 (254, 250), PC1 (254, 270); VDD (170, 186); VSS (170, 314) → ground
 *   name "U2" (170, 245), "CH32V003" (170, 261): clear of the pin names (left ends ≈ 130, right start ≈ 210)
 *   VDD wire (170, 186)–(170, 156), rail at (170, 156), junction (170, 170); wire (170, 170)–(180, 170)
 *   C3 100 nF horizontal at (210, 170): (180…240), text above (y 136 / 151); ground hangs from (240, 170) to 188
 *   right pins: stubs to x 264, flags 264…304 (LED, SCL, SDA)
 * SENSOR (bottom right)
 *   rail 3V3 at (380, 220) on the wire (360, 220)–(400, 220)
 *   R2 (SCL pull-up) at (360, 250), text left ending at 344; wire (360, 280)–(360, 320) crosses the SDA wire at (360, 300) with no dot
 *   R1 (SDA pull-up) at (400, 250), text right from 416; wire (400, 280)–(400, 300)
 *   flags SDA at (350, 300) and SCL at (350, 320) pointing left (310…350); wires on to the U3 pins at x 416
 *   junctions (400, 300) and (360, 320)
 *   U3 box 430…510 × 275…345: SDA (416, 300), SCL (416, 320), VDD (470, 261) → rail, GND (470, 359) → ground
 *   name "U3" (488, 309), "AHT20" (488, 325)
 *   C4 100 nF: rail at (505, 180), cap (505, 180…240), text left ending at 485, ground (505, 240)
 */

type Group = "power" | "ground" | "mcu" | "input" | "output" | "comm"
type Net = "3V3" | "GND" | "SDA" | "SCL"
type Tag = Group | Net

const STEPS: { name: string; tags: Tag[]; note: React.ReactNode }[] = [
  {
    name: "全图",
    tags: [],
    note: "一块最小系统板：USB 供电，单片机读一个按键、点一颗 LED，再通过 I²C 读温湿度传感器。点「下一步」，按顺序把它读一遍。",
  },
  {
    name: "找电源",
    tags: ["power", "3V3"],
    note: "从接口读起：J1 的 VBUS 送进 5 V，U1（AMS1117-3.3）把它稳成 3.3 V，C1、C2 是它的输入、输出电容。图上另外 5 个写着 3V3 的电源符号都是这一路，不用画线连过去。",
  },
  {
    name: "找地",
    tags: ["GND"],
    note: "10 个接地符号全是同一个网络 GND。J1、U1 的地脚和每只电容的一端都接在上面。",
  },
  {
    name: "找主芯片",
    tags: ["mcu"],
    note: "U2 是单片机 CH32V003，全图的中心。VDD 接 3V3，VSS 接地，C3（100 nF）紧挨着 VDD 去耦。其余引脚接到哪，看引脚上挂的标号。",
  },
  {
    name: "看输入",
    tags: ["input"],
    note: "按键 SW1 接在 PC3 和地之间，R3（10 kΩ）把 PC3 上拉到 3V3：松开读到 1，按下读到 0。离得近，所以直接画线。",
  },
  {
    name: "看输出",
    tags: ["output"],
    note: (
      <>
        PC4 挂着标号 LED，右上角有一个同名标号，接 R4 和 D1。PC4 输出高电平时 LED 亮，R4 限流：
        <Tex>{String.raw`(3.3 - 2)\,\mathrm{V} / 1\,\mathrm{k\Omega} \approx 1.3\,\mathrm{mA}`}</Tex>。
      </>
    ),
  },
  {
    name: "看通信",
    tags: ["comm"],
    note: "PC2、PC1 挂着 SCL、SDA，和右下角传感器 U3（AHT20）的同名引脚相连。R1、R2（4.7 kΩ）是 I²C 的上拉，C4 给 U3 去耦。R2 的线跨过 SDA 时没有圆点：这两根线不相连。",
  },
]

const NET_NOTES: Record<Net, string> = {
  "3V3": "3V3 出现在 6 个电源符号上：U1 的输出、R3、U2、上拉电阻、C4 和 U3。名字相同，就是同一个网络。",
  GND: "10 个接地符号是同一个网络。原理图上地线几乎从不连成一根长线，各画各的符号。",
  SDA: "SDA 出现在两个标号上：U2 的 PC1 和 U3 的 SDA 脚，R1 把这根线上拉到 3V3。两个标号之间没有画线，但它们是通的。",
  SCL: "SCL 出现在两个标号上：U2 的 PC2 和 U3 的 SCL 脚，R2 是它的上拉。R2 往下走时跨过了 SDA，交叉处没有圆点，两根线不相连。",
}

const HL = trace.second

/** A piece of the drawing: full strength when it belongs to the focus, faded otherwise. */
function Layer({ on, children }: { on: boolean; children: React.ReactNode }) {
  return <g opacity={on ? 1 : 0.22}>{children}</g>
}

const J1: ChipSpec = { x: 40, y: 80, w: 48, h: 80, right: ["VBUS", "D−", "D+", "GND"] }
const U1: ChipSpec = { x: 190, y: 50, w: 80, h: 50, left: ["VIN"], right: ["VOUT"], bottom: ["GND"] }
const U2: ChipSpec = { x: 170, y: 250, w: 140, h: 100, top: ["VDD"], bottom: ["VSS"], left: ["PC3"], right: ["PC4", "PC2", "PC1"] }
const U3: ChipSpec = { x: 470, y: 310, w: 80, h: 70, left: ["SDA", "SCL"], top: ["VDD"], bottom: ["GND"] }

/** Read a board schematic step by step (power, ground, the main chip, inputs, outputs, buses), or light up one net everywhere it appears. */
export function SchematicWalkLab() {
  const [step, setStep] = React.useState(0)
  const [net, setNet] = React.useState<Net | null>(null)

  const j1 = chipPins(J1)
  const u1 = chipPins(U1)
  const u2 = chipPins(U2)
  const u3 = chipPins(U3)

  const focus: Tag[] | null = net ? [net] : STEPS[step].tags.length ? STEPS[step].tags : null
  const lit = (tags: Tag[]) => focus == null || tags.some((t) => focus.includes(t))
  /** Highlight colour for pieces of the selected net. */
  const c = (n: Net) => (net === n ? HL : undefined)

  const go = (to: number) => {
    setNet(null)
    setStep(Math.max(0, Math.min(STEPS.length - 1, to)))
  }

  return (
    <Lab
      title="读一张完整的原理图"
      hint="按「下一步」按顺序读图，相关的部分会亮起来；或者选一个网络名，看它在图上出现在哪几处。"
      onReset={() => {
        setStep(0)
        setNet(null)
      }}
    >
      <LabStage>
        <Schematic width={520} height={390} label="最小系统板原理图：Micro USB 输入 5 V，AMS1117-3.3 稳压，CH32V003 单片机带按键、LED，并通过 I²C 连接 AHT20 温湿度传感器">
          {/* ---------- power ---------- */}
          <Layer on={lit(["power"])}>
            <Chip {...J1} />
            <Label x={40} y={18} weight={600}>
              J1
            </Label>
            <Label x={40} y={33} size={12} muted>
              Micro USB
            </Label>
            <NoConnect x={j1["D−"][0]} y={j1["D−"][1]} />
            <NoConnect x={j1["D+"][0]} y={j1["D+"][1]} />
            <Wire points={[j1.VBUS, u1.VIN]} />
            <Junction x={104} y={50} />
            <Label x={91} y={44} size={12} muted>
              5V
            </Label>
            <Capacitor x={104} y={80} rot={90} label="C1" value="10 μF" />
            <Chip {...U1} />
            <Label x={150} y={17} anchor="start" weight={600}>
              U1
            </Label>
            <Label x={172} y={17} anchor="start" size={12} muted>
              AMS1117-3.3
            </Label>
            <Capacitor x={264} y={80} rot={90} polarized label="C2" value="22 μF" />
          </Layer>
          <Layer on={lit(["power", "3V3"])}>
            <Wire points={[u1.VOUT, [310, 50]]} color={c("3V3")} />
            <Junction x={264} y={50} color={c("3V3")} />
            <Rail x={310} y={50} label="3V3" color={c("3V3")} />
          </Layer>
          <Layer on={lit(["power", "GND"])}>
            <Ground x={j1.GND[0]} y={j1.GND[1]} color={c("GND")} />
            <Ground x={104} y={110} color={c("GND")} />
            <Ground x={u1.GND[0]} y={u1.GND[1]} color={c("GND")} />
            <Ground x={264} y={110} color={c("GND")} />
          </Layer>

          {/* ---------- LED ---------- */}
          <Layer on={lit(["output"])}>
            <NetFlag x={380} y={50} name="LED" side="left" />
            <Wire points={[[380, 50], [390, 50]]} />
            <Resistor x={420} y={50} label="R4" value="1 kΩ" />
            <Wire points={[[450, 50], [470, 50]]} />
            <Led x={470} y={80} rot={90} label="D1" value="红色" labelSide="left" />
          </Layer>
          <Layer on={lit(["output", "GND"])}>
            <Ground x={470} y={110} color={c("GND")} />
          </Layer>

          {/* ---------- button ---------- */}
          <Layer on={lit(["input", "3V3"])}>
            <Rail x={30} y={190} label="3V3" color={c("3V3")} />
          </Layer>
          <Layer on={lit(["input"])}>
            <Resistor x={30} y={220} rot={90} label="R3" value="10 kΩ" />
            <Junction x={30} y={250} />
            <Switch x={30} y={280} rot={90} label="SW1" />
            <Wire points={[[30, 250], u2.PC3]} />
          </Layer>
          <Layer on={lit(["input", "GND"])}>
            <Ground x={30} y={310} color={c("GND")} />
          </Layer>

          {/* ---------- MCU ---------- */}
          <Layer on={lit(["mcu", "input", "output", "comm"])}>
            <Chip {...U2} />
            <Label x={170} y={245} weight={600}>
              U2
            </Label>
            <Label x={170} y={261} size={12} muted>
              CH32V003
            </Label>
          </Layer>
          <Layer on={lit(["mcu", "3V3"])}>
            <Wire points={[u2.VDD, [170, 156]]} color={c("3V3")} />
            <Rail x={170} y={156} label="3V3" color={c("3V3")} />
            <Junction x={170} y={170} color={c("3V3")} />
            <Wire points={[[170, 170], [180, 170]]} color={c("3V3")} />
          </Layer>
          <Layer on={lit(["mcu"])}>
            <Capacitor x={210} y={170} label="C3" value="100 nF" />
          </Layer>
          <Layer on={lit(["mcu", "GND"])}>
            <Ground x={240} y={170} color={c("GND")} />
            <Ground x={u2.VSS[0]} y={u2.VSS[1]} color={c("GND")} />
          </Layer>
          <Layer on={lit(["output"])}>
            <Wire points={[u2.PC4, [264, 230]]} />
            <NetFlag x={264} y={230} name="LED" />
          </Layer>
          <Layer on={lit(["comm", "SCL"])}>
            <Wire points={[u2.PC2, [264, 250]]} color={c("SCL")} />
            <NetFlag x={264} y={250} name="SCL" color={c("SCL")} />
          </Layer>
          <Layer on={lit(["comm", "SDA"])}>
            <Wire points={[u2.PC1, [264, 270]]} color={c("SDA")} />
            <NetFlag x={264} y={270} name="SDA" color={c("SDA")} />
          </Layer>

          {/* ---------- sensor ---------- */}
          <Layer on={lit(["comm", "3V3"])}>
            <Wire points={[[360, 220], [400, 220]]} color={c("3V3")} />
            <Rail x={380} y={220} label="3V3" color={c("3V3")} />
            <Rail x={505} y={180} label="3V3" color={c("3V3")} />
            <Rail x={u3.VDD[0]} y={u3.VDD[1]} label="3V3" color={c("3V3")} />
          </Layer>
          <Layer on={lit(["comm"])}>
            <Resistor x={360} y={250} rot={90} label="R2" value="4k7" labelSide="left" />
            <Resistor x={400} y={250} rot={90} label="R1" value="4k7" />
            <Capacitor x={505} y={210} rot={90} label="C4" value="100 nF" labelSide="left" />
            <Chip {...U3} />
            <Label x={488} y={309} weight={600}>
              U3
            </Label>
            <Label x={488} y={325} size={12} muted>
              AHT20
            </Label>
          </Layer>
          <Layer on={lit(["comm", "SDA"])}>
            <NetFlag x={350} y={300} name="SDA" side="left" color={c("SDA")} />
            <Wire points={[[350, 300], u3.SDA]} color={c("SDA")} />
            <Wire points={[[400, 280], [400, 300]]} color={c("SDA")} />
            <Junction x={400} y={300} color={c("SDA")} />
          </Layer>
          <Layer on={lit(["comm", "SCL"])}>
            <NetFlag x={350} y={320} name="SCL" side="left" color={c("SCL")} />
            <Wire points={[[350, 320], u3.SCL]} color={c("SCL")} />
            <Wire points={[[360, 280], [360, 320]]} color={c("SCL")} />
            <Junction x={360} y={320} color={c("SCL")} />
          </Layer>
          <Layer on={lit(["comm", "GND"])}>
            <Ground x={505} y={240} color={c("GND")} />
            <Ground x={u3.GND[0]} y={u3.GND[1]} color={c("GND")} />
          </Layer>
        </Schematic>
      </LabStage>
      <LabControls>
        <ControlField label={`读图步骤 ${step + 1} / ${STEPS.length}：${STEPS[step].name}`}>
          <Button size="sm" disabled={step === 0 && net == null} onClick={() => go(net ? step : step - 1)}>
            <ChevronLeft aria-hidden />
            上一步
          </Button>
          <Button size="sm" disabled={step === STEPS.length - 1 && net == null} onClick={() => go(net ? step : step + 1)}>
            下一步
            <ChevronRight aria-hidden />
          </Button>
        </ControlField>
        <ControlField label="高亮一个网络">
          <Segmented<Net | "">
            aria-label="网络名"
            size="sm"
            value={net ?? ""}
            onValueChange={(v) => v && setNet(v)}
            options={[
              { value: "3V3", label: "3V3" },
              { value: "GND", label: "GND" },
              { value: "SDA", label: "SDA" },
              { value: "SCL", label: "SCL" },
            ]}
          />
        </ControlField>
      </LabControls>
      <LabNote>{net ? NET_NOTES[net] : STEPS[step].note}</LabNote>
    </Lab>
  )
}

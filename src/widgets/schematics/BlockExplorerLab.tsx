import * as React from "react"
import { Bjt, Capacitor, Chip, ControlField, Crystal, Diode, Ground, Inductor, Junction, Lab, LabControls, LabStage, Label, Mosfet, Port, Rail, Resistor, Schematic, Select, Switch, Wire, chipPins, type ChipSpec } from "@/lab"

/*
 * Eight building blocks that turn up on nearly every board. Each one is a small
 * static schematic plus: what it is for, what goes wrong without it, typical values.
 */

/* ---------- "a pull-up node feeding one chip pin": reset, button input, battery divider ----------
 * Canvas 320 × 172.
 *   rail at (80, 30); upper part (80, 30…90), text left ending at x 64 (resistor) ; junction (80, 90)
 *   lower part (80, 90…150) → ground (80, 150), text left
 *   parallel part (150, 90…150) → ground (150, 150), text right from x ≈ 170; junction (150, 90)
 *   wire (80, 90)–(216, 90) to the chip pin; chip box 230…310 × 65…115, its title above at (270, 56)
 */
const PIN_CHIP = (pin: string): ChipSpec => ({ x: 270, y: 90, w: 80, h: 50, left: [pin] })

function PinNode({ rail, pin, upper, lower, parallel, title }: { rail: string; pin: string; upper: React.ReactNode; lower: React.ReactNode; parallel: React.ReactNode; title: string }) {
  const spec = PIN_CHIP(pin)
  const p = chipPins(spec)[pin]
  return (
    <>
      <Rail x={80} y={30} label={rail} />
      {upper}
      <Junction x={80} y={90} />
      {lower}
      <Ground x={80} y={150} />
      <Junction x={150} y={90} />
      {parallel}
      <Ground x={150} y={150} />
      <Wire points={[[80, 90], p]} />
      <Chip {...spec} />
      <Label x={270} y={56}>
        {title}
      </Label>
    </>
  )
}

interface Block {
  value: string
  label: string
  /** What the drawing shows, for screen readers. */
  alt: string
  width: number
  height: number
  draw: React.ReactNode
  why: string
  without: string
  values: [string, string][]
}

const BLOCKS: Block[] = [
  {
    value: "decouple",
    label: "去耦电容",
    alt: "芯片的 VDD 脚接 3.3 V，旁边并着 100 nF 和 10 μF 两只电容到地",
    width: 330,
    height: 170,
    /*
     * rail (40, 40); bus (40, 40)–(280, 40)–(280, 56) to VDD; junctions (100, 40), (170, 40)
     * C2 10 μF at (100, 70) → ground (100, 100), text left ending at 80; C1 100 nF at (170, 70) → ground, text right from 190
     * chip box 240…320 × 70…130: VDD (280, 56), GND (280, 144) → ground
     */
    draw: (
      <>
        <Rail x={40} y={40} label="3V3" />
        <Wire points={[[40, 40], [280, 40], [280, 56]]} />
        <Junction x={100} y={40} />
        <Junction x={170} y={40} />
        <Capacitor x={100} y={70} rot={90} label="C2" value="10 μF" labelSide="left" />
        <Ground x={100} y={100} />
        <Capacitor x={170} y={70} rot={90} label="C1" value="100 nF" />
        <Ground x={170} y={100} />
        <Chip x={280} y={100} w={80} h={60} top={["VDD"]} bottom={["GND"]} label="U1" sub="芯片" />
        <Ground x={280} y={144} />
      </>
    ),
    why: "芯片内部翻转时会在几纳秒里抽一大口电流，远处的稳压器来不及送。贴在电源脚旁的电容先把电荷垫上。",
    without: "电源脚上出现毛刺和跌落：程序跑飞、莫名复位、ADC 读数乱跳。",
    values: [
      ["小电容", "每个电源脚一只 100 nF，紧贴引脚"],
      ["大电容", "每组电源一只 10 μF 左右"],
      ["类型", "X7R 或 X5R 陶瓷电容"],
    ],
  },
  {
    value: "reset",
    label: "复位电路",
    alt: "3.3 V 经 10 kΩ 电阻接到单片机的 NRST 脚，NRST 对地接 100 nF 电容，电容两端并一个复位按键",
    width: 320,
    height: 172,
    draw: (
      <PinNode
        rail="3V3"
        pin="NRST"
        title="U1 单片机"
        upper={<Resistor x={80} y={60} rot={90} label="R1" value="10 kΩ" labelSide="left" />}
        lower={<Capacitor x={80} y={120} rot={90} label="C1" value="100 nF" labelSide="left" />}
        parallel={<Switch x={150} y={120} rot={90} label="SW1" value="复位键" />}
      />
    ),
    why: "上电时电容从 0 V 开始充电，NRST 先保持一段低电平（τ = RC = 1 ms），等电源稳了才放开复位。按下按键把电容短路，就是手动复位。",
    without: "电源上升得慢时，芯片可能在电压还不够的时候就开始跑，偶尔上电不启动。",
    values: [
      ["R", "10 kΩ（很多单片机内部已有上拉，可以省掉）"],
      ["C", "100 nF"],
      ["注意", "51 单片机是高电平复位：电容接电源，电阻接地"],
    ],
  },
  {
    value: "crystal",
    label: "晶振电路",
    alt: "8 MHz 晶振接在单片机的 OSC_IN 和 OSC_OUT 之间，两端各有一只 20 pF 电容到地",
    width: 320,
    height: 196,
    /*
     * chip box 80…240 × 30…70, pins OSC_IN (120, 84) and OSC_OUT (200, 84); title (160, 22)
     * crystal (160, 110): (130…190); wires pin → (x, 110) → crystal; junctions (120, 110), (200, 110)
     * C1 (120, 110…170) text left ending at 100; C2 (200, 110…170) text right from 220; grounds at y 170
     * crystal text below it (y 139 / 154), between the two capacitors
     */
    draw: (
      <>
        <Chip x={160} y={50} w={160} h={40} bottom={["OSC_IN", "OSC_OUT"]} pitch={80} />
        <Label x={160} y={22}>
          U1 单片机
        </Label>
        <Wire points={[[120, 84], [120, 110], [130, 110]]} />
        <Wire points={[[200, 84], [200, 110], [190, 110]]} />
        <Junction x={120} y={110} />
        <Junction x={200} y={110} />
        <Crystal x={160} y={110} label="Y1" value="8 MHz" labelSide="bottom" />
        <Capacitor x={120} y={140} rot={90} label="C1" value="20 pF" labelSide="left" />
        <Capacitor x={200} y={140} rot={90} label="C2" value="20 pF" />
        <Ground x={120} y={170} />
        <Ground x={200} y={170} />
      </>
    ),
    why: "晶体和芯片里的反相放大器一起组成振荡器，两只负载电容让它稳定地振在标称频率上。",
    without: "负载电容不对，频率会偏，起振慢甚至不起振。不接外部晶振也能用芯片内部的 RC 振荡器，但它的精度一般只有 1% 左右，USB 和精确计时不够用。",
    values: [
      ["晶振", "8 MHz、12 MHz 常见；32.768 kHz 给实时时钟"],
      ["负载电容", "C ≈ 2 × (CL − Cs)，常见 10–22 pF"],
      ["布局", "晶振和电容紧贴芯片，下面不走别的线"],
    ],
  },
  {
    value: "button",
    label: "按键输入",
    alt: "3.3 V 经 10 kΩ 上拉电阻接到单片机的 PA0 脚，PA0 经按键接地，按键两端可选并一只 100 nF 电容",
    width: 320,
    height: 172,
    draw: (
      <PinNode
        rail="3V3"
        pin="PA0"
        title="U1 单片机"
        upper={<Resistor x={80} y={60} rot={90} label="R1" value="10 kΩ" labelSide="left" />}
        lower={<Switch x={80} y={120} rot={90} label="SW1" labelSide="left" />}
        parallel={<Capacitor x={150} y={120} rot={90} label="C1" value="100 nF 可选" />}
      />
    ),
    why: "上拉电阻给引脚一个默认的高电平，按下按键把引脚接到地，变成低电平。",
    without: "引脚悬空，读数随干扰乱跳。",
    values: [
      ["上拉", "10 kΩ，或打开芯片的内部上拉"],
      ["消抖电容", "可选 100 nF，软件里仍要消抖"],
      ["读数", "松开读到 1，按下读到 0"],
    ],
  },
  {
    value: "reverse",
    label: "电源防反接",
    alt: "两种防反接：上面在输入和输出之间串一只肖特基二极管；下面串一只 P 沟道 MOSFET，漏极接输入，源极接输出，栅极接地，体二极管从输入指向输出",
    width: 340,
    height: 222,
    /*
     * Option 1 (y 40): port VIN (30, 40) – D1 (130…190) – port VOUT (300, 40); D1 text below (y 66 / 81)
     * Option 2 (line y 150): MOSFET at (160, 164) rot 270: drain (130, 150), source (190, 150), gate (160, 194) → ground
     *   body diode drawn at (160, 120): anode (130, 120), cathode (190, 120), joined by (130, 150)–(130, 120) and (190, 120)–(190, 150)
     *   junctions (130, 150), (190, 150); Q1 text at x 205 (y 172 / 187), below the output wire
     * captions at (10, 16) and (10, 112)
     */
    draw: (
      <>
        <Label x={10} y={16} anchor="start" size={12} muted>
          方案一：串肖特基二极管
        </Label>
        <Port x={30} y={40} label="VIN" side="top" />
        <Wire points={[[30, 40], [130, 40]]} />
        <Diode x={160} y={40} variant="schottky" label="D1" value="SS34" labelSide="bottom" />
        <Wire points={[[190, 40], [300, 40]]} />
        <Port x={300} y={40} label="VOUT" side="top" />

        <Label x={10} y={112} anchor="start" size={12} muted>
          方案二：P-MOS
        </Label>
        <Port x={30} y={150} label="VIN" side="top" />
        <Wire points={[[30, 150], [130, 150]]} />
        <Mosfet x={160} y={164} rot={270} type="p" />
        <Diode x={160} y={120} label="体二极管" />
        <Wire points={[[130, 150], [130, 120]]} />
        <Wire points={[[190, 120], [190, 150]]} />
        <Junction x={130} y={150} />
        <Junction x={190} y={150} />
        <Wire points={[[190, 150], [300, 150]]} />
        <Port x={300} y={150} label="VOUT" side="top" />
        <Ground x={160} y={194} />
        <Label x={205} y={172} anchor="start">
          Q1
        </Label>
        <Label x={205} y={187} anchor="start" muted>
          AO3401
        </Label>
      </>
    ),
    why: "电源接反时把后面的电路断开。串二极管最简单；P-MOS 正接时先由体二极管导通，栅源电压随即把管子打开，压降只剩 I × RDS(on)；接反时管子和体二极管都不通。",
    without: "电池或适配器一插反，芯片和电解电容直接损坏。",
    values: [
      ["二极管", "SS34 肖特基，压降 0.3–0.5 V"],
      ["P-MOS", "AO3401，1 A 时压降约 0.05 V"],
      ["栅极", "输入超过栅极耐压（AO3401 是 12 V）时，栅极加稳压管和电阻"],
    ],
  },
  {
    value: "level",
    label: "电平转换",
    alt: "BSS138 双向电平转换：源极接 3.3 V 侧信号，经 10 kΩ 上拉到 3.3 V；漏极接 5 V 侧信号，经 10 kΩ 上拉到 5 V；栅极接 3.3 V",
    width: 330,
    height: 156,
    /*
     * MOSFET at (170, 106) rot 90: gate (170, 76) up to the 3V3 rail at (170, 56); source (140, 120); drain (200, 120)
     * R1 (100, 60…120) from the 3V3 rail at (100, 60), text left ending at 84; R2 (240, 60…120) from the 5V rail, text right from 256
     * signal line y 120: port LV (40, 120) … (140, 120) and (200, 120) … port HV (300, 120); junctions (100, 120), (240, 120)
     * "Q1 BSS138" under the line at (170, 146)
     */
    draw: (
      <>
        <Rail x={100} y={60} label="3V3" />
        <Resistor x={100} y={90} rot={90} label="R1" value="10 kΩ" labelSide="left" />
        <Rail x={170} y={56} label="3V3" />
        <Wire points={[[170, 56], [170, 76]]} />
        <Mosfet x={170} y={106} rot={90} />
        <Rail x={240} y={60} label="5V" />
        <Resistor x={240} y={90} rot={90} label="R2" value="10 kΩ" />
        <Port x={40} y={120} label="LV" side="left" />
        <Wire points={[[40, 120], [140, 120]]} />
        <Junction x={100} y={120} />
        <Wire points={[[200, 120], [300, 120]]} />
        <Junction x={240} y={120} />
        <Port x={300} y={120} label="HV" side="right" />
        <Label x={170} y={146} muted>
          Q1 BSS138
        </Label>
      </>
    ),
    why: "两边各有上拉。3.3 V 侧拉低时管子导通，把 5 V 侧也拉低；5 V 侧拉低时，体二极管先把 3.3 V 侧拉到约 0.7 V，管子随即导通。两边都不拉时，各自被上拉到自己的电压。",
    without: "5 V 器件的高电平直接进 3.3 V 引脚可能损坏引脚；3.3 V 的高电平又可能不够 5 V 器件认。",
    values: [
      ["MOS 管", "BSS138 或 2N7002"],
      ["上拉", "两侧各 4.7–10 kΩ"],
      ["适用", "I²C 这类开漏、双向信号，几百 kHz 以内"],
    ],
  },
  {
    value: "divider",
    label: "电池电压采样",
    alt: "电池电压经两只 100 kΩ 电阻分压后接到单片机的 ADC 脚，ADC 脚对地并一只 100 nF 电容",
    width: 320,
    height: 172,
    draw: (
      <PinNode
        rail="VBAT"
        pin="ADC"
        title="U1 单片机"
        upper={<Resistor x={80} y={60} rot={90} label="R1" value="100 kΩ" labelSide="left" />}
        lower={<Resistor x={80} y={120} rot={90} label="R2" value="100 kΩ" labelSide="left" />}
        parallel={<Capacitor x={150} y={120} rot={90} label="C1" value="100 nF" />}
      />
    ),
    why: "单片机的 ADC 量程到 3.3 V 为止，测不了 4.2 V 的锂电池。两只相同的电阻分掉一半，电池电压等于读数乘 2。",
    without: "直接接上，超出量程的部分读不出来，还可能损坏引脚。",
    values: [
      ["电阻", "两只 100 kΩ，一直耗电 4.2 V ÷ 200 kΩ = 21 μA"],
      ["电容", "100 nF，ADC 采样时由它就近供电荷"],
      ["换算", "VBAT = VADC × (R1 + R2) ÷ R2"],
    ],
  },
  {
    value: "relay",
    label: "继电器驱动",
    alt: "单片机引脚经 1 kΩ 电阻驱动 S8050 三极管，三极管接在继电器线圈和地之间，线圈两端反向并联续流二极管",
    width: 280,
    height: 226,
    /*
     * rail 5V (160, 40); coil (160, 50…110) text right from 175; diode (100, 50…110) rot 270, cathode on top, text left ending at 83
     * wires (100, 50)–(160, 50), (100, 110)–(160, 110), (160, 110)–(160, 130); junctions (160, 50), (160, 110)
     * transistor at (146, 160): base (116, 160), collector (160, 130), emitter (160, 190) → ground (160, 200)
     * base resistor (56…116, y 160), text above; port GPIO (50, 160)
     */
    draw: (
      <>
        <Rail x={160} y={40} label="5V" />
        <Wire points={[[160, 40], [160, 50]]} />
        <Wire points={[[100, 50], [160, 50]]} />
        <Wire points={[[100, 110], [160, 110]]} />
        <Wire points={[[160, 110], [160, 130]]} />
        <Wire points={[[160, 190], [160, 200]]} />
        <Wire points={[[50, 160], [56, 160]]} />
        <Junction x={160} y={50} />
        <Junction x={160} y={110} />
        <Inductor x={160} y={80} rot={90} label="K1" value="继电器线圈" />
        <Diode x={100} y={80} rot={270} label="D1" value="1N4148" labelSide="left" />
        <Bjt x={146} y={160} label="Q1" value="S8050" />
        <Resistor x={86} y={160} label="R1" value="1 kΩ" />
        <Port x={50} y={160} label="GPIO" side="left" />
        <Ground x={160} y={200} />
      </>
    ),
    why: "引脚只能给几毫安，继电器线圈要几十毫安。引脚经电阻驱动三极管，由三极管去开关线圈。",
    without: "引脚直接接线圈带不动，还可能烧坏；没有续流二极管，关断瞬间线圈产生的反向高压会击穿三极管。",
    values: [
      ["三极管", "S8050，或 AO3400 这类 MOSFET"],
      ["基极电阻", "1 kΩ"],
      ["续流二极管", "1N4148 或 1N4007，负极接电源"],
    ],
  },
]

/** Pick a common building block: see its schematic, why it is there, what breaks without it, and typical values. */
export function BlockExplorerLab() {
  const [value, setValue] = React.useState(BLOCKS[0].value)
  const block = BLOCKS.find((b) => b.value === value) ?? BLOCKS[0]
  return (
    <Lab title="单元电路图鉴" hint="从下拉框里选一个单元电路，看它长什么样、为什么要有它、通常取什么值。" onReset={() => setValue(BLOCKS[0].value)}>
      <LabControls columns={1}>
        <ControlField label="单元电路">
          <Select aria-label="单元电路" className="w-full max-w-64" value={value} onValueChange={setValue} options={BLOCKS.map((b) => ({ value: b.value, label: b.label }))} />
        </ControlField>
      </LabControls>
      <LabStage>
        <Schematic width={block.width} height={block.height} label={block.alt}>
          {block.draw}
        </Schematic>
      </LabStage>
      <div aria-live="polite" className="grid gap-x-8 gap-y-3 px-4 py-3 text-small @xl:grid-cols-2">
        <dl className="flex flex-col gap-3">
          <div>
            <dt className="text-caption text-faint-foreground">为什么要有它</dt>
            <dd className="mt-0.5">{block.why}</dd>
          </div>
          <div>
            <dt className="text-caption text-faint-foreground">不加会怎样</dt>
            <dd className="mt-0.5 text-warning">{block.without}</dd>
          </div>
        </dl>
        <div>
          <p className="text-caption text-faint-foreground">典型取值</p>
          <dl className="mt-1 divide-y">
            {block.values.map(([k, v]) => (
              <div key={k} className="flex gap-3 py-1.5">
                <dt className="w-20 shrink-0 text-muted-foreground">{k}</dt>
                <dd className="min-w-0">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </Lab>
  )
}

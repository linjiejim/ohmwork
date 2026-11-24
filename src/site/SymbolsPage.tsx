import type * as React from "react"
import { Link } from "react-router-dom"
import { Page, PageHeader, Section } from "@/components/ui/page"
import { Antenna, Battery, Bjt, Capacitor, Chip, Crystal, Diode, Fuse, Gate, Ground, Inductor, Junction, Lamp, Led, Meter, Mosfet, OpAmp, Port, Potentiometer, Rail, Resistor, Schematic, Source, Switch, Wire } from "@/lab"

interface SymbolItem {
  name: string
  /** Reference designator prefix on real schematics. */
  designator?: string
  note: string
  draw: React.ReactNode
}

// Each picture is 150 × 90 with the part centred at (75, 48).
const X = 75
const Y = 48

const GROUPS: { title: string; lesson?: { to: string; label: string }; items: SymbolItem[] }[] = [
  {
    title: "电阻、电容、电感",
    lesson: { to: "/learn/components", label: "基本元件" },
    items: [
      { name: "电阻", designator: "R", note: "限流、分压、上拉。折线是美标画法。", draw: <Resistor x={X} y={Y} /> },
      { name: "电阻（国标）", designator: "R", note: "国标和 IEC 画成一个矩形，意思完全一样。", draw: <Resistor x={X} y={Y} variant="iec" /> },
      { name: "可变电阻", designator: "RV", note: "斜箭头表示阻值可调。", draw: <Resistor x={X} y={Y} variable /> },
      { name: "电位器", designator: "RP", note: "三个脚：两端是整只电阻，中间箭头是滑动触点。", draw: <Potentiometer x={X} y={Y + 6} /> },
      { name: "电容", designator: "C", note: "两块平行极板，无极性。", draw: <Capacitor x={X} y={Y} /> },
      { name: "电解电容", designator: "C", note: "有极性，「+」一侧接高电位，接反会损坏。", draw: <Capacitor x={X} y={Y} polarized /> },
      { name: "电感", designator: "L", note: "一串线圈。", draw: <Inductor x={X} y={Y} /> },
      { name: "带磁芯电感", designator: "L", note: "两条线表示铁芯或铁氧体磁芯。", draw: <Inductor x={X} y={Y} core /> },
      { name: "晶振", designator: "Y", note: "夹在两块极板间的石英晶体，提供精确的时钟频率。", draw: <Crystal x={X} y={Y} /> },
      { name: "保险丝", designator: "F", note: "电流过大时熔断，保护后面的电路。", draw: <Fuse x={X} y={Y} /> },
    ],
  },
  {
    title: "电源与地",
    lesson: { to: "/learn/schematics/reading-schematics", label: "原理图怎么读" },
    items: [
      { name: "电池", designator: "BT", note: "长线是正极，短粗线是负极。", draw: <Battery x={X} y={Y} /> },
      { name: "直流电压源", designator: "V", note: "理想电压源，标了正负。", draw: <Source x={X} y={Y} /> },
      { name: "交流电源", designator: "V", note: "圆圈里一个正弦波。", draw: <Source x={X} y={Y} kind="ac" /> },
      { name: "电流源", designator: "I", note: "箭头是电流方向。", draw: <Source x={X} y={Y} kind="current" /> },
      {
        name: "地",
        designator: "GND",
        note: "0 V 参考点。所有画了这个符号的地方都连在一起。",
        draw: (
          <>
            <Wire points={[[X, Y - 22], [X, Y - 6]]} />
            <Ground x={X} y={Y - 6} />
          </>
        ),
      },
      {
        name: "电源轨",
        designator: "VCC",
        note: "一小段横线加名字。同名的电源符号都连在一起。",
        draw: (
          <>
            <Rail x={X} y={Y + 6} label="3V3" />
            <Wire points={[[X, Y + 6], [X, Y + 24]]} />
          </>
        ),
      },
    ],
  },
  {
    title: "二极管",
    lesson: { to: "/learn/semiconductors/diodes", label: "二极管" },
    items: [
      { name: "二极管", designator: "D", note: "三角形指向电流能通过的方向，竖线一端是负极（阴极）。", draw: <Diode x={X} y={Y} /> },
      { name: "稳压二极管", designator: "D / ZD", note: "竖线两端带折角。反向工作，电压稳定在标称值。", draw: <Diode x={X} y={Y} variant="zener" /> },
      { name: "肖特基二极管", designator: "D", note: "竖线两端弯成 S 形。压降低、速度快。", draw: <Diode x={X} y={Y} variant="schottky" /> },
      { name: "发光二极管", designator: "D / LED", note: "向外的两个箭头表示发光。", draw: <Led x={X} y={Y + 4} brightness={0.9} /> },
      { name: "光电二极管", designator: "D", note: "向内的两个箭头表示接收光。", draw: <Diode x={X} y={Y + 4} variant="photo" /> },
    ],
  },
  {
    title: "晶体管",
    lesson: { to: "/learn/semiconductors/bjt", label: "三极管（BJT）" },
    items: [
      { name: "NPN 三极管", designator: "Q", note: "箭头在发射极上，朝外。左边是基极，上面是集电极。", draw: <Bjt x={X - 6} y={Y - 3} /> },
      { name: "PNP 三极管", designator: "Q", note: "箭头朝里，指向基极。", draw: <Bjt x={X - 6} y={Y - 3} type="pnp" /> },
      { name: "N 沟道 MOSFET", designator: "Q", note: "左边是栅极，上漏极、下源极。箭头指向沟道。", draw: <Mosfet x={X - 6} y={Y - 3} /> },
      { name: "P 沟道 MOSFET", designator: "Q", note: "箭头背离沟道。", draw: <Mosfet x={X - 6} y={Y - 3} type="p" /> },
    ],
  },
  {
    title: "集成电路与逻辑门",
    lesson: { to: "/learn/digital/logic-gates", label: "逻辑电平与逻辑门" },
    items: [
      { name: "运算放大器", designator: "U", note: "三角形：左边两个输入（−、+），右边输出。", draw: <OpAmp x={X - 2} y={Y - 3} /> },
      { name: "芯片", designator: "U", note: "其他芯片都画成方框，引脚旁写着名字。", draw: <Chip x={X} y={Y - 3} w={100} h={50} label="U1" left={["VCC", "IN"]} right={["OUT", "GND"]} /> },
      { name: "与门", designator: "AND", note: "输入全为 1，输出才是 1。", draw: <Gate x={X} y={Y - 4} type="and" /> },
      { name: "或门", designator: "OR", note: "任一输入为 1，输出就是 1。", draw: <Gate x={X} y={Y - 4} type="or" /> },
      { name: "非门", designator: "NOT", note: "输出和输入相反。小圆圈表示取反。", draw: <Gate x={X} y={Y - 4} type="not" /> },
      { name: "与非门", designator: "NAND", note: "与门后面加一个取反的小圆圈。", draw: <Gate x={X} y={Y - 4} type="nand" /> },
      { name: "或非门", designator: "NOR", note: "或门后面加取反。", draw: <Gate x={X} y={Y - 4} type="nor" /> },
      { name: "异或门", designator: "XOR", note: "两个输入不同，输出才是 1。", draw: <Gate x={X} y={Y - 4} type="xor" /> },
    ],
  },
  {
    title: "开关、指示与连接",
    lesson: { to: "/learn/schematics/symbols", label: "原理图符号" },
    items: [
      { name: "开关", designator: "SW", note: "杠杆抬起是断开，放平是接通。", draw: <Switch x={X} y={Y + 4} /> },
      { name: "灯", designator: "HL", note: "圆圈里一个叉。", draw: <Lamp x={X} y={Y} brightness={0.7} /> },
      { name: "电压表", designator: "V", note: "并联在被测元件两端。", draw: <Meter x={X} y={Y} letter="V" /> },
      { name: "电流表", designator: "A", note: "串联在被测支路里。", draw: <Meter x={X} y={Y} letter="A" /> },
      { name: "电机", designator: "M", note: "圆圈里一个 M。", draw: <Meter x={X} y={Y} letter="M" /> },
      { name: "天线", designator: "ANT", note: "射频信号从这里进出。", draw: <Antenna x={X} y={Y + 22} /> },
      {
        name: "连接点",
        note: "交叉处有实心圆点，表示导线相连。",
        draw: (
          <>
            <Wire points={[[X - 34, Y], [X + 34, Y]]} />
            <Wire points={[[X, Y - 26], [X, Y + 26]]} />
            <Junction x={X} y={Y} />
          </>
        ),
      },
      {
        name: "交叉不相连",
        note: "没有圆点的交叉，两条线只是路过，互不相通。",
        draw: (
          <>
            <Wire points={[[X - 34, Y], [X + 34, Y]]} />
            <Wire points={[[X, Y - 26], [X, Y + 26]]} />
          </>
        ),
      },
      {
        name: "端口 / 测试点",
        designator: "TP",
        note: "空心圆圈加名字：信号从这里进出，或留给探头测量。",
        draw: (
          <>
            <Wire points={[[X - 34, Y], [X - 4, Y]]} />
            <Port x={X} y={Y} label="OUT" />
          </>
        ),
      },
    ],
  },
]

/** The symbols drawn by the same kit the lessons use, so what you learn here is what you see there. */
export function SymbolsPage() {
  return (
    <Page width="wide">
      <PageHeader title="符号速查" info="原理图上的常见符号：长什么样、位号用什么字母、怎么读。" />
      {GROUPS.map((group) => (
        <Section
          key={group.title}
          title={group.title}
          actions={
            group.lesson && (
              <Link to={group.lesson.to} className="text-small text-muted-foreground underline decoration-input underline-offset-4 hover:text-foreground">
                相关课程：{group.lesson.label}
              </Link>
            )
          }
        >
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {group.items.map((item) => (
              <li key={item.name} className="overflow-hidden rounded-lg border">
                <div className="bg-sunken px-2 py-1">
                  <Schematic width={150} height={90} minScale={0.6} label={item.name}>
                    {item.draw}
                  </Schematic>
                </div>
                <div className="border-t px-3 py-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-body font-medium">{item.name}</span>
                    {item.designator && <span className="tabular shrink-0 text-caption text-faint-foreground">{item.designator}</span>}
                  </div>
                  <p className="mt-0.5 text-small text-muted-foreground">{item.note}</p>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ))}
    </Page>
  )
}

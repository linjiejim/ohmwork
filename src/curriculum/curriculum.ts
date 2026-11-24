import type { LucideIcon } from "lucide-react"
import { Activity, AudioWaveform, BatteryCharging, Binary, CircuitBoard, Cpu, RadioTower, ScanSearch, Shapes, Thermometer, Triangle, Zap } from "lucide-react"

/*
 * The whole course in one place: stages → chapters → lessons, in learning
 * order. A lesson's text lives in src/content/<chapter id>/<lesson slug>.mdx;
 * everything the site needs to list, link and search it lives here.
 */

export type Level = "入门" | "基础" | "进阶"

export interface LessonMeta {
  slug: string
  title: string
  /** One sentence: what you will be able to do after this lesson. */
  summary: string
  level: Level
  /** Honest reading + playing time. */
  minutes: number
  /** Extra search terms: English names, abbreviations, part numbers. */
  keywords?: string[]
}

export interface Chapter {
  id: string
  title: string
  summary: string
  icon: LucideIcon
  lessons: LessonMeta[]
}

export interface Stage {
  id: string
  title: string
  summary: string
  chapters: Chapter[]
}

export const STAGES: Stage[] = [
  {
    id: "foundations",
    title: "第一阶段 · 电路基础",
    summary: "零基础从这里开始：电是什么，电路怎么算，最常见的元件怎么用。",
    chapters: [
      {
        id: "basics",
        title: "电的基础",
        summary: "电压、电流、电阻，以及把它们连起来的几条定律。",
        icon: Zap,
        lessons: [
          { slug: "voltage-current-resistance", title: "电压、电流与电阻", summary: "用水流的画面理解电路里最基本的三个量。", level: "入门", minutes: 10, keywords: ["voltage", "current", "resistance", "伏特", "安培", "欧姆"] },
          { slug: "ohms-law", title: "欧姆定律", summary: "知道其中两个量，就能算出第三个。", level: "入门", minutes: 8, keywords: ["ohm's law", "V=IR", "伏安特性"] },
          { slug: "power-energy", title: "功率与能量", summary: "算出元件发多少热、电池能撑多久。", level: "入门", minutes: 8, keywords: ["power", "energy", "瓦特", "焦耳", "mAh", "续航"] },
          { slug: "series-parallel", title: "串联与并联", summary: "看懂两种最基本的连接方式，会算等效电阻。", level: "入门", minutes: 10, keywords: ["series", "parallel", "等效电阻"] },
          { slug: "voltage-divider", title: "分压器与基尔霍夫定律", summary: "用两只电阻得到想要的电压，并学会列电路方程。", level: "基础", minutes: 12, keywords: ["voltage divider", "KVL", "KCL", "kirchhoff", "负载效应"] },
        ],
      },
      {
        id: "components",
        title: "基本元件",
        summary: "电阻、电容、电感和各种开关：认识它们，知道怎么选。",
        icon: Shapes,
        lessons: [
          { slug: "resistors", title: "电阻器", summary: "读色环、认封装、选阻值和功率。", level: "入门", minutes: 10, keywords: ["resistor", "色环", "E24", "0603", "贴片", "上拉"] },
          { slug: "capacitors", title: "电容器", summary: "理解充放电和时间常数，知道去耦电容为什么到处都是。", level: "基础", minutes: 12, keywords: ["capacitor", "RC", "时间常数", "去耦", "电解电容", "MLCC"] },
          { slug: "inductors", title: "电感器", summary: "电流不能突变：电感储能、续流和反向电动势。", level: "基础", minutes: 10, keywords: ["inductor", "RL", "续流二极管", "磁珠", "变压器"] },
          { slug: "switches-relays", title: "开关、继电器与保护元件", summary: "认识按键、继电器、保险丝和 TVS，知道它们各自防什么。", level: "入门", minutes: 8, keywords: ["switch", "relay", "fuse", "TVS", "按键", "消抖", "自恢复保险丝"] },
        ],
      },
      {
        id: "ac-signals",
        title: "交流与信号",
        summary: "电压随时间变化之后，电路多了频率这一维。",
        icon: AudioWaveform,
        lessons: [
          { slug: "waveforms", title: "波形与它的参数", summary: "读懂幅度、频率、相位、有效值和占空比。", level: "基础", minutes: 10, keywords: ["waveform", "sine", "RMS", "有效值", "峰峰值", "周期", "相位"] },
          { slug: "impedance", title: "容抗、感抗与阻抗", summary: "电容和电感对不同频率的「阻力」不一样。", level: "基础", minutes: 12, keywords: ["impedance", "reactance", "相量", "phasor"] },
          { slug: "rc-filters", title: "RC 滤波器", summary: "用一只电阻一只电容留下想要的频率。", level: "基础", minutes: 12, keywords: ["low pass", "high pass", "截止频率", "波特图", "bode", "低通", "高通"] },
          { slug: "resonance", title: "LC 谐振", summary: "电感和电容互相倒腾能量，在某个频率上唱歌。", level: "进阶", minutes: 10, keywords: ["resonance", "RLC", "Q 值", "品质因数", "带通", "谐振频率"] },
          { slug: "spectrum", title: "频谱与分贝", summary: "任何波形都是正弦波的叠加；用 dB 描述大小。", level: "进阶", minutes: 12, keywords: ["spectrum", "fourier", "傅里叶", "谐波", "dB", "decibel", "FFT"] },
        ],
      },
    ],
  },
  {
    id: "analog",
    title: "第二阶段 · 半导体与模拟电路",
    summary: "让电路有了「控制」的能力：开关、放大、稳压。",
    chapters: [
      {
        id: "semiconductors",
        title: "半导体器件",
        summary: "二极管、三极管和 MOSFET 是怎么工作的，怎么当开关用。",
        icon: Triangle,
        lessons: [
          { slug: "diodes", title: "二极管", summary: "电流的单向阀：伏安特性、压降和常见用法。", level: "基础", minutes: 10, keywords: ["diode", "PN 结", "肖特基", "schottky", "正向压降", "1N4148"] },
          { slug: "leds-zeners", title: "LED 与稳压二极管", summary: "会算 LED 的限流电阻，会用稳压管得到参考电压。", level: "基础", minutes: 10, keywords: ["LED", "zener", "限流电阻", "稳压管", "TL431"] },
          { slug: "bjt", title: "三极管（BJT）", summary: "用小电流控制大电流：截止、放大、饱和三个状态。", level: "基础", minutes: 14, keywords: ["BJT", "NPN", "PNP", "transistor", "β", "hFE", "饱和", "S8050"] },
          { slug: "mosfet", title: "MOSFET", summary: "用电压控制的开关：阈值电压、导通电阻和驱动。", level: "基础", minutes: 12, keywords: ["MOSFET", "NMOS", "PMOS", "Rds(on)", "Vgs", "栅极", "低边开关", "高边开关"] },
        ],
      },
      {
        id: "analog",
        title: "模拟电路",
        summary: "运放和三极管搭出的放大器、比较器和振荡器。",
        icon: Activity,
        lessons: [
          { slug: "opamp-basics", title: "运算放大器入门", summary: "两条黄金法则，看懂大部分运放电路。", level: "基础", minutes: 12, keywords: ["op-amp", "运放", "虚短", "虚断", "比较器", "comparator", "LM358"] },
          { slug: "opamp-circuits", title: "运放的常用电路", summary: "反相、同相、跟随、加法：增益由两只电阻决定。", level: "进阶", minutes: 14, keywords: ["inverting", "non-inverting", "follower", "增益", "差分放大", "削顶", "轨到轨"] },
          { slug: "transistor-amplifier", title: "三极管放大电路", summary: "给三极管设好静态工作点，让它不失真地放大。", level: "进阶", minutes: 14, keywords: ["common emitter", "共射", "偏置", "静态工作点", "Q 点", "失真"] },
          { slug: "oscillators-555", title: "振荡器与 555 定时器", summary: "电路怎么自己产生节拍：RC 振荡、555 和晶振。", level: "进阶", minutes: 12, keywords: ["555", "oscillator", "astable", "多谐振荡", "晶振", "crystal", "施密特触发器"] },
        ],
      },
      {
        id: "power",
        title: "电源",
        summary: "每个电路都要先解决供电：整流、稳压、电池。",
        icon: BatteryCharging,
        lessons: [
          { slug: "rectifiers", title: "整流与滤波", summary: "把交流变成直流：半波、全波、桥式和滤波电容。", level: "基础", minutes: 12, keywords: ["rectifier", "bridge", "整流桥", "纹波", "ripple", "滤波电容"] },
          { slug: "linear-regulators", title: "线性稳压器", summary: "LDO 怎么稳压，为什么会发烫，什么时候不该用它。", level: "基础", minutes: 10, keywords: ["LDO", "7805", "AMS1117", "压差", "dropout", "散热"] },
          { slug: "switching-regulators", title: "开关电源：Buck 与 Boost", summary: "靠电感和高速开关高效地降压、升压。", level: "进阶", minutes: 14, keywords: ["buck", "boost", "DC-DC", "占空比", "电感电流", "同步整流", "效率"] },
          { slug: "batteries", title: "电池与充电", summary: "看懂容量、放电曲线和锂电池的充电过程。", level: "基础", minutes: 10, keywords: ["battery", "lithium", "锂电池", "18650", "CC/CV", "内阻", "保护板", "TP4056"] },
        ],
      },
    ],
  },
  {
    id: "systems",
    title: "第三阶段 · 数字、单片机与传感器",
    summary: "从 0 和 1 到一个能感知世界的系统。",
    chapters: [
      {
        id: "digital",
        title: "数字电路",
        summary: "逻辑门、触发器，以及模拟世界和数字世界的接口。",
        icon: Binary,
        lessons: [
          { slug: "logic-gates", title: "逻辑电平与逻辑门", summary: "高低电平怎么表示 1 和 0，七种门各做什么。", level: "入门", minutes: 10, keywords: ["logic gate", "AND", "OR", "NOT", "NAND", "XOR", "真值表", "TTL", "CMOS", "74HC"] },
          { slug: "combinational", title: "二进制与组合逻辑", summary: "用门电路做加法、译码和选择。", level: "基础", minutes: 12, keywords: ["binary", "adder", "加法器", "decoder", "译码器", "mux", "十六进制", "数码管"] },
          { slug: "sequential", title: "触发器与时序逻辑", summary: "电路有了记忆：触发器、计数器和移位寄存器。", level: "基础", minutes: 12, keywords: ["flip-flop", "D 触发器", "counter", "shift register", "时钟", "74HC595", "寄存器"] },
          { slug: "adc-dac", title: "ADC 与 DAC", summary: "采样、量化、分辨率，以及混叠是怎么回事。", level: "基础", minutes: 12, keywords: ["ADC", "DAC", "采样率", "分辨率", "量化", "aliasing", "奈奎斯特", "参考电压"] },
          { slug: "pwm", title: "PWM 脉宽调制", summary: "只用开和关，得到中间的亮度和速度。", level: "入门", minutes: 8, keywords: ["PWM", "duty cycle", "占空比", "调光", "舵机", "电机调速"] },
        ],
      },
      {
        id: "mcu",
        title: "单片机与通信接口",
        summary: "单片机的引脚怎么用，芯片之间怎么说话。",
        icon: Cpu,
        lessons: [
          { slug: "gpio", title: "单片机与 GPIO", summary: "推挽、开漏、上拉下拉，按键和 LED 怎么接。", level: "入门", minutes: 12, keywords: ["GPIO", "MCU", "上拉", "下拉", "pull-up", "开漏", "open drain", "推挽", "消抖", "Arduino", "STM32", "ESP32"] },
          { slug: "uart", title: "UART 串口", summary: "两根线、一个约定好的波特率：一帧数据长什么样。", level: "基础", minutes: 10, keywords: ["UART", "serial", "波特率", "baud", "TX", "RX", "起始位", "RS-232", "USB 转串口"] },
          { slug: "i2c", title: "I²C 总线", summary: "两根线挂很多芯片：地址、应答和上拉电阻。", level: "基础", minutes: 12, keywords: ["I2C", "IIC", "SDA", "SCL", "ACK", "从机地址", "上拉电阻"] },
          { slug: "spi", title: "SPI 总线", summary: "四根线的高速同步通信：时钟极性和相位。", level: "基础", minutes: 10, keywords: ["SPI", "MOSI", "MISO", "SCK", "CS", "CPOL", "CPHA", "片选"] },
          { slug: "buses-overview", title: "CAN、RS-485 与 USB 一览", summary: "走得更远、更抗干扰的总线，以及怎么选接口。", level: "进阶", minutes: 10, keywords: ["CAN", "RS-485", "USB", "差分信号", "终端电阻", "1-Wire", "I2S"] },
        ],
      },
      {
        id: "sensors",
        title: "传感器",
        summary: "把温度、光、运动和力变成电信号，再读进单片机。",
        icon: Thermometer,
        lessons: [
          { slug: "sensor-basics", title: "传感器与信号调理", summary: "灵敏度、量程、精度和分辨率，以及信号怎么送进 ADC。", level: "基础", minutes: 10, keywords: ["sensor", "灵敏度", "精度", "分辨率", "信号调理", "校准", "滤波"] },
          { slug: "temperature", title: "温度传感器", summary: "热敏电阻、数字温度芯片和热电偶，各适合什么场合。", level: "基础", minutes: 10, keywords: ["NTC", "thermistor", "热敏电阻", "DS18B20", "热电偶", "PT100", "B 值"] },
          { slug: "light-distance", title: "光与距离传感器", summary: "光敏电阻、光电二极管、红外和超声波测距。", level: "基础", minutes: 12, keywords: ["LDR", "photodiode", "光敏", "红外", "超声波", "HC-SR04", "ToF", "飞行时间"] },
          { slug: "motion", title: "运动与位置传感器", summary: "加速度计、陀螺仪、霍尔元件和编码器。", level: "进阶", minutes: 12, keywords: ["IMU", "accelerometer", "gyroscope", "MPU6050", "霍尔", "hall", "encoder", "编码器", "磁力计"] },
          { slug: "force-environment", title: "力、压力与环境传感器", summary: "应变片和电桥怎么称重，湿度气压气体怎么测。", level: "进阶", minutes: 12, keywords: ["strain gauge", "应变片", "惠斯通电桥", "HX711", "称重", "湿度", "气压", "BME280", "气体"] },
        ],
      },
    ],
  },
  {
    id: "practice",
    title: "第四阶段 · 无线与设计实战",
    summary: "射频入门，再把学过的东西变成一张原理图和一块板子。",
    chapters: [
      {
        id: "rf",
        title: "射频与无线",
        summary: "信号离开导线之后：电磁波、调制、天线和匹配。",
        icon: RadioTower,
        lessons: [
          { slug: "em-waves", title: "电磁波与无线电频谱", summary: "频率、波长，以及各个频段都被谁占着。", level: "基础", minutes: 10, keywords: ["RF", "wavelength", "波长", "频段", "2.4G", "Sub-GHz", "ISM"] },
          { slug: "modulation", title: "调制：把信息装上载波", summary: "调幅、调频、调相，以及数字调制和星座图。", level: "进阶", minutes: 14, keywords: ["modulation", "AM", "FM", "ASK", "FSK", "PSK", "QAM", "星座图", "带宽"] },
          { slug: "antennas", title: "天线", summary: "天线怎么把电流变成电磁波：长度、方向图和增益。", level: "进阶", minutes: 12, keywords: ["antenna", "dipole", "偶极子", "增益", "dBi", "方向图", "极化", "PCB 天线"] },
          { slug: "transmission-lines", title: "传输线与阻抗匹配", summary: "为什么是 50 Ω，不匹配时信号怎么被反射回来。", level: "进阶", minutes: 14, keywords: ["transmission line", "50 欧", "反射", "驻波比", "VSWR", "回波损耗", "史密斯圆图", "特征阻抗", "微带线"] },
          { slug: "link-budget", title: "链路预算与常见无线技术", summary: "算一算信号能传多远；Wi-Fi、蓝牙、LoRa、NFC 各自的位置。", level: "进阶", minutes: 12, keywords: ["link budget", "dBm", "接收灵敏度", "路径损耗", "Wi-Fi", "BLE", "蓝牙", "LoRa", "NFC", "Zigbee"] },
        ],
      },
      {
        id: "schematics",
        title: "读懂原理图",
        summary: "把一张陌生的原理图拆成认识的小块。",
        icon: ScanSearch,
        lessons: [
          { slug: "symbols", title: "原理图符号", summary: "认全常见符号，分清国标和美标两种画法。", level: "入门", minutes: 10, keywords: ["symbol", "符号", "位号", "国标", "IEC", "ANSI"] },
          { slug: "reading-schematics", title: "原理图怎么读", summary: "网络标号、电源符号、总线：按信号流向读图。", level: "基础", minutes: 12, keywords: ["schematic", "net label", "网络标号", "电源符号", "框图", "信号流"] },
          { slug: "common-blocks", title: "常见单元电路", summary: "去耦、复位、晶振、电平转换、防反接：见到就认得。", level: "基础", minutes: 14, keywords: ["decoupling", "去耦", "复位电路", "电平转换", "防反接", "ESD", "指示灯", "自动下载电路"] },
          { slug: "datasheets", title: "读懂数据手册", summary: "极限参数、典型值和曲线图，从哪儿读起。", level: "基础", minutes: 10, keywords: ["datasheet", "数据手册", "绝对最大额定值", "典型值", "规格书", "引脚图"] },
        ],
      },
      {
        id: "design",
        title: "电路与 PCB 设计",
        summary: "从一个想法到一块能工作的板子，以及怎么调试它。",
        icon: CircuitBoard,
        lessons: [
          { slug: "design-flow", title: "从需求到电路：设计流程", summary: "需求、框图、选型、原理图、PCB、打样、调试的全过程。", level: "基础", minutes: 10, keywords: ["design flow", "选型", "BOM", "框图", "打样", "EDA", "KiCad", "立创 EDA"] },
          { slug: "pcb-basics", title: "PCB 基础", summary: "层、走线、过孔和封装；线该画多宽。", level: "基础", minutes: 12, keywords: ["PCB", "走线", "过孔", "via", "铜厚", "线宽", "封装", "丝印", "阻焊", "四层板"] },
          { slug: "layout-emc", title: "布局、接地与 EMC", summary: "电流总要回来：回流路径、去耦环路和干扰。", level: "进阶", minutes: 14, keywords: ["layout", "grounding", "接地", "回流路径", "EMC", "EMI", "地平面", "串扰"] },
          { slug: "measurement", title: "仪器与调试", summary: "万用表、示波器、逻辑分析仪怎么用，板子不工作先查什么。", level: "基础", minutes: 12, keywords: ["multimeter", "oscilloscope", "万用表", "示波器", "逻辑分析仪", "触发", "探头", "调试"] },
        ],
      },
    ],
  },
]

export interface LessonRef {
  stage: Stage
  chapter: Chapter
  lesson: LessonMeta
  /** "basics/ohms-law": the lesson's id everywhere (URL, progress, content path). */
  key: string
  /** Position in the whole course, from 0. */
  index: number
}

export const CHAPTERS: Chapter[] = STAGES.flatMap((s) => s.chapters)

export const LESSONS: LessonRef[] = STAGES.flatMap((stage) =>
  stage.chapters.flatMap((chapter) => chapter.lessons.map((lesson) => ({ stage, chapter, lesson, key: `${chapter.id}/${lesson.slug}`, index: 0 }))),
).map((ref, index) => ({ ...ref, index }))

const byKey = new Map(LESSONS.map((l) => [l.key, l]))

export function findLesson(chapterId: string | undefined, slug: string | undefined): LessonRef | undefined {
  return byKey.get(`${chapterId}/${slug}`)
}

export function findChapter(chapterId: string | undefined): { stage: Stage; chapter: Chapter } | undefined {
  for (const stage of STAGES) {
    const chapter = stage.chapters.find((c) => c.id === chapterId)
    if (chapter) return { stage, chapter }
  }
  return undefined
}

export const lessonPath = (key: string) => `/learn/${key}`
export const chapterPath = (chapterId: string) => `/learn/${chapterId}`

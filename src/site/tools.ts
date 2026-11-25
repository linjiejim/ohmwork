import { BatteryMedium, Binary, Combine, Divide, Hourglass, Lightbulb, Omega, Palette, RadioTower, Timer, Volume2, Waves, type LucideIcon } from "lucide-react"

/*
 * The toolbox's list: names, icons, order and search words. The sidebar's ⌘K palette reads it, so it
 * stays free of the calculators themselves (those, with KaTeX, load with the tools page).
 * Ids are URLs (/tools/<id>): don't rename one that has shipped.
 */
export interface ToolMeta {
  id: string
  title: string
  icon: LucideIcon
  /** Extra words the ⌘K palette matches. */
  keywords: string[]
  /** The lesson that explains it: "basics/ohms-law". */
  lesson?: string
}

export const TOOL_GROUPS: { label: string; tools: ToolMeta[] }[] = [
  {
    label: "元件",
    tools: [
      { id: "color-code", title: "电阻色环", icon: Palette, keywords: ["color code", "resistor", "色环", "色码", "读数", "E24", "E96"], lesson: "components/resistors" },
      { id: "led", title: "LED 限流电阻", icon: Lightbulb, keywords: ["LED", "限流电阻", "current limiting", "压降"], lesson: "semiconductors/leds-zeners" },
      { id: "series-parallel", title: "电阻串联与并联", icon: Combine, keywords: ["series", "parallel", "串联", "并联", "等效电阻"], lesson: "basics/series-parallel" },
    ],
  },
  {
    label: "电路",
    tools: [
      { id: "ohm", title: "欧姆定律与功率", icon: Omega, keywords: ["ohm's law", "V=IR", "欧姆", "电流", "电压", "功率"], lesson: "basics/ohms-law" },
      { id: "divider", title: "分压器", icon: Divide, keywords: ["voltage divider", "分压", "分压电阻"], lesson: "basics/voltage-divider" },
      { id: "battery", title: "电池续航", icon: BatteryMedium, keywords: ["battery", "mAh", "续航", "电池"], lesson: "basics/power-energy" },
    ],
  },
  {
    label: "交流与射频",
    tools: [
      { id: "rc", title: "RC 时间常数与截止频率", icon: Hourglass, keywords: ["RC", "time constant", "cutoff", "时间常数", "截止频率", "滤波"], lesson: "ac-signals/rc-filters" },
      { id: "lc", title: "LC 谐振频率", icon: Waves, keywords: ["LC", "resonance", "谐振", "谐振频率"], lesson: "ac-signals/resonance" },
      { id: "decibel", title: "分贝换算", icon: Volume2, keywords: ["dB", "dBm", "decibel", "分贝"], lesson: "ac-signals/spectrum" },
      { id: "wavelength", title: "频率与波长", icon: RadioTower, keywords: ["wavelength", "frequency", "波长", "天线", "antenna"], lesson: "rf/em-waves" },
    ],
  },
  {
    label: "数字与定时",
    tools: [
      { id: "adc", title: "ADC 分辨率", icon: Binary, keywords: ["ADC", "LSB", "分辨率", "参考电压"], lesson: "digital/adc-dac" },
      { id: "555", title: "555 无稳态振荡", icon: Timer, keywords: ["555", "astable", "振荡", "占空比"], lesson: "analog/oscillators-555" },
    ],
  },
]

/** Every tool in on-screen order. The first is what /tools opens on a wide screen. */
export const TOOLS: ToolMeta[] = TOOL_GROUPS.flatMap((g) => g.tools)

export const toolPath = (id: string) => `/tools/${id}`

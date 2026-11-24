import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button, ControlField, Lab, LabControls, LabStage } from "@/lab"

interface Stage {
  name: string
  /** What this stage hands to the next one. */
  output: string
  /** The same stage in the lesson's running project. */
  example: string
  /** The classic way to get it wrong. */
  mistake: string
}

const STAGES: Stage[] = [
  {
    name: "需求",
    output: "一页需求表：功能、供电、尺寸、成本、使用环境，每项都有数字。",
    example: "每分钟记录一次温湿度；一颗 CR2032 用满一年；板子不超过 40 × 30 mm；物料 30 元以内；室内使用。",
    mistake: "需求只有一句「做个温湿度计」。画到一半才发现续航和尺寸没定，前面的选型全部作废。",
  },
  {
    name: "框图",
    output: "系统框图：一个方块一个功能，连线上标出接口和电压。",
    example: "电池 → 单片机；单片机和温湿度传感器走 I²C，和 Flash 存储走 SPI；引出下载口和串口。",
    mistake: "跳过框图直接画原理图，画完才发现接口不够用，或者两边的电压对不上。",
  },
  {
    name: "选型",
    output: "关键器件清单：型号、封装、单价、哪里有货。",
    example: "休眠电流 2 μA 级的低功耗单片机；I²C 接口的温湿度传感器（SHT30 这一类）；CR2032 电池座。",
    mistake: "选了买不到或快停产的型号；选了自己焊不了的封装（BGA、0.4 mm 间距的 QFN）。",
  },
  {
    name: "原理图",
    output: "完整的原理图：每个器件都照手册的典型应用电路接好。",
    example: "单片机最小系统、传感器、I²C 的两只 4.7 kΩ 上拉、电池座、下载口。",
    mistake: "凭印象画引脚；抄参考设计时漏掉手册脚注里要求的那只电容。",
  },
  {
    name: "检查",
    output: "一张逐项打勾的检查清单，最好请另一个人再看一遍。",
    example: "每个电源脚旁有 100 nF；I²C 有上拉；没用到的引脚按手册处理；电源和 I²C 留了测试点。",
    mistake: "忘了引出下载口；TX 和 RX 没有交叉；电源正负极、二极管方向画反。",
  },
  {
    name: "PCB",
    output: "布局布线完成、规则检查（DRC）零报错的 PCB 文件。",
    example: "去耦电容紧贴芯片电源脚；传感器放在板边，远离会发热的器件。",
    mistake: "封装和实物不符（引脚顺序、焊盘大小）；DRC 的报错没看完就下单。",
  },
  {
    name: "打样焊接",
    output: "Gerber、钻孔文件和 BOM 交给工厂；拿回几块板子，焊好第一块。",
    example: "打 5 块样板，先只焊 1 块；剩下的留着对比和返工。",
    mistake: "BOM 里的型号和封装对不上；有极性的元件焊反；QFN 底下虚焊。",
  },
  {
    name: "上电调试",
    output: "测试记录：各路电压、工作电流、每项功能是否正常。",
    example: "可调电源限流 50 mA 上电；先量 3 V 电源；再量休眠电流是不是几微安。",
    mistake: "焊完直接装电池；没有限流，哪里一短路就冒烟。",
  },
  {
    name: "迭代",
    output: "问题清单，以及同步改好的原理图和 PCB（下一版）。",
    example: "第一版靠飞线改好了 I²C 接反的问题，把改动画回原理图，再出第二版。",
    mistake: "飞线改好就算完事，没有记下来；第二版把同一个错误原样再做一遍。",
  },
]

/** Stepper through the design flow: what each stage produces, in the logger project, and how it usually goes wrong. */
export function DesignFlowLab() {
  const [step, setStep] = React.useState(0)
  const s = STAGES[step]
  return (
    <Lab title="设计流程走一遍" hint="点任意一步，看它要交出什么、在温湿度记录器里是什么样、最容易错在哪儿。" onReset={() => setStep(0)}>
      <LabStage>
        <ol className="flex flex-wrap gap-1.5">
          {STAGES.map((st, i) => (
            <li key={st.name}>
              <Button size="sm" variant={i === step ? "primary" : "secondary"} aria-pressed={i === step} onClick={() => setStep(i)}>
                <span className="tabular">{i + 1}</span>
                {st.name}
              </Button>
            </li>
          ))}
        </ol>
      </LabStage>
      <dl aria-live="polite" className="grid gap-x-8 gap-y-3 px-4 py-3 text-small @xl:grid-cols-3">
        <div>
          <dt className="text-caption text-faint-foreground">这一步交出什么</dt>
          <dd className="mt-0.5">{s.output}</dd>
        </div>
        <div>
          <dt className="text-caption text-faint-foreground">在温湿度记录器里</dt>
          <dd className="mt-0.5">{s.example}</dd>
        </div>
        <div>
          <dt className="text-caption text-faint-foreground">常见错误</dt>
          <dd className="mt-0.5 text-warning">{s.mistake}</dd>
        </div>
      </dl>
      <LabControls>
        <ControlField label={`第 ${step + 1} 步，共 ${STAGES.length} 步：${s.name}`}>
          <Button size="sm" disabled={step === 0} onClick={() => setStep((v) => Math.max(0, v - 1))}>
            <ChevronLeft aria-hidden />
            上一步
          </Button>
          <Button size="sm" disabled={step === STAGES.length - 1} onClick={() => setStep((v) => Math.min(STAGES.length - 1, v + 1))}>
            下一步
            <ChevronRight aria-hidden />
          </Button>
        </ControlField>
      </LabControls>
    </Lab>
  )
}

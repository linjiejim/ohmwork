import * as React from "react"
import { Check, X as Cross } from "lucide-react"
import { cn } from "@/lib/utils"
import { Battery, Bjt, Button, Capacitor, Crystal, Diode, Fuse, Gate, Ground, Inductor, Lab, LabNote, LabStage, Led, Mosfet, OpAmp, Resistor, Schematic, Switch, Wire } from "@/lab"
import { shuffled } from "./kit"

/*
 * Canvas 200 × 100, every symbol centred on (100, 50). Transistors sit at x − 6 so the
 * body (gate / base lead to the right-hand leads) looks centred; the op-amp at x − 2.
 * No designators or values are drawn: they would give the answer away.
 */
const X = 100
const Y = 50

interface Question {
  /** The right name. */
  name: string
  /** Three wrong names that look plausible next to this symbol. */
  wrong: [string, string, string]
  why: string
  draw: React.ReactNode
}

const DIODES = ["普通二极管", "稳压二极管", "肖特基二极管", "发光二极管"]
const TRANSISTORS = ["NPN 三极管", "PNP 三极管", "N 沟道 MOSFET", "P 沟道 MOSFET"]
const others = (all: string[], right: string) => all.filter((n) => n !== right) as [string, string, string]

const QUESTIONS: Question[] = [
  { name: "电阻", wrong: ["电感", "保险丝", "晶振"], why: "折线是美标的电阻画法，位号 R。", draw: <Resistor x={X} y={Y} /> },
  { name: "电阻", wrong: ["保险丝", "电容", "晶振"], why: "国标和 IEC 把电阻画成空心矩形，位号 R。保险丝的矩形里有一根线穿过。", draw: <Resistor x={X} y={Y} variant="iec" /> },
  { name: "电解电容", wrong: ["无极性电容", "电池", "晶振"], why: "两块一样长的极板加一个「+」号：有极性的电解电容，位号 C。电池的两块板一长一短。", draw: <Capacitor x={X} y={Y} polarized /> },
  { name: "电容", wrong: ["电池", "晶振", "开关"], why: "两块平行极板、没有「+」号：无极性电容，位号 C。", draw: <Capacitor x={X} y={Y} /> },
  { name: "电感", wrong: ["电阻", "保险丝", "晶振"], why: "一串半圆是线圈：电感，位号 L。", draw: <Inductor x={X} y={Y} /> },
  { name: "普通二极管", wrong: others(DIODES, "普通二极管"), why: "三角形加一条直竖线，没有折角也没有箭头：普通二极管，位号 D。竖线一端是负极。", draw: <Diode x={X} y={Y} /> },
  { name: "稳压二极管", wrong: others(DIODES, "稳压二极管"), why: "竖线两端带折角：稳压二极管（齐纳管），反向接在电路里用。", draw: <Diode x={X} y={Y} variant="zener" /> },
  { name: "肖特基二极管", wrong: others(DIODES, "肖特基二极管"), why: "竖线两端弯成 S 形：肖特基二极管，压降低、速度快。", draw: <Diode x={X} y={Y} variant="schottky" /> },
  { name: "发光二极管", wrong: others(DIODES, "发光二极管"), why: "两个向外的箭头表示发光：LED，位号 D 或 LED。", draw: <Led x={X} y={Y + 4} /> },
  { name: "NPN 三极管", wrong: others(TRANSISTORS, "NPN 三极管"), why: "基极是一根粗竖线，发射极上的箭头朝外：NPN 三极管，位号 Q。", draw: <Bjt x={X - 6} y={Y} /> },
  { name: "PNP 三极管", wrong: others(TRANSISTORS, "PNP 三极管"), why: "箭头朝里、指向基极：PNP 三极管。", draw: <Bjt x={X - 6} y={Y} type="pnp" /> },
  { name: "N 沟道 MOSFET", wrong: others(TRANSISTORS, "N 沟道 MOSFET"), why: "栅极和沟道之间隔着一道缝（绝缘栅），箭头指向沟道：N 沟道 MOSFET，位号 Q。", draw: <Mosfet x={X - 6} y={Y} /> },
  { name: "P 沟道 MOSFET", wrong: others(TRANSISTORS, "P 沟道 MOSFET"), why: "绝缘栅，箭头背离沟道：P 沟道 MOSFET。", draw: <Mosfet x={X - 6} y={Y} type="p" /> },
  { name: "晶振", wrong: ["电容", "保险丝", "电池"], why: "两块极板中间夹一块晶体：晶振，位号 Y。", draw: <Crystal x={X} y={Y} /> },
  { name: "保险丝", wrong: ["电阻", "晶振", "电感"], why: "矩形中间穿过一根线：保险丝，位号 F。", draw: <Fuse x={X} y={Y} /> },
  { name: "电池", wrong: ["电解电容", "电容", "晶振"], why: "一长一短两块板，长的是正极：电池，位号 BT。", draw: <Battery x={X} y={Y} /> },
  { name: "开关", wrong: ["保险丝", "二极管", "电容"], why: "一根抬起的杠杆：开关，位号 SW。按下去两端接通。", draw: <Switch x={X} y={Y + 4} /> },
  { name: "运算放大器", wrong: ["与门", "非门", "二极管"], why: "三角形左边两个输入，标着 − 和 +：运算放大器，位号 U。非门的输出端有个小圆圈，也只有一个输入。", draw: <OpAmp x={X - 2} y={Y} /> },
  { name: "非门", wrong: ["运算放大器", "二极管", "与门"], why: "三角形加输出端的小圆圈：非门，输出和输入相反。整颗芯片的位号是 U。", draw: <Gate x={X} y={Y} type="not" /> },
  {
    name: "地",
    wrong: ["电源", "天线", "测试点"],
    why: "由长到短的几条横线：地（GND），0 V 参考点。画着它的地方都连在一起。",
    draw: (
      <>
        <Wire points={[[X, Y - 26], [X, Y - 6]]} />
        <Ground x={X} y={Y - 6} />
      </>
    ),
  },
]

/** Seed of the first round; each "再来一轮" moves to the next seed, so every round has its own fixed order. */
const SEED = 2024

/** A symbol-naming game: one symbol, four names, a one-line explanation and a running score. */
export function SymbolQuizLab() {
  const [round, setRound] = React.useState(0)
  const [pos, setPos] = React.useState(0)
  const [picked, setPicked] = React.useState<string | null>(null)
  const [score, setScore] = React.useState(0)

  const order = React.useMemo(() => shuffled(QUESTIONS, SEED + round), [round])
  const q = order[Math.min(pos, order.length - 1)]
  const options = React.useMemo(() => shuffled([q.name, ...q.wrong], SEED * 31 + round * 101 + pos), [q, round, pos])
  const answered = picked != null
  const right = picked === q.name
  const last = pos === order.length - 1

  const pick = (name: string) => {
    if (answered) return
    setPicked(name)
    if (name === q.name) setScore((s) => s + 1)
  }
  const next = () => {
    if (!answered) return
    if (last) {
      setRound((r) => r + 1)
      setPos(0)
      setScore(0)
    } else {
      setPos((p) => p + 1)
    }
    setPicked(null)
  }
  const reset = () => {
    setRound(0)
    setPos(0)
    setPicked(null)
    setScore(0)
  }

  const done = pos + (answered ? 1 : 0)
  return (
    <Lab title="认符号" hint="看图选名字。答完会告诉你怎么从图上认出来，再点「下一题」。" onReset={reset}>
      <LabStage>
        <p className="mb-2 text-center text-small text-muted-foreground">
          第 <span className="tabular">{pos + 1}</span> 题，共 <span className="tabular">{order.length}</span> 题：这是什么符号？
        </p>
        <Schematic width={200} height={100} label="待辨认的电路符号">
          {q.draw}
        </Schematic>
      </LabStage>
      <div className="grid gap-2 px-4 py-3 @md:grid-cols-2" role="group" aria-label="选项">
        {options.map((name) => {
          const isRight = answered && name === q.name
          const isWrong = answered && name === picked && !right
          return (
            <Button
              key={name}
              disabled={answered && !isRight && !isWrong}
              onClick={() => pick(name)}
              aria-pressed={name === picked}
              className={cn("justify-start", isRight && "border-success bg-success-subtle hover:bg-success-subtle", isWrong && "border-destructive bg-destructive-subtle hover:bg-destructive-subtle")}
            >
              {isRight ? <Check aria-hidden className="text-success" /> : isWrong ? <Cross aria-hidden className="text-destructive" /> : null}
              {name}
            </Button>
          )
        })}
      </div>
      <LabNote tone={!answered ? "neutral" : right ? "good" : "bad"}>
        {!answered ? "选一个名字。" : `${right ? "答对了。" : `不对，这是${q.name}。`}${q.why}`}
      </LabNote>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <p className="text-small text-muted-foreground">
          得分 <span className="tabular font-medium text-foreground">{score}</span> / <span className="tabular">{done}</span>
          {answered && last && `，这一轮答完了${score === order.length ? "，全对" : ""}`}
        </p>
        <Button size="sm" variant={answered ? "primary" : "secondary"} disabled={!answered} onClick={next}>
          {last ? "再来一轮" : "下一题"}
        </Button>
      </div>
    </Lab>
  )
}

import * as React from "react"
import { catVar } from "@/lib/categorical"
import { cn } from "@/lib/utils"
import { ControlField, Gate, Ground, Lab, LabControls, LabNote, LabReadouts, LabStage, Label, Led, Readout, Resistor, Schematic, Select, SwitchField, Tex, Wire, trace } from "@/lab"

type Kind = "and" | "or" | "not" | "nand" | "nor" | "xor" | "xnor"

/** The Boolean expression of each gate is TeX: \overline is the "NOT" bar. */
const GATES: Record<Kind, { name: string; english: string; expr: string; chip: string; rule: string; fn: (a: boolean, b: boolean) => boolean }> = {
  and: { name: "与门", english: "AND", expr: String.raw`A \cdot B`, chip: "74HC08", rule: "两个输入都是 1，输出才是 1", fn: (a, b) => a && b },
  or: { name: "或门", english: "OR", expr: "A + B", chip: "74HC32", rule: "只要有一个输入是 1，输出就是 1", fn: (a, b) => a || b },
  not: { name: "非门", english: "NOT", expr: String.raw`\overline{A}`, chip: "74HC04", rule: "输出总是和输入相反", fn: (a) => !a },
  nand: { name: "与非门", english: "NAND", expr: String.raw`\overline{A \cdot B}`, chip: "74HC00", rule: "与门的结果再取反：只有两个输入都是 1 时输出 0", fn: (a, b) => !(a && b) },
  nor: { name: "或非门", english: "NOR", expr: String.raw`\overline{A + B}`, chip: "74HC02", rule: "或门的结果再取反：只有两个输入都是 0 时输出 1", fn: (a, b) => !(a || b) },
  xor: { name: "异或门", english: "XOR", expr: String.raw`A \oplus B`, chip: "74HC86", rule: "两个输入不一样时输出 1", fn: (a, b) => a !== b },
  xnor: { name: "同或门", english: "XNOR", expr: String.raw`\overline{A \oplus B}`, chip: "74HC7266", rule: "两个输入一样时输出 1", fn: (a, b) => a === b },
}

const OPTIONS = (Object.keys(GATES) as Kind[]).map((k) => ({ value: k, label: `${GATES[k].name} ${GATES[k].english}` }))

const bit = (on: boolean) => (on ? 1 : 0)

/** A clickable logic input drawn on the schematic: a pill that reads "A = 1". Its right edge is at (x + 24, y). */
function InputPad({ x, y, name, on, onClick }: { x: number; y: number; name: string; on: boolean; onClick: () => void }) {
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`翻转输入 ${name}，现在是 ${bit(on)}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick()
        }
      }}
      className="cursor-pointer outline-none focus-visible:[&_rect]:stroke-ring"
    >
      <rect x={x - 24} y={y - 13} width={48} height={26} rx={6} fill={on ? catVar("orange", true) : "var(--background)"} stroke={on ? trace.voltage : "var(--input)"} />
      <Label x={x} y={y + 4.5} weight={600}>
        {name} = {bit(on)}
      </Label>
    </g>
  )
}

/**
 * One gate on the bench: flip A and B, watch the leads light up and the LED
 * follow the output, with the truth table tracking the current row.
 *
 * Layout (300 × 150): input pads end at x = 60; gate at (130, 60) with inputs
 * (100, 52) / (100, 68) — or (100, 60) for NOT — and output (160, 60);
 * 1 kΩ resistor (180…240, 60); LED standing at (262, 90), anode (262, 60),
 * cathode (262, 120) on ground.
 */
export function LogicGateLab() {
  const [kind, setKind] = React.useState<Kind>("and")
  const [a, setA] = React.useState(true)
  const [b, setB] = React.useState(false)
  const g = GATES[kind]
  const single = kind === "not"
  const y = g.fn(a, b)
  // 5 V supply, about 2 V across a red LED, 1 kΩ in series
  const iLed = y ? (5 - 2) / 1000 : 0
  const hot = (on: boolean) => (on ? { color: trace.voltage, width: 2.25 } : {})
  const rows: boolean[][] = single
    ? [[false], [true]]
    : [
        [false, false],
        [false, true],
        [true, false],
        [true, true],
      ]
  return (
    <Lab
      title="逻辑门实验台"
      hint="换一种门，拨动输入 A 和 B（图上的输入也能点）。橙色的线是高电平，LED 亮表示输出 1。"
      onReset={() => {
        setKind("and")
        setA(true)
        setB(false)
      }}
    >
      <LabStage>
        <div className="grid items-center gap-x-8 gap-y-4 @xl:grid-cols-[auto_minmax(0,1fr)]">
          <Schematic width={300} height={150} label={`${g.name}：输入 A${single ? "" : "、B"}，输出经过限流电阻点亮一颗 LED`}>
            {single ? (
              <Wire points={[[60, 36], [80, 36], [80, 60], [100, 60]]} {...hot(a)} />
            ) : (
              <>
                <Wire points={[[60, 36], [80, 36], [80, 52], [100, 52]]} {...hot(a)} />
                <Wire points={[[60, 84], [80, 84], [80, 68], [100, 68]]} {...hot(b)} />
              </>
            )}
            <Wire points={[[160, 60], [180, 60]]} current={iLed} scale={0.004} {...hot(y)} />
            <Wire points={[[240, 60], [262, 60]]} current={iLed} scale={0.004} />
            <Gate x={130} y={60} type={kind} a={a} b={b} out={y} label={g.name} />
            <Resistor x={210} y={60} value="1 kΩ" />
            <Led x={262} y={90} rot={90} color="red" brightness={y ? 1 : 0} label="LED" labelSide="left" />
            <Ground x={262} y={120} />
            <Label x={170} y={50} color={y ? trace.voltage : undefined} muted={!y}>
              Y = {bit(y)}
            </Label>
            <InputPad x={36} y={36} name="A" on={a} onClick={() => setA((v) => !v)} />
            {!single && <InputPad x={36} y={84} name="B" on={b} onClick={() => setB((v) => !v)} />}
          </Schematic>
          <table className="tabular mx-auto w-full max-w-60 border-collapse text-center text-body">
            <caption className="mb-1.5 text-caption text-muted-foreground">{g.name}的真值表</caption>
            <thead>
              <tr className="border-b text-small text-muted-foreground">
                <th scope="col" className="px-3 py-1.5 font-medium">
                  A
                </th>
                {!single && (
                  <th scope="col" className="px-3 py-1.5 font-medium">
                    B
                  </th>
                )}
                <th scope="col" className="px-3 py-1.5 font-medium">
                  Y
                </th>
                <th scope="col" className="w-12 px-1 py-1.5 font-medium">
                  <span className="sr-only">当前行</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([ra, rb = false]) => {
                const current = ra === a && (single || rb === b)
                return (
                  <tr key={`${bit(ra)}${bit(rb)}`} aria-current={current ? "true" : undefined} className={cn("border-b last:border-b-0", current ? "bg-selected font-semibold" : "text-muted-foreground")}>
                    <td className="px-3 py-1.5">{bit(ra)}</td>
                    {!single && <td className="px-3 py-1.5">{bit(rb)}</td>}
                    <td className="px-3 py-1.5">{bit(g.fn(ra, rb))}</td>
                    <td className="px-1 py-1.5 text-caption font-normal text-muted-foreground">{current ? "当前" : ""}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </LabStage>
      <LabControls columns={3}>
        <ControlField label="逻辑门">
          <Select options={OPTIONS} value={kind} onValueChange={(v) => setKind(v as Kind)} aria-label="逻辑门" />
        </ControlField>
        <SwitchField label="输入 A" checked={a} onChange={setA} hint={a ? "高电平（1）" : "低电平（0）"} />
        {!single && <SwitchField label="输入 B" checked={b} onChange={setB} hint={b ? "高电平（1）" : "低电平（0）"} />}
      </LabControls>
      <LabReadouts>
        <Readout label="表达式" value={<Tex>{`Y = ${g.expr}`}</Tex>} />
        <Readout label="输出 Y" value={`${bit(y)}（${y ? "高" : "低"}电平）`} color={y ? trace.voltage : undefined} />
        <Readout label="74HC 系列型号" value={g.chip} />
      </LabReadouts>
      <LabNote>
        {g.name}：{g.rule}。现在 A = {bit(a)}
        {single ? "" : `、B = ${bit(b)}`}，所以 Y = {bit(y)}，LED {y ? "点亮" : "熄灭"}。
      </LabNote>
    </Lab>
  )
}

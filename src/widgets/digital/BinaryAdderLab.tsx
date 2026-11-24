import * as React from "react"
import { cn } from "@/lib/utils"
import { Gate, Junction, Lab, LabNote, LabReadouts, LabStage, Label, Port, Readout, Schematic, Tex, Wire, trace } from "@/lab"

const bitOf = (n: number, i: number) => (n >> i) & 1
const bin = (n: number, width: number) => n.toString(2).padStart(width, "0")
const hex = (n: number) => `0x${n.toString(16).toUpperCase()}`

/** Columns of the sum as written on paper, left to right: the carry-out column, then bits 3…0. */
const COLUMNS = [4, 3, 2, 1, 0]

function Cell({ selected, edge, children }: { selected?: boolean; edge?: "top" | "bottom"; children?: React.ReactNode }) {
  return <div className={cn("flex h-10 items-center justify-center", selected && "bg-selected", edge === "top" && "rounded-t-md", edge === "bottom" && "rounded-b-md")}>{children}</div>
}

function RowLabel({ children }: { children?: React.ReactNode }) {
  return <div className="flex h-10 items-center justify-end pr-2 text-caption text-muted-foreground">{children}</div>
}

/** A wire that turns orange and thicker when it carries a 1. */
function Net({ on, points }: { on: boolean; points: readonly (readonly [number, number])[] }) {
  return <Wire points={points} color={on ? trace.voltage : undefined} width={on ? 2.25 : undefined} />
}

/**
 * One full adder at gate level, lit up with the values of the chosen column.
 *
 * Layout (300 × 186). Gates: AND (88, 40) and XOR (88, 100) take A and B;
 * AND (190, 108) and XOR (190, 160) take A⊕B and Cin; OR (258, 100) merges the
 * two carries. A gate's inputs sit at (x − 30, y ∓ 8), its output at (x + 30, y).
 * Two wires cross without joining: at (46, 48) and at (146, 152).
 */
function FullAdder({ a, b, cin }: { a: boolean; b: boolean; cin: boolean }) {
  const p = a !== b // A ⊕ B
  const g = a && b // carry made by this column alone
  const h = p && cin // carry passed on from below
  const s = p !== cin
  const cout = g || h
  const dot = (on: boolean) => (on ? trace.voltage : undefined)
  return (
    <Schematic width={300} height={186} label="一位全加器：两个异或门算出和，两个与门加一个或门算出进位">
      {/* A → AND.a (58, 32), branch at x = 46 down to XOR.a (58, 92) */}
      <Net on={a} points={[[14, 32], [58, 32]]} />
      <Net on={a} points={[[46, 32], [46, 92], [58, 92]]} />
      <Junction x={46} y={32} color={dot(a)} />
      {/* B → AND.b (58, 48), branch at x = 34 down to XOR.b (58, 108) */}
      <Net on={b} points={[[14, 48], [58, 48]]} />
      <Net on={b} points={[[34, 48], [34, 108], [58, 108]]} />
      <Junction x={34} y={48} color={dot(b)} />
      {/* A·B → OR.a (228, 92) */}
      <Net on={g} points={[[118, 40], [224, 40], [224, 92], [228, 92]]} />
      {/* A⊕B → AND.a (160, 100), branch at x = 132 down to XOR.a (160, 152) */}
      <Net on={p} points={[[118, 100], [160, 100]]} />
      <Net on={p} points={[[132, 100], [132, 152], [160, 152]]} />
      <Junction x={132} y={100} color={dot(p)} />
      {/* Cin → XOR.b (160, 168), branch at x = 146 up to AND.b (160, 116) */}
      <Net on={cin} points={[[14, 168], [160, 168]]} />
      <Net on={cin} points={[[146, 168], [146, 116], [160, 116]]} />
      <Junction x={146} y={168} color={dot(cin)} />
      {/* (A⊕B)·Cin → OR.b (228, 108); sum and carry out to the right edge */}
      <Net on={h} points={[[220, 108], [228, 108]]} />
      <Net on={s} points={[[220, 160], [288, 160]]} />
      <Gate x={88} y={40} type="and" a={a} b={b} out={g} />
      <Gate x={88} y={100} type="xor" a={a} b={b} out={p} />
      <Gate x={190} y={108} type="and" a={p} b={cin} out={h} />
      <Gate x={190} y={160} type="xor" a={p} b={cin} out={s} />
      <Gate x={258} y={100} type="or" a={g} b={h} out={cout} />
      <Port x={14} y={32} label="A" side="top" color={dot(a)} />
      <Port x={14} y={48} label="B" side="bottom" color={dot(b)} />
      <Port x={14} y={168} label="Cin" side="top" color={dot(cin)} />
      <Port x={288} y={100} color={dot(cout)} />
      <Port x={288} y={160} color={dot(s)} />
      <Label x={294} y={130} anchor="end" color={dot(cout)}>
        进位 Cout
      </Label>
      <Label x={294} y={150} anchor="end" color={dot(s)}>
        和 S
      </Label>
    </Schematic>
  )
}

/**
 * Two 4-bit numbers added the way it is done on paper, carries on top, next to
 * the gate-level full adder of whichever column is selected.
 */
export function BinaryAdderLab() {
  const [a, setA] = React.useState(0b0110)
  const [b, setB] = React.useState(0b0111)
  const [col, setCol] = React.useState(2)
  // ripple carry: carry[i] goes into bit i, carry[4] is the carry out
  const carry = [0]
  const sumBits: number[] = []
  for (let i = 0; i < 4; i++) {
    const ai = bitOf(a, i)
    const bi = bitOf(b, i)
    sumBits.push(ai ^ bi ^ carry[i])
    carry.push((ai & bi) | (carry[i] & (ai ^ bi)))
  }
  sumBits.push(carry[4])
  const sum = a + b
  const overflow = sum > 15
  const ai = bitOf(a, col)
  const bi = bitOf(b, col)
  const ci = carry[col]
  const column = ai + bi + ci

  const bitButton = (name: string, value: number, set: React.Dispatch<React.SetStateAction<number>>, i: number) => {
    const on = bitOf(value, i) === 1
    return (
      <button
        type="button"
        aria-pressed={on}
        aria-label={`${name} 的位 ${i}（位权 ${2 ** i}），现在是 ${on ? 1 : 0}，点击翻转`}
        onClick={() => set((n) => n ^ (1 << i))}
        className={cn(
          "tabular size-8 rounded-md border text-body font-semibold transition-colors duration-(--duration-fast)",
          on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background text-muted-foreground hover:bg-accent",
        )}
      >
        {on ? 1 : 0}
      </button>
    )
  }

  return (
    <Lab
      title="4 位二进制加法器"
      hint="点 A、B 的任意一位把它翻转，看进位怎么一级一级往高位传。点最上面一行的位权，换一位看它的全加器。"
      onReset={() => {
        setA(0b0110)
        setB(0b0111)
        setCol(2)
      }}
    >
      <LabStage>
        <div className="grid items-center justify-items-center gap-x-8 gap-y-5 @2xl:grid-cols-[auto_minmax(0,1fr)]">
          <div className="tabular grid w-fit grid-cols-[auto_repeat(5,2.25rem)] gap-x-1 text-center text-body">
            <RowLabel>位权</RowLabel>
            {COLUMNS.map((i) =>
              i === 4 ? (
                <Cell key={i}>
                  <span className="text-small text-faint-foreground">16</span>
                </Cell>
              ) : (
                <Cell key={i} selected={i === col} edge="top">
                  <button
                    type="button"
                    aria-pressed={i === col}
                    aria-label={`查看位权 ${2 ** i} 这一位的全加器`}
                    onClick={() => setCol(i)}
                    className={cn(
                      "h-7 w-8 rounded-md text-small transition-colors duration-(--duration-fast) hover:bg-accent",
                      i === col ? "font-semibold text-foreground underline underline-offset-4" : "text-muted-foreground",
                    )}
                  >
                    {2 ** i}
                  </button>
                </Cell>
              ),
            )}
            <RowLabel>进位</RowLabel>
            {COLUMNS.map((i) => (
              <Cell key={i} selected={i === col}>
                <span className={carry[i] ? "font-semibold" : "text-faint-foreground"} style={carry[i] ? { color: trace.voltage } : undefined}>
                  {carry[i]}
                </span>
              </Cell>
            ))}
            <RowLabel>A</RowLabel>
            {COLUMNS.map((i) => (
              <Cell key={i} selected={i === col}>
                {i < 4 && bitButton("A", a, setA, i)}
              </Cell>
            ))}
            <RowLabel>B</RowLabel>
            {COLUMNS.map((i) => (
              <Cell key={i} selected={i === col}>
                {i < 4 ? bitButton("B", b, setB, i) : <span className="text-heading text-muted-foreground">+</span>}
              </Cell>
            ))}
            <div className="col-span-full h-px bg-foreground" />
            <RowLabel>和</RowLabel>
            {COLUMNS.map((i) => (
              <Cell key={i} selected={i === col} edge="bottom">
                <span className={cn("text-heading font-semibold", i === 4 && !overflow && "text-faint-foreground")}>{sumBits[i]}</span>
              </Cell>
            ))}
          </div>
          <figure className="w-full min-w-0">
            <FullAdder a={ai === 1} b={bi === 1} cin={ci === 1} />
            <figcaption className="tabular mt-1 text-center text-caption text-muted-foreground">
              位权 {2 ** col} 这一位：{ai} + {bi} + 进位 {ci} = {column}，二进制写作 {bin(column, 2)}，本位得 {sumBits[col]}，向高位进 {carry[col + 1]}
            </figcaption>
          </figure>
        </div>
      </LabStage>
      <LabReadouts>
        <Readout label="A" value={a} sub={`${bin(a, 4)}₂ · ${hex(a)}`} />
        <Readout label="B" value={b} sub={`${bin(b, 4)}₂ · ${hex(b)}`} />
        <Readout label="A + B" value={sum} sub={`${bin(sum, 5)}₂ · ${hex(sum)}`} color={trace.voltage} />
      </LabReadouts>
      <LabNote tone={overflow ? "warn" : "neutral"}>
        <Tex>{`${a} + ${b} = ${sum}`}</Tex>
        {overflow
          ? `，超过了 4 位能表示的最大值 15。最高位的进位如果没有地方放，只剩下低 4 位 ${bin(sum & 15, 4)}（${sum & 15}），这就是溢出。`
          : "。每一位都是一个全加器：把本位的两个数和低位送来的进位加起来，得到本位的和，再把进位交给高一位。"}
      </LabNote>
    </Lab>
  )
}

import * as React from "react"
import { Button, ControlField, Lab, LabControls, LabNote, LabReadouts, LabStage, Label, Port, Readout, Schematic, SwitchField, Timing, Wire, trace, type Level } from "@/lab"

type Bit = 0 | 1

/** One column of the timing diagram. `edge` marks a slot that starts with a rising clock edge. */
interface Slot {
  clk: Bit
  d: Bit
  q: Bit
  edge?: boolean
}

/** What the learner did last: changed D, or clocked in a new / an unchanged value. */
type LastAction = "d" | "captured" | "same"

interface State {
  d: Bit
  q: Bit
  hist: Slot[]
  last: LastAction
}

/** Slots the diagram shows; older ones scroll off the left. */
const WINDOW = 20

// A short story to start from: D goes high, a clock edge copies it into Q, then D drops and Q keeps the 1.
const INITIAL: State = {
  d: 0,
  q: 1,
  last: "d",
  hist: [
    { clk: 0, d: 0, q: 0 },
    { clk: 0, d: 1, q: 0 },
    { clk: 1, d: 1, q: 1, edge: true },
    { clk: 0, d: 1, q: 1 },
    { clk: 0, d: 0, q: 1 },
  ],
}

type Action = { type: "d"; value: Bit } | { type: "pulse" } | { type: "reset" }

function reduce(s: State, action: Action): State {
  const push = (...slots: Slot[]) => [...s.hist, ...slots].slice(-WINDOW)
  switch (action.type) {
    case "d":
      if (action.value === s.d) return s
      return { ...s, d: action.value, last: "d", hist: push({ clk: 0, d: action.value, q: s.q }) }
    case "pulse":
      // the rising edge copies D into Q; nothing happens on the way back down
      return { ...s, q: s.d, last: s.d === s.q ? "same" : "captured", hist: push({ clk: 1, d: s.d, q: s.d, edge: true }, { clk: 0, d: s.d, q: s.d }) }
    case "reset":
      return INITIAL
  }
}

const hot = (on: boolean) => (on ? { color: trace.voltage, width: 2.25 } : {})

/**
 * An edge-triggered D flip-flop driven by hand: change D whenever you like,
 * Q only follows when a clock pulse arrives. Every action adds to the timing
 * diagram, so the "Q copies D on the rising edge" rule can be read off it.
 */
export function DFlipFlopLab() {
  const [s, dispatch] = React.useReducer(reduce, INITIAL)
  const { d, q, hist } = s
  // the part of the window not reached yet just continues the present levels (drawn faded)
  const row = (pick: (slot: Slot) => Bit, rest: Bit): Level[] => Array.from({ length: WINDOW }, (_, i) => (i < hist.length ? pick(hist[i]) : rest))
  const edges = hist.flatMap((slot, i) => (slot.edge ? [{ at: i }] : []))
  return (
    <Lab title="D 触发器" hint="随便拨动 D，再给一个时钟脉冲：Q 只在时钟上升沿（竖虚线）那一刻照抄 D，其余时间不理会 D。" onReset={() => dispatch({ type: "reset" })}>
      <LabStage>
        <div className="flex flex-col gap-4">
          {/* box x 100…180, y 26…96; D pin at y = 46, CLK pin at y = 76, Q pin at y = 46 */}
          <Schematic width={280} height={106} label={`D 触发器：D = ${d}，Q = ${q}`}>
            <Label x={140} y={16} muted>
              D 触发器（74HC74 的一半）
            </Label>
            <Wire points={[[40, 46], [100, 46]]} {...hot(d === 1)} />
            <Wire points={[[40, 76], [100, 76]]} />
            <Wire points={[[180, 46], [240, 46]]} {...hot(q === 1)} />
            <rect x={100} y={26} width={80} height={70} rx={3} fill="var(--background)" />
            {/* the small triangle marks an edge-triggered clock input */}
            <path d="M100 70L110 76L100 82" />
            <Label x={108} y={50.5} anchor="start">
              D
            </Label>
            <Label x={115} y={80.5} anchor="start">
              CLK
            </Label>
            <Label x={172} y={50.5} anchor="end">
              Q
            </Label>
            <Port x={40} y={46} side="top" label={`D = ${d}`} color={d ? trace.voltage : undefined} />
            <Port x={40} y={76} side="bottom" label="CLK" />
            <Port x={240} y={46} side="top" label={`Q = ${q}`} color={q ? trace.voltage : undefined} />
          </Schematic>
          <Timing
            minSlot={10}
            cursor={hist.length}
            marks={edges}
            signals={[
              { label: "CLK", values: row((slot) => slot.clk, 0), color: trace.ref },
              { label: "D", values: row((slot) => slot.d, d), color: trace.second },
              { label: "Q", values: row((slot) => slot.q, q) },
            ]}
            ariaLabel="时序图：时钟 CLK、输入 D、输出 Q 的历史"
          />
        </div>
      </LabStage>
      <LabControls>
        <SwitchField label="输入 D" checked={d === 1} onChange={(v) => dispatch({ type: "d", value: v ? 1 : 0 })} hint={d ? "高电平（1）" : "低电平（0）"} />
        <ControlField label="时钟 CLK">
          <Button onClick={() => dispatch({ type: "pulse" })}>给一个时钟脉冲</Button>
        </ControlField>
      </LabControls>
      <LabReadouts>
        <Readout label="输入 D" value={d} color={trace.second} />
        <Readout label="输出 Q" value={q} color={trace.voltage} />
        <Readout label="Q 和 D" value={d === q ? "一致" : "不一致"} sub={d === q ? undefined : "等下一个时钟沿"} />
      </LabReadouts>
      <LabNote tone={s.last === "captured" ? "good" : "neutral"}>
        {s.last === "captured"
          ? `时钟上升沿到了：触发器把这一刻的 D（${d}）抄进 Q，然后一直记住它。`
          : s.last === "same"
            ? `时钟上升沿到了，但 D 还是 ${d}，Q 抄到的是同一个值，看不出变化。先改 D 再给时钟。`
            : d === q
              ? `D 回到了 ${d}，和 Q 一样。中间那段变化没有碰上时钟沿，Q 完全不知道它发生过。`
              : `D 变成了 ${d}，但时钟沿还没来，Q 仍然记着 ${q}。给一个时钟脉冲试试。`}
      </LabNote>
    </Lab>
  )
}

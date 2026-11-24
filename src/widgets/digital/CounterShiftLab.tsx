import * as React from "react"
import {
  Arrow,
  Button,
  ControlField,
  Junction,
  Lab,
  LabControls,
  LabNote,
  LabReadouts,
  LabStage,
  Label,
  PlayButton,
  Readout,
  Schematic,
  Segmented,
  SliderField,
  SwitchField,
  Timing,
  Wire,
  glow,
  sig,
  trace,
  useFrame,
  usePlayback,
  type Level,
} from "@/lab"

type Mode = "counter" | "shift"
type Bit = 0 | 1

/** One half clock period in the timing diagram. `q` holds Q3…Q0 as a 4-bit number. */
interface Slot {
  clk: Bit
  din: Bit
  q: number
}

interface State {
  mode: Mode
  q: number
  clk: Bit
  din: Bit
  hist: Slot[]
  /** The counter just rolled over from 15 to 0. */
  wrapped: boolean
}

/** Half periods on screen: 16 clock cycles, one full lap of the 4-bit counter. */
const WINDOW = 32

const start = (mode: Mode): State => ({ mode, q: 0, clk: 0, din: 1, hist: [], wrapped: false })

/** Advance half a clock period. Flip-flops only act on the rising half. */
function half(s: State): State {
  const push = (slot: Slot) => [...s.hist, slot].slice(-WINDOW)
  if (s.clk === 1) return { ...s, clk: 0, hist: push({ clk: 0, din: s.din, q: s.q }) }
  // counter: add one. shift register: everything moves up one place, DIN enters at Q0.
  const q = s.mode === "counter" ? (s.q + 1) & 15 : ((s.q << 1) | s.din) & 15
  return { ...s, clk: 1, q, wrapped: s.mode === "counter" && q === 0, hist: push({ clk: 1, din: s.din, q }) }
}

// start with five counts already on the diagram, so there is something to read before the clock runs
const INITIAL = Array.from({ length: 10 }).reduce<State>((s) => half(s), start("counter"))

type Action = { type: "half" } | { type: "step" } | { type: "din"; value: Bit } | { type: "mode"; value: Mode } | { type: "reset" }

function reduce(s: State, action: Action): State {
  switch (action.type) {
    case "half":
      return half(s)
    case "step":
      // one whole pulse by hand: finish the current high half first, then up and back down
      return half(half(s.clk === 1 ? half(s) : s))
    case "din": {
      if (action.value === s.din) return s
      const hist = s.hist.slice()
      const last = hist[hist.length - 1]
      // DIN changed while the clock is low: show it in the current slot, before the next edge samples it
      if (last && last.clk === 0) hist[hist.length - 1] = { ...last, din: action.value }
      return { ...s, din: action.value, hist }
    }
    case "mode":
      return action.value === s.mode ? s : start(action.value)
    case "reset":
      return INITIAL
  }
}

/** The free-running clock. It is rendered inside <Lab>, so it stops while the widget is off screen. */
function Clock({ running, hz, onHalf }: { running: boolean; hz: number; onHalf: () => void }) {
  const phase = React.useRef(0)
  useFrame((dt) => {
    phase.current += dt * hz * 2
    if (phase.current >= 1) {
      phase.current = Math.min(phase.current - 1, 1)
      onHalf()
    }
  }, running)
  return null
}

/** Centre x of FF0 … FF3: bit 0 on the right, the way a binary number is written. */
const FF_X = [236, 172, 108, 44]

const hot = (on: boolean) => (on ? { color: trace.voltage, width: 2.25 } : {})
const bin4 = (n: number) => n.toString(2).padStart(4, "0")

/**
 * Four flip-flops wired two ways. As a counter each stage halves the frequency
 * of the one before; as a shift register one bit enters per clock and the
 * others move along. The timing diagram records every half period.
 */
export function CounterShiftLab() {
  const [s, dispatch] = React.useReducer(reduce, INITIAL)
  const [hz, setHz] = React.useState(2)
  const playback = usePlayback()
  const { mode, q, clk, din, hist } = s
  const counter = mode === "counter"
  const bit = (i: number) => ((q >> i) & 1) as Bit
  const row = (pick: (slot: Slot) => Bit, rest: Bit): Level[] => Array.from({ length: WINDOW }, (_, i) => (i < hist.length ? pick(hist[i]) : rest))
  const qRows = [0, 1, 2, 3].map((i) => ({ label: `Q${i}`, values: row((slot) => ((slot.q >> i) & 1) as Bit, bit(i)) }))
  return (
    <Lab
      title="计数器和移位寄存器"
      hint="时钟在自动走，右上角可以暂停，然后点「走一拍」手动送时钟。切到移位寄存器，拨动 DIN，看数据一位一位移进去。"
      actions={<PlayButton playback={playback} />}
      onReset={() => {
        dispatch({ type: "reset" })
        setHz(2)
      }}
    >
      <Clock running={playback.playing} hz={hz} onHalf={() => dispatch({ type: "half" })} />
      <LabStage>
        <div className="flex flex-col gap-3">
          <figure>
            {/* boxes are 42 × 40 around (x, 76); each Q lamp sits at (x, 30) */}
            <Schematic width={300} height={128} label={counter ? `4 位计数器，当前计数值 ${q}` : `4 位移位寄存器，Q3 到 Q0 是 ${bin4(q)}`}>
              {FF_X.map((x, i) => {
                const on = bit(i) === 1
                return (
                  <g key={i}>
                    <Label x={x} y={12} muted>
                      Q{i}
                    </Label>
                    <Wire points={[[x, 40], [x, 56]]} {...hot(on)} />
                    {on && <circle cx={x} cy={30} r={15} fill={glow.red} opacity={0.22} stroke="none" />}
                    <circle cx={x} cy={30} r={10} fill={on ? glow.red : "var(--background)"} stroke={on ? glow.red : undefined} />
                    <Label x={x} y={34.5} weight={600} color={on ? "var(--background)" : undefined} muted={!on}>
                      {bit(i)}
                    </Label>
                    <rect x={x - 21} y={56} width={42} height={40} rx={3} fill="var(--background)" />
                    <Label x={x} y={counter ? 73 : 80.5}>
                      FF{i}
                    </Label>
                    {counter && (
                      <Label x={x} y={89} muted>
                        ÷2
                      </Label>
                    )}
                    {/* each stage feeds the next one to its left */}
                    {i < 3 && <Arrow from={[x - 21, 76]} to={[FF_X[i + 1] + 21, 76]} color={on ? trace.voltage : undefined} />}
                  </g>
                )
              })}
              {/* what enters FF0 from the right: the clock (counter) or the serial data (shift register) */}
              <Arrow from={[292, 76]} to={[257, 76]} color={(counter ? clk : din) ? trace.voltage : undefined} />
              <Label x={296} y={66} anchor="end" color={(counter ? clk : din) ? trace.voltage : undefined} muted>
                {counter ? "CLK" : "DIN"}
              </Label>
              {!counter && (
                <>
                  {/* shared clock bus along the bottom, one tap per flip-flop */}
                  <Wire points={[[292, 116], [44, 116], [44, 96]]} {...hot(clk === 1)} />
                  {[236, 172, 108].map((x) => (
                    <g key={x}>
                      <Wire points={[[x, 116], [x, 96]]} {...hot(clk === 1)} />
                      <Junction x={x} y={116} color={clk ? trace.voltage : undefined} />
                    </g>
                  ))}
                  <Label x={296} y={110} anchor="end" color={clk ? trace.voltage : undefined} muted>
                    CLK
                  </Label>
                </>
              )}
            </Schematic>
            <figcaption className="mt-1 text-center text-caption text-muted-foreground">
              {counter ? "时钟只送给 FF0；每一级的输出再去当下一级的时钟，每级把频率除以 2。" : "4 个触发器共用一个时钟；每一级的 Q 接到下一级的 D。"}
            </figcaption>
          </figure>
          <Timing
            minSlot={6}
            cursor={hist.length}
            signals={[
              { label: "CLK", values: row((slot) => slot.clk, clk), color: trace.ref },
              ...(counter ? [] : [{ label: "DIN", values: row((slot) => slot.din, din), color: trace.second }]),
              ...qRows,
            ]}
            ariaLabel={counter ? "时序图：时钟和 Q0 到 Q3，每一路的频率是上一路的一半" : "时序图：时钟、串行输入 DIN 和 Q0 到 Q3"}
          />
        </div>
      </LabStage>
      <LabControls>
        <ControlField label="4 个触发器怎么连">
          <Segmented
            value={mode}
            onValueChange={(value) => dispatch({ type: "mode", value })}
            options={[
              { value: "counter", label: "计数器" },
              { value: "shift", label: "移位寄存器" },
            ]}
            aria-label="电路类型"
          />
        </ControlField>
        <SliderField label="时钟频率" value={hz} onChange={setHz} min={0.5} max={8} step={0.5} unit="Hz" />
        <ControlField label="手动时钟">
          <Button onClick={() => dispatch({ type: "step" })}>走一拍</Button>
        </ControlField>
        {!counter && <SwitchField label="串行输入 DIN" checked={din === 1} onChange={(v) => dispatch({ type: "din", value: v ? 1 : 0 })} hint="下一个时钟沿移进 Q0 的那一位" />}
      </LabControls>
      {counter ? (
        <LabReadouts>
          <Readout label="计数值" value={q} sub={`${bin4(q)}₂ · 0x${q.toString(16).toUpperCase()}`} color={trace.voltage} />
          <Readout label="Q0 的频率" value={`${sig(hz / 2)} Hz`} sub="时钟 ÷ 2" />
          <Readout label="Q3 的频率" value={`${sig(hz / 16)} Hz`} sub="时钟 ÷ 16" />
        </LabReadouts>
      ) : (
        <LabReadouts>
          <Readout label="并行输出 Q3 Q2 Q1 Q0" value={bin4(q)} color={trace.voltage} />
          <Readout label="串行输入 DIN" value={din} color={trace.second} />
        </LabReadouts>
      )}
      <LabNote>
        {counter
          ? s.wrapped
            ? "数到 15（1111）之后再来一拍，4 位装不下 16，回到 0 重新数。"
            : "每来一个时钟上升沿，计数值加 1。看时序图：Q0 的频率是时钟的一半，Q1 又是 Q0 的一半，每一级都是一个二分频器。"
          : "每来一个时钟上升沿，4 位一起往高位挪一格，DIN 的值进入 Q0。连续送 4 拍，串行送来的 4 位就并排出现在 Q3–Q0 上。"}
      </LabNote>
    </Lab>
  )
}

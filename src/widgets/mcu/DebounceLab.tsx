import * as React from "react"
import { Button, ControlField, Lab, LabControls, LabNote, LabReadouts, LabStage, Plot, Readout, SliderField, fixed, trace } from "@/lab"

const VDD = 3.3
/** Time window of the plots, ms. */
const T_MAX = 80
const TICKS = [0, 20, 40, 60, 80]

/** One click of the button: the instants (ms) at which the contact toggles while closing, then while opening. */
interface Bounce {
  press: number[]
  release: number[]
}

/** What the lab shows before the first click: 4 falling edges on the way down, 1 more on the way up. */
const FIRST: Bounce = { press: [5, 5.9, 7.2, 8.1, 9.6, 10.5, 12], release: [33, 34.1, 35.4] }

/** A fresh, random bounce pattern. Only called from the click handler, never while rendering. */
function randomBounce(): Bounce {
  const burst = (start: number, pairs: number) => {
    const out: number[] = []
    let t = start
    for (let k = 0; k < 2 * pairs + 1; k++) {
      out.push(Math.round(t * 10) / 10)
      t += 0.8 + Math.random() * 1.2
    }
    return out
  }
  return { press: burst(5, 1 + Math.floor(Math.random() * 3)), release: burst(32 + Math.random() * 2, Math.floor(Math.random() * 3)) }
}

/**
 * Software debouncing: a new level only counts once the raw signal has held
 * it for `hold` ms. Returns the instants at which the accepted state toggles
 * (it starts high, so even entries are presses).
 */
function debounce(edges: number[], hold: number): number[] {
  const out: number[] = []
  let raw = 1
  let state = 1
  edges.forEach((e, k) => {
    raw = 1 - raw
    const next = edges[k + 1] ?? Number.POSITIVE_INFINITY
    if (raw !== state && next - e >= hold) {
      state = raw
      out.push(e + hold)
    }
  })
  return out
}

/** Staircase points for a signal that starts high and toggles at each edge. */
function staircase(edges: number[], high: number): [number, number][] {
  const pts: [number, number][] = [[0, high]]
  let level = 1
  for (const e of edges) {
    if (e > T_MAX) break
    level = 1 - level
    pts.push([e, level * high])
  }
  pts.push([T_MAX, level * high])
  return pts
}

/**
 * One press of a real push button: the raw pin signal bounces for a few
 * milliseconds, and the MCU counts every falling edge unless the firmware
 * waits for the level to settle. Drag the debounce time to see the count.
 */
export function DebounceLab() {
  const [bounce, setBounce] = React.useState<Bounce>(FIRST)
  const [hold, setHold] = React.useState(10)

  const edges = [...bounce.press, ...bounce.release]
  const clean = debounce(edges, hold)
  const rawFalls = edges.length / 2
  const count = Math.ceil(clean.length / 2)
  /** How long the contact really stayed closed between the two bursts. */
  const held = bounce.release[0] - bounce.press[bounce.press.length - 1]
  const falls = clean.filter((_, k) => k % 2 === 0)

  let tone: "good" | "warn" | "bad"
  let note: string
  if (count === 0) {
    tone = "bad"
    note = `消抖时间 ${hold} ms 比这次按住的时间（约 ${fixed(held, 1)} ms）还长，这次按下没被认出来。真人按键通常按住 100 ms 以上，10–20 ms 的消抖不会漏。`
  } else if (count === 1) {
    tone = "good"
    note = `电平要保持 ${hold} ms 不变才算数。每一段弹跳都比这短，全被忽略，只数到 1 次按下。代价是晚 ${hold} ms 才反应，人感觉不出来。`
  } else if (hold === 0) {
    tone = "warn"
    note = `没有消抖：每个下降沿都被当成一次按下。你只按了一下，单片机数到 ${count} 次。`
  } else {
    tone = "warn"
    note = `${hold} ms 还不够：有的弹跳比它长，被当成了新的按下，数到 ${count} 次。`
  }

  return (
    <Lab
      title="按键抖动与消抖"
      hint="按键接了上拉：松开是高电平，按下是低电平。按一下，再拖动消抖时间。"
      onReset={() => {
        setBounce(FIRST)
        setHold(10)
      }}
    >
      <LabStage>
        <div className="flex flex-col gap-3">
          <Plot
            height={150}
            x={{ min: 0, max: T_MAX, ticks: TICKS }}
            y={{ min: -0.5, max: 4, label: "引脚电压 (V)", ticks: [0, VDD] }}
            series={[{ points: staircase(edges, VDD), label: "原始信号：触点在弹跳", color: trace.voltage, step: true }]}
            ariaLabel="按键引脚上的原始电压"
          />
          <Plot
            height={170}
            x={{ min: 0, max: T_MAX, label: "时间 (ms)", ticks: TICKS }}
            y={{ min: -0.25, max: 1.5, label: "程序认定的电平 (0 / 1)", ticks: [0, 1] }}
            series={[{ points: staircase(clean, 1), label: "消抖之后", color: trace.second, step: true }]}
            markers={falls.filter((x) => x <= T_MAX).map((x) => ({ x, y: 0.5, color: trace.power }))}
            ariaLabel="消抖之后程序认定的电平"
          />
          <p className="text-caption text-muted-foreground">圆点：单片机在这里记下一次「按下」。为了看清弹跳，这次只按住了不到 30 ms。</p>
        </div>
      </LabStage>
      <LabControls>
        <ControlField label="按键">
          <Button onClick={() => setBounce(randomBounce())}>按下按键</Button>
        </ControlField>
        <SliderField label="消抖时间" value={hold} onChange={setHold} min={0} max={30} step={0.5} unit="ms" color={trace.second} />
      </LabControls>
      <LabReadouts>
        <Readout label="原始信号的下降沿" value={`${rawFalls} 个`} color={trace.voltage} />
        <Readout label="触点稳定闭合了" value={`${fixed(held, 1)} ms`} />
        <Readout label="单片机数到" value={`${count} 次按下`} color={trace.power} />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

import * as React from "react"
import {
  Chip,
  ControlField,
  Ground,
  Junction,
  Lab,
  LabControls,
  LabNote,
  LabReadouts,
  LabStage,
  Label,
  PlayButton,
  Plot,
  Rail,
  Readout,
  Resistor,
  Schematic,
  Segmented,
  SliderField,
  Switch,
  SwitchField,
  Wire,
  clamp,
  fixed,
  formatSI,
  trace,
  usePlayback,
  useTime,
} from "@/lab"
import { smoothNoise } from "./shared"

type Mode = "up" | "down" | "float"

const VDD = 3.3
/** CMOS input thresholds: above 0.7·VDD is surely 1, below 0.3·VDD surely 0. */
const VIH = 0.7 * VDD
const VIL = 0.3 * VDD
/** Interference assumed to couple into the pin node (peak). Its voltage is this current times the pull resistor. */
const I_NOISE = 2e-6
/** The scope trace shows the last second, sampled on a fixed time grid so it scrolls without shimmering. */
const WINDOW = 1
const DT = 1 / 150

/** Pin voltage at time `tau` (s) for the present wiring. */
function pinVoltage(mode: Mode, pressed: boolean, r: number, tau: number): number {
  if (mode === "float") {
    // released: nothing sets the level, the pin follows whatever couples into it
    if (!pressed) return clamp(VDD / 2 + 2.6 * (0.75 * smoothNoise(tau * 5, 1) + 0.25 * smoothNoise(tau * 23, 2)), 0, VDD)
    return 0
  }
  const wobble = r * I_NOISE * (0.7 * smoothNoise(tau * 6, 3) + 0.3 * smoothNoise(tau * 19, 4))
  if (mode === "up") return pressed ? 0 : clamp(VDD - wobble, 0, VDD)
  return pressed ? VDD : clamp(wobble, 0, VDD)
}

/**
 * A push button on an input pin, with a pull-up, a pull-down or nothing at
 * all. Shows the pin voltage as a scrolling trace and what the MCU reads;
 * without a resistor the released pin floats and the reading jumps around.
 */
export function PullResistorLab() {
  const [mode, setMode] = React.useState<Mode>("up")
  const [pressed, setPressed] = React.useState(false)
  const [r, setR] = React.useState(10000)
  const playback = usePlayback()
  const t = useTime(playback.playing)

  // the last second of pin voltage; x is "seconds ago"
  const points: [number, number][] = []
  let lo = VDD
  let hi = 0
  for (let k = Math.ceil((t - WINDOW) / DT); k * DT <= t; k++) {
    const v = pinVoltage(mode, pressed, r, k * DT)
    points.push([k * DT - t, v])
    lo = Math.min(lo, v)
    hi = Math.max(hi, v)
  }
  const vNow = pinVoltage(mode, pressed, r, t)
  points.push([0, vNow])
  lo = Math.min(lo, vNow)
  hi = Math.max(hi, vNow)

  const bit = vNow > VDD / 2 ? 1 : 0
  const reliable = lo >= VIH || hi <= VIL
  const hasR = mode !== "float"
  const i = hasR && pressed ? VDD / r : 0
  const wobble = r * I_NOISE
  const name = mode === "up" ? "上拉" : "下拉"

  let tone: "neutral" | "good" | "warn" | "bad" = "neutral"
  let note: string
  if (mode === "float") {
    if (pressed) {
      tone = "warn"
      note = "按住时，按键把引脚接到地，读到确定的 0。可是一松手，引脚又没人管了。"
    } else {
      tone = "bad"
      note = "引脚悬空：没有任何东西决定它的电压，周围一点点干扰就能让读数在 0 和 1 之间乱跳。程序会以为有人在乱按按键。"
    }
  } else if (pressed) {
    if (i > 0.002) {
      tone = "warn"
      note = `读数没问题，但电阻太小：只要按住，就有 ${formatSI(i, "A")} 白白从电源流到地。`
    } else {
      note = `按下时，按键把引脚直接接到${mode === "up" ? "地" : " 3.3 V"}，读到 ${bit}。电阻上流过 ${formatSI(i, "A")}，小到可以不管。`
    }
  } else if (wobble > VIL) {
    tone = "bad"
    note = `电阻太大：假设附近的干扰往引脚上耦合约 2 μA 的电流，它在 ${formatSI(r, "Ω")} 上就是 ${fixed(wobble, 2)} V 的波动，${mode === "up" ? "高" : "低"}电平已经靠不住。`
  } else if (wobble > 0.3) {
    tone = "warn"
    note = `松开时读到 ${bit}，但 ${formatSI(r, "Ω")} 已经偏大：同样的干扰在它上面有 ${fixed(wobble, 2)} V 的波动，再大就会读错。`
  } else {
    tone = "good"
    note = `松开时，${name}电阻把引脚拉到 ${mode === "up" ? "3.3 V" : "0 V"}，读到 ${bit}。输入引脚几乎不取电流，电阻上没有压降。`
  }

  /*
   * Layout (250 × 180): one column at x = 80.
   *   rail (80, 30) · upper part (80, 60): A (80, 30), B (80, 90) · node (80, 90)
   *   lower part (80, 120): A (80, 90), B (80, 150) · ground (80, 150)
   *   node → pin: (80, 90) → (151, 90); chip body x 165–235, y 55–125
   * Pull-up: resistor above, button below. Pull-down: button above, resistor below.
   */
  const buttonY = mode === "down" ? 60 : 120
  const resistorY = mode === "down" ? 120 : 60
  const toggle = () => setPressed((p) => !p)

  return (
    <Lab
      title="按键、上拉与下拉"
      hint="换三种接法，按下按键再松开，看引脚电压和单片机读到的值。再把电阻拖到两头试试。"
      actions={<PlayButton playback={playback} />}
      onReset={() => {
        setMode("up")
        setPressed(false)
        setR(10000)
      }}
    >
      <LabStage>
        <div className="grid items-center gap-x-6 gap-y-4 @xl:grid-cols-[auto_minmax(0,1fr)]">
          <Schematic width={250} height={180} label="按键接在单片机输入引脚上，配上拉或下拉电阻">
            {hasR ? (
              <Rail x={80} y={30} label="3.3 V" />
            ) : (
              <Label x={80} y={56} muted>
                什么都没接
              </Label>
            )}
            {hasR && <Resistor x={80} y={resistorY} rot={90} label={`${name}电阻`} value={formatSI(r, "Ω")} labelSide="left" />}
            <Switch x={80} y={buttonY} rot={90} closed={pressed} onClick={toggle} ariaLabel={pressed ? "松开按键" : "按下按键"} />
            <Label x={64} y={buttonY + 4.5} anchor="end">
              按键
            </Label>
            <Ground x={80} y={150} />
            <Wire points={[[80, 90], [151, 90]]} />
            {hasR && <Junction x={80} y={90} />}
            {/* current only flows while the button is held: rail → resistor and button → ground */}
            {hasR && <Wire points={[[80, 30], [80, 150]]} current={i} scale={0.0033} color="none" />}
            <Label x={118} y={82} color={trace.voltage}>
              {fixed(vNow, 2)} V
            </Label>
            <Chip x={200} y={90} w={70} h={70} left={["GPIO"]} />
            <Label x={200} y={77} weight={600}>
              读到 {bit}
            </Label>
            <Label x={200} y={114} muted>
              单片机
            </Label>
          </Schematic>
          <Plot
            height={200}
            x={{ min: -WINDOW, max: 0, label: "时间 (s)", ticks: [-1, -0.75, -0.5, -0.25, 0] }}
            y={{ min: -0.3, max: 3.7, label: "引脚电压 (V)", ticks: [0, 1, 2, 3] }}
            series={[{ points, label: "引脚电压", color: trace.voltage }]}
            lines={[
              { y: VIH, label: "高于 2.31 V 才算 1" },
              { y: VIL, label: "低于 0.99 V 才算 0" },
            ]}
          />
        </div>
      </LabStage>
      <LabControls columns={3}>
        <ControlField label="引脚外面怎么接">
          <Segmented
            aria-label="引脚外面怎么接"
            value={mode}
            onValueChange={setMode}
            options={[
              { value: "up", label: "上拉" },
              { value: "down", label: "下拉" },
              { value: "float", label: "悬空" },
            ]}
          />
        </ControlField>
        <SwitchField label="按住按键" checked={pressed} onChange={setPressed} hint="也可以直接点图里的按键" />
        <SliderField label="电阻阻值" value={r} onChange={setR} min={100} max={1e6} log snap="E12" unit="Ω" disabled={!hasR} />
      </LabControls>
      <LabReadouts>
        <Readout label="引脚电压" value={`${fixed(vNow, 2)} V`} color={trace.voltage} />
        <Readout label="单片机读到" value={bit} sub={reliable ? "稳定" : "不可靠"} />
        <Readout label="电阻上的电流" value={formatSI(i, "A")} color={trace.current} sub="只在按住时流过" />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

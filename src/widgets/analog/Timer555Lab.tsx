import * as React from "react"
import { Capacitor, Chip, Ground, Junction, Lab, LabControls, LabNote, LabReadouts, LabStage, Label, Led, PlayButton, Plot, Rail, Readout, Resistor, Schematic, SliderField, Wire, chipPins, fixed, formatSI, percent, sig, trace, usePlayback, useTime, type ChipSpec } from "@/lab"

const VCC = 5
const BLINK_LIMIT = 10 // Hz: up to here the LED and the cursor follow the output in real time

// 555 body (163, 130), 90 × 110, pins 30 apart:
// DIS (104, 100), THR (104, 130), TRIG (104, 160), RST (148, 61), VCC (178, 61), OUT (222, 130), GND (163, 199)
const CHIP: ChipSpec = { x: 163, y: 130, w: 90, h: 110, pitch: 30, left: ["DIS", "THR", "TRIG"], top: ["RST", "VCC"], right: ["OUT"], bottom: ["GND"] }
const PIN = chipPins(CHIP)

/** Frequencies below 1 Hz read better as "0.988 Hz" than "988 mHz". */
const hertz = (f: number) => (f < 1 ? `${sig(f)} Hz` : formatSI(f, "Hz"))

const NICE = [1, 1.5, 2, 3, 4, 5, 6, 8, 10]
/** The next "round" number at or above v (1, 1.5, 2, 3 … × a power of ten), like a scope's time base. */
function niceCeil(v: number) {
  const mag = 10 ** Math.floor(Math.log10(v))
  const n = v / mag
  return (NICE.find((s) => s >= n - 1e-9) ?? 10) * mag
}

/** 555 astable: C charges through RA + RB up to 2/3 VCC, discharges through RB down to 1/3 VCC, forever. */
export function Timer555Lab() {
  const [ra, setRa] = React.useState(10e3)
  const [rb, setRb] = React.useState(68e3)
  const [c, setC] = React.useState(10e-6)
  const playback = usePlayback()

  const tHigh = Math.LN2 * (ra + rb) * c
  const tLow = Math.LN2 * rb * c
  const period = tHigh + tLow
  const freq = 1 / period
  const duty = tHigh / period
  const slow = freq <= BLINK_LIMIT
  const now = useTime(playback.playing && slow)

  // time axis: about three to four periods, in a unit that keeps the numbers short
  const k = 3 * period >= 1 ? 1 : 3 * period >= 1e-3 ? 1e-3 : 1e-6
  const unit = k === 1 ? "s" : k === 1e-3 ? "ms" : "μs"
  const span = niceCeil((3 * period) / k) // in display units

  const wave = React.useMemo(() => {
    // capacitor voltage `p` seconds into a cycle that starts at 1/3 VCC
    const capAt = (p: number) => (p < tHigh ? VCC * (1 - (2 / 3) * Math.exp(-p / ((ra + rb) * c))) : ((2 * VCC) / 3) * Math.exp(-(p - tHigh) / (rb * c)))
    const cap: [number, number][] = []
    const out: [number, number][] = []
    const cycles = Math.ceil((span * k) / period)
    for (let n = 0; n < cycles; n++) {
      const t0 = n * period
      for (let i = 0; i < 24; i++) cap.push([(t0 + (tHigh * i) / 24) / k, capAt((tHigh * i) / 24)])
      for (let i = 0; i < 24; i++) cap.push([(t0 + tHigh + (tLow * i) / 24) / k, capAt(tHigh + (tLow * i) / 24)])
      out.push([t0 / k, VCC], [(t0 + tHigh) / k, 0])
    }
    cap.push([(cycles * period) / k, VCC / 3])
    out.push([(cycles * period) / k, VCC])
    return { cap, out, capAt }
  }, [ra, rb, c, tHigh, tLow, period, span, k])

  // where "now" is on the plot, and what the circuit is doing at that instant
  const cursor = slow ? now % (span * k) : 0
  const phase = cursor % period
  const high = phase < tHigh
  const vCap = wave.capAt(phase)
  const live = slow && playback.playing
  const iFromRail = high ? (VCC - vCap) / (ra + rb) : VCC / ra
  const iIntoDis = high ? 0 : VCC / ra + vCap / rb
  const iScale = VCC / ra + (2 * VCC) / 3 / rb

  let tone: "neutral" | "warn" = "neutral"
  let note: string
  if (slow) {
    note = `LED 每 ${formatSI(period, "s")} 闪一次：亮 ${formatSI(tHigh, "s")}（电容经 RA + RB 充电到 2/3 电源电压），灭 ${formatSI(tLow, "s")}（电容经 RB 放电到 1/3）。${period > 20 ? "周期很长，把 C 或电阻调小会快一些。" : ""}`
  } else if (freq <= 50) {
    note = `每秒闪 ${fixed(freq, 0)} 次：肉眼还能看出在抖，屏幕已经演示不出来，图上的 LED 改为显示平均亮度。`
  } else if (freq <= 20e3) {
    note = `${hertz(freq)}：闪得比眼睛快，LED 看起来一直亮着，亮度大约是占空比 ${percent(duty)}。把输出接到喇叭上，就是一个 ${hertz(freq)} 的音调。`
  } else if (freq <= 300e3) {
    note = `${formatSI(freq, "Hz")}：已经超出人耳能听到的范围。红外遥控的 38 kHz 载波就可以这样产生。`
  } else {
    tone = "warn"
    note = `${formatSI(freq, "Hz")}：接近经典 NE555 的极限（几百 kHz），实际输出的边沿会变形、频率也会偏。再快就该换别的振荡器了。`
  }

  return (
    <Lab
      title="555 无稳态振荡器"
      hint="调 RA、RB、C 改变频率和占空比。电容电压在 1/3 和 2/3 电源电压（两条虚线）之间来回，输出跟着翻转。"
      actions={slow ? <PlayButton playback={playback} /> : undefined}
      onReset={() => {
        setRa(10e3)
        setRb(68e3)
        setC(10e-6)
      }}
    >
      <LabStage>
        <div className="grid items-center gap-x-6 gap-y-4 @xl:grid-cols-[auto_minmax(0,1fr)]">
          {/*
           * Timing parts on x = 68: RA (68, 70) from the bus (y = 40) to the DIS node (68, 100),
           * RB (68, 130) down to the THR / TRIG node (68, 160), C (68, 190) to ground (68, 220).
           * Output: R (252, 130) from OUT (222, 130) to (282, 130), then the LED (282, 170) to ground (282, 200).
           */}
          <Schematic width={310} height={244} label="555 接成无稳态振荡器，输出驱动一颗 LED">
            <Wire points={[[110, 40], [68, 40]]} current={live ? iFromRail : undefined} scale={iScale} />
            <Wire points={[[110, 40], [178, 40], PIN.VCC]} />
            <Wire points={[[148, 40], PIN.RST]} />
            <Junction x={148} y={40} />
            <Rail x={110} y={40} label="5 V" />
            <Resistor x={68} y={70} rot={90} label="RA" value={formatSI(ra, "Ω")} labelSide="left" />
            <Resistor x={68} y={130} rot={90} label="RB" value={formatSI(rb, "Ω")} labelSide="left" />
            <Capacitor x={68} y={190} rot={90} label="C" value={formatSI(c, "F")} labelSide="left" />
            <Ground x={68} y={220} />
            <Wire points={[[68, 100], PIN.DIS]} current={live ? iIntoDis : undefined} scale={iScale} />
            <Junction x={68} y={100} />
            <Wire points={[[68, 160], PIN.TRIG]} />
            <Wire points={[PIN.THR, [90, 130], [90, 160]]} />
            <Junction x={68} y={160} />
            <Junction x={90} y={160} />
            <Chip {...CHIP} />
            <Label x={184} y={160} weight={600}>
              555
            </Label>
            <Ground x={163} y={199} />
            <Resistor x={252} y={130} value="330 Ω" />
            <Wire points={[[282, 130], [282, 140]]} />
            <Led x={282} y={170} rot={90} color="red" brightness={slow ? (high ? 1 : 0) : duty} />
            <Ground x={282} y={200} />
            {slow && (
              <Label x={84} y={210} anchor="start" color={trace.voltage}>
                {fixed(vCap, 2)} V
              </Label>
            )}
          </Schematic>
          <Plot
            height={240}
            x={{ min: 0, max: span, label: `时间 (${unit})` }}
            y={{ min: 0, max: 6, label: "电压 (V)", ticks: [0, VCC / 3, (2 * VCC) / 3, VCC] }}
            series={[
              { points: wave.cap, label: "电容电压", color: trace.voltage },
              { points: wave.out, label: "输出（3 脚）", color: trace.second, step: true },
            ]}
            lines={[{ y: (2 * VCC) / 3 }, { y: VCC / 3 }, ...(slow ? [{ x: cursor / k, label: "现在" }] : [])]}
          />
        </div>
      </LabStage>
      <LabControls columns={3}>
        <SliderField label="电阻 RA" value={ra} onChange={setRa} min={1e3} max={1e6} log snap="E12" unit="Ω" />
        <SliderField label="电阻 RB" value={rb} onChange={setRb} min={1e3} max={1e6} log snap="E12" unit="Ω" />
        <SliderField label="电容 C" value={c} onChange={setC} min={1e-9} max={100e-6} log snap="E12" unit="F" />
      </LabControls>
      <LabReadouts>
        <Readout label="频率" value={hertz(freq)} color={trace.second} />
        <Readout label="周期" value={formatSI(period, "s")} />
        <Readout label="占空比" value={percent(duty, 1)} sub={`高 ${formatSI(tHigh, "s")}，低 ${formatSI(tLow, "s")}`} />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

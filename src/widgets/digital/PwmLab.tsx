import * as React from "react"
import { Capacitor, Ground, Junction, Lab, LabControls, LabNote, LabReadouts, LabStage, Label, Led, Plot, Port, Readout, Resistor, Schematic, SliderField, SwitchField, Tex, Wire, fixed, formatSI, prefersReducedMotion, trace, useTime } from "@/lab"

/** High level of the PWM pin. */
const VH = 5
/** The LED branch: 330 Ω in series, about 2 V across a red LED. */
const I_LED = (VH - 2) / 330
/** The filter: 10 kΩ and 1 μF, a 10 ms time constant (cut-off about 16 Hz). */
const TAU_RC = 10e3 * 1e-6
/** Below this the eye sees the LED switching rather than dimming. */
const FLICKER_HZ = 50

const INITIAL = { duty: 30, f: 1000, rc: false }

/** The time window, like a scope's timebase: the next 1-2-5 value that fits at least four periods. */
function timebase(period: number) {
  const want = period * 4
  const decade = 10 ** Math.floor(Math.log10(want))
  const m = want / decade
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * decade
}

/**
 * The LED on the schematic. Fast PWM shows as steady, dimmed light; below the
 * flicker threshold it really blinks, in step with a clock that only this
 * small component re-renders on.
 */
function PwmLed({ duty, f }: { duty: number; f: number }) {
  const blink = f < FLICKER_HZ && duty > 0 && duty < 1 && !prefersReducedMotion()
  const t = useTime(blink)
  const brightness = blink ? ((t * f) % 1 < duty ? 1 : 0) : duty
  return <Led x={180} y={40} color="red" brightness={brightness} label="LED" labelSide="bottom" />
}

/**
 * PWM on a scope: duty cycle sets the average, frequency sets how fast it
 * repeats. An LED shows the average as brightness; an optional RC low-pass
 * turns it into a real (rippling) analog voltage.
 */
export function PwmLab() {
  const [dutyPct, setDutyPct] = React.useState(INITIAL.duty)
  const [f, setF] = React.useState(INITIAL.f)
  const [rc, setRc] = React.useState(INITIAL.rc)

  const duty = dutyPct / 100
  const period = 1 / f
  const tOn = duty * period
  const vAvg = duty * VH
  const span = timebase(period)

  // steady state of the RC filter: it climbs towards VH while the pin is high and decays towards 0 while it is low
  const a = tOn / TAU_RC
  const b = (period - tOn) / TAU_RC
  const vMax = duty <= 0 ? 0 : duty >= 1 ? VH : (VH * Math.expm1(-a)) / Math.expm1(-(a + b))
  const vMin = vMax * Math.exp(-b)
  const ripple = vMax - vMin

  const waves = React.useMemo(() => {
    const cycles = Math.ceil(span / period - 1e-9)
    const square: [number, number][] = []
    const filtered: [number, number][] = []
    if (duty <= 0 || duty >= 1) {
      square.push([0, vAvg], [span, vAvg])
      filtered.push([0, vAvg], [span, vAvg])
      return { square, filtered }
    }
    const STEPS = 16
    for (let k = 0; k < cycles; k++) {
      const t0 = k * period
      square.push([t0, VH], [t0 + tOn, 0])
      for (let i = 0; i < STEPS; i++) {
        const dt = (tOn * i) / STEPS
        filtered.push([t0 + dt, VH + (vMin - VH) * Math.exp(-dt / TAU_RC)])
      }
      for (let i = 0; i < STEPS; i++) {
        const dt = ((period - tOn) * i) / STEPS
        filtered.push([t0 + tOn + dt, vMax * Math.exp(-dt / TAU_RC)])
      }
    }
    square.push([cycles * period, VH])
    filtered.push([cycles * period, vMin])
    return { square, filtered }
  }, [span, period, duty, tOn, vAvg, vMin, vMax])

  const flicker = f < FLICKER_HZ && duty > 0 && duty < 1
  const iLed = duty * I_LED

  return (
    <Lab
      title="PWM 示波器"
      hint="拖占空比，看平均电压和 LED 亮度；把频率降到几十赫兹以下，LED 会真的闪起来。再打开 RC 滤波，看方波被抹成一条带纹波的直流。"
      onReset={() => {
        setDutyPct(INITIAL.duty)
        setF(INITIAL.f)
        setRc(INITIAL.rc)
      }}
    >
      <LabStage>
        <div className="grid items-center gap-x-6 gap-y-4 @xl:grid-cols-[auto_minmax(0,1fr)]">
          {/*
            PWM pin (20, 40) → 330 Ω (70…130, 40) → LED (150…210, 40) → ground at (236, 56).
            Filter branch from (44, 40): down to 10 kΩ (70…130, 110) → output node (160, 110) → 1 μF down to ground at (160, 170).
          */}
          <Schematic width={260} height={192} label="单片机的 PWM 引脚经限流电阻点亮 LED，另一路经过 RC 低通滤波器输出平均电压">
            <Label x={12} y={26} anchor="start" muted>
              PWM 引脚
            </Label>
            <Wire points={[[20, 40], [70, 40]]} current={iLed} scale={0.01} />
            <Wire points={[[130, 40], [150, 40]]} current={iLed} scale={0.01} />
            <Wire points={[[210, 40], [236, 40], [236, 56]]} current={iLed} scale={0.01} />
            <Resistor x={100} y={40} value="330 Ω" />
            <PwmLed duty={duty} f={f} />
            <Ground x={236} y={56} />
            <g opacity={rc ? 1 : 0.3}>
              <Wire points={[[44, 40], [44, 110], [70, 110]]} />
              <Wire points={[[130, 110], [200, 110]]} />
              <Junction x={44} y={40} />
              <Junction x={160} y={110} />
              <Resistor x={100} y={110} value="10 kΩ" />
              <Capacitor x={160} y={140} rot={90} value="1 μF" />
              <Ground x={160} y={170} />
              <Port x={200} y={110} label="输出" color={rc ? trace.second : undefined} />
            </g>
            <Port x={20} y={40} color={trace.voltage} />
          </Schematic>
          <Plot
            height={240}
            x={{ min: 0, max: span, label: "时间（自动量程）", format: (v) => formatSI(v, "s") }}
            y={{ min: 0, max: 5.5, label: "电压 (V)", ticks: [0, 1, 2, 3, 4, 5] }}
            series={[
              { points: waves.square, label: "PWM 引脚", color: trace.voltage, step: true },
              {
                points: [
                  [0, vAvg],
                  [span, vAvg],
                ],
                label: "平均电压",
                color: trace.good,
                dashed: true,
              },
              ...(rc ? [{ points: waves.filtered, label: "RC 滤波后", color: trace.second }] : []),
            ]}
            ariaLabel="PWM 方波、它的平均电压，以及经过 RC 滤波后的电压"
          />
        </div>
      </LabStage>
      <LabControls columns={3}>
        <SliderField label="占空比" value={dutyPct} onChange={setDutyPct} min={0} max={100} step={1} unit="%" color={trace.voltage} />
        <SliderField label="PWM 频率" value={f} onChange={setF} min={1} max={50000} log unit="Hz" />
        <SwitchField label="加 RC 低通滤波" checked={rc} onChange={setRc} hint="10 kΩ + 1 μF，时间常数 10 ms" />
      </LabControls>
      <LabReadouts>
        <Readout label="平均电压" value={`${fixed(vAvg, 2)} V`} sub={<Tex>{String.raw`${dutyPct}\% \times ${VH}\,\mathrm{V}`}</Tex>} color={trace.good} />
        <Readout label="周期" value={formatSI(period, "s")} />
        <Readout label="高电平时间" value={formatSI(tOn, "s")} color={trace.voltage} />
        {rc && <Readout label="滤波后的纹波" value={formatSI(ripple, "V")} sub="峰峰值" color={trace.second} />}
      </LabReadouts>
      <LabNote tone={flicker || (rc && ripple > 0.5) ? "warn" : rc && duty > 0 && duty < 1 ? "good" : "neutral"}>
        {flicker
          ? `${formatSI(f, "Hz")} 太慢了：每次亮 ${formatSI(tOn, "s")}、灭 ${formatSI(period - tOn, "s")}，人眼看得出 LED 在一亮一灭。调光至少要用几百赫兹。`
          : duty <= 0
            ? "占空比 0%：引脚一直是低电平，LED 不亮，平均电压 0 V。"
            : duty >= 1
              ? `占空比 100%：引脚一直是高电平，相当于直接接在 ${VH} V 上。`
              : rc
                ? ripple > 0.5
                  ? `滤波器的时间常数是 10 ms，PWM 的周期有 ${formatSI(period, "s")}：电容来不及把方波抹平，纹波还有 ${formatSI(ripple, "V")}。把频率调高试试。`
                  : `滤波之后稳在 ${fixed(vAvg, 2)} V 附近，纹波只剩 ${formatSI(ripple, "V")}。频率越高纹波越小：PWM 加 RC，就是一个简易的 DAC。`
                : `每个周期亮 ${formatSI(tOn, "s")}、灭 ${formatSI(period - tOn, "s")}，切换得足够快，眼睛只看到 ${dutyPct}% 的平均亮度。`}
      </LabNote>
    </Lab>
  )
}

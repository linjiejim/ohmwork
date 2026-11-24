import * as React from "react"
import { Arrow, Lab, LabControls, LabNote, LabReadouts, LabStage, Label, Plot, Readout, Schematic, SliderField, Tex, fixed, formatSI, percent, sig, tex, trace } from "@/lab"

/** LM35: 10 mV per °C, 0 V at 0 °C. */
const SENSITIVITY = 0.01
/** ADC reference: the highest voltage it can tell apart. */
const VREF = 3.3
/** The range this thermometer is supposed to cover. */
const T_FULL = 100

/**
 * One signal chain, stage by stage: temperature → LM35 (10 mV/°C) → amplifier → ADC.
 * Shows how gain and bit count set "how many °C is one LSB", and what clipping costs.
 */
export function SensorChainLab() {
  const [temp, setTemp] = React.useState(25)
  const [gain, setGain] = React.useState(1)
  const [bits, setBits] = React.useState(12)

  const vSensor = temp * SENSITIVITY
  const vIdeal = vSensor * gain
  const vAdc = Math.min(VREF, vIdeal)
  const clipped = vIdeal > VREF * 1.0005
  const levels = 2 ** bits
  const lsb = VREF / levels
  const code = Math.min(levels - 1, Math.floor(vAdc / lsb + 1e-9))
  const degPerLsb = lsb / (SENSITIVITY * gain)
  // the temperature at which the amplified signal reaches the top of the ADC
  const tClip = VREF / (SENSITIVITY * gain)
  const vFull = T_FULL * SENSITIVITY * gain
  const willClip = vFull > VREF * 1.0005
  const used = Math.min(1, vFull / VREF)

  const tone = clipped ? "bad" : willClip ? "warn" : used >= 0.7 ? "good" : "neutral"
  const note = clipped
    ? `放大后本该是 ${formatSI(vIdeal, "V")}，但 ADC 最高只认 3.3 V：读数顶在 ${levels - 1} 不动，${fixed(tClip, 0)} °C 以上的温度全读成同一个数。这就是饱和。`
    : willClip
      ? `现在没事，但温度一过 ${fixed(tClip, 0)} °C 就会饱和，0–100 °C 的上半段读不出来。放大倍数要降到 3.3 倍以内。`
      : used >= 0.7
        ? `0–100 °C 用掉了 ADC 量程的 ${percent(used)}，没有饱和。现在读数每跳 1 格代表 ${sig(degPerLsb, 2)} °C。`
        : `100 °C 时放大后也只有 ${formatSI(vFull, "V")}，只用了 ADC 量程的 ${percent(used)}，其余的码白白空着。加大放大倍数，每一格代表的温度会更小。`

  return (
    <Lab
      title="信号链实验台"
      hint="温度先变成电压，放大后再变成数字。调放大倍数和 ADC 位数，看读数的一格代表多少度；再把放大倍数拉大，看它怎么饱和。"
      onReset={() => {
        setTemp(25)
        setGain(1)
        setBits(12)
      }}
    >
      <LabStage>
        <div className="grid gap-4">
          {/*
            Layout (340 × 110). Blocks sit on y = 32…82, signal line at y = 57.
            sensor box x 14…84 · amplifier triangle x 148…198 · ADC box x 256…326
            row above (y 22): what each block is; row below (y 101): its live value.
          */}
          <Schematic width={340} height={110} label="信号链：温度经 LM35 变成电压，放大后送进 ADC">
            <Label x={49} y={22} size={12} muted>
              传感器
            </Label>
            <Label x={173} y={22} size={12} muted>
              放大
            </Label>
            <Label x={291} y={22} size={12} muted>
              模数转换
            </Label>

            <rect x={14} y={32} width={70} height={50} rx={3} fill="var(--background)" />
            <Label x={49} y={54} weight={600}>
              LM35
            </Label>
            <Label x={49} y={71} size={12} muted>
              10 mV/°C
            </Label>

            <Arrow from={[84, 57]} to={[148, 57]} color="var(--foreground)" />
            <Label x={116} y={48} color={trace.voltage}>
              {formatSI(vSensor, "V")}
            </Label>

            <path d="M148 32V82L198 57Z" fill="var(--background)" />

            <Arrow from={[198, 57]} to={[256, 57]} color="var(--foreground)" />
            <Label x={227} y={48} color={clipped ? trace.power : trace.voltage}>
              {formatSI(vAdc, "V")}
            </Label>

            <rect x={256} y={32} width={70} height={50} rx={3} fill="var(--background)" />
            <Label x={291} y={54} weight={600}>
              ADC
            </Label>
            <Label x={291} y={71} size={12} muted>
              {bits} 位
            </Label>

            <Label x={49} y={101}>{temp} °C</Label>
            <Label x={173} y={101}>×{sig(gain)}</Label>
            <Label x={291} y={101} color={clipped ? trace.power : undefined}>
              读数 {code}
            </Label>
          </Schematic>
          <Plot
            height={200}
            x={{ min: 0, max: T_FULL, label: "温度 (°C)" }}
            y={{ min: 0, max: 4, label: "电压 (V)" }}
            series={[
              { fn: () => VREF, label: "ADC 上限 3.3 V", color: trace.ref, dashed: true },
              { fn: (t) => t * SENSITIVITY, label: "传感器输出", color: trace.second, dashed: true },
              { fn: (t) => Math.min(VREF, t * SENSITIVITY * gain), label: "放大后（进 ADC）", color: trace.voltage },
            ]}
            markers={[{ x: temp, y: vAdc, label: formatSI(vAdc, "V"), color: clipped ? trace.power : trace.voltage }]}
          />
        </div>
      </LabStage>
      <LabControls columns={3}>
        <SliderField label="温度" value={temp} onChange={setTemp} min={0} max={T_FULL} step={1} format={(v) => `${v} °C`} />
        <SliderField label="放大倍数" value={gain} onChange={setGain} min={1} max={10} step={0.1} format={(v) => `${sig(v)} 倍`} color={trace.voltage} />
        <SliderField label="ADC 位数" value={bits} onChange={setBits} min={8} max={16} step={2} format={(v) => `${v} 位`} />
      </LabControls>
      <LabReadouts>
        <Readout label="传感器输出" value={formatSI(vSensor, "V")} color={trace.second} />
        <Readout label="放大后" value={formatSI(vAdc, "V")} color={trace.voltage} sub={clipped ? "已饱和" : undefined} />
        <Readout label="ADC 读数" value={String(code)} sub={`最大 ${levels - 1}`} />
        <Readout label="1 格（1 LSB）代表" value={`${sig(degPerLsb, 2)} °C`} sub={<Tex>{String.raw`${tex.si(lsb, "V")} / ${tex.num(sig(SENSITIVITY * gain * 1000))}\,\mathrm{mV/{}^{\circ}C}`}</Tex>} />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

import * as React from "react"
import { Lab, LabControls, LabNote, LabReadouts, LabStage, Plot, Readout, SliderField, TAU, clamp, formatSI, sig, trace } from "@/lab"

const VREF = 3.3
/** The input: a sine centred in the ADC's range, 0.15 V … 3.15 V. */
const OFFSET = 1.65
const AMPLITUDE = 1.5
/** Time on screen, seconds. Fixed, so a faster signal simply shows more cycles. */
const SPAN = 0.01

const INITIAL = { bits: 4, fs: 4000, fin: 300 }

/**
 * Sampling and quantising a sine: the sample rate sets how wide the steps are,
 * the resolution how tall. Push the input past half the sample rate and the
 * samples trace out a slower sine that was never there.
 */
export function AdcLab() {
  const [bits, setBits] = React.useState(INITIAL.bits)
  const [fs, setFs] = React.useState(INITIAL.fs)
  const [fin, setFin] = React.useState(INITIAL.fin)

  const levels = 2 ** bits
  const lsb = VREF / levels
  // always in millivolts, so 12 bits reads 0.806 mV like the lesson's worked example
  const lsbText = `${sig(lsb * 1000, 3)} mV`
  const nyquist = fs / 2
  const perCycle = fs / fin
  const aliasing = fin >= nyquist
  // the samples of a sine at fin are the same as those of a sine at fin − k·fs
  const fAlias = fin - Math.round(fin / fs) * fs

  const model = React.useMemo(() => {
    const vin = (t: number) => OFFSET + AMPLITUDE * Math.sin(TAU * fin * t)
    const quantise = (v: number) => clamp(Math.round(v / lsb), 0, levels - 1) * lsb
    const ms = (t: number) => t * 1000
    const input: [number, number][] = Array.from({ length: 801 }, (_, i) => {
      const t = (SPAN * i) / 800
      return [ms(t), vin(t)]
    })
    const count = Math.floor(SPAN * fs + 1e-9)
    const instants = Array.from({ length: count + 1 }, (_, n) => n / fs)
    // sample and hold: each reading stays until the next sample
    const held: [number, number][] = instants.map((t) => [ms(t), quantise(vin(t))])
    held.push([ms(SPAN), held[held.length - 1][1]])
    const dots = instants.length <= 21 ? instants.map((t) => ({ x: ms(t), y: vin(t), color: trace.second })) : []
    const alias: [number, number][] = Array.from({ length: 201 }, (_, i) => {
      const t = (SPAN * i) / 200
      return [ms(t), OFFSET + AMPLITUDE * Math.sin(TAU * fAlias * t)]
    })
    return { input, held, dots, alias }
  }, [fin, fs, lsb, levels, fAlias])

  // with few bits, draw every level the ADC can report
  const rungs = bits <= 4 ? Array.from({ length: levels - 1 }, (_, k) => ({ y: (k + 1) * lsb, color: "var(--border)" })) : []

  return (
    <Lab
      title="采样与量化"
      hint="细线是真实的模拟输入，阶梯是 ADC 读到的数。减少位数、降低采样率，再把输入频率推过采样率的一半。"
      onReset={() => {
        setBits(INITIAL.bits)
        setFs(INITIAL.fs)
        setFin(INITIAL.fin)
      }}
    >
      <LabStage>
        <Plot
          height={260}
          x={{ min: 0, max: SPAN * 1000, label: "时间 (ms)" }}
          y={{ min: 0, max: VREF, label: "电压 (V)", ticks: [0, 1, 2, 3] }}
          series={[
            { points: model.input, label: "模拟输入", color: trace.voltage, width: 1.25 },
            { points: model.held, label: `ADC 读数（${bits} 位）`, color: trace.second, step: true },
            ...(aliasing ? [{ points: model.alias, label: "采样点连起来像这样（混叠）", color: trace.third, dashed: true }] : []),
          ]}
          markers={model.dots}
          lines={rungs}
          ariaLabel="模拟输入的正弦波，和 ADC 采样保持、量化之后的阶梯波"
        />
      </LabStage>
      <LabControls columns={3}>
        <SliderField label="分辨率" value={bits} onChange={(v) => setBits(Math.round(v))} min={2} max={12} step={1} format={(v) => `${v} 位`} />
        <SliderField label="采样率" value={fs} onChange={setFs} min={500} max={20000} log unit="Hz" color={trace.second} />
        <SliderField label="输入信号频率" value={fin} onChange={setFin} min={100} max={3000} log unit="Hz" color={trace.voltage} />
      </LabControls>
      <LabReadouts>
        <Readout label="台阶数" value={levels} sub={`2 的 ${bits} 次方`} />
        <Readout label="每级台阶（LSB）" value={lsbText} sub={`${VREF} V ÷ ${levels}`} />
        <Readout label="奈奎斯特频率" value={formatSI(nyquist, "Hz")} sub="采样率的一半" />
        <Readout label="每个周期采样" value={`${sig(perCycle, 3)} 点`} />
      </LabReadouts>
      <LabNote tone={aliasing ? "bad" : perCycle < 5 ? "warn" : "neutral"}>
        {aliasing
          ? Math.abs(fAlias) < 1e-9
            ? `输入 ${formatSI(fin, "Hz")} 正好是采样率的整数倍：每次都采在波形的同一个位置，读数连成一条直线，看起来像直流。这是混叠最极端的样子。`
            : `输入 ${formatSI(fin, "Hz")} 不低于奈奎斯特频率 ${formatSI(nyquist, "Hz")}：采样点连起来像一个 ${formatSI(Math.abs(fAlias), "Hz")} 的信号（虚线）。这就是混叠，采完之后再也分不出真假。`
          : perCycle < 5
            ? `每个周期只采到 ${sig(perCycle, 2)} 个点：频率还认得出，波形已经走样。实际设计里，采样率通常取信号最高频率的 5–10 倍。`
            : `每个周期采 ${sig(perCycle, 3)} 个点，每级台阶 ${lsbText}。采样率决定台阶有多窄，位数决定台阶有多矮。`}
      </LabNote>
    </Lab>
  )
}

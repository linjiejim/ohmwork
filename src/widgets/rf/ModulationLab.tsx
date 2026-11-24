import * as React from "react"
import { Button, ControlField, Lab, LabControls, LabNote, LabReadouts, LabStage, Plot, Readout, Segmented, SliderField, TAU, fixed, formatSI, percent, trace } from "@/lab"

type Mode = "am" | "fm" | "ask" | "fsk" | "bpsk"

/*
 * Everything is slowed down so the carrier's cycles are visible: an 8 ms
 * window, a 3 kHz carrier, and either a 250 Hz sine or 8 bits at 1 kbit/s as
 * the baseband. Real carriers run thousands of times faster than the data.
 */
const WINDOW = 8 // ms
const CARRIER = 3 // kHz
const TONE = 0.25 // kHz, the analogue baseband
const BIT_RATE = 1 // kbit/s
const SAMPLES = 1600
const INITIAL_BITS = [1, 0, 1, 1, 0, 0, 1, 0]
const TIME_TICKS = [0, 1, 2, 3, 4, 5, 6, 7, 8]

const MODES: { value: Mode; label: string }[] = [
  { value: "am", label: "AM" },
  { value: "fm", label: "FM" },
  { value: "ask", label: "ASK" },
  { value: "fsk", label: "FSK" },
  { value: "bpsk", label: "BPSK" },
]

const INITIAL = { amDepth: 0.6, fmDev: 1.5, askDepth: 1, fskDev: 1, pskShift: 180 }

/** One baseband, five ways to put it on a carrier: the top plot is the message, the bottom plot is what goes to the antenna. */
export function ModulationLab() {
  const [mode, setMode] = React.useState<Mode>("am")
  const [bits, setBits] = React.useState(INITIAL_BITS)
  const [p, setP] = React.useState(INITIAL)
  const digital = mode === "ask" || mode === "fsk" || mode === "bpsk"
  const set = (key: keyof typeof INITIAL) => (v: number) => setP((old) => ({ ...old, [key]: v }))

  const { wave, envelope } = React.useMemo(() => {
    const wave: [number, number][] = []
    const envelope: [number, number][] = []
    const dt = WINDOW / SAMPLES
    let phase = 0 // FSK keeps its phase continuous across bit edges
    for (let i = 0; i <= SAMPLES; i++) {
      const t = i * dt
      const bit = bits[Math.min(bits.length - 1, Math.floor(t * BIT_RATE))]
      const tone = Math.sin(TAU * TONE * t)
      let y = 0
      if (mode === "am") {
        const a = 1 + p.amDepth * tone
        y = a * Math.cos(TAU * CARRIER * t)
        envelope.push([t, Math.abs(a)])
      } else if (mode === "fm") {
        // phase = ∫ 2π (fc + Δf·sin(2π fm τ)) dτ
        y = Math.cos(TAU * CARRIER * t + (p.fmDev / TONE) * (1 - Math.cos(TAU * TONE * t)))
      } else if (mode === "ask") {
        y = (bit ? 1 : 1 - p.askDepth) * Math.cos(TAU * CARRIER * t)
      } else if (mode === "fsk") {
        y = Math.cos(phase)
        phase += TAU * (CARRIER + (bit ? p.fskDev : -p.fskDev)) * dt
      } else {
        y = Math.cos(TAU * CARRIER * t + (bit ? 0 : (p.pskShift * Math.PI) / 180))
      }
      wave.push([t, y])
    }
    return { wave, envelope }
  }, [mode, bits, p])

  const bitSteps = React.useMemo(() => [...bits.map((b, i) => [i, b] as [number, number]), [bits.length, bits[bits.length - 1]] as [number, number]], [bits])

  let slider: React.ReactNode
  let readouts: { label: string; value: string; sub?: string }[]
  let note: { tone: "neutral" | "good" | "warn" | "bad"; text: string }
  if (mode === "am") {
    slider = <SliderField label="调制深度" value={p.amDepth} onChange={set("amDepth")} min={0} max={1.5} step={0.05} format={(v) => percent(v)} color={trace.voltage} />
    readouts = [
      { label: "调制深度", value: percent(p.amDepth) },
      { label: "占用带宽", value: formatSI(2 * TONE * 1000, "Hz"), sub: "2 × 基带频率" },
    ]
    note =
      p.amDepth === 0
        ? { tone: "warn", text: "调制深度 0：载波的幅度纹丝不动，什么信息也没带上。" }
        : p.amDepth > 1
          ? { tone: "bad", text: "过调制：深度超过 100%，包络碰到零以后翻了上去，接收机检出来的不再是原来的正弦，声音会失真。" }
          : { tone: "neutral", text: "调幅：载波的幅度跟着基带起伏，虚线画出的包络就是原来的信号。接收机用一只二极管检出包络就能还原，但幅度上的任何干扰也会原样混进去。" }
  } else if (mode === "fm") {
    slider = <SliderField label="频偏 Δf" value={p.fmDev} onChange={set("fmDev")} min={0} max={2} step={0.05} format={(v) => formatSI(v * 1000, "Hz")} color={trace.voltage} />
    readouts = [
      { label: "瞬时频率", value: `${fixed(CARRIER - p.fmDev, 2)}–${fixed(CARRIER + p.fmDev, 2)} kHz` },
      { label: "调制指数 β", value: fixed(p.fmDev / TONE, 1), sub: "Δf ÷ 基带频率" },
      { label: "占用带宽", value: formatSI(2 * (p.fmDev + TONE) * 1000, "Hz"), sub: "2 × (Δf + 基带频率)" },
    ]
    note =
      p.fmDev === 0
        ? { tone: "warn", text: "频偏 0：只剩一个纯载波，什么信息也没带上。" }
        : { tone: "neutral", text: "调频：幅度始终不变，基带高的地方波挤得密，低的地方拉得疏。幅度上的干扰可以直接削掉，所以比调幅抗噪声；代价是频偏越大，占的带宽越宽。" }
  } else if (mode === "ask") {
    slider = <SliderField label="调制深度" value={p.askDepth} onChange={set("askDepth")} min={0} max={1} step={0.05} format={(v) => percent(v)} color={trace.voltage} />
    readouts = [
      { label: "发 0 时的幅度", value: percent(1 - p.askDepth) },
      { label: "每个符号", value: "1 比特" },
      { label: "占用带宽", value: formatSI(2 * BIT_RATE * 1000, "Hz"), sub: "约 2 × 比特率" },
    ]
    note =
      p.askDepth === 0
        ? { tone: "bad", text: "调制深度 0：发 0 和发 1 的波形一模一样，接收机分不出来。" }
        : p.askDepth === 1
          ? { tone: "neutral", text: "深度 100% 的 ASK 就是 OOK：发 1 时有载波，发 0 时干脆不发。433 MHz 遥控器几乎都这么做，电路最简单，发 0 时还不耗电。" }
          : { tone: "neutral", text: `ASK：发 0 时幅度降到 ${percent(1 - p.askDepth)}。两种幅度差得越少，越容易被噪声搅混。` }
  } else if (mode === "fsk") {
    const h = (2 * p.fskDev) / BIT_RATE
    slider = <SliderField label="频偏 Δf" value={p.fskDev} onChange={set("fskDev")} min={0} max={2} step={0.05} format={(v) => formatSI(v * 1000, "Hz")} color={trace.voltage} />
    readouts = [
      { label: "发 0 / 发 1 的频率", value: `${fixed(CARRIER - p.fskDev, 2)} / ${fixed(CARRIER + p.fskDev, 2)} kHz` },
      { label: "调制指数 h", value: fixed(h, 1), sub: "2Δf ÷ 比特率" },
      { label: "占用带宽", value: formatSI(2 * (p.fskDev + BIT_RATE) * 1000, "Hz"), sub: "约 2 × (Δf + 比特率)" },
    ]
    note =
      p.fskDev === 0
        ? { tone: "bad", text: "频偏 0：两个频率重合，发 0 和发 1 没有区别。" }
        : h <= 0.7
          ? { tone: "neutral", text: `调制指数 h = ${fixed(h, 1)}：两个频率只差一点，肉眼几乎看不出，接收机却分得清，占的带宽也小。蓝牙的 GFSK 就取 h ≈ 0.5。` }
          : { tone: "neutral", text: "FSK：发 1 用高一点的频率，发 0 用低一点的，幅度不变。频偏越大越好分辨，占的带宽也越宽。" }
  } else {
    slider = <SliderField label="0 和 1 的相位差" value={p.pskShift} onChange={set("pskShift")} min={0} max={180} step={5} unit="°" color={trace.voltage} />
    readouts = [
      { label: "相位差", value: `${fixed(p.pskShift, 0)}°` },
      { label: "每个符号", value: "1 比特" },
      { label: "占用带宽", value: formatSI(2 * BIT_RATE * 1000, "Hz"), sub: "约 2 × 比特率" },
    ]
    note =
      p.pskShift === 0
        ? { tone: "bad", text: "相位差 0：发 0 和发 1 的波形一模一样，接收机分不出来。" }
        : p.pskShift === 180
          ? { tone: "good", text: "BPSK：发 0 时把载波倒过来（相位差 180°）。两种波形正好相反，是两个符号能拉开的最大距离，所以最抗噪声。看比特交界处波形的突然翻转。" }
          : { tone: "warn", text: `相位差只有 ${fixed(p.pskShift, 0)}°：两种波形比较像，同样的噪声下比 180° 的 BPSK 更容易判错。` }
  }

  return (
    <Lab
      title="调制实验台"
      hint="换一种调制方式，拖动深度或频偏：上图是要传的信息，下图是送上天线的波形。"
      onReset={() => {
        setMode("am")
        setBits(INITIAL_BITS)
        setP(INITIAL)
      }}
    >
      <LabStage>
        <div className="flex flex-col gap-3">
          {digital && (
            <div className="pl-11 pr-3.5">
              <p className="mb-1 text-caption text-muted-foreground">要发送的 8 个比特（点一下翻转）</p>
              <div className="grid grid-cols-8 gap-1">
                {bits.map((b, i) => (
                  <Button
                    key={i}
                    size="sm"
                    aria-label={`第 ${i + 1} 位，现在是 ${b}，点击翻转`}
                    aria-pressed={b === 1}
                    className={b ? "tabular w-full border-foreground px-0" : "tabular w-full px-0 text-muted-foreground"}
                    onClick={() => setBits((old) => old.map((v, k) => (k === i ? 1 - v : v)))}
                  >
                    {b}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <Plot
            height={digital ? 136 : 150}
            x={{ min: 0, max: WINDOW, label: "时间 (ms)", ticks: TIME_TICKS }}
            y={digital ? { min: -0.3, max: 1.3, ticks: [0, 1] } : { min: -1.3, max: 1.3, ticks: [-1, 0, 1] }}
            series={[digital ? { points: bitSteps, step: true, label: "基带：比特流", color: trace.second } : { fn: (t) => Math.sin(TAU * TONE * t), label: "基带：250 Hz 正弦", color: trace.second }]}
            ariaLabel="基带信号随时间的波形"
          />
          <Plot
            height={190}
            x={{ min: 0, max: WINDOW, label: "时间 (ms)", ticks: TIME_TICKS }}
            y={mode === "am" ? { min: -2.6, max: 2.6, ticks: [-2, -1, 0, 1, 2] } : { min: -1.3, max: 1.3, ticks: [-1, 0, 1] }}
            series={[
              { points: wave, label: "已调波形", color: trace.voltage, width: 1.5 },
              ...(mode === "am"
                ? [
                    { points: envelope, label: "包络", color: trace.ref, dashed: true, width: 1.5 },
                    { points: envelope.map(([t, a]) => [t, -a] as [number, number]), color: trace.ref, dashed: true, width: 1.5 },
                  ]
                : []),
            ]}
            ariaLabel="已调波形随时间的变化"
          />
        </div>
      </LabStage>
      <LabControls>
        <ControlField label="调制方式">
          <Segmented size="sm" value={mode} onValueChange={setMode} options={MODES} aria-label="调制方式" />
        </ControlField>
        {slider}
      </LabControls>
      <LabReadouts>
        <Readout label="载波" value={formatSI(CARRIER * 1000, "Hz")} sub="为了看清，放慢了很多" />
        {readouts.map((r) => (
          <Readout key={r.label} label={r.label} value={r.value} sub={r.sub} />
        ))}
      </LabReadouts>
      <LabNote tone={note.tone}>{note.text}</LabNote>
    </Lab>
  )
}

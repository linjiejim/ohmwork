import * as React from "react"
import { ControlField, Lab, LabControls, LabNote, LabReadouts, LabStage, Plot, Readout, Segmented, SliderField, TAU, Tex, dbV, formatSI, percent, sig, trace, useWidth } from "@/lab"

type Shape = "square" | "saw" | "triangle"
type Scale = "linear" | "db"

const MAX_N = 30
const SAMPLES = 800
/** The readouts quote frequencies for a 1 kHz fundamental. */
const F0 = 1000

/** Fourier sine coefficient of the n-th harmonic, for a wave that swings between −1 and +1. */
function coeff(shape: Shape, n: number): number {
  const odd = n % 2 === 1
  if (shape === "square") return odd ? 4 / (Math.PI * n) : 0
  if (shape === "saw") return ((odd ? 1 : -1) * 2) / (Math.PI * n)
  return odd ? (((n - 1) / 2) % 2 === 0 ? 1 : -1) * (8 / (Math.PI * Math.PI * n * n)) : 0
}

/** Two periods of the ideal wave as corner points. */
const IDEAL: Record<Shape, [number, number][]> = {
  square: [
    [0, 1],
    [0.5, 1],
    [0.5, -1],
    [1, -1],
    [1, 1],
    [1.5, 1],
    [1.5, -1],
    [2, -1],
  ],
  saw: [
    [0, 0],
    [0.5, 1],
    [0.5, -1],
    [1.5, 1],
    [1.5, -1],
    [2, 0],
  ],
  triangle: [
    [0, 0],
    [0.25, 1],
    [0.75, -1],
    [1.25, 1],
    [1.75, -1],
    [2, 0],
  ],
}
/** Mean square of the ideal wave (Parseval: each harmonic of amplitude b carries b²/2 of it). */
const MEAN_SQUARE: Record<Shape, number> = { square: 1, saw: 1 / 3, triangle: 1 / 3 }
const NAME: Record<Shape, string> = { square: "方波", saw: "锯齿波", triangle: "三角波" }

/** The spectrum: one bar per harmonic. Harmonics above `upTo` are drawn faint: they are not in the sum. */
function SpectrumBars({ amps, upTo, scale }: { amps: number[]; upTo: number; scale: Scale }) {
  const [ref, width] = useWidth<HTMLDivElement>(640)
  const height = 210
  const m = { l: 44, r: 14, t: 26, b: 42 }
  const pw = Math.max(40, width - m.l - m.r)
  const ph = height - m.t - m.b
  const slot = pw / MAX_N
  const barW = Math.max(2, slot * 0.62)
  const db = scale === "db"
  // linear: 0 … 1.4 × the wave's peak; dB: −60 … +5 dB relative to that peak
  const lo = db ? -60 : 0
  const hi = db ? 5 : 1.4
  const yOf = (v: number) => m.t + (1 - (v - lo) / (hi - lo)) * ph
  const base = m.t + ph
  const yTicks = db ? [-60, -40, -20, 0] : [0, 0.5, 1]
  const xTicks = [1, 5, 10, 15, 20, 25, 30]
  const cutX = m.l + upTo * slot
  const cutLeft = cutX > m.l + pw - 100
  return (
    <div ref={ref} className="w-full min-w-0">
      <div className="mb-1 flex min-h-5 flex-wrap items-center gap-x-4 gap-y-1 text-caption text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <svg aria-hidden width="10" height="10" className="shrink-0">
            <rect width="10" height="10" rx="2" fill={trace.voltage} />
          </svg>
          已叠加的谐波
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg aria-hidden width="10" height="10" className="shrink-0">
            <rect width="10" height="10" rx="2" fill="var(--input)" />
          </svg>
          还没加进来的
        </span>
      </div>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="各次谐波幅度的柱状图" className="block max-w-full select-none">
        <g stroke="var(--border)" strokeWidth="1">
          {yTicks.map((v) => (
            <line key={v} x1={m.l} x2={m.l + pw} y1={yOf(v)} y2={yOf(v)} />
          ))}
        </g>
        <rect x={m.l} y={m.t} width={pw} height={ph} fill="none" stroke="var(--input)" strokeWidth="1" />
        <g className="tabular fill-faint-foreground text-caption">
          {xTicks.map((n) => (
            <text key={n} x={m.l + (n - 0.5) * slot} y={base + 16} textAnchor="middle">
              {n}
            </text>
          ))}
          {yTicks.map((v) => (
            <text key={v} x={m.l - 6} y={yOf(v) + 4} textAnchor="end">
              {sig(v)}
            </text>
          ))}
          <text x={m.l + pw / 2} y={height - 6} textAnchor="middle">
            谐波次数 n（频率 = n × 基波频率）
          </text>
          <text x={4} y={14} textAnchor="start">
            {db ? "谐波幅度 (dB，波形峰值为 0 dB)" : "谐波幅度（波形峰值为 1）"}
          </text>
        </g>
        {amps.map((a, k) => {
          const n = k + 1
          const v = db ? (a > 0 ? dbV(a) : -Infinity) : a
          if (!(v > lo)) return null
          const top = yOf(Math.min(v, hi))
          return (
            <rect key={n} x={m.l + (n - 0.5) * slot - barW / 2} y={top} width={barW} height={base - top} rx={Math.min(2, barW / 2)} fill={n <= upTo ? trace.voltage : "var(--input)"}>
              <title>{`第 ${n} 次谐波，幅度 ${sig(a, 3)}`}</title>
            </rect>
          )
        })}
        <line x1={cutX} x2={cutX} y1={m.t} y2={base} stroke="var(--faint-foreground)" strokeWidth="1.25" strokeDasharray="4 4" />
        <text x={cutX + (cutLeft ? -6 : 6)} y={m.t + 14} textAnchor={cutLeft ? "end" : "start"} className="tabular fill-faint-foreground text-caption">
          {`保留到第 ${upTo} 次`}
        </text>
      </svg>
    </div>
  )
}

/** Build a square, sawtooth or triangle wave out of sine waves, one harmonic at a time, and watch its spectrum. */
export function FourierLab() {
  const [shape, setShape] = React.useState<Shape>("square")
  const [upTo, setUpTo] = React.useState(5)
  const [scale, setScale] = React.useState<Scale>("linear")

  const amps = React.useMemo(() => Array.from({ length: MAX_N }, (_, k) => Math.abs(coeff(shape, k + 1))), [shape])
  const synth = React.useMemo(() => {
    const pts: [number, number][] = []
    for (let k = 0; k <= SAMPLES; k++) {
      const x = (2 * k) / SAMPLES // time in periods
      let y = 0
      for (let n = 1; n <= upTo; n++) {
        const b = coeff(shape, n)
        if (b !== 0) y += b * Math.sin(TAU * n * x)
      }
      pts.push([x, y])
    }
    return pts
  }, [shape, upTo])

  // which harmonics are actually in the sum (a square wave has no even ones)
  const included = amps.map((a, k) => (a > 0 && k < upTo ? k + 1 : 0)).filter((n) => n > 0)
  const last = included[included.length - 1]
  const power = included.reduce((sum, n) => sum + amps[n - 1] ** 2 / 2, 0)
  const error = Math.sqrt(Math.max(0, MEAN_SQUARE[shape] - power) / MEAN_SQUARE[shape])
  const listed = included.length <= 4 ? `第 ${included.join("、")} 次` : `第 ${included.slice(0, 3).join("、")} … ${last} 次`

  let note: React.ReactNode
  if (shape === "square") {
    if (included.length === 1)
      note = (
        <>
          只有基波：一个幅度约 1.27（<Tex>{String.raw`4/\pi`}</Tex>）的正弦波。它和方波频率相同，但一点棱角都没有。
        </>
      )
    else if (last < 10) note = `加到第 ${last} 次谐波：边沿变陡了，平顶还在起伏。方波只有奇次谐波，偶数那几格是空的。`
    else note = `加到第 ${last} 次谐波：已经很像方波。跳变两侧的小尖峰大约是跳变高度的 9%，谐波再多它也不会消失，只会变窄。`
  } else if (shape === "saw") {
    if (included.length === 1)
      note = (
        <>
          只有基波。锯齿波的奇次、偶次谐波都有，幅度按 <Tex>{"1/n"}</Tex> 递减。
        </>
      )
    else if (last < 10) note = `加到第 ${last} 次谐波：斜坡成形了，但跳变的地方还很圆。跳变越陡，需要的高次谐波越多。`
    else note = `加到第 ${last} 次谐波：斜坡已经很直。和方波一样，跳变两侧的小尖峰不会随着谐波增多而消失。`
  } else {
    if (included.length === 1)
      note = (
        <>
          只用基波就很像三角波了，差距只有 {percent(error)}。三角波没有跳变，谐波按 <Tex>{"1/n^2"}</Tex> 衰减，高次谐波非常弱。
        </>
      )
    else note = `加到第 ${last} 次谐波，差距只剩 ${percent(error, 1)}。三角波只有尖角、没有跳变，几个谐波就够了。`
  }

  return (
    <Lab
      title="用正弦波拼出一个波形"
      hint="把谐波一个一个加进来，看上图的合成波形怎样逼近理想波形，下图的频谱里哪些柱子被点亮。"
      onReset={() => {
        setShape("square")
        setUpTo(5)
        setScale("linear")
      }}
    >
      <LabStage>
        <Plot
          height={230}
          x={{ min: 0, max: 2, label: "时间 (周期)", ticks: [0, 0.5, 1, 1.5, 2] }}
          y={{ min: -1.5, max: 1.5, label: "电压 (V)", ticks: [-1, 0, 1] }}
          series={[
            { points: IDEAL[shape], label: `理想的${NAME[shape]}`, color: trace.ref, dashed: true },
            { points: synth, label: `${included.length} 个正弦波之和`, color: trace.voltage },
          ]}
        />
        <div className="mt-4">
          <SpectrumBars amps={amps} upTo={upTo} scale={scale} />
        </div>
      </LabStage>
      <LabControls columns={3}>
        <ControlField label="目标波形">
          <Segmented
            aria-label="目标波形"
            value={shape}
            onValueChange={setShape}
            options={[
              { value: "square", label: "方波" },
              { value: "saw", label: "锯齿波" },
              { value: "triangle", label: "三角波" },
            ]}
          />
        </ControlField>
        <SliderField label="保留到第几次谐波" value={upTo} onChange={setUpTo} min={1} max={MAX_N} step={1} format={(v) => `第 ${v} 次`} color={trace.voltage} />
        <ControlField label="频谱的纵轴">
          <Segmented
            aria-label="频谱的纵轴"
            value={scale}
            onValueChange={setScale}
            options={[
              { value: "linear", label: "线性" },
              { value: "db", label: "分贝" },
            ]}
          />
        </ControlField>
      </LabControls>
      <LabReadouts>
        <Readout label="已叠加" value={`${included.length} 个正弦波`} sub={listed} color={trace.voltage} />
        <Readout label="最高频率成分" value={formatSI(last * F0, "Hz")} sub="基波按 1 kHz 算" />
        <Readout label="和理想波形的差距" value={percent(error, 1)} sub="均方根误差" />
      </LabReadouts>
      <LabNote>{note}</LabNote>
    </Lab>
  )
}

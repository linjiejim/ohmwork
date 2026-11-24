import * as React from "react"
import { ControlField, Lab, LabControls, LabNote, LabReadouts, LabStage, Label, Readout, Schematic, Segmented, SliderField, percent, trace } from "@/lab"
import { seeded } from "./kit"

type Scheme = "bpsk" | "qpsk" | "qam16"

interface Point {
  i: number
  q: number
  bits: string
}

/* Ideal points, scaled so the average symbol energy is 1 in every scheme. */
function constellation(scheme: Scheme): Point[] {
  if (scheme === "bpsk")
    return [
      { i: -1, q: 0, bits: "0" },
      { i: 1, q: 0, bits: "1" },
    ]
  if (scheme === "qpsk") {
    const a = Math.SQRT1_2
    return [1, -1].flatMap((si) => [1, -1].map((sq) => ({ i: si * a, q: sq * a, bits: `${si < 0 ? 1 : 0}${sq < 0 ? 1 : 0}` })))
  }
  const levels = [-3, -1, 1, 3]
  const gray = ["00", "01", "11", "10"]
  const a = 1 / Math.sqrt(10)
  return levels.flatMap((li, x) => levels.map((lq, y) => ({ i: li * a, q: lq * a, bits: gray[x] + gray[y] })))
}

/** Lines the receiver decides by, as positions on one axis (the same on I and Q, except BPSK which only uses I). */
function boundaries(scheme: Scheme): { i: number[]; q: number[] } {
  if (scheme === "bpsk") return { i: [0], q: [] }
  if (scheme === "qpsk") return { i: [0], q: [0] }
  const b = 2 / Math.sqrt(10)
  return { i: [-b, 0, b], q: [-b, 0, b] }
}

/*
 * 240 symbols with unit-variance Gaussian noise, drawn once from a fixed seed.
 * The slider only scales the noise, so the cloud breathes instead of jumping.
 */
const COUNT = 240
const DRAWS = (() => {
  const rand = seeded(20251)
  return Array.from({ length: COUNT }, () => {
    const pick = rand()
    const r = Math.sqrt(-2 * Math.log(1 - rand()))
    const angle = 2 * Math.PI * rand()
    return { pick, ni: r * Math.cos(angle), nq: r * Math.sin(angle) }
  })
})()

/** Complementary error function (Abramowitz–Stegun 7.1.26, good to 1.5e-7) for x ≥ 0. */
function erfc(x: number) {
  const t = 1 / (1 + 0.3275911 * x)
  return t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-x * x)
}
const tail = (x: number) => 0.5 * erfc(x / Math.SQRT2)

/** Symbol error rate over additive white Gaussian noise; snr is Es/N0 as a plain ratio. */
function symbolErrorRate(scheme: Scheme, snr: number) {
  if (scheme === "bpsk") return tail(Math.sqrt(2 * snr))
  if (scheme === "qpsk") return 1 - (1 - tail(Math.sqrt(snr))) ** 2
  return 1 - (1 - 1.5 * tail(Math.sqrt(snr / 5))) ** 2
}

const SCHEMES: { value: Scheme; label: string }[] = [
  { value: "bpsk", label: "BPSK" },
  { value: "qpsk", label: "QPSK" },
  { value: "qam16", label: "16-QAM" },
]
const NAMES: Record<Scheme, string> = { bpsk: "BPSK", qpsk: "QPSK", qam16: "16-QAM" }

// drawing: 270 × 270, centre (135, 135), one unit of amplitude = 72 px, plot square 15…255
const SIZE = 270
const MID = 135
const UNIT = 72
const EDGE = 120

/** A constellation diagram with noise: ideal points, what the receiver actually sees, and which symbols it gets wrong. */
export function ConstellationLab() {
  const [scheme, setScheme] = React.useState<Scheme>("qam16")
  const [snrDb, setSnrDb] = React.useState(18)
  const clipId = React.useId()

  const ideal = React.useMemo(() => constellation(scheme), [scheme])
  const lines = boundaries(scheme)
  const snr = 10 ** (snrDb / 10)
  const sigma = Math.sqrt(1 / (2 * snr)) // noise per axis, for Es = 1
  const received = DRAWS.map((d) => {
    const sent = Math.min(ideal.length - 1, Math.floor(d.pick * ideal.length))
    const i = ideal[sent].i + sigma * d.ni
    const q = ideal[sent].q + sigma * d.nq
    let nearest = 0
    let best = Infinity
    ideal.forEach((pt, k) => {
      const dist = (pt.i - i) ** 2 + (pt.q - q) ** 2
      if (dist < best) {
        best = dist
        nearest = k
      }
    })
    return { x: MID + i * UNIT, y: MID - q * UNIT, wrong: nearest !== sent }
  })
  const errors = received.filter((r) => r.wrong).length
  const ser = symbolErrorRate(scheme, snr)
  const bitsPerSymbol = Math.log2(ideal.length)

  const note: { tone: "good" | "warn" | "bad"; text: string } =
    errors === 0 && ser < 1e-3
      ? { tone: "good", text: `${NAMES[scheme]}：每团点云都离判决边界（虚线）很远，接收机几乎不会认错。信噪比还有富余，可以换点更密的调制来提速。` }
      : ser < 0.02
        ? { tone: "warn", text: `${NAMES[scheme]}：点云的边缘碰到了判决边界，偶尔有点落进邻居的格子，接收机就把它认成别的符号（红叉）。零星的错误还能靠纠错编码救回来。` }
        : { tone: "bad", text: `${NAMES[scheme]}：相邻的点云已经重叠，接收机分不清发的是哪个点，成片判错。要么提高信噪比，要么退回点更少的调制方式。` }

  return (
    <Lab
      title="星座图与噪声"
      hint="把信噪比往下拖，看点云什么时候糊成一片；再换一种调制方式比一比。"
      onReset={() => {
        setScheme("qam16")
        setSnrDb(18)
      }}
    >
      <LabStage>
        <Schematic width={SIZE} height={SIZE} label={`${NAMES[scheme]} 星座图：${ideal.length} 个理想点，以及信噪比 ${snrDb} dB 时接收到的 ${COUNT} 个带噪声的点`}>
          <defs>
            <clipPath id={clipId}>
              <rect x={MID - EDGE} y={MID - EDGE} width={EDGE * 2} height={EDGE * 2} />
            </clipPath>
          </defs>
          <rect x={MID - EDGE} y={MID - EDGE} width={EDGE * 2} height={EDGE * 2} stroke="var(--input)" strokeWidth={1} />
          <path d={`M${MID - EDGE} ${MID}H${MID + EDGE}M${MID} ${MID - EDGE}V${MID + EDGE}`} stroke="var(--input)" strokeWidth={1} />
          {/* decision boundaries */}
          <g stroke="var(--muted-foreground)" strokeWidth={1.25} strokeDasharray="4 4">
            {lines.i.map((b) => (
              <line key={`i${b}`} x1={MID + b * UNIT} x2={MID + b * UNIT} y1={MID - EDGE} y2={MID + EDGE} />
            ))}
            {lines.q.map((b) => (
              <line key={`q${b}`} x1={MID - EDGE} x2={MID + EDGE} y1={MID - b * UNIT} y2={MID - b * UNIT} />
            ))}
          </g>
          <g clipPath={`url(#${clipId})`}>
            {received.map((r, k) =>
              r.wrong ? (
                <path key={k} d={`M${(r.x - 3).toFixed(1)} ${(r.y - 3).toFixed(1)}l6 6m0 -6l-6 6`} stroke={trace.power} strokeWidth={1.5} />
              ) : (
                <circle key={k} cx={r.x.toFixed(1)} cy={r.y.toFixed(1)} r={2} fill={trace.current} opacity={0.6} stroke="none" />
              ),
            )}
          </g>
          {ideal.map((pt) => (
            <g key={pt.bits}>
              <circle cx={MID + pt.i * UNIT} cy={MID - pt.q * UNIT} r={4.5} fill="var(--foreground)" stroke="var(--sunken)" strokeWidth={1.5} />
              <text x={MID + pt.i * UNIT} y={MID - pt.q * UNIT + 18} textAnchor="middle" fontSize={12} fontWeight={500} fill="var(--foreground)" stroke="var(--sunken)" strokeWidth={3} paintOrder="stroke" className="tabular">
                {pt.bits}
              </text>
            </g>
          ))}
          <Label x={MID + EDGE - 6} y={MID - 6} anchor="end" size={12} muted>
            I
          </Label>
          <Label x={MID + 6} y={MID - EDGE + 14} anchor="start" size={12} muted>
            Q
          </Label>
        </Schematic>
        <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-caption text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2 shrink-0 rounded-full bg-foreground" />
            理想位置和它代表的比特
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: trace.current }} />
            收到的点
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg aria-hidden width="8" height="8" className="shrink-0">
              <path d="M1 1l6 6m0 -6l-6 6" stroke={trace.power} strokeWidth="1.5" fill="none" />
            </svg>
            判错的点
          </span>
        </div>
      </LabStage>
      <LabControls>
        <ControlField label="调制方式">
          <Segmented size="sm" value={scheme} onValueChange={setScheme} options={SCHEMES} aria-label="调制方式" />
        </ControlField>
        <SliderField label="信噪比" value={snrDb} onChange={setSnrDb} min={0} max={30} step={0.5} unit="dB" />
      </LabControls>
      <LabReadouts>
        <Readout label="每个符号携带" value={`${bitsPerSymbol} 比特`} sub={`${ideal.length} 个点`} />
        <Readout label={`这 ${COUNT} 个符号里判错`} value={`${errors} 个`} color={trace.power} />
        <Readout label="理论误符号率" value={ser >= 1e-4 ? percent(ser, ser < 0.01 ? 2 : 1) : "低于 0.01%"} />
      </LabReadouts>
      <LabNote tone={note.tone}>{note.text}</LabNote>
    </Lab>
  )
}

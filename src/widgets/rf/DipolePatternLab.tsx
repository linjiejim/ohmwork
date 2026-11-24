import * as React from "react"
import { Button, ControlField, Lab, LabControls, LabNote, LabReadouts, LabStage, Label, Readout, Schematic, SliderField, TAU, fixed, trace } from "@/lab"

/**
 * Far field of a thin centre-fed dipole with a sinusoidal current, θ measured
 * from the wire: |cos(kL/2·cos θ) − cos(kL/2)| / sin θ, with kL/2 = π·L/λ.
 * On the axis (sin θ → 0) the limit is 0.
 */
function field(length: number, theta: number) {
  const s = Math.sin(theta)
  if (Math.abs(s) < 1e-6) return 0
  const a = Math.PI * length
  return Math.abs((Math.cos(a * Math.cos(theta)) - Math.cos(a)) / s)
}

/** Peak direction, −3 dB width of the main lobe, and directivity by integrating the pattern over the sphere. */
function analyse(length: number) {
  const n = 1440
  const step = Math.PI / n
  let max = 0
  let peak = Math.PI / 2
  let integral = 0
  for (let i = 0; i <= n; i++) {
    const theta = i * step
    const f = field(length, theta)
    // the pattern is mirror-symmetric about 90°, so look for the peak in the first half only
    if (i <= n / 2 && f > max + 1e-9) {
      max = f
      peak = theta
    }
    integral += (i === 0 || i === n ? 0.5 : 1) * f * f * Math.sin(theta) * step
  }
  const half = max * Math.SQRT1_2
  let lo = peak
  let hi = peak
  while (lo > 0 && field(length, lo) >= half) lo -= step
  while (hi < Math.PI && field(length, hi) >= half) hi += step
  const directivity = integral > 0 ? (2 * max * max) / integral : 1
  return { max: max || 1, peakDeg: (peak * 180) / Math.PI, widthDeg: ((hi - lo) * 180) / Math.PI, dbi: 10 * Math.log10(directivity) }
}

const PRESETS = [0.5, 1, 1.25, 1.5]

/* polar plot: 280 × 264, centre (140, 134), radius 100. The antenna lies along the horizontal axis. */
const CX = 140
const CY = 134
const R = 100
/* current plot: 270 × 128, antenna on y = 66, one wavelength = 160 px. */
const AX = 135
const AY = 66
const PX_PER_WAVELENGTH = 160

/** A dipole of adjustable length: the standing wave of current on it, and the radiation pattern that current produces. */
export function DipolePatternLab() {
  const [length, setLength] = React.useState(0.5)
  const { max, peakDeg, widthDeg, dbi } = React.useMemo(() => analyse(length), [length])
  const broadside = peakDeg > 89.5
  const peakText = Math.round(peakDeg)

  // radiation pattern, one point per degree all the way round
  let pattern = ""
  for (let deg = 0; deg <= 360; deg++) {
    const theta = (deg * Math.PI) / 180
    const r = (R * field(length, theta)) / max
    pattern += `${deg ? "L" : "M"}${(CX + r * Math.cos(theta)).toFixed(1)} ${(CY - r * Math.sin(theta)).toFixed(1)}`
  }
  pattern += "Z"
  const peaks = broadside ? [90, 270] : [peakDeg, 180 - peakDeg, 180 + peakDeg, 360 - peakDeg]

  // current along the wire: sin(k·(L/2 − |z|)), normalised to its largest value
  const half = length / 2
  const currentMax = length >= 0.5 ? 1 : Math.sin(Math.PI * length)
  let current = ""
  const steps = 120
  for (let i = 0; i <= steps; i++) {
    const z = -half + (length * i) / steps
    const amp = Math.sin(TAU * (half - Math.abs(z))) / currentMax
    current += `${i ? "L" : "M"}${(AX + z * PX_PER_WAVELENGTH).toFixed(1)} ${(AY - 36 * amp).toFixed(1)}`
  }
  const armPx = half * PX_PER_WAVELENGTH

  let note: { tone: "neutral" | "good" | "warn"; text: string }
  if (!broadside) note = { tone: "warn", text: `主瓣分裂了：天线上方向相反的几段电流在垂直方向互相抵消，最强的方向歪到了 ${peakText}° 和 ${180 - peakText}°。天线不是越长越好。` }
  else if (length > 1.02) note = { tone: "neutral", text: "超过一个波长：天线上出现了方向相反的电流（曲线翻到下方的部分），方向图冒出旁瓣。1.25λ 附近垂直方向的增益最高，约 5.2 dBi，再长主瓣就要分裂。" }
  else if (length >= 0.6) note = { tone: "neutral", text: "天线加长，主瓣变扁变窄，增益升高。但接近一个波长时，馈电点正好落在电流的零点上，阻抗高达上千欧，很难直接接 50 Ω 的线。" }
  else if (length > 0.4) note = { tone: "good", text: "半波偶极子：电流在中间最大、两端为零，馈电点阻抗约 73 Ω，容易匹配。垂直于天线的方向最强，顺着天线的方向什么也收不到。" }
  else note = { tone: "warn", text: "比半波短很多的「电小天线」：方向图几乎没变，理想增益也只低零点几 dB。代价在别处：辐射电阻只剩几欧到十几欧，还串着很大的容抗，难匹配、带宽窄，损耗吃掉大半功率。" }

  return (
    <Lab title="偶极子的电流与方向图" hint="拖动天线长度：上图是导线上的电流驻波，下图是它向各个方向辐射的强弱。" onReset={() => setLength(0.5)}>
      <LabStage>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          <figure>
            <Schematic width={270} height={128} label={`长 ${fixed(length, 2)} 个波长的偶极子上的电流分布`}>
              <Label x={AX} y={14} size={12} muted>
                馈电点
              </Label>
              <path d={`${current}L${(AX + armPx).toFixed(1)} ${AY}L${(AX - armPx).toFixed(1)} ${AY}Z`} fill={trace.current} opacity={0.12} stroke="none" />
              <path d={current} stroke={trace.current} strokeWidth={2} />
              <path d={`M${(AX - armPx).toFixed(1)} ${AY}H${AX - 3}M${AX + 3} ${AY}H${(AX + armPx).toFixed(1)}`} strokeWidth={3} strokeLinecap="butt" />
              <path d={`M${(AX - armPx).toFixed(1)} 110H${(AX + armPx).toFixed(1)}M${(AX - armPx).toFixed(1)} 106V114M${(AX + armPx).toFixed(1)} 106V114`} stroke="var(--muted-foreground)" strokeWidth={1.25} />
              <Label x={AX} y={125} size={12} muted>
                L = {fixed(length, 2)} λ
              </Label>
            </Schematic>
            <figcaption className="mt-1 max-w-[270px] text-center text-caption text-muted-foreground">电流分布。翻到下方的部分，电流方向相反。</figcaption>
          </figure>
          <figure>
            <Schematic width={280} height={264} label={`长 ${fixed(length, 2)} 个波长的偶极子的方向图，最强方向与天线成 ${peakText} 度`}>
              <g stroke="var(--border)" strokeWidth={1}>
                {[0, 30, 60, 90, 120, 150].map((deg) => {
                  const dx = R * Math.cos((deg * Math.PI) / 180)
                  const dy = R * Math.sin((deg * Math.PI) / 180)
                  return <line key={deg} x1={(CX - dx).toFixed(1)} y1={(CY + dy).toFixed(1)} x2={(CX + dx).toFixed(1)} y2={(CY - dy).toFixed(1)} />
                })}
                <circle cx={CX} cy={CY} r={25} />
                <circle cx={CX} cy={CY} r={50} />
                <circle cx={CX} cy={CY} r={75} />
              </g>
              <circle cx={CX} cy={CY} r={R} stroke="var(--input)" strokeWidth={1} />
              <circle cx={CX} cy={CY} r={R * Math.SQRT1_2} stroke="var(--muted-foreground)" strokeWidth={1} strokeDasharray="3 4" />
              <path d={pattern} fill={trace.voltage} fillOpacity={0.12} stroke={trace.voltage} strokeWidth={2} />
              <path d={`M${CX - 14} ${CY}H${CX - 3}M${CX + 3} ${CY}H${CX + 14}`} strokeWidth={3} strokeLinecap="butt" />
              {peaks.map((deg) => (
                <circle key={deg} cx={(CX + R * Math.cos((deg * Math.PI) / 180)).toFixed(1)} cy={(CY - R * Math.sin((deg * Math.PI) / 180)).toFixed(1)} r={4} fill={trace.voltage} stroke="var(--sunken)" strokeWidth={1.5} />
              ))}
              <Label x={CX} y={21} size={12} muted>
                90°（垂直于天线）
              </Label>
              <Label x={CX} y={254} size={12} muted>
                90°
              </Label>
              <Label x={CX + R + 6} y={CY + 4} anchor="start" size={12} muted>
                0°
              </Label>
              <Label x={CX - R - 6} y={CY + 4} anchor="end" size={12} muted>
                180°
              </Label>
            </Schematic>
            <figcaption className="mt-1 max-w-[280px] text-center text-caption text-muted-foreground">方向图：离中心越远，这个方向辐射越强。虚线圈是半功率（−3 dB）。</figcaption>
          </figure>
        </div>
      </LabStage>
      <LabControls>
        <SliderField label="天线总长 L" value={length} onChange={setLength} min={0.1} max={1.5} step={0.01} format={(v) => `${fixed(v, 2)} λ`} />
        <ControlField label="常见长度">
          {PRESETS.map((v) => (
            <Button key={v} size="sm" aria-pressed={length === v} className={length === v ? "border-foreground" : undefined} onClick={() => setLength(v)}>
              {v} λ
            </Button>
          ))}
        </ControlField>
      </LabControls>
      <LabReadouts>
        <Readout label="最强方向（与天线的夹角）" value={broadside ? "90°" : `${peakText}° 和 ${180 - peakText}°`} color={trace.voltage} sub={broadside ? "垂直于天线" : "偏离了垂直方向"} />
        <Readout label="主瓣宽度（−3 dB）" value={`${fixed(widthDeg, 0)}°`} />
        <Readout label="增益（理想、无损耗）" value={`${fixed(dbi, 2)} dBi`} sub={Math.abs(length - 0.5) < 0.005 ? "半波偶极子的标准值" : undefined} />
      </LabReadouts>
      <LabNote tone={note.tone}>{note.text}</LabNote>
    </Lab>
  )
}

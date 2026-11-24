import * as React from "react"
import { Button, ControlField, Lab, LabControls, LabNote, LabReadouts, LabStage, Label, PlayButton, Readout, Segmented, SliderField, TAU, fixed, formatSI, percent, trace, usePlayback, useTime } from "@/lab"
import { Canvas, formatDb } from "./kit"

const Z0 = 50

type Signal = "pulse" | "cw"

/* Pulse animation, in units of "line lengths travelled by the pulse centre". */
const LEAD = 0.2 // the pulse starts this far before the line and exits this far past it
const PULSE_WIDTH = 0.06
const CYCLE = 2 + 2 * LEAD + 0.3
const SPEED = 0.55 // line lengths per second
const START = LEAD + 0.5 // first frame: pulse in the middle of the line, so a paused widget still shows something
/* Continuous wave: two wavelengths fit on the line. */
const BETA = 2 * TAU

const pulse = (x: number) => Math.exp(-((x / PULSE_WIDTH) ** 2))

const formatLoad = (z: number) => (z === 0 ? "0 Ω（短路）" : Number.isFinite(z) ? formatSI(z, "Ω") : "∞（开路）")

/**
 * A 50 Ω line into an adjustable load. Γ = (ZL − Z0) / (ZL + Z0) sets how much
 * of the incident wave comes back and with which sign; the source is matched,
 * so what returns is absorbed there.
 */
export function ReflectionLab() {
  const [zl, setZl] = React.useState(150)
  const [signal, setSignal] = React.useState<Signal>("pulse")
  const playback = usePlayback()
  const t = useTime(playback.playing)

  const gamma = zl === 0 ? -1 : Number.isFinite(zl) ? (zl - Z0) / (zl + Z0) : 1
  const mag = Math.abs(gamma)
  const vswr = mag >= 1 ? Infinity : (1 + mag) / (1 - mag)
  const returnLoss = mag === 0 ? Infinity : 20 * Math.log10(1 / mag)
  const reflected = mag * mag
  const gammaText = gamma === 0 ? "0" : `${gamma > 0 ? "+" : "−"}${fixed(mag, 2)}`

  // voltage along the line, u = 0 at the source and 1 at the load
  const travelled = (START + t * SPEED) % CYCLE
  const incidentAt = travelled - LEAD
  const voltage = (u: number) =>
    signal === "pulse"
      ? pulse(u - incidentAt) + gamma * pulse(u - (2 - incidentAt))
      : Math.cos(TAU * 0.5 * t - BETA * u) + gamma * Math.cos(TAU * 0.5 * t - BETA * (2 - u))
  const envelope = (u: number) => Math.sqrt(Math.max(0, 1 + gamma * gamma + 2 * gamma * Math.cos(2 * BETA * (1 - u))))

  const status =
    signal === "cw"
      ? mag === 0
        ? "行波：包络处处一样高"
        : `包络最高 ${fixed(1 + mag, 2)}，最低 ${fixed(1 - mag, 2)}`
      : incidentAt <= 1
        ? "入射脉冲 →"
        : mag === 0
          ? "到达负载：被完全吸收"
          : `← 反射脉冲（入射的 ${gammaText} 倍）`

  let note: { tone: "neutral" | "good" | "warn" | "bad"; text: string }
  if (mag === 0) note = { tone: "good", text: "负载正好等于线的特征阻抗：波走到头被完全吸收，一点也不反射。这就是「匹配」，功率全部送进负载。" }
  else if (zl === 0) note = { tone: "bad", text: "短路：负载两端的电压只能是 0，于是线上生出一个大小相等、方向相反的波往回走。功率全部退回，一点也没送出去。" }
  else if (!Number.isFinite(zl)) note = { tone: "bad", text: "开路：电流走到头无处可去，电压在末端叠成两倍，再原样弹回去。功率全部退回，一点也没送出去。" }
  else {
    const side = gamma > 0 ? `负载比 ${Z0} Ω 大，反射波和入射波同相` : `负载比 ${Z0} Ω 小，反射波和入射波反相`
    const amount = `幅度是入射的 ${percent(mag)}，${percent(reflected, reflected < 0.1 ? 1 : 0)} 的功率被退回`
    note =
      vswr <= 1.5
        ? { tone: "good", text: `${side}，${amount}。驻波比不超过 1.5，工程上算匹配得不错。` }
        : vswr <= 3
          ? { tone: "warn", text: `${side}，${amount}。驻波比超过 1.5，天线和功放之间通常要加匹配网络了。` }
          : { tone: "bad", text: `${side}，${amount}。严重失配：退回的功率还可能烧坏发射机的功放。` }
  }

  return (
    <Lab
      title="传输线上的反射"
      hint="改变负载阻抗，看波走到线的尽头后有多少被弹回来、是正还是反。"
      actions={<PlayButton playback={playback} />}
      onReset={() => {
        setZl(150)
        setSignal("pulse")
      }}
    >
      <LabStage>
        <Canvas height={214} label={`50 Ω 传输线接 ${formatLoad(zl)} 负载：线上的电压波形，反射系数 ${gammaText}`}>
          {(w) => {
            // line from xs to xl; voltage plot above it: 0 V on y = 84, 30 px per unit
            const xs = 30
            const xl = w - 30
            const len = xl - xs
            const y0 = 84
            const unit = 30
            const n = 220
            let d = ""
            let top = ""
            let bottom = ""
            for (let i = 0; i <= n; i++) {
              const u = i / n
              const x = (xs + u * len).toFixed(1)
              d += `${i ? "L" : "M"}${x} ${(y0 - unit * voltage(u)).toFixed(1)}`
              if (signal === "cw") {
                const e = unit * envelope(u)
                top += `${i ? "L" : "M"}${x} ${(y0 - e).toFixed(1)}`
                bottom += `${i ? "L" : "M"}${x} ${(y0 + e).toFixed(1)}`
              }
            }
            const lx = w - 14 // the load sits here, the source at x = 14
            return (
              <>
                <Label x={xs} y={14} anchor="start" size={12} muted>
                  {status}
                </Label>
                {/* voltage scale */}
                <g stroke="var(--border)" strokeWidth={1}>
                  <line x1={xs} x2={xl} y1={y0 - unit} y2={y0 - unit} />
                  <line x1={xs} x2={xl} y1={y0 + unit} y2={y0 + unit} />
                  <line x1={xl} x2={xl} y1={24} y2={144} strokeDasharray="3 4" />
                </g>
                <line x1={xs} x2={xl} y1={y0} y2={y0} stroke="var(--input)" strokeWidth={1} />
                <Label x={xs - 6} y={y0 - unit + 4} anchor="end" size={12} color="var(--faint-foreground)">
                  +1
                </Label>
                <Label x={xs - 6} y={y0 + 4} anchor="end" size={12} color="var(--faint-foreground)">
                  0
                </Label>
                <Label x={xs - 6} y={y0 + unit + 4} anchor="end" size={12} color="var(--faint-foreground)">
                  −1
                </Label>
                {signal === "cw" && <path d={`${top}${bottom}`} stroke={trace.ref} strokeWidth={1.25} strokeDasharray="4 4" />}
                <path d={d} stroke={trace.voltage} strokeWidth={2} />

                {/* the line itself: two conductors, source on the left, load on the right */}
                <rect x={xs} y={162} width={len} height={28} fill="var(--muted)" stroke="none" />
                <path d={`M14 168V162H${lx - (Number.isFinite(zl) ? 0 : 6)}M14 184V190H${lx - (Number.isFinite(zl) ? 0 : 6)}`} />
                <circle cx={14} cy={176} r={8} fill="var(--sunken)" />
                <path d="M9 176C10.5 171 12.5 171 14 176S17.5 181 19 176" strokeWidth={1.25} />
                <Label x={(xs + xl) / 2} y={180.5} size={12} muted>
                  传输线 Z₀ = {Z0} Ω
                </Label>
                {zl === 0 ? (
                  <path d={`M${lx} 162V190`} />
                ) : Number.isFinite(zl) ? (
                  <>
                    <path d={`M${lx} 162V168M${lx} 184V190`} />
                    <rect x={lx - 5} y={168} width={10} height={16} fill="var(--sunken)" />
                  </>
                ) : (
                  <>
                    <circle cx={lx - 6} cy={162} r={2.5} fill="var(--sunken)" />
                    <circle cx={lx - 6} cy={190} r={2.5} fill="var(--sunken)" />
                  </>
                )}
                <Label x={4} y={208} anchor="start" size={12} muted>
                  信号源 {Z0} Ω
                </Label>
                <Label x={w - 4} y={208} anchor="end" size={12} muted>
                  负载 {zl === 0 ? "短路" : Number.isFinite(zl) ? formatSI(zl, "Ω") : "开路"}
                </Label>
              </>
            )
          }}
        </Canvas>
      </LabStage>
      <LabControls>
        <SliderField label="负载阻抗 ZL" value={zl} onChange={(v) => setZl(Number(v.toPrecision(2)))} min={5} max={500} log format={formatLoad} />
        <ControlField label="极端情况">
          <Button size="sm" aria-pressed={zl === 0} className={zl === 0 ? "border-foreground" : undefined} onClick={() => setZl(0)}>
            短路
          </Button>
          <Button size="sm" aria-pressed={zl === Z0} className={zl === Z0 ? "border-foreground" : undefined} onClick={() => setZl(Z0)}>
            匹配 {Z0} Ω
          </Button>
          <Button size="sm" aria-pressed={zl === Infinity} className={zl === Infinity ? "border-foreground" : undefined} onClick={() => setZl(Infinity)}>
            开路
          </Button>
        </ControlField>
        <ControlField label="送进去的信号">
          <Segmented
            size="sm"
            value={signal}
            onValueChange={setSignal}
            options={[
              { value: "pulse", label: "单个脉冲" },
              { value: "cw", label: "连续正弦波" },
            ]}
            aria-label="送进去的信号"
          />
        </ControlField>
      </LabControls>
      <LabReadouts>
        <Readout label="反射系数 Γ" value={gammaText} color={trace.voltage} sub="(ZL − Z₀) ÷ (ZL + Z₀)" />
        <Readout label="驻波比 VSWR" value={Number.isFinite(vswr) ? fixed(vswr, 2) : "∞"} sub="(1 + |Γ|) ÷ (1 − |Γ|)" />
        <Readout label="回波损耗" value={formatDb(returnLoss)} sub="−20 · log|Γ|" />
        <Readout label="送到负载的功率" value={percent(1 - reflected, 1)} sub={`反射 ${percent(reflected, 1)}`} />
      </LabReadouts>
      <LabNote tone={note.tone}>{note.text}</LabNote>
    </Lab>
  )
}

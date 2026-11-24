import * as React from "react"
import { ControlField, Lab, LabControls, LabNote, LabReadouts, LabStage, PlayButton, Readout, Segmented, SliderField, SwitchField, TAU, clamp, formatSI, sig, trace, usePlayback, useTime, useWidth } from "@/lab"

/*
 * A simulated oscilloscope. The signal is 1 kHz (square, sine or PWM); the
 * screen is 10 × 8 divisions with 0 V two divisions above the bottom edge.
 *
 * Trigger model (rising edge): when the trigger is on and its level lies
 * strictly between the signal's minimum and maximum, every sweep starts so
 * that the signal crosses the level, rising, at the centre of the screen: the
 * picture stands still. Otherwise the scope free-runs and each sweep starts
 * at a different phase, shown as a steady drift.
 */
const PERIOD = 1e-3
const TIME_DIVS = [50e-6, 100e-6, 200e-6, 500e-6, 1e-3, 2e-3, 5e-3]
const VOLT_DIVS = [0.2, 0.5, 1, 2, 5]
/** Divisions of screen above and below the 0 V line. */
const DIV_UP = 6
const DIV_DOWN = 2

type Kind = "square" | "sine" | "pwm"
const SIGNALS: Record<Kind, { name: string; lo: number; hi: number; duty: number }> = {
  square: { name: "方波", lo: 0, hi: 3.3, duty: 0.5 },
  sine: { name: "正弦波", lo: -1.5, hi: 1.5, duty: 0 },
  pwm: { name: "PWM", lo: 0, hi: 5, duty: 0.25 },
}

const pick = (list: number[], index: number) => list[clamp(Math.round(index), 0, list.length - 1)]

/** Screen path for the window [t0, t0 + span]; x(t) and y(v) map to pixels. */
function tracePath(kind: Kind, t0: number, span: number, x: (t: number) => number, y: (v: number) => number): string {
  const def = SIGNALS[kind]
  if (kind === "sine") {
    const n = 1200
    let d = ""
    for (let i = 0; i <= n; i++) {
      const t = t0 + (span * i) / n
      d += `${i ? "L" : "M"}${x(t).toFixed(1)} ${y(def.hi * Math.sin((TAU * t) / PERIOD)).toFixed(1)}`
    }
    return d
  }
  // square and PWM: exact edges, rising at k·T and falling at (k + duty)·T
  const first = Math.floor(t0 / PERIOD)
  const phase = t0 / PERIOD - first
  let d = `M${x(t0).toFixed(1)} ${y(phase < def.duty ? def.hi : def.lo).toFixed(1)}`
  for (let k = first; k * PERIOD <= t0 + span; k++) {
    for (const [t, v] of [
      [k * PERIOD, def.hi],
      [(k + def.duty) * PERIOD, def.lo],
    ]) {
      if (t > t0 && t < t0 + span) d += `H${x(t).toFixed(1)}V${y(v).toFixed(1)}`
    }
  }
  return `${d}H${x(t0 + span).toFixed(1)}`
}

/** Time base, vertical scale and trigger on a 1 kHz signal: why a waveform stands still or runs away. */
export function ScopeLab() {
  const [kind, setKind] = React.useState<Kind>("square")
  const [ti, setTi] = React.useState(2)
  const [vi, setVi] = React.useState(2)
  const [level, setLevel] = React.useState(1)
  const [trig, setTrig] = React.useState(false)
  const playback = usePlayback()
  const [ref, width] = useWidth<HTMLDivElement>(420)

  const sigDef = SIGNALS[kind]
  const tdiv = pick(TIME_DIVS, ti)
  const vdiv = pick(VOLT_DIVS, vi)
  const inRange = level > sigDef.lo && level < sigDef.hi
  const stable = trig && inRange
  const time = useTime(playback.playing && !stable)

  // the instant the signal rises through the trigger level, within one period
  const tTrig = kind === "sine" ? (Math.asin(clamp(level / sigDef.hi, -1, 1)) / TAU) * PERIOD : 0
  // free-running: the picture starts at an arbitrary phase and slides at 1.7 divisions per second
  const tCentre = stable ? tTrig : (1.3 + time * 1.7) * tdiv
  const span = 10 * tdiv
  const t0 = tCentre - span / 2

  /*
   * Screen geometry (pixels): grid starts at (34, 14) and is 10 × 8 squares of
   * `div`; the left margin holds the "0 V" marker, the right one the trigger
   * arrow, the strip below the scale read-outs.
   */
  const w = clamp(width, 240, 448)
  const gx = 34
  const gy = 14
  const div = (w - gx - 14) / 10
  const gw = div * 10
  const gh = div * 8
  const h = gy + gh + 26
  const yZero = gy + DIV_UP * div
  const xOf = (t: number) => gx + ((t - t0) / span) * gw
  const yOf = (v: number) => clamp(yZero - (v / vdiv) * div, gy, gy + gh)
  const path = tracePath(kind, t0, span, xOf, yOf)
  const yLevel = yZero - (level / vdiv) * div
  const levelOnScreen = yLevel >= gy && yLevel <= gy + gh
  const levelColor = stable ? trace.good : "var(--warning)"

  const vpp = sigDef.hi - sigDef.lo
  const cycles = span / PERIOD
  const clipped = sigDef.hi / vdiv > DIV_UP || -sigDef.lo / vdiv > DIV_DOWN
  let scale = ""
  if (clipped) scale = "波形超出了屏幕，被边缘削掉了一截：把垂直档位调大。"
  else if (vpp / vdiv < 1) scale = "波形还占不到 1 格，读不准：把垂直档位调小。"
  else if (cycles > 20) scale = `一屏挤了 ${sig(cycles, 2)} 个周期，看不清细节：把时基调小。`
  else if (cycles < 1) scale = "一屏装不下一个完整的周期：把时基调大。"

  let note: string
  if (!trig) note = "触发关着。示波器每扫一屏，都从随便哪个时刻开始画，每一屏的起点都不一样，看上去波形就在屏幕上跑。"
  else if (!inRange) note = `触发电平 ${formatSI(level, "V")} 在信号的范围（${formatSI(sigDef.lo, "V")} 到 ${formatSI(sigDef.hi, "V")}）之外。信号永远碰不到这条线，示波器等不来触发，只好自己随便扫，波形照样跑。`
  else note = `每一屏都从「信号上升着穿过 ${formatSI(level, "V")}」的那一刻对齐，画的总是同一段，所以波形站住了。`

  return (
    <Lab
      title="示波器"
      hint="先打开触发，把触发电平拖进、拖出信号的范围；再调时基和垂直档位，把波形摆到合适的大小。"
      actions={<PlayButton playback={playback} />}
      onReset={() => {
        setKind("square")
        setTi(2)
        setVi(2)
        setLevel(1)
        setTrig(false)
      }}
    >
      <LabStage>
        <div ref={ref} className="mx-auto w-full max-w-md min-w-0">
          <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`示波器屏幕：1 kHz ${sigDef.name}，${stable ? "已触发，波形稳定" : "未触发，波形在滚动"}`} className="block max-w-full select-none">
            <rect x={gx} y={gy} width={gw} height={gh} fill="var(--background)" stroke="none" />
            <g stroke="var(--border)" strokeWidth={1}>
              {Array.from({ length: 11 }, (_, i) => (
                <line key={`v${i}`} x1={gx + i * div} x2={gx + i * div} y1={gy} y2={gy + gh} />
              ))}
              {Array.from({ length: 9 }, (_, i) => (
                <line key={`h${i}`} x1={gx} x2={gx + gw} y1={gy + i * div} y2={gy + i * div} />
              ))}
            </g>
            {/* centre cross-hair, a little stronger than the grid */}
            <path d={`M${gx + 5 * div} ${gy}V${gy + gh}M${gx} ${gy + 4 * div}H${gx + gw}`} stroke="var(--input)" strokeWidth={1} fill="none" />
            <rect x={gx} y={gy} width={gw} height={gh} fill="none" stroke="var(--input)" strokeWidth={1} />
            {/* 0 V reference */}
            <path d={`M${gx - 7} ${yZero - 4}L${gx - 1} ${yZero}L${gx - 7} ${yZero + 4}Z`} fill={trace.voltage} stroke="none" />
            <text x={gx - 10} y={yZero + 4} textAnchor="end" className="tabular fill-muted-foreground text-caption">
              0 V
            </text>
            {/* trigger level and trigger position */}
            {trig && levelOnScreen && (
              <g>
                <line x1={gx} x2={gx + gw} y1={yLevel} y2={yLevel} stroke={levelColor} strokeWidth={1.25} strokeDasharray="4 4" />
                <path d={`M${gx + gw + 9} ${yLevel - 4.5}L${gx + gw + 2} ${yLevel}L${gx + gw + 9} ${yLevel + 4.5}Z`} fill={levelColor} stroke="none" />
              </g>
            )}
            {trig && <path d={`M${gx + 5 * div - 4.5} ${gy - 9}L${gx + 5 * div} ${gy - 2}L${gx + 5 * div + 4.5} ${gy - 9}Z`} fill={levelColor} stroke="none" />}
            {/* the trace */}
            <path d={path} fill="none" stroke={trace.voltage} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {/* scale read-outs, like the strip along the bottom of a real screen */}
            <g className="tabular text-caption">
              <text x={gx} y={gy + gh + 18} className="fill-muted-foreground">
                {formatSI(vdiv, "V")}/格
              </text>
              <text x={gx + gw / 2} y={gy + gh + 18} textAnchor="middle" className="fill-muted-foreground">
                {formatSI(tdiv, "s")}/格
              </text>
              <text x={gx + gw} y={gy + gh + 18} textAnchor="end" fill={levelColor} className="font-medium">
                {stable ? "已触发" : "未触发"}
              </text>
            </g>
          </svg>
        </div>
      </LabStage>
      <LabControls>
        <ControlField label="被测信号（都是 1 kHz）">
          <Segmented aria-label="被测信号" value={kind} onValueChange={setKind} options={[{ value: "square", label: "方波" }, { value: "sine", label: "正弦波" }, { value: "pwm", label: "PWM" }]} />
        </ControlField>
        <SwitchField label="触发（上升沿）" hint="对齐每一屏的起点" checked={trig} onChange={setTrig} />
        <SliderField label="时基（横向每格）" value={ti} onChange={setTi} min={0} max={TIME_DIVS.length - 1} step={1} format={(i) => `${formatSI(pick(TIME_DIVS, i), "s")}/格`} />
        <SliderField label="垂直档位（纵向每格）" value={vi} onChange={setVi} min={0} max={VOLT_DIVS.length - 1} step={1} format={(i) => `${formatSI(pick(VOLT_DIVS, i), "V")}/格`} color={trace.voltage} />
        <SliderField label="触发电平" value={level} onChange={setLevel} min={-3} max={6} step={0.1} unit="V" disabled={!trig} />
      </LabControls>
      <LabReadouts>
        <Readout label="频率" value="1 kHz" sub={`一个周期 ${sig(PERIOD / tdiv, 3)} 格 × ${formatSI(tdiv, "s")}`} />
        <Readout label="峰峰值" value={formatSI(vpp, "V")} color={trace.voltage} sub={`${sig(vpp / vdiv, 3)} 格 × ${formatSI(vdiv, "V")}`} />
        <Readout label="触发" value={stable ? "已触发" : "未触发"} sub={stable ? "波形稳定" : "自由运行"} />
      </LabReadouts>
      <LabNote tone={!stable || scale ? "warn" : "good"}>
        {note}
        {scale && ` ${scale}`}
      </LabNote>
    </Lab>
  )
}

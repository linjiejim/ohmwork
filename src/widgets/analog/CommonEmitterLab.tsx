import * as React from "react"
import { Bjt, Capacitor, Ground, Junction, Lab, LabControls, LabNote, LabReadouts, LabStage, Label, Plot, Port, Rail, Readout, Resistor, Schematic, SliderField, TAU, Tex, Wire, fixed, formatSI, sig, trace } from "@/lab"

const VCC = 12
const RC = 4700
const RE = 470
const BETA = 200
const ALPHA = BETA / (BETA + 1)
const IS = 1.4e-14 // saturation current: VBE ≈ 0.65 V at 1.2 mA
const VT = 0.02585 // thermal voltage at room temperature
const VCE_SAT = 0.2
const I_CUT = 0.08e-3 // below this the transistor is as good as off (its own re has grown past Re)
const WINDOW = 2 // ms: two periods of a 1 kHz sine
const SAMPLES = 400

/**
 * Large-signal model of the stage for a given base voltage.
 * Emitter: vb = VBE + IE·RE with IE = IS·(exp(VBE / VT) − 1), solved by bisection.
 * Collector: VCC − α·IE·RC while active; in saturation it sits VCE_SAT above the emitter.
 */
function stage(vb: number) {
  if (vb <= 0) return { ve: 0, vc: VCC, ic: 0, sat: false }
  let lo = 0
  let hi = Math.min(vb, 0.9)
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2
    if (mid + IS * (Math.exp(mid / VT) - 1) * RE < vb) lo = mid
    else hi = mid
  }
  const ve = Math.max(0, vb - (lo + hi) / 2)
  const active = VCC - ALPHA * (ve / RE) * RC
  const floor = ve + VCE_SAT
  const sat = active < floor
  const vc = sat ? floor : active
  return { ve, vc, ic: (VCC - vc) / RC, sat }
}

/** The load line: every (VCE, IC) pair the resistors allow. */
const loadLine = (vce: number) => (VCC - vce) / (RC + RE / ALPHA)
// where the load line meets saturation
const VE_SAT = (VCC - VCE_SAT) / ((ALPHA * RC) / RE + 1)
const IC_SAT = (VCC - VCE_SAT - VE_SAT) / RC

const volts = (v: number) => `${fixed(v, 2)} V`

/** Common-emitter amplifier with divider bias and an emitter resistor: move the operating point, watch the output clip. */
export function CommonEmitterLab() {
  const [vbias, setVbias] = React.useState(1.2)
  const [amp, setAmp] = React.useState(0.2)

  const q = stage(vbias)
  const qVce = q.vc - q.ve
  const qCut = q.ic < I_CUT
  // small-signal gain at the operating point: slope of the collector voltage against the base voltage
  const gain = (stage(vbias + 0.001).vc - stage(vbias - 0.001).vc) / 0.002

  const wave = React.useMemo(() => {
    const base: [number, number][] = []
    const collector: [number, number][] = []
    let vcMin = Infinity
    let vcMax = -Infinity
    let vceMin = Infinity
    let vceMax = -Infinity
    let icMin = Infinity
    let satHit = false
    for (let k = 0; k <= SAMPLES; k++) {
      const t = (WINDOW * k) / SAMPLES
      const vb = vbias + amp * Math.sin(TAU * t)
      const s = stage(vb)
      base.push([t, vb])
      collector.push([t, s.vc])
      vcMin = Math.min(vcMin, s.vc)
      vcMax = Math.max(vcMax, s.vc)
      vceMin = Math.min(vceMin, s.vc - s.ve)
      vceMax = Math.max(vceMax, s.vc - s.ve)
      icMin = Math.min(icMin, s.ic)
      satHit = satHit || s.sat
    }
    return { base, collector, vcMin, vcMax, vceMin, vceMax, satHit, cutHit: icMin < I_CUT }
  }, [vbias, amp])

  const vpp = wave.vcMax - wave.vcMin
  const clipped = amp > 0 && (wave.satHit || wave.cutHit)

  let tone: "neutral" | "good" | "warn" | "bad" = "good"
  let note: string
  if (q.sat) {
    tone = "bad"
    note = `偏置太高，没有信号时三极管就已经饱和：集电极电压 ${volts(q.vc)}，只比发射极高 0.2 V。输入再怎么变，输出也只是跟着基极小幅晃动，不再放大。把偏置调低。`
  } else if (qCut) {
    tone = "bad"
    note = `偏置太低，没有信号时三极管几乎不导通（截止），集电极电压贴在电源的 12 V 上。只有输入往上摆的那一小段能把它打开，其余时间输出都是平的。把偏置调高。`
  } else if (amp === 0) {
    tone = "neutral"
    note = `没有输入信号：电路停在静态工作点，集电极电流 ${formatSI(q.ic, "A")}，集电极电压 ${volts(q.vc)}。`
  } else if (wave.satHit && wave.cutHit) {
    tone = "bad"
    note = "输入太大：输出往下撞到饱和，往上撞到截止，两头都被削平了。减小输入幅度。"
  } else if (wave.satHit) {
    tone = "bad"
    note = `工作点偏高（静态电流 ${formatSI(q.ic, "A")}）：集电极电压往下摆到 ${volts(wave.vcMin)} 就饱和了，只比发射极高 0.2 V，再也下不去，波形底部被削平。这叫饱和失真，把偏置调低。`
  } else if (wave.cutHit) {
    tone = "bad"
    note = `工作点偏低（静态电流 ${formatSI(q.ic, "A")}）：电流减到 0 时三极管截止，集电极电压顶在电源的 12 V 上，波形顶部被削平。这叫截止失真，把偏置调高。`
  } else {
    note = `不失真：输入峰峰值 ${formatSI(2 * amp, "V")}，输出峰峰值 ${formatSI(vpp, "V")}，放大约 ${sig(vpp / (2 * amp), 2)} 倍。输入往上走时输出往下走，两者反相。`
  }

  const satEndFree = !q.sat && (IC_SAT - q.ic) * 1000 > 0.35
  const cutEndFree = q.ic * 1000 > 0.35

  return (
    <Lab
      title="共射放大电路实验台"
      hint="拖动基极偏置，让工作点 Q 沿着负载线移动；再加大输入，看输出先在哪一头被削平。"
      onReset={() => {
        setVbias(1.2)
        setAmp(0.2)
      }}
    >
      <LabStage>
        <div className="grid items-center gap-x-6 gap-y-4 @xl:grid-cols-[auto_minmax(0,1fr)]">
          {/*
           * Supply bus along y = 40, rail at (145, 40).
           * Bias divider on x = 96: R1 (96, 70) → base node (96, 140) → R2 (96, 180) → ground (96, 210).
           * Transistor (180, 140): base (150, 140), collector (194, 110), emitter (194, 170).
           * Rc (194, 70): ends (194, 40) and (194, 100). Re (194, 200): ends (194, 170) and (194, 230).
           * C1 (50, 140): ends (20, 140) and (80, 140). C2 (252, 104): ends (222, 104) and (282, 104).
           */}
          <Schematic width={312} height={256} label="分压式偏置的共射放大电路">
            <Wire points={[[145, 40], [96, 40]]} />
            <Wire points={[[145, 40], [194, 40]]} current={q.ic} scale={IC_SAT} />
            <Rail x={145} y={40} label="12 V" />
            <Resistor x={96} y={70} rot={90} label="R1" labelSide="left" />
            <Wire points={[[96, 100], [96, 150]]} />
            <Resistor x={96} y={180} rot={90} label="R2" labelSide="left" variable />
            <Ground x={96} y={210} />
            <Junction x={96} y={140} />
            <Wire points={[[96, 140], [150, 140]]} />
            <Resistor x={194} y={70} rot={90} label="Rc" value="4.7 kΩ" labelSide="left" />
            <Wire points={[[194, 100], [194, 110]]} />
            <Junction x={194} y={104} />
            <Bjt x={180} y={140} />
            <Resistor x={194} y={200} rot={90} label="Re" value="470 Ω" />
            <Ground x={194} y={230} />
            <Wire points={[[14, 140], [20, 140]]} />
            <Capacitor x={50} y={140} label="C1" />
            <Wire points={[[80, 140], [96, 140]]} />
            <Port x={14} y={140} label="输入" side="top" />
            <Wire points={[[194, 104], [222, 104]]} />
            <Capacitor x={252} y={104} label="C2" labelSide="bottom" />
            <Wire points={[[282, 104], [294, 104]]} />
            <Port x={294} y={104} label="输出" side="top" />
            <Label x={123} y={132} color={trace.second}>
              {volts(vbias)}
            </Label>
            <Label x={208} y={84} anchor="start" color={trace.voltage}>
              {volts(q.vc)}
            </Label>
            <Label x={206} y={176} anchor="start" muted>
              {volts(q.ve)}
            </Label>
          </Schematic>
          <Plot
            height={230}
            ariaLabel="负载线和静态工作点"
            x={{ min: 0, max: 12, label: "VCE (V)", ticks: [0, 3, 6, 9, 12] }}
            y={{ min: 0, max: 3, label: "IC (mA)" }}
            series={[
              { fn: (v) => loadLine(v) * 1000, label: "负载线", color: trace.ref },
              {
                points: [
                  [wave.vceMin, loadLine(wave.vceMin) * 1000],
                  [wave.vceMax, loadLine(wave.vceMax) * 1000],
                ],
                label: "信号摆动的范围",
                color: trace.voltage,
                width: 4,
              },
            ]}
            markers={[
              ...(q.sat ? [] : [{ x: VCE_SAT, y: IC_SAT * 1000, label: satEndFree ? "饱和" : undefined, color: trace.ref }]),
              { x: VCC, y: 0, label: cutEndFree ? "截止" : undefined, color: trace.ref },
              { x: qVce, y: q.ic * 1000, label: q.sat ? "Q（饱和）" : qCut ? "Q（截止）" : "Q", color: trace.current },
            ]}
          />
        </div>
        <div className="mt-4">
          <Plot
            height={230}
            ariaLabel="基极和集电极的电压波形"
            x={{ min: 0, max: WINDOW, label: "时间 (ms)" }}
            y={{ min: 0, max: 14, label: "电压 (V)", ticks: [0, 3, 6, 9, 12] }}
            series={[
              { points: wave.collector, label: "集电极电压（输出）", color: trace.voltage },
              { points: wave.base, label: "基极电压（偏置 + 输入）", color: trace.second },
              {
                points: [
                  [0, q.vc],
                  [WINDOW, q.vc],
                ],
                label: "静态时的集电极电压",
                color: trace.ref,
                dashed: true,
                width: 1.25,
              },
            ]}
            lines={[{ y: VCC, label: "电源 12 V" }]}
          />
        </div>
      </LabStage>
      <LabControls>
        <SliderField label="基极偏置 VB（调 R2）" value={vbias} onChange={setVbias} min={0.4} max={2.4} step={0.01} format={volts} color={trace.second} />
        <SliderField label="输入幅度（峰值）" value={amp} onChange={setAmp} min={0} max={0.8} step={0.01} format={(v) => formatSI(v, "V")} />
      </LabControls>
      <LabReadouts>
        <Readout label="静态 IC" value={formatSI(q.ic, "A")} color={trace.current} />
        <Readout label="静态 VCE" value={volts(qVce)} sub={q.sat ? "已饱和" : qCut ? "已截止" : "放大区"} />
        <Readout label="电压增益" value={q.sat || qCut ? "—" : `${fixed(gain, 1)} 倍`} sub={q.sat || qCut ? "不再放大" : <Tex>{String.raw`\approx -R_c / R_e = -10`}</Tex>} />
        <Readout label="输出峰峰值" value={formatSI(vpp, "V")} color={trace.voltage} sub={clipped ? "已削波" : undefined} />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

import * as React from "react"
import { Bjt, Ground, Lab, LabControls, LabNote, LabReadouts, LabStage, Label, Lamp, Plot, Port, Rail, Readout, Resistor, Schematic, SliderField, Tex, Wire, clamp, fixed, formatSI, sig, tex, trace } from "@/lab"

/*
 * NPN low-side switch, the hand-calculation model: Vbe is a fixed 0.7 V once
 * the base conducts, Ic = β·Ib until the load cannot give more, and a
 * saturated transistor keeps 0.2 V across collector–emitter.
 */
const VCC = 12
/** A 12 V, 100 mA lamp treated as a plain resistor. */
const R_LOAD = 120
const VBE = 0.7
const VCE_SAT = 0.2
const IC_SAT = (VCC - VCE_SAT) / R_LOAD
/** SOT-23 S8050. */
const P_MAX = 0.3

/** Any real current gets at least a crawl of dots, so "base flows, collector flows" always reads together. */
const flow = (i: number, scale: number) => (i > 1e-9 ? Math.max(i, scale * 0.005) : 0)

/** A 3.3 V pin switches a 12 V lamp through an NPN transistor: choose the base resistor, watch cutoff / active / saturation. */
export function BjtSwitchLab() {
  const [vin, setVin] = React.useState(3.3)
  const [rb, setRb] = React.useState(270)
  const [beta, setBeta] = React.useState(200)

  const ib = Math.max(0, (vin - VBE) / rb)
  const ic = Math.min(beta * ib, IC_SAT)
  const vce = VCC - ic * R_LOAD
  const pq = vce * ic + (ib > 0 ? VBE * ib : 0)
  const region = ib <= 0 ? "cutoff" : beta * ib < IC_SAT ? "active" : "saturated"
  /** How many times the base current exceeds the bare minimum for saturation. */
  const overdrive = (beta * ib) / IC_SAT
  const brightness = (ic / IC_SAT) ** 2

  let tone: "neutral" | "good" | "warn" | "bad" = "neutral"
  let note: React.ReactNode
  if (region === "cutoff") {
    note = `截止：控制电压没超过 0.7 V，基极没有电流，集电极也就没有电流。三极管像一只断开的开关，12 V 全压在它身上，灯不亮。`
  } else if (region === "active") {
    tone = pq > P_MAX * 0.5 ? "bad" : "warn"
    note = (
      <>
        放大区：<Tex>{String.raw`I_C = \beta I_B = ${beta} \times ${tex.si(ib, "A")} = ${tex.si(ic, "A")}`}</Tex>，灯没全亮。三极管自己扛着 {fixed(vce, 1)} V，发热 {formatSI(pq, "W")}
        {pq > P_MAX * 0.5 ? "，贴片 S8050 的上限才 300 mW" : ""}。当开关用要避开这个状态：把基极电阻减小。
      </>
    )
  } else if (overdrive < 2) {
    tone = "warn"
    note = `刚好饱和：基极电流只比最低要求多 ${fixed((overdrive - 1) * 100, 0)}%。换一只 β 小一点的管子、天气冷一点，就会掉回放大区。基极电阻还要再小。`
  } else if (ib > 0.02) {
    tone = "warn"
    note = `饱和了，但基极电流有 ${formatSI(ib, "A")}，多数单片机引脚出不了这么多（一般不超过 20 mA）。基极电阻不用这么小。`
  } else if (ic / ib > 30) {
    note = (
      <>
        饱和，但余量不算多：<Tex>{String.raw`I_C / I_B \approx ${tex.num(sig(ic / ib, 2))}`}</Tex>。β 是 {beta} 的这只管子没问题，换一只 β 低于 {sig(ic / ib, 2)} 的就会掉回放大区。经验做法是把{" "}
        <Tex>{"I_C / I_B"}</Tex> 压到 10–20。
      </>
    )
  } else {
    tone = "good"
    note = (
      <>
        深度饱和：<Tex>{String.raw`I_C / I_B \approx ${tex.num(sig(ic / ib, 2))}`}</Tex>，基极电流是最低要求的 {sig(overdrive, 2)} 倍，就算换一只 β 只有 50 的管子也照样导通。Vce 只剩 {fixed(vce, 1)} V，灯全亮，三极管只耗 {formatSI(pq, "W")}。
      </>
    )
  }

  // the plot is log–log: keep the operating point on the frame even when the currents are tiny or zero
  const markX = clamp(ib * 1000, 0.001, 100)
  const markY = clamp(ic * 1000, 0.1, 1000)

  return (
    <Lab
      title="三极管开关实验台"
      hint="3.3 V 的引脚通过 NPN 三极管控制一只 12 V、约 100 mA 的灯。把基极电阻往大拖，看灯什么时候变暗；再把 β 调小试试。"
      onReset={() => {
        setVin(3.3)
        setRb(270)
        setBeta(200)
      }}
    >
      <LabStage>
        <div className="grid items-center gap-x-6 gap-y-4 @xl:grid-cols-[auto_minmax(0,1fr)]">
          {/*
           * Port (40,130) → Rb (110,130): terminals (80,130) / (140,130) → base (160,130).
           * NPN (190,130): collector (204,100), emitter (204,160).
           * Lamp (204,70) vertical: terminals (204,40) / (204,100). Rail at (204,30), ground at (204,172).
           */}
          <Schematic width={300} height={196} label="单片机引脚经基极电阻驱动 NPN 三极管，三极管在灯和地之间做开关">
            <Wire points={[[40, 130], [80, 130]]} current={flow(ib, 0.002)} scale={0.002} />
            <Wire points={[[140, 130], [160, 130]]} current={flow(ib, 0.002)} scale={0.002} />
            <Wire points={[[204, 30], [204, 40]]} current={flow(ic, 0.03)} scale={0.03} />
            <Wire points={[[204, 160], [204, 172]]} current={flow(ic + ib, 0.03)} scale={0.03} />
            <Rail x={204} y={30} label="12 V" />
            <Lamp x={204} y={70} rot={90} brightness={brightness} label="灯" />
            <Bjt x={190} y={130} label="S8050" value={`Vce ${fixed(vce, 1)} V`} color={region === "active" && pq > P_MAX * 0.5 ? trace.power : undefined} />
            <Ground x={204} y={172} />
            <Resistor x={110} y={130} label="Rb" value={formatSI(rb, "Ω")} />
            <Port x={40} y={130} label={`${fixed(vin, 2)} V`} side="bottom" color={trace.voltage} />
            <Label x={40} y={117} muted>
              引脚
            </Label>
          </Schematic>
          <div className="min-w-0">
            <Plot
              height={230}
              ariaLabel="集电极电流随基极电流变化：先按 β 倍上升，再被负载封顶"
              x={{ min: 0.001, max: 100, log: true, format: (v) => sig(v, 2), label: "基极电流 Ib (mA)" }}
              y={{ min: 0.1, max: 1000, log: true, format: (v) => sig(v, 3), label: "集电极电流 Ic (mA)" }}
              series={[{ fn: (x) => Math.min(beta * x, IC_SAT * 1000), label: `Ic = ${beta} × Ib，到 ${formatSI(IC_SAT, "A")} 封顶`, color: trace.current }]}
              markers={[{ x: markX, y: markY, label: region === "cutoff" ? "截止" : formatSI(ic, "A"), color: trace.current }]}
              lines={[{ x: (IC_SAT * 1000) / 10, label: "Ib = Ic ÷ 10", color: trace.good }]}
            />
            <p className="mt-1 text-caption text-muted-foreground">两条轴都是对数刻度，每一格是 10 倍。斜线段是放大区，平台是饱和区。</p>
          </div>
        </div>
      </LabStage>
      <LabControls columns={3}>
        <SliderField label="引脚输出电压" value={vin} onChange={setVin} min={0} max={3.3} step={0.05} format={(v) => `${fixed(v, 2)} V`} color={trace.voltage} />
        <SliderField label="基极电阻 Rb" value={rb} onChange={setRb} min={100} max={1e6} log snap="E12" unit="Ω" />
        <SliderField label="电流放大倍数 β" value={beta} onChange={setBeta} min={50} max={400} step={10} format={(v) => String(v)} />
      </LabControls>
      <LabReadouts>
        <Readout label="工作区" value={region === "cutoff" ? "截止" : region === "active" ? "放大" : "饱和"} />
        <Readout label="基极电流 Ib" value={formatSI(ib, "A")} color={trace.current} />
        <Readout label="集电极电流 Ic" value={formatSI(ic, "A")} color={trace.current} />
        <Readout label="Vce" value={`${fixed(vce, 2)} V`} color={trace.voltage} />
        <Readout label="三极管功耗" value={formatSI(pq, "W")} color={trace.power} />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

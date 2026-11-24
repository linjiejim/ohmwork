import * as React from "react"
import { Battery, ControlField, Diode, Lab, LabControls, LabNote, LabReadouts, LabStage, Label, Plot, Readout, Resistor, Schematic, Segmented, SliderField, Tex, Wire, diodeCurrent, fixed, formatSI, sig, solveDiodeLoop, tex, trace } from "@/lab"

type Kind = "si" | "schottky"

/*
 * Shockley parameters. Silicon follows the 1N4148 SPICE model (Is 2.5 nA,
 * n 1.75 → n·Vt 45 mV): 0.58 V at 1 mA, 0.68 V at 10 mA, 0.79 V at 100 mA.
 * The Schottky is a generic small rectifier: 0.21 / 0.28 / 0.34 V at the same
 * currents, and 200 times the leakage.
 */
const DIODES: Record<Kind, { name: string; variant: "diode" | "schottky"; is: number; nVt: number }> = {
  si: { name: "硅二极管", variant: "diode", is: 2.5e-9, nVt: 0.045 },
  schottky: { name: "肖特基", variant: "schottky", is: 5e-7, nVt: 0.028 },
}

/*
 * The plot's x axis is stretched the way textbooks draw diode curves: the
 * reverse half spans 10 V, the forward half 1 V. Axis position u is −1…1.
 */
const fromAxis = (u: number) => (u < 0 ? u * 10 : u)
const toAxis = (v: number) => (v < 0 ? v / 10 : v)

/** A source (either polarity) behind a resistor feeds a diode: the I–V curve, the load line and where they meet. */
export function DiodeCurveLab() {
  const [vs, setVs] = React.useState(5)
  const [r, setR] = React.useState(330)
  const [kind, setKind] = React.useState<Kind>("si")
  const d = DIODES[kind]

  const { vd, id } = solveDiodeLoop(vs, r, d.is, d.nVt)
  const vr = vs - vd
  const pr = id * id * r
  const conducting = id > 2e-4
  const hotResistor = pr > 0.25

  let tone: "neutral" | "good" | "warn" = "neutral"
  let note: React.ReactNode
  if (vs === 0) {
    note = "电源电压是 0，回路里没有电流。往右拖是正向，往左拖是反向。"
  } else if (vs < 0) {
    note =
      kind === "si"
        ? `反向截止：${fixed(-vs, 1)} V 的电源电压全部压在二极管上，只漏过 ${formatSI(-id, "A")}，蓝点不动。1N4148 这类硅管要到 100 V 左右才会击穿。`
        : `反向截止，但漏电流有 ${formatSI(-id, "A")}，是硅管的两百倍。压降低的代价是漏电大、耐压低（SS14 只有 40 V）。`
  } else if (!conducting) {
    note = `二极管两端只有 ${fixed(vd, 2)} V，还在门槛下面，电流只有 ${formatSI(id, "A")}，基本不导通。`
  } else {
    tone = "good"
    note = (
      <>
        正向导通：二极管上掉 {fixed(vd, 2)} V，剩下的 {fixed(vr, 2)} V 落在电阻上。电流由电阻决定：
        <Tex>{String.raw`\frac{${fixed(vs, 1)}\,\mathrm{V} - ${fixed(vd, 2)}\,\mathrm{V}}{${tex.si(r, "Ω")}} = ${tex.si(id, "A")}`}</Tex>。
        {hotResistor && `注意电阻要耗 ${formatSI(pr, "W")}，普通的 1/4 W 电阻会烧。`}
      </>
    )
    if (hotResistor) tone = "warn"
  }

  return (
    <Lab
      title="二极管伏安特性实验台"
      hint="把电源电压从正拖到负，看圆点（工作点）在曲线上怎么走。再换成肖特基对比。"
      onReset={() => {
        setVs(5)
        setR(330)
        setKind("si")
      }}
    >
      <LabStage>
        <div className="grid items-center gap-x-6 gap-y-4 @xl:grid-cols-[auto_minmax(0,1fr)]">
          {/*
           * Battery (40,100) vertical: terminals (40,70) / (40,130); + on top when vs ≥ 0, flipped when negative.
           * Resistor (135,40): terminals (105,40) / (165,40).
           * Diode (230,100) vertical: anode (230,70), cathode (230,130).
           */}
          <Schematic width={280} height={190} label="电源经一只电阻接到二极管的回路">
            <Wire points={[[40, 70], [40, 40], [105, 40]]} current={id} scale={0.05} />
            <Wire points={[[165, 40], [230, 40], [230, 70]]} current={id} scale={0.05} />
            <Wire points={[[230, 130], [230, 160], [40, 160], [40, 130]]} current={id} scale={0.05} />
            <Battery x={40} y={100} rot={vs >= 0 ? 90 : 270} label={vs < 0 ? "电源（反接）" : "电源"} value={`${fixed(Math.abs(vs), 1)} V`} />
            <Resistor x={135} y={40} label={`R = ${formatSI(r, "Ω")}`} />
            <Diode x={230} y={100} rot={90} variant={d.variant} label={d.name} value={`${fixed(vd, 2)} V`} labelSide="left" />
            <Label x={135} y={180} color={trace.current}>
              I = {formatSI(id, "A")}
            </Label>
          </Schematic>
          <div className="min-w-0">
            <Plot
              height={230}
              samples={400}
              ariaLabel="二极管的伏安特性曲线、负载线和工作点"
              x={{ min: -1, max: 1, ticks: [-1, -0.5, 0, 0.5, 1], format: (u) => sig(fromAxis(u), 2), label: "二极管两端电压 (V)" }}
              y={{ min: -20, max: 100, ticks: [-20, 0, 20, 40, 60, 80, 100], format: (v) => sig(v, 3), label: "电流 (mA)" }}
              series={[
                {
                  // stop a little above the frame: the exponential reaches astronomical values at 1 V
                  fn: (u) => {
                    const ma = diodeCurrent(fromAxis(u), d.is, d.nVt) * 1000
                    return ma > 200 ? Number.NaN : ma
                  },
                  label: `${d.name}的伏安特性`,
                  color: trace.current,
                },
                {
                  // drawn only on the side the source is on, where it meets the curve
                  fn: (u) => ((vs >= 0 ? u >= 0 : u <= 0) ? ((vs - fromAxis(u)) / r) * 1000 : Number.NaN),
                  label: "负载线（电源和电阻）",
                  color: trace.ref,
                  dashed: true,
                },
              ]}
              markers={[{ x: toAxis(vd), y: id * 1000, label: `${fixed(vd, vs < 0 ? 1 : 2)} V，${formatSI(id, "A")}`, color: trace.current }]}
              lines={[
                { x: -1, label: "反向" },
                { x: 0, label: "正向" },
              ]}
            />
            <p className="mt-1 text-caption text-muted-foreground">横轴两边的刻度不同：反向一格 5 V，正向一格 0.5 V。</p>
          </div>
        </div>
      </LabStage>
      <LabControls columns={3}>
        <SliderField label="电源电压" value={vs} onChange={setVs} min={-10} max={10} step={0.1} format={(v) => `${fixed(v, 1)} V`} color={trace.voltage} />
        <SliderField label="串联电阻 R" value={r} onChange={setR} min={100} max={10000} log snap="E12" unit="Ω" />
        <ControlField label="二极管类型">
          <Segmented
            aria-label="二极管类型"
            value={kind}
            onValueChange={setKind}
            options={[
              { value: "si", label: "硅二极管" },
              { value: "schottky", label: "肖特基" },
            ]}
          />
        </ControlField>
      </LabControls>
      <LabReadouts>
        <Readout label="二极管两端电压" value={`${fixed(vd, 2)} V`} color={trace.voltage} />
        <Readout label="电流" value={formatSI(id, "A")} color={trace.current} />
        <Readout label="电阻上的电压" value={`${fixed(vr, 2)} V`} />
        <Readout label="状态" value={vs < 0 ? "反向截止" : conducting ? "正向导通" : "未导通"} />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

import * as React from "react"
import { catVar } from "@/lib/categorical"
import { ControlField, Lab, LabControls, LabNote, LabReadouts, LabStage, Label, Plot, Readout, Schematic, Segmented, SliderField, Wire, clamp, fixed, formatSI, sig, trace } from "@/lab"

/*
 * IPC-2221 trace sizing:
 *   I = k · ΔT^0.44 · A^0.725      A in mil², k = 0.048 (outer layer) or 0.024 (inner layer)
 *   A = (I / (k · ΔT^0.44))^(1 / 0.725),   width = A / thickness,   1 oz copper = 1.378 mil ≈ 35 μm
 * Resistance of the trace: R = ρ · L / (w · t), ρ(copper) = 1.72e-8 Ω·m.
 */
const MIL_PER_OZ = 1.378
const M_PER_OZ = 35e-6
const MM_PER_MIL = 0.0254
const RHO_CU = 1.72e-8
/** Narrowest trace a low-cost fab will make, in mm (order of magnitude). The resistance uses at least this width. */
const FAB_MIN = 0.15
/** The IPC-2221 charts stop around 400 mil. */
const CHART_MAX = 10

const COPPER = catVar("amber")
const PX_PER_MM = 12
const MAX_PX = 64

type Oz = "0.5" | "1" | "2"
type Layer = "outer" | "inner"

function widthMm(i: number, dT: number, oz: number, layer: Layer) {
  const k = layer === "inner" ? 0.024 : 0.048
  const area = (i / (k * dT ** 0.44)) ** (1 / 0.725)
  return (area / (oz * MIL_PER_OZ)) * MM_PER_MIL
}

const fmtMm = (w: number) => (w >= 10 ? sig(w, 3) : w >= 0.1 ? fixed(w, 2) : sig(w, 2))

/** How wide a trace must be for a given current, and what it costs in resistance and voltage drop. */
export function TraceWidthLab() {
  const [i, setI] = React.useState(1)
  const [dT, setDT] = React.useState(10)
  const [oz, setOz] = React.useState<Oz>("1")
  const [layer, setLayer] = React.useState<Layer>("outer")
  const [len, setLen] = React.useState(50)

  const ounces = Number(oz)
  const need = widthMm(i, dT, ounces, layer)
  const needMil = need / MM_PER_MIL
  const used = Math.max(need, FAB_MIN)
  const r = (RHO_CU * (len / 1000)) / ((used / 1000) * (ounces * M_PER_OZ))
  const drop = i * r
  const heat = i * i * r

  /*
   * Picture (300 × 150), top view at 12 px per mm:
   *   board 10..290 × 10..140; trace centred on y = 66 from pad (46, 66) to pad (254, 66),
   *   at most 64 px wide (y 34..98); width label above it; below, a 0603 part
   *   (1.6 × 0.8 mm = 19.2 × 9.6 px at 40..59.2 × 112..121.6) and a 5 mm scale bar (220..280, y = 117).
   */
  const px = clamp(used * PX_PER_MM, 1.5, MAX_PX)
  const tooWide = used * PX_PER_MM > MAX_PX

  const layerName = layer === "inner" ? "内层" : "外层"
  let tone: "neutral" | "warn" | "bad" = "neutral"
  let note: string
  if (need > CHART_MAX) {
    tone = "bad"
    note = `算出来要 ${fmtMm(need)} mm 宽，已经超出 IPC-2221 图表覆盖的范围（大约 10 mm 以内），这个数只能当参考。这么大的电流不该靠一根走线：用大面积铺铜、加厚铜箔，或者把它放到外层。`
  } else if (need > 3) {
    tone = "warn"
    note = `要 ${fmtMm(need)} mm 宽。这么宽的线通常直接画成一块铺铜。加厚铜箔、换到外层、放宽允许的温升，都能让它窄下来。`
  } else if (drop > 0.1) {
    tone = "warn"
    note = `温升没问题，但这 ${len} mm 长的线上要掉 ${formatSI(drop, "V")}。供电线不能只看温升，还要看压降：加宽，或者把线缩短。`
  } else if (need < FAB_MIN) {
    note = `按温升算只要 ${fmtMm(need)} mm，比工厂能做的最细的线（约 0.1–0.15 mm）还细。这种小电流的线，照常用的 0.2–0.25 mm 画就行。下面的电阻是按 ${FAB_MIN} mm 算的。`
  } else {
    note = `${formatSI(i, "A")} 的电流、允许温升 ${dT}°C，${layerName}走线至少要 ${fmtMm(need)} mm（${sig(needMil, 3)} mil）宽。${layer === "inner" ? "内层被板材包着，散热差，同样的电流要比外层宽得多。" : "实际画的时候再留些余量。"}`
  }

  return (
    <Lab
      title="走线宽度计算器"
      hint="调电流、铜厚和允许温升，看走线要画多宽；再拉长走线，看电阻和压降。"
      onReset={() => {
        setI(1)
        setDT(10)
        setOz("1")
        setLayer("outer")
        setLen(50)
      }}
    >
      <LabStage>
        <div className="grid items-center gap-x-6 gap-y-4 @2xl:grid-cols-[auto_minmax(0,1fr)]">
          <Schematic width={300} height={150} label={`一条 ${fmtMm(used)} mm 宽的走线，旁边按同一比例画了一只 0603 电阻`}>
            <rect x={10} y={10} width={280} height={130} rx={6} fill={catVar("green", true)} stroke="var(--border)" />
            <path d="M46 66H254" stroke={COPPER} strokeWidth={px} strokeLinecap="butt" />
            <circle cx={46} cy={66} r={8} fill={COPPER} stroke="none" />
            <circle cx={254} cy={66} r={8} fill={COPPER} stroke="none" />
            <circle cx={46} cy={66} r={3} fill="var(--background)" stroke="none" />
            <circle cx={254} cy={66} r={3} fill="var(--background)" stroke="none" />
            <Wire points={[[46, 66], [254, 66]]} current={i} scale={10} color="none" />
            <Label x={150} y={66 - px / 2 - 8}>
              线宽 {fmtMm(used)} mm{tooWide ? "（图上画不下）" : ""}
            </Label>
            {/* a 0603 part at the same scale */}
            <rect x={40} y={112} width={19.2} height={9.6} fill="var(--background)" strokeWidth={1} />
            <rect x={40} y={112} width={4.5} height={9.6} fill="var(--muted-foreground)" stroke="none" />
            <rect x={54.7} y={112} width={4.5} height={9.6} fill="var(--muted-foreground)" stroke="none" />
            <Label x={66} y={121} anchor="start" muted>
              0603 电阻，同一比例
            </Label>
            {/* 5 mm scale bar */}
            <path d="M220 117H280M220 113V121M280 113V121" stroke="var(--muted-foreground)" strokeWidth={1.25} />
            <Label x={250} y={134} muted>
              5 mm
            </Label>
          </Schematic>
          <Plot
            height={200}
            x={{ min: 0, max: 10, label: "电流 (A)" }}
            y={{ min: 0, max: CHART_MAX, label: "所需线宽 (mm)" }}
            series={[
              { fn: (a) => widthMm(a, dT, ounces, "outer"), label: "外层", color: trace.current },
              { fn: (a) => widthMm(a, dT, ounces, "inner"), label: "内层", color: trace.second, dashed: true },
            ]}
            markers={[{ x: i, y: Math.min(need, CHART_MAX), label: `${fmtMm(need)} mm`, color: layer === "inner" ? trace.second : trace.current }]}
          />
        </div>
      </LabStage>
      <LabControls columns={3}>
        <SliderField label="电流" value={i} onChange={setI} min={0.1} max={10} step={0.1} unit="A" color={trace.current} />
        <SliderField label="允许温升" value={dT} onChange={setDT} min={10} max={60} step={5} unit="°C" />
        <SliderField label="走线长度" value={len} onChange={setLen} min={5} max={200} step={5} format={(v) => `${v} mm`} />
        <ControlField label="铜厚">
          <Segmented aria-label="铜厚" value={oz} onValueChange={setOz} options={[{ value: "0.5", label: "0.5 oz" }, { value: "1", label: "1 oz" }, { value: "2", label: "2 oz" }]} />
        </ControlField>
        <ControlField label="走线在哪一层">
          <Segmented aria-label="走线在哪一层" value={layer} onValueChange={setLayer} options={[{ value: "outer", label: "外层" }, { value: "inner", label: "内层" }]} />
        </ControlField>
      </LabControls>
      <LabReadouts>
        <Readout label="所需最小线宽" value={`${fmtMm(need)} mm`} sub={`${sig(needMil, 3)} mil`} />
        <Readout label="走线电阻" value={formatSI(r, "Ω")} sub={`按 ${fmtMm(used)} mm 宽、${len} mm 长`} />
        <Readout label="压降" value={formatSI(drop, "V")} color={trace.voltage} sub={`发热 ${formatSI(heat, "W")}`} />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

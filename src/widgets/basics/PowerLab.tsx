import * as React from "react"
import { Battery, ControlField, Lab, LabControls, LabNote, LabReadouts, LabStage, Label, Plot, Readout, Resistor, Schematic, Segmented, SliderField, Wire, clamp, formatSI, percent, sig, trace } from "@/lab"

/** Rated power of the resistor on the bench: the three sizes the lesson's table talks about. */
const RATINGS = [
  { value: "0.1", label: "1/10 W", watts: 0.1, name: "1/10 W（0603 贴片）" },
  { value: "0.25", label: "1/4 W", watts: 0.25, name: "1/4 W（常见直插）" },
  { value: "1", label: "1 W", watts: 1, name: "1 W" },
] as const
type RatingId = (typeof RATINGS)[number]["value"]

/**
 * Battery + resistor loop where the resistor heats up with P = V² / R, beside
 * the P–V parabola. Push the voltage up and the part goes past its rating.
 */
export function PowerLab() {
  const [v, setV] = React.useState(5)
  const [r, setR] = React.useState(100)
  const [ratingId, setRatingId] = React.useState<RatingId>("0.25")
  const rating = RATINGS.find((x) => x.value === ratingId) ?? RATINGS[1]

  const i = v / r
  const p = v * i
  const ratio = p / rating.watts // 1 = exactly at the rating
  // the body shifts from the normal ink to the "heat" colour as it nears its rating, then starts to glow
  const heat = clamp(ratio, 0, 1)
  const bodyColor = `color-mix(in oklab, ${trace.power} ${Math.round(heat * 100)}%, var(--foreground))`
  const glow = clamp(ratio, 0, 3)

  let tone: "neutral" | "good" | "warn" | "bad" = "good"
  let note: string
  if (p === 0) {
    tone = "neutral"
    note = "电压是 0，没有电流，电阻不发热。"
  } else if (ratio <= 0.5) {
    note = `功率 ${formatSI(p, "W")}，是额定 ${rating.label} 的 ${percent(ratio)}。在一半以内，留有余量，可以长期工作。`
  } else if (ratio <= 1) {
    tone = "warn"
    note = `功率 ${formatSI(p, "W")}，已经用到额定 ${rating.label} 的 ${percent(ratio)}。没超，但电阻会明显发烫。设计时一般只用到额定值的一半。`
  } else if (ratio <= 2) {
    tone = "bad"
    note = `功率 ${formatSI(p, "W")}，超过了额定的 ${rating.label}（${percent(ratio)}）。电阻会过热变色、阻值漂移，时间一长就烧坏。换额定功率更大的电阻，或者加大阻值。`
  } else {
    tone = "bad"
    note = `功率 ${formatSI(p, "W")}，是额定 ${rating.label} 的 ${sig(ratio, 2)} 倍。这只电阻很快就会冒烟烧毁。`
  }

  return (
    <Lab
      title="电阻发热实验台"
      hint="调电压和电阻，看电阻上的功率。电压往上拉，注意功率涨得有多快。"
      onReset={() => {
        setV(5)
        setR(100)
        setRatingId("0.25")
      }}
    >
      <LabStage>
        <div className="grid items-center gap-x-6 gap-y-4 @xl:grid-cols-[auto_minmax(0,1fr)]">
          {/*
            Same loop as the Ohm's law bench. Battery (40, 90): + at (40, 60), − at (40, 120).
            Resistor (210, 90): terminals (210, 60) and (210, 120). Heat lines sit right of it (x 226–240).
          */}
          <Schematic width={250} height={180} label="电池接一只电阻，电阻随功率升高而发红">
            <Label x={125} y={19} color={trace.current}>
              I = {formatSI(i, "A")}
            </Label>
            {glow > 0.25 && <circle cx={210} cy={90} r={12 + glow * 5} fill={trace.power} stroke="none" opacity={0.06 + glow * 0.09} />}
            <Wire points={[[40, 60], [40, 30], [210, 30], [210, 60]]} current={i} scale={0.05} />
            <Wire points={[[210, 120], [210, 150], [40, 150], [40, 120]]} current={i} scale={0.05} />
            <Battery x={40} y={90} rot={90} label="电池" value={formatSI(v, "V")} />
            <Resistor x={210} y={90} rot={90} label="电阻" value={formatSI(r, "Ω")} labelSide="left" color={bodyColor} />
            {ratio > 1 && (
              <g stroke={trace.power} strokeWidth={1.5} opacity={clamp(ratio - 0.6, 0.4, 1)}>
                <path d="M228 108q-5 -6 0 -12t0 -12t0 -12" />
                <path d="M239 108q-5 -6 0 -12t0 -12t0 -12" />
              </g>
            )}
            <Label x={125} y={136} color={trace.power}>
              P = {formatSI(p, "W")}
            </Label>
          </Schematic>
          <Plot
            height={200}
            x={{ min: 0, max: 12, label: "电压 (V)" }}
            y={{ min: 0, max: 1.5, label: "功率 (W)" }}
            series={[{ fn: (x) => (x * x) / r, label: `${formatSI(r, "Ω")} 电阻的功率 P = V² ÷ R`, color: trace.power }]}
            lines={[{ y: rating.watts, label: `额定 ${rating.label}` }]}
            markers={[{ x: v, y: p, label: formatSI(p, "W"), color: trace.power }]}
          />
        </div>
      </LabStage>
      <LabControls columns={3}>
        <SliderField label="电压 V" value={v} onChange={setV} min={0} max={12} step={0.1} unit="V" color={trace.voltage} />
        <SliderField label="电阻 R" value={r} onChange={setR} min={100} max={10000} log snap="E12" unit="Ω" />
        <ControlField label="电阻的额定功率">
          <Segmented aria-label="电阻的额定功率" size="sm" value={ratingId} onValueChange={setRatingId} options={RATINGS.map((x) => ({ value: x.value, label: x.label }))} />
        </ControlField>
      </LabControls>
      <LabReadouts>
        <Readout label="电流 I = V ÷ R" value={formatSI(i, "A")} color={trace.current} />
        <Readout label="功率 P = V × I" value={formatSI(p, "W")} color={trace.power} />
        <Readout label="占额定功率" value={percent(ratio)} sub={`额定 ${rating.name}`} />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

import * as React from "react"
import { catVar } from "@/lib/categorical"
import { Battery, ControlField, Junction, Lab, LabControls, LabNote, LabReadouts, LabStage, Label, Readout, Resistor, Schematic, Segmented, SliderField, Switch, SwitchField, Wire, clamp, fixed, formatSI, parallel, trace } from "@/lab"

/*
 * A 9 V battery, a switch and two series resistors (R2 = 2 · R1), with a
 * multimeter connected the right way for each measurement:
 *   voltage    meter (≈ 10 MΩ) across R2:    V = 9 V · (R2 ∥ 10 MΩ) / (R1 + R2 ∥ 10 MΩ)
 *   current    loop opened between R1 and R2, meter (≈ 10 Ω on the mA range) in series:  I = 9 V / (R1 + R2 + 10 Ω)
 *   resistance power off, meter across R2 (R1's other end floats, so it reads R2 alone)
 *
 * Canvas 340 × 196:
 *   battery (36, 115) rot 90: + (36, 85), − (36, 145)
 *   switch  (80, 50):  (50, 50) – (110, 50)
 *   R1      (150, 50): (120, 50) – (180, 50)
 *   R2      (210, 115) rot 90: (210, 85) – (210, 145)
 *   top-right corner (210, 50); bottom wire y = 180
 *   meter body 262..332 × 72..158; red jack (262, 128), black jack (262, 146)
 *   voltage / resistance: red lead → (244, 128) → (244, 66) → (210, 66); black lead → (236, 146) → (236, 164) → (210, 164)
 *   current: wire removed between (190, 50) and (210, 70);
 *            red lead (190, 50) → (250, 50) → (250, 128) → jack; black lead jack → (232, 146) → (232, 70) → (210, 70)
 */
const VB = 9
const R_VOLTMETER = 10e6
const R_AMMETER = 10
const RED = catVar("red")
const BLACK = "var(--foreground)"

type Mode = "v" | "a" | "ohm"

const errorText = (err: number) => (Math.abs(err) < 0.0005 ? "不到 0.1%" : `${fixed(err * 100, 1)}%`)

/** The three basic multimeter measurements, each with its correct hook-up and the meter's own loading. */
export function MultimeterLab() {
  const [mode, setMode] = React.useState<Mode>("v")
  const [on, setOn] = React.useState(true)
  const [r1, setR1] = React.useState(1000)
  const r2 = 2 * r1

  const r2Loaded = parallel(r2, R_VOLTMETER)
  // loop current with the meter connected
  const i = !on ? 0 : mode === "v" ? VB / (r1 + r2Loaded) : mode === "a" ? VB / (r1 + r2 + R_AMMETER) : VB / (r1 + r2)
  const ideal = on ? VB / (r1 + r2) : 0
  const reading = mode === "v" ? i * r2Loaded : mode === "a" ? i : r2
  const truth = mode === "v" ? ideal * r2 : mode === "a" ? ideal : r2
  const invalid = mode === "ohm" && on
  const err = truth > 0 ? (reading - truth) / truth : 0
  const unit = mode === "v" ? "V" : mode === "a" ? "A" : "Ω"
  const shown = invalid ? "无效" : formatSI(reading, unit)
  const modeName = mode === "v" ? "直流电压档" : mode === "a" ? "直流电流档" : "电阻档"
  // currents span five decades as R1 moves: map them to a visible dot speed on a log scale
  const flow = i > 0 ? clamp((Math.log10(i) + 7) / 5.5, 0.05, 1.2) : 0

  let tone: "neutral" | "good" | "warn" | "bad" = "neutral"
  let note: string
  if (mode === "ohm") {
    tone = on ? "bad" : "good"
    note = on
      ? "测电阻之前必须断电。电阻档是表自己送出一个小电流，再量电压算出阻值；电路里带着电，外来的电压会把读数搅乱，还可能烧坏表。先把电源开关断开。"
      : `已经断电。表自己送出一个小电流，量到 R2 = ${formatSI(r2, "Ω")}。在板子上量电阻要留心：量到的是它和所有并联通路合起来的阻值。`
  } else if (!on) {
    note = mode === "v" ? "电源断开，回路里没有电流，R2 两端是 0 V。" : "电源断开，回路里没有电流，读数是 0。"
  } else if (mode === "v") {
    tone = Math.abs(err) < 0.01 ? "good" : "warn"
    note =
      tone === "good"
        ? `电压表并联在 R2 两端，红表笔接电位高的那一头。表的内阻约 10 MΩ，比 ${formatSI(r2, "Ω")} 大得多，并上去几乎不改变电路，读数可信。`
        : `R2 有 ${formatSI(r2, "Ω")}，和表的 10 MΩ 内阻已经是一个量级。表一并上去，这一段就变成了 ${formatSI(r2Loaded, "Ω")}，读数比真实的 ${formatSI(truth, "V")} 低了 ${fixed(-err * 100, 1)}%。测高阻值电路的电压时，要想到表自己也是一只电阻。`
  } else {
    tone = Math.abs(err) < 0.01 ? "good" : "warn"
    note =
      tone === "good"
        ? "回路在 R1 和 R2 之间断开，表串在中间：电流从红表笔流进、黑表笔流出，表才量得到。电流档的内阻很小（这里取 10 Ω），几乎不影响回路。"
        : `电流档的内阻约 10 Ω。串进去以后，回路电阻从 ${formatSI(r1 + r2, "Ω")} 变成 ${formatSI(r1 + r2 + R_AMMETER, "Ω")}，电流小了 ${fixed(-err * 100, 1)}%。回路本身的电阻越小，这个影响越明显。`
  }

  return (
    <Lab
      title="万用表的三种接法"
      hint="切换测电压、电流、电阻，看表笔该接在哪儿。再把 R1 调到兆欧级，看表自己对读数的影响。"
      onReset={() => {
        setMode("v")
        setOn(true)
        setR1(1000)
      }}
    >
      <LabStage>
        <Schematic
          width={340}
          height={196}
          minScale={0.8}
          label={mode === "a" ? "电池、开关和两只串联电阻；回路在 R1 和 R2 之间断开，万用表串在中间测电流" : `电池、开关和两只串联电阻；万用表并联在 R2 两端测${mode === "v" ? "电压" : "电阻"}`}
        >
          <Wire points={[[36, 85], [36, 50], [50, 50]]} current={flow} scale={1} />
          <Wire points={[[110, 50], [120, 50]]} current={flow} scale={1} />
          {mode === "a" ? (
            <>
              <Wire points={[[180, 50], [190, 50]]} current={flow} scale={1} />
              <Wire points={[[210, 70], [210, 85]]} current={flow} scale={1} />
              <Wire points={[[190, 50], [250, 50], [250, 128], [262, 128]]} current={flow} scale={1} color={RED} width={2} />
              <Wire points={[[262, 146], [232, 146], [232, 70], [210, 70]]} current={flow} scale={1} color={BLACK} width={2} />
              <Junction x={190} y={50} color={RED} />
              <Junction x={210} y={70} color={BLACK} />
              <Label x={186} y={40} anchor="start" muted>
                回路在这里断开
              </Label>
            </>
          ) : (
            <>
              <Wire points={[[180, 50], [210, 50], [210, 85]]} current={flow} scale={1} />
              <Wire points={[[262, 128], [244, 128], [244, 66], [210, 66]]} color={RED} width={2} />
              <Wire points={[[262, 146], [236, 146], [236, 164], [210, 164]]} color={BLACK} width={2} />
              <Junction x={210} y={66} color={RED} />
              <Junction x={210} y={164} color={BLACK} />
            </>
          )}
          <Wire points={[[210, 145], [210, 180], [36, 180], [36, 145]]} current={flow} scale={1} />
          <Battery x={36} y={115} rot={90} label="电池" value="9 V" />
          <Switch x={80} y={50} closed={on} onClick={() => setOn((o) => !o)} label="电源开关" />
          <Resistor x={150} y={50} label="R1" value={formatSI(r1, "Ω")} />
          <Resistor x={210} y={115} rot={90} label="R2" value={formatSI(r2, "Ω")} labelSide="left" />
          {/* the multimeter: display, range, and the two jacks the leads plug into */}
          <Label x={297} y={64} muted>
            万用表
          </Label>
          <rect x={262} y={72} width={70} height={86} rx={5} fill="var(--background)" />
          <rect x={266} y={80} width={62} height={24} rx={2} fill="var(--sunken)" stroke="var(--input)" strokeWidth={1} />
          <Label x={297} y={97} weight={600} color={invalid ? "var(--destructive)" : undefined}>
            {shown}
          </Label>
          <Label x={297} y={119} size={12} muted>
            {modeName}
          </Label>
          <circle cx={262} cy={128} r={4} fill={RED} stroke="none" />
          <circle cx={262} cy={146} r={4} fill={BLACK} stroke="none" />
          <Label x={272} y={132.5} anchor="start" size={12} color={RED}>
            红表笔
          </Label>
          <Label x={272} y={150.5} anchor="start" size={12}>
            黑表笔
          </Label>
        </Schematic>
      </LabStage>
      <LabControls columns={3}>
        <ControlField label="要测什么">
          <Segmented aria-label="要测什么" value={mode} onValueChange={setMode} options={[{ value: "v", label: "电压" }, { value: "a", label: "电流" }, { value: "ohm", label: "电阻" }]} />
        </ControlField>
        <SwitchField label="电源接通" hint="测电阻前要断开" checked={on} onChange={setOn} />
        <SliderField label="R1 的阻值（R2 = 2 × R1）" value={r1} onChange={setR1} min={100} max={10e6} log snap="E12" unit="Ω" />
      </LabControls>
      <LabReadouts>
        <Readout label={`表上的读数（${modeName}）`} value={shown} color={mode === "v" ? trace.voltage : mode === "a" ? trace.current : undefined} />
        <Readout label="不接表时的真实值" value={formatSI(truth, unit)} />
        <Readout label="表带来的误差" value={invalid || truth <= 0 ? "—" : errorText(err)} />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

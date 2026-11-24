import * as React from "react"
import {
  ControlField,
  Lab,
  LabControls,
  LabNote,
  LabReadouts,
  LabStage,
  Label,
  Plot,
  Readout,
  Resistor,
  Schematic,
  Segmented,
  SliderField,
  Source,
  Tex,
  Wire,
  fixed,
  formatSI,
  percent,
  tex,
  trace,
} from "@/lab"

type Target = "3.3" | "5"
type Regulator = "ams1117" | "modern"
type Package = "sot23" | "sot223" | "to220"

/** Dropout voltage: how far the input must stay above the output. */
const DROPOUT: Record<Regulator, number> = { ams1117: 1.1, modern: 0.2 }
/** Junction-to-ambient thermal resistance in °C/W, typical order of magnitude on a small board without a heatsink. */
const THETA_JA: Record<Package, number> = { sot23: 250, sot223: 90, to220: 60 }
const AMBIENT = 25
/** Rated maximum junction temperature, and roughly where thermal shutdown trips. */
const T_RATED = 125
const T_SHUTDOWN = 150
/** Most low-dropout CMOS regulators are only rated for about 6 V at the input. */
const MODERN_VIN_MAX = 6
const VIN_MAX = 15

const temp = (t: number) => `${Math.round(t)} °C`

/** A linear regulator as a self-adjusting series resistor: output, heat, efficiency and junction temperature. */
export function LdoLab() {
  const [vin, setVin] = React.useState(12)
  const [target, setTarget] = React.useState<Target>("3.3")
  const [i, setI] = React.useState(0.5)
  const [regulator, setRegulator] = React.useState<Regulator>("ams1117")
  const [pkg, setPkg] = React.useState<Package>("sot223")

  const vset = Number(target)
  const dropout = DROPOUT[regulator]
  const vinMin = vset + dropout
  const regulating = vin >= vinMin
  // below "output + dropout" the pass element is fully on and the output just follows the input down
  const vout = regulating ? vset : Math.max(0, vin - dropout)
  const vdrop = vin - vout
  const heat = vdrop * i
  const efficiency = vout / vin
  const theta = THETA_JA[pkg]
  const tj = AMBIENT + heat * theta
  const rPass = vdrop / i

  let tone: "good" | "warn" | "bad" = "good"
  let note: string
  if (regulator === "modern" && vin > MODERN_VIN_MAX) {
    tone = "bad"
    note = `大多数低压差的 CMOS LDO 输入耐压只有 ${MODERN_VIN_MAX} V 左右，接 ${formatSI(vin, "V")} 会直接击穿。输入电压高时要选耐压够的型号，或者先用 DC-DC 降一级。`
  } else if (!regulating) {
    tone = "warn"
    note = `输入 ${formatSI(vin, "V")} 低于「输出 + 压差」= ${formatSI(vinMin, "V")}。调整管已经开到最大也不够，输出掉到 ${formatSI(vout, "V")}，而且输入怎么变它就跟着怎么变，稳压失效。`
  } else if (tj > T_SHUTDOWN) {
    tone = "bad"
    note = `发热 ${formatSI(heat, "W")}，按热阻估算结温要到 ${temp(tj)}。真实芯片到 ${T_SHUTDOWN} °C 左右就会过热保护、切断输出，凉下来再接通，电路表现为反复重启。降低输入电压，或者换成 DC-DC。`
  } else if (tj > T_RATED) {
    tone = "warn"
    note = `结温约 ${temp(tj)}，超过了 ${T_RATED} °C 的允许工作上限，再热一点就会触发过热保护。换散热更好的封装、加大铜皮，或者减小压降。`
  } else {
    note = `发热 ${formatSI(heat, "W")}，结温约 ${temp(tj)}，可以长期工作。效率 ${percent(efficiency)}：输入的每 1 W 里有 ${fixed(1 - efficiency, 2)} W 变成了热。`
  }

  return (
    <Lab
      title="线性稳压器实验台"
      hint="初始状态是 12 V 降到 3.3 V、负载 0.5 A。把输入电压往下拖，看发热和结温怎么变；再拖到比输出还低试试。"
      onReset={() => {
        setVin(12)
        setTarget("3.3")
        setI(0.5)
        setRegulator("ams1117")
        setPkg("sot223")
      }}
    >
      <LabStage>
        <div className="grid items-center gap-x-6 gap-y-4 @xl:grid-cols-[auto_minmax(0,1fr)]">
          {/*
           * Layout (280 × 190). Top rail y = 50, bottom rail y = 170.
           * Source (40, 110) vertical: + (40, 80), − (40, 140).
           * Pass element (150, 50) horizontal: (120, 50), (180, 50).
           * Load (250, 110) vertical: (250, 80), (250, 140).
           */}
          <Schematic width={280} height={190} label="输入电源经过一只自动调节的串联电阻（调整管）给负载供电">
            <Wire points={[[40, 80], [40, 50], [120, 50]]} current={i} scale={1} />
            <Wire points={[[180, 50], [250, 50], [250, 80]]} current={i} scale={1} />
            <Wire points={[[250, 140], [250, 170], [40, 170], [40, 140]]} current={i} scale={1} />
            <Source kind="dc" x={40} y={110} rot={90} label="输入" value={formatSI(vin, "V")} />
            <Resistor variable x={150} y={50} color={tj > T_RATED ? trace.power : undefined} />
            <Label x={150} y={24}>调整管</Label>
            <Label x={150} y={80} muted>
              压降 {formatSI(vdrop, "V")}
            </Label>
            <Label x={150} y={96} color={trace.power}>
              发热 {formatSI(heat, "W")}
            </Label>
            <Label x={215} y={38} color={trace.voltage}>
              {formatSI(vout, "V")}
            </Label>
            <Resistor x={250} y={110} rot={90} label="负载" value={formatSI(i, "A")} labelSide="left" />
          </Schematic>
          <Plot
            height={220}
            x={{ min: 0, max: VIN_MAX, label: "输入电压 (V)" }}
            y={{ min: 0, max: 6.5, label: "输出电压 (V)" }}
            series={[
              // stops short of the top band, where the "最低输入" label sits
              { points: [[0, 0], [5.5, 5.5]], label: "输出 = 输入", color: trace.ref, dashed: true, width: 1.5 },
              { points: [[0, 0], [dropout, 0], [vinMin, vset], [VIN_MAX, vset]], label: "稳压器的输出", color: trace.voltage },
            ]}
            lines={[{ x: vinMin, label: `最低输入 ${formatSI(vinMin, "V")}` }]}
            markers={[{ x: vin, y: vout, label: formatSI(vout, "V"), color: trace.voltage }]}
          />
        </div>
      </LabStage>
      <LabControls>
        <SliderField label="输入电压" value={vin} onChange={setVin} min={2} max={VIN_MAX} step={0.1} unit="V" color={trace.voltage} />
        <SliderField label="负载电流" value={i} onChange={setI} min={0.01} max={1} step={0.01} unit="A" color={trace.current} />
        <ControlField label="输出电压">
          <Segmented
            aria-label="输出电压"
            value={target}
            onValueChange={setTarget}
            options={[
              { value: "3.3", label: "3.3 V" },
              { value: "5", label: "5 V" },
            ]}
          />
        </ControlField>
        <ControlField label="稳压器的压差">
          <Segmented
            aria-label="稳压器的压差"
            value={regulator}
            onValueChange={setRegulator}
            options={[
              { value: "ams1117", label: "AMS1117 约 1.1 V" },
              { value: "modern", label: "新型 LDO 约 0.2 V" },
            ]}
          />
        </ControlField>
        <ControlField label="封装（热阻为典型量级）">
          <Segmented
            aria-label="封装"
            value={pkg}
            onValueChange={setPkg}
            options={[
              { value: "sot23", label: "SOT-23" },
              { value: "sot223", label: "SOT-223" },
              { value: "to220", label: "TO-220" },
            ]}
          />
        </ControlField>
      </LabControls>
      <LabReadouts>
        <Readout label="输出电压" value={formatSI(vout, "V")} color={trace.voltage} />
        <Readout label={<>发热 <Tex>{String.raw`(V_{\mathrm{in}} - V_{\mathrm{out}}) \times I`}</Tex></>} value={formatSI(heat, "W")} color={trace.power} sub={`调整管等效 ${formatSI(rPass, "Ω")}`} />
        <Readout label={<>效率 <Tex>{String.raw`\approx V_{\mathrm{out}} / V_{\mathrm{in}}`}</Tex></>} value={percent(efficiency, 1)} />
        <Readout label="结温估算" value={temp(tj)} sub={<Tex>{`${AMBIENT}\\,{}^{\\circ}\\mathrm{C} + ${tex.si(heat, "W")} \\times ${theta}\\,{}^{\\circ}\\mathrm{C/W}`}</Tex>} />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

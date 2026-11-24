import * as React from "react"
import { ControlField, Ground, Lab, LabControls, LabNote, LabReadouts, LabStage, Label, Lamp, Mosfet, Plot, Port, Rail, Readout, Schematic, Segmented, SliderField, Wire, clamp, fixed, formatSI, sig, trace } from "@/lab"

type Kind = "logic" | "standard"

/*
 * Simplified MOSFET: the textbook square-law channel (transconductance K,
 * threshold Vth) in series with a fixed resistance for the silicon and the
 * package. Fully on, Rds = rs + 1 / (K·(Vgs − Vth)):
 *   logic-level  33 mΩ at 3.3 V, 26 mΩ at 4.5 V, 19 mΩ at 10 V  (AO3400 / IRLZ44N territory)
 *   standard     off at 3 V,      37 mΩ at 4.5 V, 20 mΩ at 10 V  (IRFZ44N territory)
 * Close to real parts, but not any one part's datasheet.
 */
const FETS: Record<Kind, { name: string; vth: number; k: number; rs: number }> = {
  logic: { name: "逻辑电平管", vth: 1.5, k: 30, rs: 0.015 },
  standard: { name: "标准管", vth: 3, k: 30, rs: 0.015 },
}

const VDD = 12

type State = "off" | "half" | "on"

/** N-MOS low-side switch with a resistive load to VDD. "half" = the channel is pinched off and limits the current itself. */
function operate(vgs: number, fet: { vth: number; k: number; rs: number }, rl: number): { id: number; vds: number; state: State } {
  const vov = vgs - fet.vth
  if (vov <= 0) return { id: 0, vds: VDD, state: "off" }
  const rTot = rl + fet.rs
  const idSat = (fet.k / 2) * vov * vov
  // saturation: even carrying idSat, the channel still has more than Vov across it
  if (VDD - idSat * rTot >= vov) return { id: idSat, vds: VDD - idSat * rl, state: "half" }
  // triode: find the channel voltage where channel current equals what the load passes (monotonic, so bisect)
  let lo = 0
  let hi = Math.min(vov, VDD)
  for (let n = 0; n < 50; n++) {
    const mid = (lo + hi) / 2
    if (fet.k * (vov * mid - (mid * mid) / 2) < (VDD - mid) / rTot) lo = mid
    else hi = mid
  }
  const id = (VDD - (lo + hi) / 2) / rTot
  return { id, vds: VDD - id * rl, state: "on" }
}

/** A gate voltage, two kinds of N-MOSFET and a 12 V load: how "on" is the switch, and where does the heat go. */
export function MosfetSwitchLab() {
  const [vgs, setVgs] = React.useState(3.3)
  const [iLoad, setILoad] = React.useState(2)
  const [kind, setKind] = React.useState<Kind>("logic")
  const fet = FETS[kind]
  const other = FETS[kind === "logic" ? "standard" : "logic"]
  const rl = VDD / iLoad

  const { id, vds, state } = operate(vgs, fet, rl)
  const rds = id > 0 ? vds / id : Infinity
  const p = vds * id
  const brightness = (id / iLoad) ** 2
  /** Effective drain–source resistance, for the plot. Infinity while off. */
  const rdsAt = (v: number, f: typeof fet) => {
    const o = operate(v, f, rl)
    return o.id > 0 ? o.vds / o.id : Infinity
  }

  let tone: "neutral" | "good" | "warn" | "bad" = "neutral"
  let note: string
  if (state === "off") {
    note = `关断：Vgs 没超过阈值电压（${fixed(fet.vth, 1)} V），沟道没有形成，D–S 之间不通，负载没有电流。`
  } else if (state === "half") {
    tone = p >= 1 ? "bad" : "warn"
    note = `半开半关：管子只放得过 ${formatSI(id, "A")}，负载本来要 ${formatSI(iLoad, "A")}。12 V 里有 ${fixed(vds, 1)} V 压在管子上，发热 ${formatSI(p, "W")}${p >= 1 ? "，贴片小管子几秒钟就烧毁" : ""}。${kind === "standard" && vgs <= 3.5 ? "单片机的 3.3 V 引脚带不动标准管，要换逻辑电平管。" : "栅极电压要再高一些。"}`
  } else if (p >= 1) {
    tone = "warn"
    note = `导通了，但 Rds(on) 还有 ${formatSI(rds, "Ω")}，${formatSI(id, "A")} 流过去要发热 ${formatSI(p, "W")}，得加散热片。栅极电压再高一些，或者换 Rds(on) 更小的管子。`
  } else {
    tone = "good"
    note = `完全导通：Rds(on) 只有 ${formatSI(rds, "Ω")}，比负载的 ${formatSI(rl, "Ω")} 小得多。管子上只掉 ${formatSI(vds, "V")}，发热 ${formatSI(p, "W")}，栅极不需要持续的电流。`
  }

  return (
    <Lab
      title="MOSFET 开关实验台"
      hint="先把栅极电压停在 3.3 V，切换两种管子对比；再从 0 慢慢往上拖，看 D–S 之间的电阻怎么从无穷大掉到毫欧级。"
      onReset={() => {
        setVgs(3.3)
        setILoad(2)
        setKind("logic")
      }}
    >
      <LabStage>
        <div className="grid items-center gap-x-6 gap-y-4 @xl:grid-cols-[auto_minmax(0,1fr)]">
          {/*
           * Port (50,130) → gate (110,130). N-MOS (140,130): drain (154,100), source (154,160).
           * Lamp (154,70) vertical: terminals (154,40) / (154,100). Rail at (154,30), ground at (154,172).
           */}
          <Schematic width={260} height={196} label="N 沟道 MOSFET 接在 12 V 负载和地之间做低边开关">
            <Wire points={[[50, 130], [110, 130]]} />
            <Wire points={[[154, 30], [154, 40]]} current={id} scale={2} />
            <Wire points={[[154, 160], [154, 172]]} current={id} scale={2} />
            <Rail x={154} y={30} label="12 V" />
            <Lamp x={154} y={70} rot={90} brightness={brightness} label="负载" />
            <Mosfet x={140} y={130} label="N-MOS" value={`Vds ${vds >= 1 ? `${fixed(vds, 1)} V` : formatSI(vds, "V")}`} color={p >= 1 ? trace.power : undefined} />
            <Ground x={154} y={172} />
            <Port x={50} y={130} label={`${fixed(vgs, 1)} V`} side="bottom" color={trace.voltage} />
            <Label x={50} y={117} muted>
              栅极
            </Label>
          </Schematic>
          <div className="min-w-0">
            <Plot
              height={230}
              ariaLabel="漏极和源极之间的等效电阻随栅极电压变化的曲线"
              x={{ min: 0, max: 10, label: "栅源电压 Vgs (V)" }}
              y={{ min: 0.01, max: 1000, log: true, format: (v) => (!Number.isFinite(v) ? "∞" : v >= 1000 ? `${sig(v / 1000, 3)}k` : sig(v, 3)), label: "D–S 之间的电阻 (Ω)" }}
              series={[
                { fn: (v) => rdsAt(v, fet), label: `${fet.name}（Vth ${fixed(fet.vth, 1)} V）`, color: trace.second },
                { fn: (v) => rdsAt(v, other), label: `${other.name}，对比`, color: trace.ref, dashed: true },
              ]}
              markers={[{ x: vgs, y: clamp(rds, 0.01, 1000), label: state === "off" ? "关断" : formatSI(rds, "Ω"), color: trace.second }]}
              lines={[{ y: rl, label: `负载 ${formatSI(rl, "Ω")}` }]}
            />
            <p className="mt-1 text-caption text-muted-foreground">纵轴是对数刻度，每一格是 10 倍。曲线和负载那条线相交的地方，管子发热最厉害。</p>
          </div>
        </div>
      </LabStage>
      <LabControls columns={3}>
        <SliderField label="栅极电压 Vgs" value={vgs} onChange={setVgs} min={0} max={10} step={0.1} format={(v) => `${fixed(v, 1)} V`} color={trace.voltage} />
        <SliderField label="负载电流（全开时）" value={iLoad} onChange={setILoad} min={0.5} max={5} step={0.1} format={(v) => `${fixed(v, 1)} A`} color={trace.current} />
        <ControlField label="MOSFET 类型">
          <Segmented
            aria-label="MOSFET 类型"
            value={kind}
            onValueChange={setKind}
            options={[
              { value: "logic", label: "逻辑电平管" },
              { value: "standard", label: "标准管" },
            ]}
          />
        </ControlField>
      </LabControls>
      <LabReadouts>
        <Readout label="状态" value={state === "off" ? "关断" : state === "half" ? "半开" : "导通"} />
        <Readout label="D–S 之间的电阻" value={formatSI(rds, "Ω")} color={trace.second} sub={state === "on" ? "就是 Rds(on)" : state === "half" ? "远大于 Rds(on)" : undefined} />
        <Readout label="漏极电流 Id" value={formatSI(id, "A")} color={trace.current} />
        <Readout label="管子功耗" value={formatSI(p, "W")} color={trace.power} />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

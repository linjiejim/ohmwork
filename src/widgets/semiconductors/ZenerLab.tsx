import * as React from "react"
import { Battery, Diode, Junction, Lab, LabControls, LabNote, LabReadouts, LabStage, Label, Plot, Port, Readout, Resistor, Schematic, SliderField, SwitchField, Wire, fixed, formatSI, solveDiodeLoop, trace } from "@/lab"

/*
 * A 5.1 V, 0.5 W zener (BZX55C5V1 class) in breakdown: an exponential knee
 * that passes 5 mA at 5.1 V and gains a decade every 0.23 V, i.e. about 20 Ω
 * of dynamic resistance at 5 mA, 100 Ω at 1 mA. Low-voltage zeners really are
 * this soft.
 */
const VZ = 5.1
const SLOPE = 0.1
const IS_Z = 5e-3 * Math.exp(-VZ / SLOPE)
const P_MAX = 0.5

/** Series resistor + zener, with an optional load across the zener. Thevenin turns it into "a source behind a resistor feeds a diode". */
function regulate(vin: number, r: number, rl: number | null) {
  const vth = rl == null ? vin : (vin * rl) / (r + rl)
  const rth = rl == null ? r : (r * rl) / (r + rl)
  const { vd, id } = solveDiodeLoop(vth, rth, IS_Z, SLOPE)
  return { vout: vd, iz: id, il: rl == null ? 0 : vd / rl, ir: (vin - vd) / r, open: vth }
}

/** The shunt regulator everyone builds first: output follows the input up to 5.1 V, then holds — as long as the zener keeps some current. */
export function ZenerLab() {
  const [vin, setVin] = React.useState(9)
  const [r, setR] = React.useState(330)
  const [loaded, setLoaded] = React.useState(false)
  const [rl, setRl] = React.useState(1000)
  const load = loaded ? rl : null

  const { vout, iz, il, ir, open } = regulate(vin, r, load)
  const pz = vout * iz
  const hot = pz > P_MAX
  const regulating = iz >= 1e-3

  let tone: "neutral" | "good" | "warn" | "bad" = "neutral"
  let note: string
  if (hot) {
    tone = "bad"
    note = `稳压管要耗 ${formatSI(pz, "W")}，超过它 0.5 W 的额定功耗，会烧毁。串联电阻太小了，把它加大。`
  } else if (regulating) {
    tone = "good"
    note = `稳压管击穿导通，把输出稳在 ${fixed(vout, 2)} V，多出来的 ${fixed(vin - vout, 2)} V 落在串联电阻上。电阻送来 ${formatSI(ir, "A")}${loaded ? `，负载拿走 ${formatSI(il, "A")}，剩下 ${formatSI(iz, "A")} 流过稳压管。` : "，全部流过稳压管。"}`
  } else if (loaded && vin > VZ && open < VZ + 0.2) {
    tone = "warn"
    note = `负载要的电流太多：串联电阻和负载分压后只剩 ${fixed(open, 2)} V，稳压管得不到足够的电流（只有 ${formatSI(iz, "A")}），稳不住，输出掉到 ${fixed(vout, 2)} V。把串联电阻减小，或者减轻负载。`
  } else if (vin > VZ) {
    tone = "warn"
    note = `稳压管里只有 ${formatSI(iz, "A")}，还在击穿曲线的拐弯处，输出（${fixed(vout, 2)} V）会跟着输入晃。一般要让它保持 1 mA 以上。`
  } else {
    note = `输入不到 5.1 V，稳压管没有击穿，几乎不导通，输出${loaded ? "由串联电阻和负载分压决定" : "跟着输入走"}。`
  }

  return (
    <Lab
      title="稳压二极管实验台"
      hint="把输入电压从 0 往上拖，看输出在 5.1 V 附近被「按住」。再接上负载，把负载电阻调小试试。"
      onReset={() => {
        setVin(9)
        setR(330)
        setLoaded(false)
        setRl(1000)
      }}
    >
      <LabStage>
        <div className="grid items-center gap-x-6 gap-y-4 @xl:grid-cols-[auto_minmax(0,1fr)]">
          {/*
           * Battery (40,110) vertical: + (40,80), − (40,140).
           * Resistor R (120,50): terminals (90,50) / (150,50).
           * Output node (200,50). Zener (200,110) pointing up: cathode (200,80), anode (200,140).
           * Load (270,110) vertical: terminals (270,80) / (270,140). Return wire along y = 170.
           */}
          <Schematic width={320} height={190} label="输入电源经串联电阻接到稳压管，负载并联在稳压管两端">
            <Wire points={[[40, 80], [40, 50], [90, 50]]} current={ir} scale={0.03} />
            <Wire points={[[150, 50], [200, 50]]} current={ir} scale={0.03} />
            <Wire points={[[200, 50], [200, 80]]} current={iz} scale={0.03} />
            <Wire points={[[200, 140], [200, 170]]} current={iz} scale={0.03} />
            <Wire points={[[200, 170], [40, 170], [40, 140]]} current={ir} scale={0.03} />
            {loaded ? (
              <>
                <Wire points={[[200, 50], [270, 50], [270, 80]]} current={il} scale={0.03} />
                <Wire points={[[270, 140], [270, 170], [200, 170]]} current={il} scale={0.03} />
                <Resistor x={270} y={110} rot={90} label="负载" value={formatSI(rl, "Ω")} labelSide="left" />
              </>
            ) : (
              <>
                <Wire points={[[200, 50], [270, 50]]} />
                <Port x={270} y={50} />
              </>
            )}
            <Junction x={200} y={50} />
            <Junction x={200} y={170} />
            <Battery x={40} y={110} rot={90} label="输入" value={`${fixed(vin, 1)} V`} />
            <Resistor x={120} y={50} label="R" value={formatSI(r, "Ω")} />
            <Diode x={200} y={110} rot={270} variant="zener" label="稳压管" value="5.1 V" labelSide="left" color={hot ? trace.power : undefined} />
            <Label x={236} y={36} color={trace.voltage}>
              输出 {fixed(vout, 2)} V
            </Label>
          </Schematic>
          <Plot
            height={220}
            ariaLabel="输出电压随输入电压变化的曲线"
            x={{ min: 0, max: 15, label: "输入电压 (V)" }}
            y={{ min: 0, max: 8, label: "输出电压 (V)" }}
            series={[
              { fn: (x) => regulate(x, r, load).vout, label: "输出电压", color: trace.voltage },
              { fn: (x) => (load == null ? x : (x * load) / (r + load)), label: "去掉稳压管会是多少", color: trace.ref, dashed: true },
            ]}
            markers={[{ x: vin, y: vout, label: `${fixed(vout, 2)} V`, color: trace.voltage }]}
            lines={[{ y: VZ, label: "5.1 V" }]}
          />
        </div>
      </LabStage>
      <LabControls>
        <SliderField label="输入电压" value={vin} onChange={setVin} min={0} max={15} step={0.1} format={(x) => `${fixed(x, 1)} V`} color={trace.voltage} />
        <SliderField label="串联电阻 R" value={r} onChange={setR} min={47} max={4700} log snap="E12" unit="Ω" />
        <SwitchField label="接上负载" checked={loaded} onChange={setLoaded} hint="并联在稳压管两端" />
        <SliderField label="负载电阻" value={rl} onChange={setRl} min={100} max={10000} log snap="E12" unit="Ω" disabled={!loaded} />
      </LabControls>
      <LabReadouts>
        <Readout label="输出电压" value={`${fixed(vout, 2)} V`} color={trace.voltage} />
        <Readout label="稳压管电流" value={formatSI(iz, "A")} color={trace.current} />
        <Readout label="稳压管功耗" value={formatSI(pz, "W")} color={trace.power} sub="额定 0.5 W" />
        <Readout label="负载电流" value={loaded ? formatSI(il, "A") : "未接负载"} />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

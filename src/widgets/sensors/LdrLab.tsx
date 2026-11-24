import * as React from "react"
import { catVar } from "@/lib/categorical"
import { Arrow, Ground, Junction, Lab, LabControls, LabNote, LabReadouts, LabStage, Label, Led, OpAmp, Plot, Port, Rail, Readout, Resistor, Schematic, SliderField, Wire, fixed, formatSI, sig, trace } from "@/lab"

const VCC = 3.3
/** Fixed resistor on top of the divider. */
const R_TOP = 10_000
/**
 * Photoresistor as a power law, R = R10 · (E / 10 lx)^−γ: 15 kΩ at 10 lx, γ = 0.6.
 * Roughly a GL5528-class part; real ones vary a lot from piece to piece.
 */
const R_AT_10LX = 15_000
const GAMMA = 0.6
const ldr = (lux: number) => R_AT_10LX * (lux / 10) ** -GAMMA
const divider = (lux: number) => (VCC * ldr(lux)) / (ldr(lux) + R_TOP)

const LUX_MIN = 0.1
const LUX_MAX = 100_000
const LIGHT = catVar("amber")

function scene(lux: number) {
  if (lux < 1) return "月光下"
  if (lux < 50) return "黄昏或路灯下"
  if (lux < 1000) return "室内灯光"
  if (lux < 20_000) return "阴天室外"
  return "晴天阳光下"
}

/**
 * Photoresistor + divider + comparator: a dusk switch. Light sets the divider
 * voltage; when it climbs above the threshold the comparator turns the lamp on.
 */
export function LdrLab() {
  const [lux, setLux] = React.useState(200)
  const [vth, setVth] = React.useState(1.65)

  const r = ldr(lux)
  const v = divider(lux)
  const iDivider = VCC / (r + R_TOP)
  const lampOn = v > vth
  // the illuminance at which the divider output equals the threshold
  const rSwitch = (R_TOP * vth) / (VCC - vth)
  const luxSwitch = 10 * (rSwitch / R_AT_10LX) ** (-1 / GAMMA)
  const margin = Math.abs(v - vth)
  const twitchy = margin < 0.05

  const tone = twitchy ? "warn" : lampOn ? "good" : "neutral"
  const note = twitchy
    ? `分压输出离阈值只差 ${fixed(margin * 1000, 0)} mV：一点噪声、一片云影就会让灯忽亮忽灭。实际电路要给比较器加一点迟滞。`
    : lampOn
      ? `${scene(lux)}（${sig(lux)} lx）：光敏电阻升到 ${formatSI(r, "Ω")}，分压输出 ${fixed(v, 2)} V 高过阈值，比较器输出高电平，灯亮了。`
      : `${scene(lux)}（${sig(lux)} lx）：光敏电阻只有 ${formatSI(r, "Ω")}，分压输出 ${fixed(v, 2)} V 低于阈值，灯不亮。照度降到约 ${sig(luxSwitch, 2)} lx 以下才会开灯。`

  return (
    <Lab
      title="天黑自动开灯"
      hint="把光照往暗处拖，看分压输出越过阈值、灯亮起来。光敏电阻的阻值按幂律近似计算（10 lx 时 15 kΩ，γ = 0.6），真实器件个体差异很大。"
      onReset={() => {
        setLux(200)
        setVth(1.65)
      }}
    >
      <LabStage>
        <div className="grid gap-4">
          {/*
            Layout (340 × 216).
            Divider on x = 80: rail (80, 40) · R centre (80, 70), terminals (80, 40) / (80, 100)
              · node (80, 110) · LDR centre (80, 150), terminals (80, 120) / (80, 180) · ground (80, 180).
            Comparator centre (200, 124): + input (160, 110), − input (160, 138), output (244, 124).
            Threshold: (160, 138) → (140, 138) → port (140, 166), label below it.
            Output: (244, 124) → 330 Ω centre (280, 124), terminals (250, 124) / (310, 124)
              → LED centre (310, 160), terminals (310, 130) / (310, 190) → ground (310, 190).
          */}
          <Schematic width={340} height={216} label="光敏电阻分压接到比较器的同相端，比较器输出点亮一只 LED">
            <Rail x={80} y={40} label="3.3 V" />
            <Resistor x={80} y={70} rot={90} label="R" value="10 kΩ" labelSide="left" />
            <Wire points={[[80, 100], [80, 120]]} current={iDivider} scale={0.0004} />
            <Wire points={[[80, 110], [160, 110]]} />
            <Junction x={80} y={110} />
            <Label x={120} y={102} color={trace.voltage}>
              {fixed(v, 2)} V
            </Label>
            <Resistor x={80} y={150} rot={90} label="光敏电阻" value={formatSI(r, "Ω")} labelSide="left" color={LIGHT} />
            <Arrow from={[112, 132]} to={[98, 146]} color={LIGHT} />
            <Arrow from={[112, 148]} to={[98, 162]} color={LIGHT} />
            <Ground x={80} y={180} />

            <OpAmp x={200} y={124} plusOnTop label="比较器" />
            <Wire points={[[160, 138], [140, 138], [140, 166]]} />
            <Port x={140} y={166} side="bottom" label={`阈值 ${fixed(vth, 2)} V`} color={trace.good} />

            <Wire points={[[244, 124], [250, 124]]} current={lampOn ? 0.004 : 0} scale={0.005} />
            <Resistor x={280} y={124} value="330 Ω" />
            <Wire points={[[310, 124], [310, 130]]} current={lampOn ? 0.004 : 0} scale={0.005} />
            <Led x={310} y={160} rot={90} color="amber" brightness={lampOn ? 1 : 0} label="灯" labelSide="left" />
            <Ground x={310} y={190} />
          </Schematic>
          <Plot
            height={200}
            x={{ min: LUX_MIN, max: LUX_MAX, log: true, label: "光照 (lx)" }}
            y={{ min: 0, max: VCC, ticks: [0, 1, 2, 3], label: "分压输出 (V)" }}
            series={[{ fn: divider, label: "分压输出：越暗越高", color: trace.voltage }]}
            lines={[
              { y: vth, label: "阈值", color: trace.good },
              { x: luxSwitch, label: "开灯点" },
            ]}
            markers={[{ x: lux, y: v, label: `${fixed(v, 2)} V`, color: trace.voltage }]}
          />
        </div>
      </LabStage>
      <LabControls>
        <SliderField label="光照" value={lux} onChange={setLux} min={LUX_MIN} max={LUX_MAX} log format={(e) => `${sig(e)} lx`} color={LIGHT} />
        <SliderField label="比较器阈值" value={vth} onChange={setVth} min={0.3} max={3} step={0.05} format={(x) => `${fixed(x, 2)} V`} color={trace.good} />
      </LabControls>
      <LabReadouts>
        <Readout label="光敏电阻" value={formatSI(r, "Ω")} color={LIGHT} />
        <Readout label="分压输出" value={`${fixed(v, 2)} V`} color={trace.voltage} />
        <Readout label="开灯的照度" value={`约 ${sig(luxSwitch, 2)} lx`} sub="低于它就开灯" />
        <Readout label="灯" value={lampOn ? "亮" : "灭"} sub={lampOn ? "比较器输出高" : "比较器输出低"} />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

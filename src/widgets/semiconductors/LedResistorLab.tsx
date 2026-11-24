import * as React from "react"
import { Battery, ControlField, Lab, LabControls, LabNote, LabReadouts, LabStage, Label, Led, Plot, Readout, Resistor, Schematic, Segmented, SliderField, Wire, fixed, formatSI, percent, solveDiodeLoop, trace } from "@/lab"

type Hue = "red" | "green" | "blue" | "white"

/*
 * Each LED is a Shockley junction plus a little series resistance, pinned so
 * that it drops `vf` at 10 mA. Red then reads 1.76 V at 1 mA and 2.08 V at
 * 20 mA; blue / white 2.75 V and 3.15 V — the spread real parts show.
 */
const LEDS: Record<Hue, { name: string; vf: number; nVt: number; rs: number }> = {
  red: { name: "红", vf: 2.0, nVt: 0.05, rs: 5 },
  green: { name: "绿", vf: 2.2, nVt: 0.05, rs: 6 },
  blue: { name: "蓝", vf: 3.0, nVt: 0.07, rs: 10 },
  white: { name: "白", vf: 3.0, nVt: 0.07, rs: 10 },
}

/** Vf in the table above is quoted at this current; it is also the current the suggested resistor aims for. */
const I_NOM = 0.01
/** Rated continuous current of an ordinary indicator LED. */
const I_MAX = 0.02

function ledLoop(vs: number, r: number, led: { vf: number; nVt: number; rs: number }) {
  const is = I_NOM / (Math.exp((led.vf - I_NOM * led.rs) / led.nVt) - 1)
  const { vd, id } = solveDiodeLoop(vs, r + led.rs, is, led.nVt)
  return { i: id, v: vd + id * led.rs }
}

const E12 = [1, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2]

/** The smallest E12 value that is not below `v` (v > 0): rounding a current-limiting resistor up is the safe direction. */
function ceilE12(v: number): number {
  const decade = 10 ** Math.floor(Math.log10(v))
  for (const d of [decade, decade * 10]) {
    for (const b of E12) {
      const c = Number((b * d).toPrecision(3))
      if (c >= v * 0.999) return c
    }
  }
  return v
}

/** Supply + resistor + LED: pick the colour, set the resistor, see the current, the glow and what the resistor burns. */
export function LedResistorLab() {
  const [vs, setVs] = React.useState(5)
  const [r, setR] = React.useState(330)
  const [hue, setHue] = React.useState<Hue>("red")
  const led = LEDS[hue]

  const { i, v } = ledLoop(vs, r, led)
  const pr = i * i * r
  const headroom = vs - led.vf
  const suggested = headroom > 0 ? ceilE12(headroom / I_NOM) : null
  const over = i > I_MAX

  let tone: "neutral" | "good" | "warn" | "bad" = "neutral"
  let note: string
  if (over) {
    tone = "bad"
    note =
      i > 0.1
        ? `电流 ${formatSI(i, "A")}，是 20 mA 上限的 ${fixed(i / I_MAX, 0)} 倍，LED 会立刻烧毁。把电阻换大。`
        : i > 0.03
          ? `电流 ${formatSI(i, "A")}，远超 20 mA 的上限。LED 会过热、很快变暗，用不了多久就烧毁。把电阻换大。`
          : `电流 ${formatSI(i, "A")}，超过了 20 mA 的额定值。一时烧不掉，但 LED 发热变多、寿命缩短。把电阻换大一档。`
  } else if (i < 1e-4 && headroom <= 0) {
    tone = "warn"
    note = `电源只有 ${fixed(vs, 1)} V，比这颗 LED 的导通电压（约 ${fixed(led.vf, 1)} V）还低，电流几乎为 0，点不亮。换多小的电阻都没用。`
  } else if (i < 1e-3) {
    tone = "warn"
    note = `电流只有 ${formatSI(i, "A")}，LED 很暗，亮一点的环境里几乎看不出来。把电阻换小。`
  } else if (i < 5e-3) {
    note = `电流 ${formatSI(i, "A")}：不算亮，但做指示灯够用，还省电。`
  } else {
    tone = "good"
    note = `电流 ${formatSI(i, "A")}，落在 5–20 mA 之间，亮度合适。LED 自己占 ${fixed(v, 2)} V，电阻分担剩下的 ${fixed(vs - v, 2)} V。`
  }
  if (!over && i >= 1e-4 && headroom < 0.8) {
    if (tone === "good") tone = "neutral"
    note += "电源电压和 LED 的导通电压太接近，Vf 稍有偏差电流就差一大截，这种搭配亮度很难做一致。"
  }
  if (pr > 0.25) note += `电阻要耗 ${formatSI(pr, "W")}，普通的 1/4 W 电阻也会烧。`
  else if (pr > 0.1 && !over) note += `电阻要耗 ${formatSI(pr, "W")}，0603 贴片电阻（0.1 W）扛不住，要换大一号的封装。`

  return (
    <Lab
      title="LED 限流电阻实验台"
      hint="换电源电压和 LED 颜色，再调电阻：电流要落在 20 mA 以下。试试把电阻拖到最小。"
      onReset={() => {
        setVs(5)
        setR(330)
        setHue("red")
      }}
    >
      <LabStage>
        <div className="grid items-center gap-x-6 gap-y-4 @xl:grid-cols-[auto_minmax(0,1fr)]">
          {/*
           * Battery (40,100) vertical: + (40,70), − (40,130).
           * Resistor (125,40): terminals (95,40) / (155,40).
           * LED (210,100) vertical: anode (210,70), cathode (210,130); its glow reaches 26 px out.
           */}
          <Schematic width={260} height={190} label="电源、限流电阻和一颗 LED 串成的回路">
            <Wire points={[[40, 70], [40, 40], [95, 40]]} current={i} scale={0.02} />
            <Wire points={[[155, 40], [210, 40], [210, 70]]} current={i} scale={0.02} />
            <Wire points={[[210, 130], [210, 160], [40, 160], [40, 130]]} current={i} scale={0.02} />
            <Battery x={40} y={100} rot={90} label="电源" value={`${fixed(vs, 1)} V`} />
            <Resistor x={125} y={40} label={`R = ${formatSI(r, "Ω")}`} />
            <Led x={210} y={100} rot={90} color={hue} brightness={i / I_MAX} label="LED" value={`${fixed(v, 2)} V`} labelSide="left" />
            <Label x={125} y={180} color={over ? trace.power : trace.current}>
              I = {formatSI(i, "A")}
            </Label>
          </Schematic>
          <Plot
            height={220}
            ariaLabel="LED 电流随限流电阻变化的曲线"
            x={{ min: 10, max: 10000, log: true, label: "限流电阻 (Ω)" }}
            y={{ min: 0, max: 40, label: "LED 电流 (mA)" }}
            series={[{ fn: (rx) => ledLoop(vs, rx, led).i * 1000, label: `${fixed(vs, 1)} V 电源下${led.name}色 LED 的电流`, color: trace.current }]}
            // off-scale currents stay pinned to the top edge; the label still says the real value
            markers={[{ x: r, y: Math.min(i * 1000, 40), label: formatSI(i, "A"), color: over ? trace.power : trace.current }]}
            lines={[{ y: I_MAX * 1000, label: "上限 20 mA", color: trace.power }, ...(suggested != null ? [{ x: suggested, label: `推荐 ${formatSI(suggested, "Ω")}`, color: trace.good }] : [])]}
          />
        </div>
      </LabStage>
      <LabControls columns={3}>
        <SliderField label="电源电压" value={vs} onChange={setVs} min={1.5} max={12} step={0.1} format={(x) => `${fixed(x, 1)} V`} color={trace.voltage} />
        <SliderField label="限流电阻 R" value={r} onChange={setR} min={10} max={10000} log snap="E12" unit="Ω" />
        <ControlField label="LED 颜色">
          <Segmented
            aria-label="LED 颜色"
            value={hue}
            onValueChange={setHue}
            options={[
              { value: "red", label: "红" },
              { value: "green", label: "绿" },
              { value: "blue", label: "蓝" },
              { value: "white", label: "白" },
            ]}
          />
        </ControlField>
      </LabControls>
      <LabReadouts>
        <Readout label="LED 电流" value={formatSI(i, "A")} color={over ? trace.power : trace.current} />
        <Readout label="LED 两端电压" value={`${fixed(v, 2)} V`} color={trace.voltage} />
        <Readout label="亮度" value={percent(Math.min(1, i / I_MAX))} sub="以 20 mA 为 100%" />
        <Readout label="电阻功耗" value={formatSI(pr, "W")} color={trace.power} />
        <Readout label="推荐阻值" value={suggested != null ? formatSI(suggested, "Ω") : "—"} sub={suggested != null ? "按 10 mA 算，往大取标准值" : "电源电压不够点亮"} color={trace.good} />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

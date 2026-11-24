import * as React from "react"
import { catVar } from "@/lib/categorical"
import { ControlField, Lab, LabControls, LabNote, LabReadouts, LabStage, Label, Readout, Schematic, Segmented, SliderField, fixed, trace } from "@/lab"

type Family = "cmos33" | "cmos5" | "ttl5"

/*
 * Guaranteed levels of the three families a beginner meets (the usual JEDEC /
 * TI logic-level chart): inputs must see ≤ VIL for 0 and ≥ VIH for 1; outputs
 * promise ≤ VOL and ≥ VOH. `limit` is where an input pin's protection gives up:
 * about VCC + 0.3 V for a pin that is not 5 V tolerant.
 */
const FAMILIES: Record<Family, { name: string; vcc: number; vil: number; vih: number; vol: number; voh: number; limit: number }> = {
  cmos33: { name: "3.3 V CMOS", vcc: 3.3, vil: 0.8, vih: 2.0, vol: 0.4, voh: 2.4, limit: 3.6 },
  cmos5: { name: "5 V CMOS", vcc: 5, vil: 1.5, vih: 3.5, vol: 0.5, voh: 4.44, limit: 5.5 },
  ttl5: { name: "5 V TTL", vcc: 5, vil: 0.8, vih: 2.0, vol: 0.4, voh: 2.4, limit: 5.5 },
}

const OPTIONS: { value: Family; label: string }[] = [
  { value: "cmos33", label: "3.3 V CMOS" },
  { value: "cmos5", label: "5 V CMOS" },
  { value: "ttl5", label: "5 V TTL" },
]

const V_MAX = 5
const LOW = catVar("gray")
const WARN = "var(--warning)"
const BAD = "var(--destructive)"

// canvas: 300 × 228. Voltage runs up the page: 0 V at y = 214, 5 V at y = 24.
const yOf = (v: number) => 214 - 38 * v
const OUT_X = 82 // output bar: x 82…118
const IN_X = 176 // input bar: x 176…212
const BAR_W = 36

/** "2.0 V", "4.44 V": one decimal unless the spec needs two. */
const volts = (v: number) => `${fixed(v, Math.abs(v * 10 - Math.round(v * 10)) < 1e-9 ? 1 : 2)} V`

/** A filled band of a level bar between two voltages. */
function Band({ x, from, to, color, text }: { x: number; from: number; to: number; color: string; text?: string }) {
  const top = yOf(to)
  const h = yOf(from) - top
  return (
    <>
      <rect x={x} y={top} width={BAR_W} height={h} fill={color} fillOpacity={0.24} stroke="none" />
      {text && h >= 16 && (
        <Label x={x + BAR_W / 2} y={top + h / 2 + 4.5} weight={600}>
          {text}
        </Label>
      )}
    </>
  )
}

/**
 * The logic-level chart as a live picture: what an output of the family
 * guarantees (left bar) against what its input accepts (right bar), with a
 * pointer for the voltage actually arriving at the input.
 */
export function LogicLevelLab() {
  const [v, setV] = React.useState(3.3)
  const [family, setFamily] = React.useState<Family>("cmos5")
  const f = FAMILIES[family]
  const verdict = v > f.limit ? "over" : v >= f.vih ? "high" : v <= f.vil ? "low" : "unsure"
  const pointer = { over: BAD, high: trace.voltage, low: "var(--foreground)", unsure: WARN }[verdict]
  const verdictText = { over: "超过上限", high: "逻辑 1", low: "逻辑 0", unsure: "不确定" }[verdict]
  const inTop = Math.min(f.limit, V_MAX)
  const py = yOf(v)
  // 3.3 V parts put out about 2.4–3.3 V for a 1: exactly the range a 5 V CMOS input cannot promise to read
  const mixed = family === "cmos5" && verdict === "unsure" && v >= 2.4
  return (
    <Lab
      title="逻辑电平刻度"
      hint="拖动输入电压，看它被认作 0、1，还是落进不确定区。再换一个逻辑系列，门槛会跟着变。"
      onReset={() => {
        setV(3.3)
        setFamily("cmos5")
      }}
    >
      <LabStage>
        <Schematic width={300} height={228} label={`${f.name} 的逻辑电平：输出保证的范围和输入认可的范围，以及当前输入电压 ${fixed(v, 2)} V`}>
          <Label x={OUT_X + BAR_W / 2} y={14} muted>
            输出保证
          </Label>
          <Label x={IN_X + BAR_W / 2} y={14} muted>
            输入认作
          </Label>
          {/* output bar: 0…VCC, with the two guaranteed bands */}
          <Band x={OUT_X} from={0} to={f.vol} color={LOW} />
          <Band x={OUT_X} from={f.voh} to={f.vcc} color={trace.voltage} />
          <rect x={OUT_X} y={yOf(f.vcc)} width={BAR_W} height={yOf(0) - yOf(f.vcc)} stroke="var(--input)" />
          {[
            { at: f.vcc, text: `VCC ${fixed(f.vcc, f.vcc === 5 ? 0 : 1)} V` },
            { at: f.voh, text: `VOH ${volts(f.voh)}` },
            { at: f.vol, text: `VOL ${volts(f.vol)}` },
          ].map((m) => (
            <g key={m.text}>
              <path d={`M${OUT_X - 5} ${yOf(m.at)}H${OUT_X}`} />
              <Label x={OUT_X - 8} y={yOf(m.at) + 4.5} anchor="end" muted>
                {m.text}
              </Label>
            </g>
          ))}
          {/* input bar: 0…5 V, cut into "0", undefined, "1" and (for 3.3 V parts) the over-voltage zone */}
          <Band x={IN_X} from={0} to={f.vil} color={LOW} text="0" />
          <Band x={IN_X} from={f.vil} to={f.vih} color={WARN} text="不定" />
          <Band x={IN_X} from={f.vih} to={inTop} color={trace.voltage} text="1" />
          {inTop < V_MAX && <Band x={IN_X} from={inTop} to={V_MAX} color={BAD} text="超限" />}
          <rect x={IN_X} y={yOf(V_MAX)} width={BAR_W} height={yOf(0) - yOf(V_MAX)} stroke="var(--input)" />
          {[
            ...(inTop < V_MAX ? [{ at: inTop, text: `上限 ${volts(inTop)}` }] : []),
            { at: f.vih, text: `VIH ${volts(f.vih)}` },
            { at: f.vil, text: `VIL ${volts(f.vil)}` },
          ].map((m) => (
            <g key={m.text}>
              <path d={`M${IN_X + BAR_W} ${yOf(m.at)}H${IN_X + BAR_W + 5}`} />
              <Label x={IN_X + BAR_W + 8} y={yOf(m.at) + 4.5} anchor="start" muted>
                {m.text}
              </Label>
            </g>
          ))}
          {/* the voltage arriving at the input: an arrow from the gap into the input bar */}
          <path d={`M124 ${py}H${IN_X - 7}`} stroke={pointer} strokeWidth={2.25} />
          <path d={`M${IN_X - 9} ${py - 5}L${IN_X} ${py}L${IN_X - 9} ${py + 5}Z`} fill={pointer} stroke={pointer} strokeWidth={1} />
          <Label x={146} y={py < 60 ? py + 17 : py - 7} color={pointer} weight={600}>
            {fixed(v, 2)} V
          </Label>
        </Schematic>
      </LabStage>
      <LabControls columns={1}>
        <SliderField label="输入电压" value={v} onChange={setV} min={0} max={V_MAX} step={0.05} format={(x) => `${fixed(x, 2)} V`} color={trace.voltage} />
        <ControlField label="接收这个电压的芯片">
          <Segmented size="sm" value={family} onValueChange={setFamily} options={OPTIONS} aria-label="逻辑系列" />
        </ControlField>
      </LabControls>
      <LabReadouts>
        <Readout label="输入电压" value={`${fixed(v, 2)} V`} color={trace.voltage} />
        <Readout label="被认作" value={verdictText} />
        <Readout label="低电平噪声容限" value={`${fixed(f.vil - f.vol, 2)} V`} sub="VIL − VOL" />
        <Readout label="高电平噪声容限" value={`${fixed(f.voh - f.vih, 2)} V`} sub="VOH − VIH" />
      </LabReadouts>
      <LabNote tone={verdict === "over" ? "bad" : verdict === "unsure" ? "warn" : "neutral"}>
        {verdict === "over"
          ? `${fixed(v, 2)} V 超过了 ${volts(f.limit)} 的上限（电源电压加 0.3 V）。不耐 5 V 的引脚会被灌进电流，可能损坏。5 V 的信号要先分压或做电平转换。`
          : verdict === "high"
            ? `${fixed(v, 2)} V 不低于 VIH（${volts(f.vih)}），${f.name} 的输入保证把它认作 1。`
            : verdict === "low"
              ? `${fixed(v, 2)} V 不高于 VIL（${volts(f.vil)}），${f.name} 的输入保证把它认作 0。`
              : mixed
                ? `${fixed(v, 2)} V 落在不确定区。3.3 V 芯片输出的高电平（2.4–3.3 V）正好在这里：5 V CMOS 的输入要 ${volts(f.vih)} 以上才保证认作 1。`
                : `${fixed(v, 2)} V 落在 VIL 和 VIH 之间：芯片不保证认成 0 还是 1，输出可能乱跳，输入级还会额外耗电。`}
      </LabNote>
    </Lab>
  )
}

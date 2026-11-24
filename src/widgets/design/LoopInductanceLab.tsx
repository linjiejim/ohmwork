import * as React from "react"
import { Lab, LabControls, LabNote, LabReadouts, LabStage, Label, Plot, Readout, Schematic, SliderField, Wire, formatSI, percent, sig, trace } from "@/lab"

/*
 * A decoupling capacitor at distance d from a chip's supply pin.
 *   loop inductance  L ≈ 1 nH per mm of distance   (rule of thumb, a rough estimate)
 *   spike on the pin V = L · di/dt,  di = 100 mA switching in t_r
 */
const NH_PER_MM = 1
const DI = 0.1
const VDD = 3.3

/** Pads are drawn neutral so they never read as part of the coloured loop. */
const PAD = "var(--muted-foreground)"

/** Spike in volts for a distance in mm and an edge time in ns. */
const spike = (d: number, tr: number) => (NH_PER_MM * d * 1e-9 * DI) / (tr * 1e-9)

/** How far the decoupling capacitor sits from the pin decides how big the supply spike is. */
export function LoopInductanceLab() {
  const [d, setD] = React.useState(10)
  const [tr, setTr] = React.useState(5)

  const lNh = NH_PER_MM * d
  const v = spike(d, tr)
  const ratio = v / VDD
  const tone = ratio <= 0.05 ? "good" : ratio <= 0.1 ? "warn" : "bad"
  const loopColor = tone === "good" ? trace.good : tone === "warn" ? "var(--warning)" : "var(--destructive)"

  /*
   * Picture (340 × 168), top view:
   *   chip body 252..316 × 38..122; its VDD pin ends at (242, 62), its GND pin at (242, 98).
   *   capacitor: right edge xr = 242 − (6 + 5.4·d), centre cx = xr − 10   (d = 1 → cx 220.6, d = 30 → cx 64)
   *     pads cx±10 × 54..68 (VDD) and 92..106 (GND), body cx±8 × 68..92
   *   loop: (cx, 62) → (262, 62) → (262, 98) → (cx, 98) → back up through the capacitor
   *   supply comes in from the top at (cx, 16); ground via at (cx, 119)
   *   dimension line at y = 140 from xr to 242, text at y = 158
   */
  const xr = 242 - (6 + 5.4 * d)
  const cx = xr - 10
  const note =
    tone === "good"
      ? `电容离电源脚 ${d} mm，回路电感约 ${sig(lNh, 3)} nH。100 mA 在 ${tr} ns 里跳变，只激起 ${formatSI(v, "V")} 的尖峰，不到 3.3 V 的 5%，芯片感觉不到。`
      : tone === "warn"
        ? `尖峰 ${formatSI(v, "V")}，超过了 3.3 V 的 5%。电流跳变的那几纳秒里，电只能从这颗电容来，却被 ${d} mm 走线的电感挡了一下。把电容再挪近些。`
        : `尖峰 ${formatSI(v, "V")}，是 3.3 V 的 ${percent(ratio)}。电源脚上这样晃，逻辑电平会被搅乱，ADC 读数乱跳，严重时芯片复位。${v > VDD ? "按公式算已经超过了电源电压，实际上电压早被拉垮了。" : ""}这颗电容离得太远，等于没放。`

  return (
    <Lab
      title="去耦电容离多远"
      hint="把电容拉远、把电流跳变调快，看电源脚上的尖峰。回路电感按每毫米约 1 nH 粗略估算。"
      onReset={() => {
        setD(10)
        setTr(5)
      }}
    >
      <LabStage>
        <div className="grid items-center gap-x-6 gap-y-4 @2xl:grid-cols-[auto_minmax(0,1fr)]">
          <Schematic width={340} height={168} minScale={0.8} label={`俯视图：去耦电容离芯片电源脚 ${d} mm，电容、电源脚和地脚围成一个电流回路`}>
            {/* the loop: tinted area, then the path the fast current takes */}
            <rect x={cx} y={62} width={262 - cx} height={36} fill={loopColor} opacity={0.14} stroke="none" />
            <Wire points={[[cx, 62], [262, 62], [262, 98], [cx, 98], [cx, 62]]} current={1} scale={1} color={loopColor} width={3} />
            {/* supply coming in, and the capacitor's ground via */}
            <path d={`M${cx} 16V54M${cx} 106V114`} />
            <circle cx={cx} cy={119} r={5} fill="var(--background)" />
            <circle cx={cx} cy={119} r={1.5} fill="currentColor" stroke="none" />
            <Label x={cx + 8} y={28} anchor="start" color={trace.voltage}>
              3.3 V
            </Label>
            <Label x={cx - 10} y={123.5} anchor="end" muted>
              地孔
            </Label>
            {/* capacitor: two pads and the body */}
            <rect x={cx - 10} y={54} width={20} height={14} fill={PAD} stroke="none" />
            <rect x={cx - 10} y={92} width={20} height={14} fill={PAD} stroke="none" />
            <rect x={cx - 8} y={68} width={16} height={24} fill="var(--background)" strokeWidth={1.25} />
            <Label x={cx} y={84.5} size={12}>
              C
            </Label>
            {/* chip */}
            <path d="M316 56H326M316 80H326M316 104H326" />
            <rect x={252} y={38} width={64} height={84} rx={3} fill="var(--background)" />
            <Label x={258} y={66.5} anchor="start" size={12} muted>
              VDD
            </Label>
            <Label x={258} y={102.5} anchor="start" size={12} muted>
              GND
            </Label>
            <Label x={294} y={86} weight={600}>
              芯片
            </Label>
            {d >= 10 && (
              <Label x={(cx + 10 + 242) / 2} y={84.5} color={loopColor}>
                电流回路
              </Label>
            )}
            {/* distance */}
            <path d={`M${xr} 140H242M${xr} 134V146M242 134V146`} stroke="var(--muted-foreground)" strokeWidth={1.25} />
            <Label x={(xr + 242) / 2} y={160} muted>
              d = {d} mm
            </Label>
          </Schematic>
          <Plot
            height={210}
            x={{ min: 0, max: 30, label: "电容到电源脚的距离 (mm)" }}
            y={{ min: 0, max: 1000, label: "电压尖峰 (mV)" }}
            series={[{ fn: (x) => spike(x, tr) * 1000, label: `100 mA 在 ${tr} ns 内跳变`, color: trace.voltage }]}
            lines={[
              { y: 165, label: "3.3 V 的 5%" },
              { y: 330, label: "10%" },
            ]}
            markers={[{ x: d, y: Math.min(v * 1000, 1000), label: v > 1 ? `${formatSI(v, "V")}（超出图外）` : formatSI(v, "V"), color: trace.voltage }]}
          />
        </div>
      </LabStage>
      <LabControls>
        <SliderField label="电容到电源脚的距离 d" value={d} onChange={setD} min={1} max={30} step={1} format={(x) => `${x} mm`} />
        <SliderField label="电流跳变用的时间" value={tr} onChange={setTr} min={1} max={10} step={0.5} format={(x) => `${x} ns`} />
      </LabControls>
      <LabReadouts>
        <Readout label="回路电感（粗估）" value={`约 ${sig(lNh, 3)} nH`} />
        <Readout label="电流变化率" value={`${sig((DI / tr) * 1000, 3)} A/μs`} sub={`100 mA ÷ ${tr} ns`} color={trace.current} />
        <Readout label="电源脚上的尖峰" value={formatSI(v, "V")} sub={`3.3 V 的 ${percent(ratio, ratio < 0.1 ? 1 : 0)}`} color={trace.voltage} />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

import * as React from "react"
import { Battery, Junction, Lab, LabControls, LabNote, LabReadouts, LabStage, Label, Plot, Readout, Resistor, Schematic, SliderField, Switch, SwitchField, Wire, formatSI, parallel, percent, sig, trace } from "@/lab"

/** Current that reads as "fast": the starting divider draws 167 μA unloaded and 300 μA loaded. */
const SCALE = 0.0005
/** Rating of an ordinary through-hole resistor, for the "these values are too small" warning. */
const RATED = 0.25

/**
 * Two-resistor divider with a switchable load. Unloaded: Vout = Vin·R2 / (R1 + R2).
 * Loaded: R2 is replaced by R2 ∥ RL. The plot shows the output sagging as the load gets heavier.
 */
export function VoltageDividerLab() {
  const [vin, setVin] = React.useState(5)
  const [r1, setR1] = React.useState(10000)
  const [r2, setR2] = React.useState(20000)
  const [load, setLoad] = React.useState(false)
  const [rl, setRl] = React.useState(10000)

  const ratioAt = (rLoad: number) => {
    const low = parallel(r2, rLoad)
    return low / (r1 + low)
  }
  const openRatio = r2 / (r1 + r2)
  const ratio = load ? ratioAt(rl) : openRatio
  const vOpen = vin * openRatio
  const vOut = vin * ratio
  const i1 = (vin - vOut) / r1
  const i2 = vOut / r2
  const iL = load ? vOut / rl : 0
  const drop = vOpen - vOut
  const dropShare = 1 - ratio / openRatio // openRatio > 0 because R2 ≥ 100 Ω
  const p1 = (vin - vOut) * i1
  const p2 = vOut * i2
  const hot = p1 > RATED || p2 > RATED

  let tone: "neutral" | "good" | "warn" | "bad" = "neutral"
  let note: string
  if (!load) {
    note = `空载：Vout = ${formatSI(vin, "V")} × ${formatSI(r2, "Ω")} ÷ (${formatSI(r1, "Ω")} + ${formatSI(r2, "Ω")}) = ${formatSI(vOpen, "V")}。打开「接上负载」，看它还稳不稳。`
  } else if (dropShare <= 0.1) {
    // RL ≥ 10·R2 always lands here (the sag is then at most 1/11); so does a small R1, whatever R2 is
    tone = "good"
    const sag = `Vout 只被拉低 ${formatSI(drop, "V")}（${dropShare < 0.001 ? "不到 0.1%" : percent(dropShare, 1)}）`
    note =
      rl >= 10 * r2
        ? `负载 ${formatSI(rl, "Ω")} 是 R2 的 ${sig(rl / r2, 2)} 倍，${sag}，基本不受影响。`
        : `${sag}。负载不到 R2 的 10 倍，但 R1 和 R2 的并联值只有 ${formatSI(parallel(r1, r2), "Ω")}，比负载小得多，所以扛得住。`
  } else if (dropShare < 0.5) {
    tone = "warn"
    note = `负载 ${formatSI(rl, "Ω")} 和 R2 并联后只剩 ${formatSI(parallel(r2, rl), "Ω")}，Vout 从 ${formatSI(vOpen, "V")} 被拉低到 ${formatSI(vOut, "V")}，少了 ${percent(dropShare)}。负载电阻比 R2 大 10 倍以上才稳。`
  } else {
    tone = "bad"
    const left = 1 - dropShare
    note = `负载 ${formatSI(rl, "Ω")} 太重：它和 R2 并联后只剩 ${formatSI(parallel(r2, rl), "Ω")}，Vout 从 ${formatSI(vOpen, "V")} 掉到 ${formatSI(vOut, "V")}，只剩空载时的 ${percent(left, left < 0.1 ? 1 : 0)}。这个分压器带不动它。`
  }
  if (hot) {
    tone = "bad"
    note += `另外，${p1 >= p2 ? "R1" : "R2"} 自己要耗掉 ${formatSI(Math.max(p1, p2), "W")}，超过常见电阻的 1/4 W：阻值取得太小了。`
  }

  return (
    <Lab
      title="分压器实验台"
      hint="先调 R1 和 R2，看 Vout 怎么跟着比值变。再接上负载，看它被拉低多少。"
      onReset={() => {
        setVin(5)
        setR1(10000)
        setR2(20000)
        setLoad(false)
        setRl(10000)
      }}
    >
      <LabStage>
        {/* the schematic is 320 wide, so the plot only sits beside it at full lesson width */}
        <div className="grid items-center gap-x-6 gap-y-4 @2xl:grid-cols-[auto_minmax(0,1fr)]">
          {/*
            Battery (60, 120): + at (60, 90), − at (60, 150); its text is on the left.
            R1 (180, 80): 50…110.  Output node (180, 120).  R2 (180, 160): 130…190.  Ground rail y = 210.
            Switch (240, 120): 210…270.  Load (300, 160): 130…190, fed from (300, 120).
            Text left of each resistor ends at x − 16: R1 / R2 at 164, load at 284. Vout sits left of the node.
          */}
          <Schematic width={320} height={225} label="R1 和 R2 串联分压，输出端经开关接到负载">
            <Label x={120} y={28} color={trace.current}>
              I1 = {formatSI(i1, "A")}
            </Label>
            <Wire points={[[60, 90], [60, 40], [180, 40], [180, 50]]} current={i1} scale={SCALE} />
            <Wire points={[[180, 110], [180, 120]]} current={i1} scale={SCALE} />
            <Wire points={[[180, 120], [180, 130]]} current={i2} scale={SCALE} />
            <Wire points={[[180, 190], [180, 210]]} current={i2} scale={SCALE} />
            <Wire points={[[180, 210], [60, 210], [60, 150]]} current={i1} scale={SCALE} />
            <Wire points={[[180, 120], [210, 120]]} current={iL} scale={SCALE} />
            <Wire points={[[270, 120], [300, 120], [300, 130]]} current={iL} scale={SCALE} />
            <Wire points={[[300, 190], [300, 210], [180, 210]]} current={iL} scale={SCALE} />
            <Junction x={180} y={120} />
            <Junction x={180} y={210} />
            <Battery x={60} y={120} rot={90} label="Vin" value={formatSI(vin, "V")} labelSide="left" />
            <Resistor x={180} y={80} rot={90} label="R1" value={formatSI(r1, "Ω")} labelSide="left" />
            <Label x={196} y={84.5} anchor="start" color={trace.voltage}>
              压降 {formatSI(vin - vOut, "V")}
            </Label>
            <Resistor x={180} y={160} rot={90} label="R2" value={formatSI(r2, "Ω")} labelSide="left" />
            <Label x={164} y={187} anchor="end" color={trace.current}>
              I2 = {formatSI(i2, "A")}
            </Label>
            <Label x={164} y={117} anchor="end" color={trace.voltage} weight={500}>
              Vout
            </Label>
            <Label x={164} y={132} anchor="end" color={trace.voltage} weight={500}>
              {formatSI(vOut, "V")}
            </Label>
            <Switch x={240} y={120} closed={load} onClick={() => setLoad((on) => !on)} ariaLabel={load ? "断开负载" : "接上负载"} />
            <Resistor x={300} y={160} rot={90} label="负载" value={formatSI(rl, "Ω")} labelSide="left" dim={!load} />
            <Label x={284} y={187} anchor="end" color={load ? trace.current : undefined} muted={!load}>
              IL = {formatSI(iL, "A")}
            </Label>
          </Schematic>
          <Plot
            height={215}
            x={{ min: 100, max: 1e6, log: true, label: "负载电阻 (Ω)" }}
            y={{ min: 0, max: 100, label: "Vout ÷ Vin (%)", format: (y) => `${sig(y, 3)}%` }}
            series={[
              { fn: (x) => ratioAt(x) * 100, label: "接上负载后的输出", color: trace.voltage },
              // the unloaded level is a series, not a labelled reference line: its label would land on the "10 × R2" one
              { fn: () => openRatio * 100, label: "空载时的输出", color: trace.ref, dashed: true },
            ]}
            lines={[{ x: 10 * r2, label: "10 × R2" }]}
            markers={load ? [{ x: rl, y: ratio * 100, label: formatSI(vOut, "V"), color: trace.voltage }] : []}
          />
        </div>
      </LabStage>
      <LabControls columns={3}>
        <SliderField label="输入电压 Vin" value={vin} onChange={setVin} min={1} max={12} step={0.1} unit="V" color={trace.voltage} />
        <SliderField label="上面的电阻 R1" value={r1} onChange={setR1} min={100} max={100000} log snap="E24" unit="Ω" />
        <SliderField label="下面的电阻 R2" value={r2} onChange={setR2} min={100} max={100000} log snap="E24" unit="Ω" />
        <SwitchField label="接上负载" checked={load} onChange={setLoad} hint="也可以点电路图里的开关" />
        <SliderField label="负载电阻 RL" value={rl} onChange={setRl} min={100} max={1000000} log snap="E12" unit="Ω" disabled={!load} />
      </LabControls>
      <LabReadouts>
        <Readout label="空载 Vout" value={formatSI(vOpen, "V")} color={trace.ref} sub={`Vin 的 ${percent(openRatio, 1)}`} />
        <Readout label="带载 Vout" value={load ? formatSI(vOut, "V") : "未接负载"} color={trace.voltage} sub={load ? `Vin 的 ${percent(ratio, 1)}` : undefined} />
        <Readout label="被负载拉低" value={load ? formatSI(drop, "V") : "0 V"} sub={load ? (dropShare < 0.001 ? "不到 0.1%" : `少了 ${percent(dropShare, 1)}`) : undefined} />
        <Readout label="电源电流 I1 = I2 + IL" value={formatSI(i1, "A")} color={trace.current} sub={`${formatSI(i2, "A")} + ${formatSI(iL, "A")}`} />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

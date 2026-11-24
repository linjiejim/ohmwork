import * as React from "react"
import {
  Battery,
  Capacitor,
  ControlField,
  Junction,
  Lab,
  LabControls,
  LabNote,
  LabReadouts,
  LabStage,
  Label,
  PlayButton,
  Plot,
  Readout,
  Resistor,
  Schematic,
  Segmented,
  SliderField,
  Wire,
  clamp,
  fixed,
  formatSI,
  percent,
  trace,
  useFrame,
  usePlayback,
} from "@/lab"

const VS = 5
/** Seconds shown on the plot. The animation runs in real time: one second on screen is one second in the circuit. */
const WINDOW = 5
/** After this many time constants the capacitor is within 0.04% of its final voltage: stop the clock. */
const SETTLED = 8

type Mode = "charge" | "discharge"

/**
 * A capacitor charged and discharged through a resistor, in real time.
 * Model: Vc(t) = target + (V0 − target)·e^(−t/RC), I = (target − Vc) / R, where V0 is
 * the capacitor voltage at the moment the switch was thrown (it cannot jump).
 * Moving a slider reruns the experiment from the same starting voltage.
 */
export function RcChargeLab() {
  const [r, setR] = React.useState(10_000)
  const [c, setC] = React.useState(100e-6)
  const [mode, setMode] = React.useState<Mode>("charge")
  /** Capacitor voltage when this run started. */
  const [v0, setV0] = React.useState(0)
  /** Seconds since this run started. */
  const [elapsed, setElapsed] = React.useState(0)
  const playback = usePlayback()

  const tau = r * c
  const charging = mode === "charge"
  const target = charging ? VS : 0
  const limit = Math.max(WINDOW, SETTLED * tau)
  useFrame((dt) => setElapsed((e) => Math.min(limit, e + dt)), playback.playing && elapsed < limit)

  const curve = (t: number) => target + (v0 - target) * Math.exp(-t / tau)
  const settled = elapsed >= SETTLED * tau
  const vc = settled ? target : curve(elapsed)
  const iStart = VS / r
  /** Current into the capacitor: positive while charging, negative while it discharges. */
  const iRaw = (target - vc) / r
  const i = Math.abs(iRaw) < iStart * 1e-3 ? 0 : iRaw
  // a bigger resistor means visibly slower dots, but every run still shows them slowing to a stop
  const dotScale = iStart / clamp(Math.sqrt(10_000 / r), 0.4, 1.6)

  const restart = () => setElapsed(0)
  const throwSwitch = (next: Mode) => {
    if (next === mode) return
    setV0(vc)
    setMode(next)
    setElapsed(0)
  }

  const shown = Math.min(elapsed, WINDOW)
  const traced: [number, number][] = shown > 0 ? Array.from({ length: 121 }, (_, k) => [(shown * k) / 120, curve((shown * k) / 120)]) : [[0, v0]]
  const done = elapsed >= 5 * tau
  const slow = tau > 1.0001
  const pace = slow
    ? `τ = ${formatSI(tau, "s")}，要等 5τ ≈ ${formatSI(5 * tau, "s", 2)} 才算${charging ? "充满" : "放完"}，这张图只画前 ${WINDOW} 秒。`
    : tau < 0.05
      ? `τ 只有 ${formatSI(tau, "s")}，对肉眼来说就是一瞬间。`
      : ""

  return (
    <Lab
      title="RC 充放电实验台"
      hint="动画按真实时间播放。把开关拨到「放电」再拨回来，或者调 R 和 C，看曲线变快还是变慢。"
      actions={<PlayButton playback={playback} />}
      onReset={() => {
        setR(10_000)
        setC(100e-6)
        setMode("charge")
        setV0(0)
        setElapsed(0)
      }}
    >
      <LabStage>
        <div className="grid items-center gap-x-6 gap-y-4 @xl:grid-cols-[auto_minmax(0,1fr)]">
          {/*
            Battery (40,110) vertical: + (40,80), − (40,140).
            Switch: 充电 contact (110,37), 放电 contact (110,63), common (150,50).
            R (200,50) horizontal: (170,50) – (230,50). C (260,110) vertical: (260,80) – (260,140).
            Bottom rail y = 170; the 放电 contact joins it at (90,170).
          */}
          <Schematic width={300} height={190} label="电源经过一个单刀双掷开关和电阻 R 给电容 C 充电；开关拨到另一边时，电容经过 R 放电">
            <Wire points={[[40, 80], [40, 37], [107.5, 37]]} current={charging ? i : 0} scale={dotScale} />
            <Wire points={[[107.5, 63], [90, 63], [90, 170]]} current={charging ? 0 : -i} scale={dotScale} />
            <Wire points={[[152.5, 50], [170, 50]]} current={i} scale={dotScale} />
            <Wire points={[[230, 50], [260, 50], [260, 80]]} current={i} scale={dotScale} />
            <Wire points={[[260, 140], [260, 170], [90, 170]]} current={i} scale={dotScale} />
            <Wire points={[[90, 170], [40, 170], [40, 140]]} current={charging ? i : 0} scale={dotScale} />
            <Junction x={90} y={170} />
            <Battery x={40} y={110} rot={90} label={`${VS} V`} />
            <Resistor x={200} y={50} label="R" value={formatSI(r, "Ω")} />
            <Capacitor x={260} y={110} rot={90} label="C" value={formatSI(c, "F")} labelSide="left" />
            <Label x={240} y={141} anchor="end" color={trace.voltage}>
              Vc = {fixed(vc, 2)} V
            </Label>
            {/* how full the capacitor is */}
            <rect x={279} y={80 + 60 * (1 - clamp(vc / VS, 0, 1))} width={8} height={60 * clamp(vc / VS, 0, 1)} fill={trace.voltage} stroke="none" />
            <rect x={278} y={80} width={10} height={60} strokeWidth={1.25} />
            {/* the changeover switch: click it, or use the control below */}
            <g
              role="button"
              tabIndex={0}
              aria-label={charging ? "把开关拨到放电" : "把开关拨到充电"}
              className="cursor-pointer outline-none focus-visible:[&_.part-hit]:stroke-ring"
              onClick={() => throwSwitch(charging ? "discharge" : "charge")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  throwSwitch(charging ? "discharge" : "charge")
                }
              }}
            >
              <rect className="part-hit" x={98} y={28} width={64} height={44} rx={6} fill="transparent" stroke="transparent" />
              <Wire points={charging ? [[112.4, 37.8], [147.6, 49.2]] : [[112.4, 62.2], [147.6, 50.8]]} current={i} scale={dotScale} />
              <circle cx={110} cy={37} r={2.5} />
              <circle cx={110} cy={63} r={2.5} />
              <circle cx={150} cy={50} r={2.5} />
            </g>
            <Label x={110} y={27} muted={!charging}>
              充电
            </Label>
            <Label x={118} y={80} muted={charging}>
              放电
            </Label>
          </Schematic>
          <Plot
            height={230}
            x={{ min: 0, max: WINDOW, label: "时间 (s)" }}
            y={{ min: 0, max: 6, label: "电容电压 (V)" }}
            series={[
              { fn: () => VS, label: `电源 ${VS} V`, color: trace.ref, dashed: true, width: 1.5 },
              { fn: curve, label: "公式算出的整条曲线", color: trace.voltage, dashed: true, width: 1.5 },
              { points: traced, label: "已经走过的部分", color: trace.voltage, width: 2.5 },
            ]}
            lines={[{ x: tau, label: `τ = ${formatSI(tau, "s")}` }, ...(tau >= 0.4 ? [{ x: 5 * tau, label: "5τ" }] : [])]}
            markers={[
              { x: tau, y: curve(tau), label: "1τ：走完 63%" },
              { x: shown, y: curve(shown), color: trace.voltage },
            ]}
          />
        </div>
      </LabStage>
      <LabControls columns={3}>
        <SliderField
          label="电阻 R"
          value={r}
          onChange={(v) => {
            setR(v)
            restart()
          }}
          min={1000}
          max={100_000}
          log
          snap="E12"
          unit="Ω"
        />
        <SliderField
          label="电容 C"
          value={c}
          onChange={(v) => {
            setC(v)
            restart()
          }}
          min={10e-6}
          max={470e-6}
          log
          snap="E12"
          unit="F"
        />
        <ControlField label="开关拨到">
          <Segmented
            aria-label="开关位置"
            value={mode}
            onValueChange={throwSwitch}
            options={[
              { value: "charge", label: "充电" },
              { value: "discharge", label: "放电" },
            ]}
          />
        </ControlField>
      </LabControls>
      <LabReadouts>
        <Readout label="时间常数 τ = RC" value={formatSI(tau, "s")} />
        <Readout label="已过时间" value={`${fixed(elapsed, 1)} s`} sub={`${fixed(elapsed / tau, 1)} 个 τ`} />
        <Readout label="电容电压" value={`${fixed(vc, 2)} V`} sub={`电源的 ${percent(vc / VS)}`} color={trace.voltage} />
        <Readout label={charging ? "充电电流" : "放电电流"} value={formatSI(Math.abs(i), "A")} color={trace.current} />
      </LabReadouts>
      <LabNote tone={done ? "good" : slow ? "warn" : "neutral"}>
        {charging
          ? done
            ? "过了 5τ，电容电压和电源相差不到 1%，可以当它充满了：电流几乎为 0，电容对直流相当于断开。"
            : `正在充电。电容电压越接近电源，电阻两端的压差越小，电流也越小，所以曲线越走越平。${pace}`
          : done
            ? "放完了：电容电压回到 0，电流也停了。"
            : `正在放电。电容电压从拨开关那一刻的值往下掉，不会跳变；电压越低，放电电流越小。${pace}`}
      </LabNote>
    </Lab>
  )
}

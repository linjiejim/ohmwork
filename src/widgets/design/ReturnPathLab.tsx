import * as React from "react"
import { catVar } from "@/lib/categorical"
import { Lab, LabControls, LabNote, LabReadouts, LabStage, Label, Readout, Schematic, SliderField, SwitchField, Wire, formatSI, percent, trace, type Pt } from "@/lab"

/*
 * Where does the return current flow in a ground plane? A qualitative sketch,
 * not a field solver. The share that hugs the trace follows the usual
 * "inductive part of an impedance" curve,
 *
 *   s = x / √(1 + x²),   x = f / f_c,   f_c ≈ 30 kHz
 *
 * so the plane is resistive (straight-line return) at 1 kHz and inductive
 * (return under the trace) by 1 MHz, which is the order of magnitude seen on
 * real boards.
 *
 * Canvas 320 × 220, top view:
 *   plane 10..310 × 10..210
 *   driver A box 48..72 × 158..182 (centre 60, 170); receiver B box 248..272 × 158..182 (centre 260, 170)
 *   signal trace (top layer): (60, 158) → (60, 60) → (260, 60) → (260, 158)
 *   low-frequency return: seven arcs from B to A, bulging to y = 170 ± 10, ± 20, ± 30 at mid-span (140..200)
 *   high-frequency return: the trace's path backwards, drawn as a 12 px band under it
 *   slot in the plane: x 156..164, y 10..106; the band then dips around its end through (160, 124)
 */
const FC = 30e3
const PLANE = catVar("amber", true)

const ARCS = [-3, -2, -1, 0, 1, 2, 3].map((k) => ({
  k,
  // quadratic Bézier from B (260, 170) to A (60, 170), control point (160, 170 + 20k)
  points: Array.from({ length: 21 }, (_, n): Pt => {
    const t = n / 20
    return [260 - 200 * t, 170 + 40 * k * t * (1 - t)]
  }),
}))

const UNDER_TRACE = "M260 158V60H60V158"
const AROUND_SLOT = "M260 158V60H208L172 112L160 124L148 112L112 60H60V158"
const EXTRA_LOOP = "M208 60L172 112L160 124L148 112L112 60Z"

/** Return current in a ground plane: spread out at low frequency, under the trace at high frequency, forced around a slot. */
export function ReturnPathLab() {
  const [f, setF] = React.useState(1000)
  const [slot, setSlot] = React.useState(false)

  const x = f / FC
  const s = x / Math.sqrt(1 + x * x)
  const direct = 1 - s

  const where = s < 0.2 ? "散开，走直线" : s < 0.8 ? "两条路都有" : slot ? "被槽逼着绕路" : "紧贴信号线下方"
  let tone: "neutral" | "good" | "warn" | "bad" = "neutral"
  let note: string
  if (s < 0.2) {
    note = `${formatSI(f, "Hz")} 算低频。对它来说地平面就是一大片电阻，回流电流散开，沿 A、B 之间最短的直线回去。${slot ? "这条槽没挡在直线上，几乎没有影响。" : ""}`
  } else if (s < 0.8) {
    tone = slot ? "warn" : "neutral"
    note = `过渡区：一部分电流还在走直线，另一部分已经往信号线下面挤。频率越高，电感说了算的成分越多。${slot ? "往信号线下面挤的那部分，被槽挡住了去路。" : ""}`
  } else if (!slot) {
    tone = "good"
    note = `${formatSI(f, "Hz")} 算高频。电流挑电感最小的路走，也就是回路面积最小的路：回流电流紧贴在信号线正下方，像影子一样跟着它。`
  } else {
    tone = "bad"
    note = "高频回流过不了槽，只能绕到槽的尽头再折回来。多出来的这一圈就是一副环形天线：往外辐射，也把外面的干扰收进来；旁边一起绕路的信号还会互相串扰。高速线不要跨过地平面上的槽和分割。"
  }

  return (
    <Lab
      title="回流电流走哪条路"
      hint="拖动频率，看地平面里的回流电流从「散开走直线」变成「贴着信号线走」；再在地平面上开一条槽。定性示意，不是场仿真。"
      onReset={() => {
        setF(1000)
        setSlot(false)
      }}
    >
      <LabStage>
        <Schematic width={320} height={220} label="俯视图：信号线在顶层从 A 绕一个弯到 B，回流电流在下面的地平面里从 B 流回 A">
          <rect x={10} y={10} width={300} height={200} rx={6} fill={PLANE} stroke="var(--border)" />
          {/* low-frequency return: fans out around the straight line from B back to A */}
          {direct > 0.02 &&
            ARCS.map((a) => {
              const weight = 1 - 0.18 * Math.abs(a.k)
              return (
                <g key={a.k} opacity={0.2 + 0.8 * direct * weight}>
                  <Wire points={a.points} current={direct * weight} scale={1} color={trace.current} width={1.5} />
                </g>
              )
            })}
          {/* high-frequency return: a band in the plane right under the trace */}
          {s > 0.02 && slot && <path d={EXTRA_LOOP} fill="var(--destructive)" opacity={0.18 * s} stroke="none" />}
          {s > 0.02 && <path d={slot ? AROUND_SLOT : UNDER_TRACE} stroke={trace.current} strokeWidth={12} opacity={0.12 + 0.48 * s} />}
          {slot && <rect x={156} y={10} width={8} height={96} fill="var(--sunken)" stroke="var(--muted-foreground)" strokeWidth={1} />}
          {/* the signal trace on the top layer, current flowing A → B */}
          <Wire points={[[60, 158], [60, 60], [260, 60], [260, 158]]} current={1} scale={1} width={2.5} />
          <rect x={48} y={158} width={24} height={24} rx={3} fill="var(--background)" />
          <rect x={248} y={158} width={24} height={24} rx={3} fill="var(--background)" />
          <Label x={60} y={174.5} weight={600}>
            A
          </Label>
          <Label x={260} y={174.5} weight={600}>
            B
          </Label>
          <Label x={42} y={174.5} anchor="end" muted>
            驱动
          </Label>
          <Label x={278} y={174.5} anchor="start" muted>
            接收
          </Label>
          <Label x={105} y={50}>
            信号线（顶层）
          </Label>
          <Label x={302} y={30} anchor="end" muted>
            地平面（整层铜）
          </Label>
          {slot && (
            <Label x={170} y={46} anchor="start" muted>
              开槽
            </Label>
          )}
          {slot && s > 0.5 && (
            <Label x={132} y={122} anchor="end" color="var(--destructive)">
              回路变大
            </Label>
          )}
        </Schematic>
        <p className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-caption text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-0.5 w-4 bg-foreground" />
            信号线里的电流（去）
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-1.5 w-4 rounded-full opacity-60" style={{ background: trace.current }} />
            地平面里的回流电流（回）
          </span>
        </p>
      </LabStage>
      <LabControls>
        <SliderField label="信号频率" value={f} onChange={setF} min={100} max={1e8} log unit="Hz" />
        <SwitchField label="地平面上开一条槽" hint="槽正好横在信号线下面" checked={slot} onChange={setSlot} />
      </LabControls>
      <LabReadouts>
        <Readout label="信号频率" value={formatSI(f, "Hz")} />
        <Readout label="贴着信号线回流的比例（示意）" value={percent(s)} color={trace.current} />
        <Readout label="回流电流怎么走" value={where} />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

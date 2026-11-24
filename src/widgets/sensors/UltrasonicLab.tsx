import * as React from "react"
import { Lab, LabControls, LabNote, LabReadouts, LabStage, Label, PlayButton, Plot, Readout, Schematic, SliderField, clamp, fixed, trace, usePlayback, useTime, useWidth } from "@/lab"

/** Right edge of the scene, in cm. The module is rated for 2…400 cm. */
const MAX_CM = 450
const RANGE_MIN = 2
const RANGE_MAX = 400
/** Speed of sound the firmware assumes (20 °C). */
const V_ASSUMED = 343
/** Time axis of the timing plot, ms. */
const AXIS_MS = 40
/** When the trigger fires on that axis, ms. */
const T_FIRE = 1
/** The burst: 8 cycles of 40 kHz = 0.2 ms. */
const BURST = 0.2
/** With no echo the module holds Echo high for about this long, ms. */
const TIMEOUT = 38
/** Slow motion: this many real milliseconds pass per second on screen. */
const MS_PER_SECOND = 5

// rows of the timing plot, as [low, high] on its y axis
const TRIG = [3.7, 4.7] as const
const SOUND = [2, 3] as const
const ECHO = [0.3, 1.3] as const

const SOUND_COLOR = trace.third
const ECHO_COLOR = trace.second

/**
 * HC-SR04 in slow motion: a burst flies to the obstacle and back, and the Echo
 * pin stays high for exactly that round trip. Distance = speed of sound × time ÷ 2.
 */
export function UltrasonicLab() {
  const [dist, setDist] = React.useState(100)
  const [airTemp, setAirTemp] = React.useState(20)
  const playback = usePlayback()
  const t = useTime(playback.playing)
  const [ref, measuredWidth] = useWidth<HTMLDivElement>(640)

  // physics
  const vSound = 331 + 0.6 * airTemp // m/s
  const tEcho = ((2 * dist) / 100 / vSound) * 1000 // round trip, ms
  const blind = dist < RANGE_MIN
  const tooFar = dist > RANGE_MAX
  const echoHigh = tooFar ? TIMEOUT : tEcho
  const computed = ((echoHigh / 1000) * V_ASSUMED * 100) / 2 // cm, what the firmware works out
  const error = computed - dist

  // animation clock on the plot's time axis
  const period = clamp(T_FIRE + BURST + echoHigh + 4, 10, AXIS_MS)
  const now = (t * MS_PER_SECOND) % period
  const travelled = vSound * 0.1 * (now - T_FIRE) // cm since the burst left
  const phase = travelled < 0 ? "idle" : travelled <= dist ? "out" : travelled <= 2 * dist ? "back" : "idle"
  const soundAt = phase === "out" ? travelled : 2 * dist - travelled

  // scene geometry (1 unit = 1 px, as wide as the widget)
  const W = Math.max(260, measuredWidth)
  const H = 104
  const X0 = 40
  const X1 = W - 14
  const CY = 50
  const px = (cm: number) => X0 + (cm / MAX_CM) * (X1 - X0)
  const wallX = px(dist)
  const labelLeft = wallX > W - 120

  const arcs: React.ReactNode[] = []
  if (phase !== "idle") {
    const dir = phase === "out" ? 1 : -1
    const strength = phase === "out" ? 1 : tooFar ? 0.25 : 0.7
    for (let j = 0; j < 3; j++) {
      const xa = px(soundAt) - dir * j * 7
      if (xa < X0 + 4 || xa > wallX - 2) continue
      const h = 16 - j * 4
      arcs.push(
        <path
          key={j}
          d={`M${(xa - dir * 3).toFixed(1)} ${CY - h}Q${(xa + dir * 6).toFixed(1)} ${CY} ${(xa - dir * 3).toFixed(1)} ${CY + h}`}
          stroke={SOUND_COLOR}
          strokeWidth={2}
          opacity={(1 - j * 0.28) * strength}
        />,
      )
    }
  }
  const sending = now >= T_FIRE && now < T_FIRE + 1.5
  const hearing = !blind && !tooFar && now >= T_FIRE + tEcho && now < T_FIRE + tEcho + 1.5

  // timing plot
  const echoStrength = tooFar ? 0.06 : 0.25 + 0.65 * (50 / (dist + 50))
  const tReturn = T_FIRE + tEcho
  const soundPts: [number, number][] =
    tEcho < BURST
      ? [
          [0, SOUND[0]],
          [T_FIRE, SOUND[1]],
          [tReturn + BURST, SOUND[0]],
          [AXIS_MS, SOUND[0]],
        ]
      : [
          [0, SOUND[0]],
          [T_FIRE, SOUND[1]],
          [T_FIRE + BURST, SOUND[0]],
          [tReturn, SOUND[0] + echoStrength],
          [tReturn + BURST, SOUND[0]],
          [AXIS_MS, SOUND[0]],
        ]
  const echoPts: [number, number][] = [
    [0, ECHO[0]],
    [T_FIRE + BURST, ECHO[1]],
    [T_FIRE + BURST + echoHigh, ECHO[0]],
    [AXIS_MS, ECHO[0]],
  ]
  const trigPts: [number, number][] = [
    [0, TRIG[0]],
    [T_FIRE, TRIG[1]],
    [T_FIRE + 0.01, TRIG[0]],
    [AXIS_MS, TRIG[0]],
  ]

  const tempOff = Math.abs(error) / dist > 0.015
  const tone = blind || tooFar ? "bad" : tempOff ? "warn" : "neutral"
  const note = blind
    ? `不到 2 cm：回波 ${fixed(tEcho * 1000, 0)} μs 就回来了，可发射头的 8 个脉冲要响 200 μs，余振还没停，接收头分不出哪一段是回波。这就是盲区。`
    : tooFar
      ? "超过 4 m：回波太弱，模块收不到，Echo 一直高到约 38 ms 才超时。程序要把这么长的脉冲当成「没测到」，不能算成 6.5 m。"
      : tempOff
        ? `气温 ${fixed(airTemp, 0)} °C 时声速是 ${fixed(vSound, 0)} m/s，程序却按 343 m/s 算，结果${error > 0 ? "偏大" : "偏小"}了 ${fixed(Math.abs(error), 1)} cm。要测得准，就量一下气温再修正声速。`
        : `声音走了一个来回，共 ${2 * dist} cm，用时 ${fixed(tEcho, 2)} ms。距离 = 343 m/s × ${fixed(tEcho, 2)} ms ÷ 2 = ${fixed(computed, 1)} cm。`

  return (
    <Lab
      title="超声波测距实验台"
      hint="拖距离，看 Echo 脉冲跟着变宽。动画放慢了 200 倍；再试试把障碍物贴到 2 cm 以内或推到 4 m 以外。"
      actions={<PlayButton playback={playback} />}
      onReset={() => {
        setDist(100)
        setAirTemp(20)
      }}
    >
      <LabStage>
        <div ref={ref} className="w-full min-w-0">
          {/*
            Scene (W × 104, W follows the widget's width). Module body x 10…40, y 22…78,
            transducers at (25, 36) and (25, 64); sound travels along y = 50 from x = 40;
            obstacle at px(dist), y 14…80; ruler on y = 86 with labels on y = 100.
          */}
          <Schematic width={W} height={H} minScale={0.5} label="超声波模块向障碍物发出一串脉冲，再接收反射回来的回波">
            <path d={`M${X0} ${CY}H${wallX.toFixed(1)}`} stroke="var(--border)" strokeDasharray="4 4" />
            {/* ruler */}
            <path d={`M${X0} 86H${X1}`} stroke="var(--input)" strokeWidth={1} />
            {[0, 100, 200, 300, 400].map((cm) => (
              <g key={cm}>
                <path d={`M${px(cm).toFixed(1)} 83V89`} stroke="var(--input)" strokeWidth={1} />
                <Label x={px(cm)} y={101} size={12} muted>
                  {cm === 0 ? "0" : `${cm / 100} m`}
                </Label>
              </g>
            ))}
            {/* module */}
            <rect x={10} y={22} width={30} height={56} rx={3} fill="var(--background)" />
            <circle cx={25} cy={36} r={9} fill={sending ? SOUND_COLOR : "var(--background)"} fillOpacity={sending ? 0.35 : 1} />
            <circle cx={25} cy={64} r={9} fill={hearing ? SOUND_COLOR : "var(--background)"} fillOpacity={hearing ? 0.35 : 1} />
            <Label x={25} y={40.5} size={12}>
              发
            </Label>
            <Label x={25} y={68.5} size={12}>
              收
            </Label>
            {arcs}
            {/* obstacle */}
            <rect x={wallX} y={14} width={5} height={66} fill="currentColor" stroke="none" />
            <Label x={labelLeft ? wallX - 8 : wallX + 12} y={26} anchor={labelLeft ? "end" : "start"}>
              障碍物 {dist} cm
            </Label>
          </Schematic>
        </div>
        <Plot
          className="mt-3"
          height={200}
          hover={false}
          ariaLabel="Trig、超声和 Echo 三路信号随时间的变化"
          x={{ min: 0, max: AXIS_MS, label: "时间 (ms)" }}
          y={{ min: 0, max: 5, ticks: [ECHO[0], SOUND[0], TRIG[0]], format: (v) => (v > 3 ? "Trig" : v > 1.5 ? "超声" : "Echo") }}
          series={[
            { points: trigPts, step: true, label: "Trig：10 μs 触发脉冲", color: trace.voltage },
            { points: soundPts, step: true, label: "超声：发射和回波", color: SOUND_COLOR },
            { points: echoPts, step: true, label: `Echo：高电平 ${tooFar ? "约 38" : fixed(tEcho, 2)} ms`, color: ECHO_COLOR },
          ]}
          lines={[{ x: now, color: "var(--foreground)" }]}
        />
      </LabStage>
      <LabControls>
        <SliderField label="障碍物距离" value={dist} onChange={setDist} min={1} max={MAX_CM} step={1} format={(v) => `${v} cm`} />
        <SliderField label="气温" value={airTemp} onChange={setAirTemp} min={-10} max={40} step={1} format={(v) => `${fixed(v, 0)} °C`} />
      </LabControls>
      <LabReadouts>
        <Readout label="Echo 高电平宽度" value={tooFar ? "约 38 ms" : `${fixed(tEcho, 2)} ms`} color={ECHO_COLOR} sub={tooFar ? "超时" : "声音来回的时间"} />
        <Readout label="程序算出的距离" value={blind ? "不可靠" : tooFar ? "没测到" : `${fixed(computed, 1)} cm`} sub="按 343 m/s 计算" />
        <Readout label="此刻的声速" value={`${fixed(vSound, 0)} m/s`} color={SOUND_COLOR} />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

import * as React from "react"
import { Lab, LabControls, LabNote, LabReadouts, LabStage, Label, PlayButton, Plot, Readout, Schematic, SliderField, SwitchField, fixed, trace, usePlayback, useTime } from "@/lab"
import { gaussianNoise } from "./noise"

/** Vibration added to each axis when the switch is on, in g (standard deviation). */
const VIBRATION = 0.15
/** Samples per second, and how many the plot keeps (2 s). */
const RATE = 40
const KEPT = 80
const NOISE_X = gaussianNoise(7, 1024)
const NOISE_Z = gaussianNoise(1913, 1024)

const AX_COLOR = trace.second
const AZ_COLOR = trace.third
const EST_COLOR = trace.fourth

// scene geometry: the board pivots about (CX, CY); 1 g is drawn G px long
const CX = 130
const CY = 112
const G = 72

const rad = (deg: number) => (deg * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI
/** Tiny values print as 0, never as "−0.00". */
const tidy = (v: number, decimals: number) => fixed(Math.abs(v) < 0.5 * 10 ** -decimals ? 0 : v, decimals)

/** An arrow from (x1, y1) to (x2, y2); skipped when too short to read. */
function Vector({ x1, y1, x2, y2, color, width = 2, opacity }: { x1: number; y1: number; x2: number; y2: number; color: string; width?: number; opacity?: number }) {
  const len = Math.hypot(x2 - x1, y2 - y1)
  if (len < 4) return null
  const ux = (x2 - x1) / len
  const uy = (y2 - y1) / len
  const head = Math.min(8, len * 0.6)
  const bx = x2 - ux * head
  const by = y2 - uy * head
  const f = (n: number) => n.toFixed(1)
  return (
    <path
      d={`M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}M${f(bx - uy * 4)} ${f(by + ux * 4)}L${f(x2)} ${f(y2)}L${f(bx + uy * 4)} ${f(by - ux * 4)}`}
      stroke={color}
      strokeWidth={width}
      opacity={opacity}
    />
  )
}

/**
 * A board on a pivot: gravity splits into the accelerometer's X and Z axes
 * (sin and cos of the tilt), and atan2 turns the two readings back into the
 * angle. Switch vibration on and the computed angle starts to jump.
 */
export function TiltLab() {
  const [theta, setTheta] = React.useState(30)
  const [shake, setShake] = React.useState(false)
  const playback = usePlayback()
  const t = useTime(shake && playback.playing)

  const sin = Math.sin(rad(theta))
  const cos = Math.cos(rad(theta))
  // reading number k of the sensor: gravity's share on each axis, plus vibration
  const sample = (k: number) => {
    const idx = ((k % NOISE_X.length) + NOISE_X.length) % NOISE_X.length
    const ax = sin + (shake ? VIBRATION * NOISE_X[idx] : 0)
    const az = cos + (shake ? VIBRATION * NOISE_Z[idx] : 0)
    return { ax, az, angle: deg(Math.atan2(ax, az)) }
  }
  const kNow = Math.floor(t * RATE)
  const { ax, az, angle } = sample(kNow)
  const history: [number, number][] = []
  let sumSq = 0
  for (let j = 0; j <= KEPT; j++) {
    const a = sample(kNow - KEPT + j).angle
    history.push([(j - KEPT) / RATE, a])
    sumSq += (a - theta) ** 2
  }
  const jitter = Math.sqrt(sumSq / (KEPT + 1))

  // unit vectors of the board's axes on screen (y grows downward); positive tilt lifts the +X end
  const xHat = [cos, -sin] as const
  const zHat = [-sin, -cos] as const
  const at = (along: readonly [number, number], d: number): [number, number] => [CX + along[0] * d, CY + along[1] * d]
  // what each axis senses, drawn as a share of the gravity arrow
  const xTip = at(xHat, -G * ax)
  const zTip = at(zHat, -G * az)
  const sumTip: [number, number] = [xTip[0] + zTip[0] - CX, xTip[1] + zTip[1] - CY]
  const xAxisFrom = at(xHat, 64)
  const xAxisTo = at(xHat, 90)
  const xName = at(xHat, 102)
  const zAxisFrom = at(zHat, 16)
  const zAxisTo = at(zHat, 54)
  const zName = at(zHat, 66)
  const f = (n: number) => n.toFixed(1)

  const note = shake
    ? `加上 ${VIBRATION} g 的振动，算出的角度就在真实值附近乱跳，抖动约 ±${fixed(jitter, 0)}°。加速度计分不清重力和振动，所以还要陀螺仪来帮忙。`
    : theta === 0
      ? "平放：重力全压在 Z 轴上，az = 1 g，ax = 0。"
      : Math.abs(theta) === 90
        ? "竖起来了：重力全落在 X 轴上，Z 轴读数是 0。"
        : `板子倾斜 ${fixed(theta, 0)}°：X 轴分到 sin θ = ${tidy(sin, 2)} g，Z 轴分到 cos θ = ${tidy(cos, 2)} g。atan2(ax, az) 把角度原样算了回来。`

  return (
    <Lab
      title="用重力测倾角"
      hint="拖倾角，看重力怎么分到 X、Z 两根轴上。再打开振动，看只靠加速度计算出来的角度有多抖。"
      actions={<PlayButton playback={playback} />}
      onReset={() => {
        setTheta(30)
        setShake(false)
      }}
    >
      <LabStage>
        <div className="grid items-center gap-x-6 gap-y-4 @xl:grid-cols-[auto_minmax(0,1fr)]">
          {/*
            Scene (260 × 230), pivot at (130, 112). Board 120 × 12 turns about the pivot.
            Gravity: thick grey arrow straight down, 72 px = 1 g, tip (130, 184), caption left of the tip.
            Axis names sit 102 px (X) and 66 px (Z) from the pivot, so they stay inside at any angle
            (X at ±90°: y = 10 or 214; Z at ±90°: x = 64 or 196).
          */}
          <Schematic width={260} height={230} label="一块倾斜的电路板，重力被分解到板子的 X 轴和 Z 轴上">
            <path d="M24 112H236" stroke="var(--border)" strokeDasharray="4 4" />
            <g transform={`rotate(${-theta} ${CX} ${CY})`}>
              <rect x={CX - 60} y={CY - 6} width={120} height={12} rx={2} fill="var(--background)" />
              <rect x={CX - 11} y={CY - 14} width={22} height={8} fill="currentColor" />
            </g>
            <Vector x1={xAxisFrom[0]} y1={xAxisFrom[1]} x2={xAxisTo[0]} y2={xAxisTo[1]} color="var(--muted-foreground)" width={1.5} />
            <Vector x1={zAxisFrom[0]} y1={zAxisFrom[1]} x2={zAxisTo[0]} y2={zAxisTo[1]} color="var(--muted-foreground)" width={1.5} />
            <Label x={xName[0]} y={xName[1] + 4.5} muted>
              X
            </Label>
            <Label x={zName[0]} y={zName[1] + 4.5} muted>
              Z
            </Label>
            <Vector x1={CX} y1={CY} x2={CX} y2={CY + G} color="var(--faint-foreground)" width={5} opacity={0.45} />
            <Label x={CX - 12} y={CY + G + 16} anchor="end" muted>
              重力 1 g
            </Label>
            <path d={`M${f(xTip[0])} ${f(xTip[1])}L${f(sumTip[0])} ${f(sumTip[1])}L${f(zTip[0])} ${f(zTip[1])}`} stroke="var(--faint-foreground)" strokeWidth={1} strokeDasharray="3 3" />
            <Vector x1={CX} y1={CY} x2={xTip[0]} y2={xTip[1]} color={AX_COLOR} width={2.5} />
            <Vector x1={CX} y1={CY} x2={zTip[0]} y2={zTip[1]} color={AZ_COLOR} width={2.5} />
            <circle cx={CX} cy={CY} r={3} fill="currentColor" stroke="none" />
          </Schematic>
          <Plot
            height={230}
            x={{ min: -KEPT / RATE, max: 0, label: "时间 (s)" }}
            y={{ min: -135, max: 135, ticks: [-90, -45, 0, 45, 90], label: "角度 (°)" }}
            series={[
              { points: history, label: "加速度计算出的角度", color: EST_COLOR },
              { fn: () => theta, label: "真实倾角", color: trace.ref, dashed: true },
            ]}
          />
        </div>
      </LabStage>
      <LabControls>
        <SliderField label="倾角 θ" value={theta} onChange={setTheta} min={-90} max={90} step={1} unit="°" />
        <SwitchField label="加振动噪声" hint="像电机在转或手在抖，每根轴多出约 0.15 g" checked={shake} onChange={setShake} />
      </LabControls>
      <LabReadouts>
        <Readout label="X 轴读数 ax" value={`${tidy(ax, 2)} g`} color={AX_COLOR} sub="g·sin θ" />
        <Readout label="Z 轴读数 az" value={`${tidy(az, 2)} g`} color={AZ_COLOR} sub="g·cos θ" />
        <Readout label="反算角度 atan2(ax, az)" value={`${tidy(angle, 1)}°`} color={EST_COLOR} />
        <Readout label="角度抖动（最近 2 秒）" value={shake ? `±${fixed(jitter, 1)}°` : "0°"} />
      </LabReadouts>
      <LabNote tone={shake ? "warn" : "neutral"}>{note}</LabNote>
    </Lab>
  )
}

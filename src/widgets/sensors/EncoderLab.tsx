import * as React from "react"
import { Lab, LabControls, LabNote, LabReadouts, LabStage, Label, PlayButton, Plot, Readout, Schematic, SliderField, fixed, formatSI, trace, useFrame, usePlayback } from "@/lab"

/** Lines per revolution of this demo disc. Real ones have hundreds; 12 keeps the edges visible. */
const LINES = 12
/** Counts per revolution when every edge of A and B is counted (×4 decoding). */
const COUNTS = LINES * 4
/** Width of the scope window, s. */
const WINDOW = 1

const A_COLOR = trace.voltage
const B_COLOR = trace.second
// rows of the scope plot, as [low, high] on its y axis
const ROW_A = [2.1, 3.1] as const
const ROW_B = [0.4, 1.4] as const

// disc geometry: centre (100, 108), windows between r = 44 and r = 60, one every 30°
const CX = 100
const CY = 108
const polar = (r: number, degFromTop: number) => {
  const a = (degFromTop * Math.PI) / 180
  return `${(CX + r * Math.sin(a)).toFixed(2)} ${(CY - r * Math.cos(a)).toFixed(2)}`
}
/** The 12 windows: window j spans 30j − 15° … 30j° clockwise from the top when the disc is at 0°. */
const WINDOWS = Array.from({ length: LINES }, (_, j) => {
  const a0 = 30 * j - 15
  const a1 = 30 * j
  return `M${polar(60, a0)}A60 60 0 0 1 ${polar(60, a1)}L${polar(44, a1)}A44 44 0 0 0 ${polar(44, a0)}Z`
})
/** Sensor A looks at the top of the track; B sits a quarter of a line pitch further on (37.5° = 30° + 7.5°). */
const SENSOR_A = { x: CX, y: CY - 52 }
const SENSOR_B = { x: CX + 52 * Math.sin((37.5 * Math.PI) / 180), y: CY - 52 * Math.cos((37.5 * Math.PI) / 180) }

/** Quarter-cycle 0…3 for a position in counts: 0 → A1 B0, 1 → A1 B1, 2 → A0 B1, 3 → A0 B0. */
const quadrant = (counts: number) => ((Math.floor(counts) % 4) + 4) % 4
const levelA = (q: number) => (q < 2 ? 1 : 0)
const levelB = (q: number) => (q === 1 || q === 2 ? 1 : 0)

/**
 * What a scope shows on A and B over the last WINDOW seconds, assuming the
 * shaft has been turning steadily at `revPerSec` and is now at `now` counts.
 * Edges are placed exactly, not sampled.
 */
function scope(now: number, revPerSec: number) {
  const then = now - revPerSec * COUNTS * WINDOW
  const a: [number, number][] = []
  const b: [number, number][] = []
  let lastRise: number | null = null
  const push = (time: number, q: number) => {
    a.push([time, levelA(q) ? ROW_A[1] : ROW_A[0]])
    b.push([time, levelB(q) ? ROW_B[1] : ROW_B[0]])
  }
  push(-WINDOW, quadrant(then))
  const span = now - then
  if (Math.abs(span) > 1e-9) {
    const timeOf = (k: number) => -WINDOW + ((k - then) / span) * WINDOW
    if (span > 0) {
      // forward: crossing integer k upward enters quarter-cycle k mod 4
      for (let k = Math.floor(then) + 1; k <= Math.floor(now); k++) {
        const q = ((k % 4) + 4) % 4
        push(timeOf(k), q)
        if (q === 0) lastRise = timeOf(k)
      }
    } else {
      // reverse: crossing integer k downward enters quarter-cycle (k − 1) mod 4
      for (let k = Math.floor(then); k > now; k--) {
        const q = (((k - 1) % 4) + 4) % 4
        push(timeOf(k), q)
        if (q === 1) lastRise = timeOf(k)
      }
    }
  }
  push(0, quadrant(now))
  return { a, b, lastRise }
}

/**
 * Incremental encoder: a slotted disc, two sensors a quarter pitch apart, and
 * the two square waves they make. Which one leads tells the direction; every
 * edge moves the counter by one.
 */
export function EncoderLab() {
  const [rpm, setRpm] = React.useState(20)
  const [pos, setPos] = React.useState(0)
  const playback = usePlayback()
  const revPerSec = rpm / 60
  useFrame((dt) => setPos((p) => p + revPerSec * dt), playback.playing && rpm !== 0)

  // position in counts; the nudge keeps a value that should be a whole number from landing just below it
  const u = pos * COUNTS + 1e-9
  const count = Math.floor(u)
  const q = quadrant(u)
  const aHigh = levelA(q) === 1
  const bHigh = levelB(q) === 1
  const angle = (count * 360) / COUNTS
  const discDeg = Number((((pos * 360) % 360) + 360).toFixed(2)) % 360
  const { a, b, lastRise } = scope(u, revPerSec)
  const forward = rpm > 0

  const note =
    rpm === 0
      ? `停住了：A、B 都不再跳变，计数停在 ${count}。这个数只存在计数器里，一断电就没了，所以增量式编码器上电后要先找零点。`
      : forward
        ? "正转：A 先跳变，B 晚四分之一个周期跟上。每次 A 上升时 B 还是低电平，于是计数往上加。"
        : "反转：现在是 B 先跳变。每次 A 上升时 B 已经是高电平，于是计数往下减。"

  return (
    <Lab
      title="正交编码器实验台"
      hint="码盘每圈 12 线，A、B 两个探头错开四分之一格。拖转速，把它拖到负数让码盘反转，看哪一路先跳变。"
      actions={<PlayButton playback={playback} />}
      onReset={() => {
        setRpm(20)
        setPos(0)
      }}
    >
      <LabStage>
        <div className="grid items-center gap-x-6 gap-y-4 @xl:grid-cols-[auto_minmax(0,1fr)]">
          {/*
            Disc (200 × 190): centre (100, 108), rim r = 64, windows r = 44…60.
            Sensor A at the top of the track (100, 56), name above the rim at (100, 34).
            Sensor B 37.5° clockwise at about (131.7, 66.7), name outside the rim at (152, 48).
          */}
          <Schematic width={200} height={190} label="带 12 个透光窗口的码盘，上方有 A、B 两个探头">
            <g transform={`rotate(${discDeg} ${CX} ${CY})`}>
              <circle cx={CX} cy={CY} r={64} fill="var(--input)" />
              {WINDOWS.map((d) => (
                <path key={d} d={d} fill="var(--sunken)" stroke="none" />
              ))}
              <circle cx={CX} cy={CY - 28} r={3.5} fill="currentColor" stroke="none" />
            </g>
            <circle cx={CX} cy={CY} r={7} fill="var(--background)" />
            <circle cx={SENSOR_A.x} cy={SENSOR_A.y} r={6} fill={aHigh ? A_COLOR : "var(--background)"} />
            <circle cx={SENSOR_B.x} cy={SENSOR_B.y} r={6} fill={bHigh ? B_COLOR : "var(--background)"} />
            <Label x={100} y={34} color={A_COLOR} weight={600}>
              A
            </Label>
            <Label x={152} y={48} color={B_COLOR} weight={600}>
              B
            </Label>
          </Schematic>
          <Plot
            height={190}
            hover={false}
            ariaLabel="A、B 两相方波随时间的变化"
            x={{ min: -WINDOW, max: 0, label: "时间 (s)" }}
            y={{ min: 0, max: 4, ticks: [ROW_B[0], ROW_A[0]], format: (v) => (v > 1.5 ? "A" : "B") }}
            series={[
              { points: a, step: true, label: "A 相", color: A_COLOR },
              { points: b, step: true, label: "B 相", color: B_COLOR },
            ]}
            lines={lastRise == null ? [] : [{ x: lastRise, label: forward ? "A 上升，B 是低" : "A 上升，B 是高" }]}
          />
        </div>
      </LabStage>
      <LabControls columns={1}>
        <SliderField label="转速（正数顺时针，负数逆时针）" value={rpm} onChange={setRpm} min={-60} max={60} step={5} format={(v) => `${fixed(v, 0)} 圈/分`} />
      </LabControls>
      <LabReadouts>
        <Readout label="方向" value={rpm === 0 ? "停止" : forward ? "正转" : "反转"} sub={rpm === 0 ? "没有跳变" : forward ? "A 领先 B" : "B 领先 A"} />
        <Readout label="计数（4 倍频）" value={fixed(count, 0)} sub={`每圈 ${COUNTS} 个计数`} />
        <Readout label="转过的角度" value={`${fixed(angle, 1)}°`} sub={`1 个计数 = ${360 / COUNTS}°`} />
        <Readout label="A 相频率" value={formatSI(Math.abs(revPerSec) * LINES, "Hz")} color={A_COLOR} />
      </LabReadouts>
      <LabNote>{note}</LabNote>
    </Lab>
  )
}

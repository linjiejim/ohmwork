import * as React from "react"
import { catVar } from "@/lib/categorical"
import { cn } from "@/lib/utils"
import {
  Button,
  ControlField,
  Input,
  Lab,
  LabControls,
  LabNote,
  LabReadouts,
  LabStage,
  Readout,
  Segmented,
  SliderField,
  Timing,
  trace,
  useFrame,
  type Level,
  type TimingSpan,
} from "@/lab"
import { hex, parseHex } from "./shared"

const DEFAULT_MASTER = 0xa5
const DEFAULT_SLAVE = 0x3c
/** Slots in the diagram: 0 idle · 1 CS low · 2–17 eight clock periods (two slots each) · 18 CS still low · 19 idle. */
const N = 20
/** Animation speed of the cursor, slots per second. */
const SPEED = 5
const MOSI_COLOR = trace.second
const MISO_COLOR = trace.third

/**
 * The four lines of one byte exchange in SPI mode 0–3 (mode = CPOL·2 + CPHA).
 * Period k (k = 0 is the MSB) has its leading clock edge at slot 2 + 2k and
 * its trailing edge at 3 + 2k.
 *   CPHA 0: data changes on trailing edges, is sampled on leading edges
 *   CPHA 1: data changes on leading edges, is sampled on trailing edges
 */
function buildWaves(mode: number, master: number, slave: number) {
  const cpol = ((mode >> 1) & 1) as 0 | 1
  const cpha = (mode & 1) as 0 | 1
  const active = (1 - cpol) as 0 | 1
  const bitOf = (byte: number, k: number) => ((byte >> (7 - k)) & 1) as 0 | 1
  const cs: Level[] = []
  const sck: Level[] = []
  const mosi: Level[] = []
  const miso: Level[] = []
  for (let slot = 0; slot < N; slot++) {
    const selected = slot >= 1 && slot <= 18
    cs.push(selected ? 0 : 1)
    sck.push(slot >= 2 && slot <= 17 && slot % 2 === 0 ? active : cpol)
    // which bit sits on the data lines during this slot
    let k = cpha ? Math.floor((slot - 2) / 2) : Math.floor((slot - 1) / 2)
    if (cpha && slot === 18) k = 7 // no clock edge left to shift it away
    const live = selected && k >= 0 && k <= 7
    mosi.push(live ? bitOf(master, k) : "x")
    miso.push(!selected ? "z" : live ? bitOf(slave, k) : "x")
  }
  /** Slot positions of the eight sampling edges. */
  const edges = Array.from({ length: 8 }, (_, k) => (cpha ? 3 : 2) + 2 * k)
  /** Each data bit is valid for one slot either side of its sampling edge. */
  const spans: TimingSpan[] = edges.map((e, k) => ({ from: e - 1, to: e + 1, label: `b${7 - k}` }))
  return { cs, sck, mosi, miso, edges, spans, cpol, cpha }
}

/** Eight cells, MSB on the left. Bits that arrived from the other side are tinted and take that side's colour. */
function ShiftRegister({ title, value, arrived, ownColor, otherColor, caption }: { title: string; value: number; arrived: number; ownColor: string; otherColor: string; caption: string }) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-caption">
        <span className="font-medium">{title}</span>
        <span className="tabular text-muted-foreground">{hex(value)}</span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: 8 }, (_, j) => {
          const foreign = j >= 8 - arrived
          return (
            <span key={j} className={cn("tabular grid h-7 min-w-0 flex-1 place-items-center rounded-sm border text-body font-medium", foreign && "bg-muted")} style={{ color: foreign ? otherColor : ownColor }}>
              {(value >> (7 - j)) & 1}
            </span>
          )
        })}
      </div>
      <p className="mt-1.5 text-caption text-muted-foreground">{caption}</p>
    </div>
  )
}

/**
 * One byte exchanged over SPI: CS, SCK, MOSI and MISO in any of the four
 * modes, the sampling edges marked, and the two shift registers that swap
 * their contents one bit per clock.
 */
export function SpiLab() {
  const [mode, setMode] = React.useState<"0" | "1" | "2" | "3">("0")
  const [masterText, setMasterText] = React.useState("A5")
  const [slaveText, setSlaveText] = React.useState("3C")
  /** Bits exchanged so far when the picture stands still. */
  const [step, setStep] = React.useState(3)
  /** Cursor position while the exchange is being played; null when still. */
  const [anim, setAnim] = React.useState<number | null>(null)

  const masterParsed = parseHex(masterText)
  const slaveParsed = parseHex(slaveText)
  const master = masterParsed ?? DEFAULT_MASTER
  const slave = slaveParsed ?? DEFAULT_SLAVE
  const { cs, sck, mosi, miso, edges, spans, cpol, cpha } = React.useMemo(() => buildWaves(Number(mode), master, slave), [mode, master, slave])

  useFrame(
    (dt) =>
      setAnim((p) => {
        if (p == null) return null
        const next = p + dt * SPEED
        return next >= N ? null : next
      }),
    anim != null,
  )

  // k bits have been exchanged once the cursor has passed k sampling edges
  const k = anim == null ? step : edges.filter((e) => e <= anim).length
  const cursor = anim != null ? anim : k === 0 ? 1.5 : k >= 8 ? undefined : edges[k - 1] + 0.5
  const masterNow = ((master << k) | (slave >> (8 - k))) & 0xff
  const slaveNow = ((slave << k) | (master >> (8 - k))) & 0xff
  const rising = cpol === cpha

  let tone: "neutral" | "good" = "neutral"
  let note: string
  if (k === 0) {
    note = `片选拉低，传输开始，时钟还没动。主机准备发 ${hex(master)}，从机准备回 ${hex(slave)}，都是高位先发。`
  } else if (k < 8) {
    note = `过了 ${k} 个采样沿：主机的高 ${k} 位已经移进从机，从机的高 ${k} 位也移进了主机。两边同时在发、同时在收。`
  } else {
    tone = "good"
    note = `8 个时钟之后，两个寄存器的内容正好对调：主机收到 ${hex(slave)}，从机收到 ${hex(master)}。模式 ${mode} 在${rising ? "上升" : "下降"}沿采样。`
  }
  const fixes = [masterParsed == null && `主机字节不是 00–FF 的十六进制数，按 ${hex(DEFAULT_MASTER)} 处理。`, slaveParsed == null && `从机字节不是 00–FF 的十六进制数，按 ${hex(DEFAULT_SLAVE)} 处理。`].filter(Boolean)
  if (fixes.length) note = `${fixes.join("")}${note}`

  return (
    <Lab
      title="SPI：一个字节的交换"
      hint="切换四种模式，看时钟的空闲电平和采样沿（竖虚线）怎么变。拖动时钟数，看两个移位寄存器一位位交换。"
      onReset={() => {
        setMode("0")
        setMasterText("A5")
        setSlaveText("3C")
        setStep(3)
        setAnim(null)
      }}
    >
      <LabStage>
        <Timing
          signals={[
            { label: "CS", values: cs, color: catVar("gray") },
            { label: "SCK", values: sck },
            { label: "MOSI", values: mosi, color: MOSI_COLOR },
            { label: "MISO", values: miso, color: MISO_COLOR },
          ]}
          spans={spans}
          marks={edges.map((at) => ({ at, color: trace.good }))}
          cursor={cursor}
          ariaLabel={`SPI 模式 ${mode} 的时序图：主机发 ${hex(master)}，从机回 ${hex(slave)}`}
        />
        <p className="mt-2 text-caption text-muted-foreground">竖虚线是采样沿，两边都在这一刻读数据线。双线是「无所谓」，虚线是高阻。</p>
        <div className="mt-4 grid gap-x-6 gap-y-4 @lg:grid-cols-2">
          <ShiftRegister title="主机的移位寄存器" value={masterNow} arrived={k} ownColor={MOSI_COLOR} otherColor={MISO_COLOR} caption="左端移出 → MOSI，MISO → 右端移入" />
          <ShiftRegister title="从机的移位寄存器" value={slaveNow} arrived={k} ownColor={MISO_COLOR} otherColor={MOSI_COLOR} caption="左端移出 → MISO，MOSI → 右端移入" />
        </div>
      </LabStage>
      <LabControls>
        <ControlField label="SPI 模式">
          <Segmented
            aria-label="SPI 模式"
            value={mode}
            onValueChange={setMode}
            options={[
              { value: "0", label: "模式 0" },
              { value: "1", label: "1" },
              { value: "2", label: "2" },
              { value: "3", label: "3" },
            ]}
          />
        </ControlField>
        <SliderField
          label="已经过的时钟数"
          value={k}
          onChange={(v) => {
            setAnim(null)
            setStep(Math.round(v))
          }}
          min={0}
          max={8}
          step={1}
          format={(v) => `${v} / 8`}
        />
        <ControlField label="主机发送（十六进制）">
          <span className="tabular text-small text-muted-foreground">0x</span>
          <Input aria-label="主机发送的字节，十六进制" className="w-16" value={masterText} maxLength={4} onChange={(e) => setMasterText(e.target.value)} />
          <Button
            onClick={() => {
              setStep(8)
              setAnim(0)
            }}
          >
            交换一个字节
          </Button>
        </ControlField>
        <ControlField label="从机回应（十六进制）">
          <span className="tabular text-small text-muted-foreground">0x</span>
          <Input aria-label="从机回应的字节，十六进制" className="w-16" value={slaveText} maxLength={4} onChange={(e) => setSlaveText(e.target.value)} />
        </ControlField>
      </LabControls>
      <LabReadouts>
        <Readout label="模式" value={`模式 ${mode}`} sub={`CPOL = ${cpol}，CPHA = ${cpha}`} />
        <Readout label="时钟空闲时" value={cpol ? "高电平" : "低电平"} />
        <Readout label="采样沿" value={rising ? "上升沿" : "下降沿"} sub={`每个周期的第${cpha ? "二" : "一"}个沿`} color={trace.good} />
        <Readout label="主机寄存器" value={hex(masterNow)} color={MOSI_COLOR} />
        <Readout label="从机寄存器" value={hex(slaveNow)} color={MISO_COLOR} />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

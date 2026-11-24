import * as React from "react"
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
  fixed,
  formatSI,
  sig,
  trace,
  useFrame,
  type Level,
  type TimingMark,
  type TimingSpan,
} from "@/lab"
import { bin, hex } from "./shared"

type Parity = "none" | "even" | "odd"

/** Idle slots drawn before and after the frame. */
const IDLE = 2
/** Animation speed of the "send" cursor, bits per second. */
const SPEED = 3
const DEFAULT_CHAR = "A"

/** "A" → 'A', a space is named so it can be seen. */
function charName(code: number): string {
  return code === 0x20 ? "空格" : `'${String.fromCharCode(code)}'`
}

/**
 * One UART frame on the wire: idle high, start bit, eight data bits (LSB
 * first), optional parity, stop bit. The receiver runs its own clock from the
 * start edge; a baud-rate mismatch moves its sample points a little more with
 * every bit, until late bits are read from the neighbouring slot.
 */
export function UartFrameLab() {
  const [text, setText] = React.useState(DEFAULT_CHAR)
  const [baud, setBaud] = React.useState<"9600" | "115200">("9600")
  const [parity, setParity] = React.useState<Parity>("none")
  const [drift, setDrift] = React.useState(2)
  /** Cursor position in slots while a frame is being "sent"; null shows the whole frame. */
  const [pos, setPos] = React.useState<number | null>(null)

  // only printable ASCII goes on the wire; anything else falls back to "A"
  const typed = text.length === 1 ? text.charCodeAt(0) : -1
  const valid = typed >= 0x20 && typed <= 0x7e
  const byte = valid ? typed : DEFAULT_CHAR.charCodeAt(0)

  // the frame, one entry per bit, in the order it leaves the pin
  const data = Array.from({ length: 8 }, (_, k) => ((byte >> k) & 1) as 0 | 1)
  const ones = data.reduce<number>((a, b) => a + b, 0)
  const frame: { name: string; level: 0 | 1 }[] = [
    { name: "起始", level: 0 },
    ...data.map((level, k) => ({ name: `D${k}`, level })),
    ...(parity === "none" ? [] : [{ name: "校验", level: ((parity === "even" ? ones : ones + 1) % 2) as 0 | 1 }]),
    { name: "停止", level: 1 },
  ]
  const n = IDLE + frame.length + IDLE

  // receiver: sample k sits (k + 0.5) of ITS bit times after the start edge
  const rate = 1 + drift / 100
  const samples = frame.map((_, k) => {
    const at = (k + 0.5) / rate // in transmitter bit times
    const slot = Math.floor(at)
    const level: 0 | 1 = slot < frame.length ? frame[slot].level : 1 // past the stop bit the line idles high
    return { at, level, ok: slot === k }
  })
  const rxByte = samples.slice(1, 9).reduce((acc, s, k) => acc | (s.level << k), 0)
  const framingError = samples[samples.length - 1].level === 0
  const firstBad = samples.findIndex((s) => !s.ok)
  const lastShift = Math.abs(samples[samples.length - 1].at - (frame.length - 0.5))

  const tx: Level[] = [1, 1, ...frame.map((b) => b.level), 1, 1]
  const rx: Level[] = [1, 1, ...samples.map((s) => s.level), 1, 1]
  const spans: TimingSpan[] = [
    { from: 0, to: IDLE, label: "空闲" },
    ...frame.map((b, k) => ({ from: IDLE + k, to: IDLE + k + 1, label: b.name, highlight: !samples[k].ok })),
    { from: n - IDLE, to: n, label: "空闲" },
  ]
  const marks: TimingMark[] = samples.map((s) => ({ at: Math.min(n, IDLE + s.at), color: s.ok ? trace.good : trace.power }))

  useFrame(
    (dt) =>
      setPos((p) => {
        if (p == null) return null
        const next = p + dt * SPEED
        return next >= n ? null : next
      }),
    pos != null,
  )

  const bitTime = 1 / Number(baud)
  const sending = pos == null ? null : frame[Math.floor(pos) - IDLE]

  let tone: "neutral" | "good" | "bad" = "neutral"
  let note: string
  if (pos != null) {
    note = sending ? `正在发送「${sending.name}」：TX 线是${sending.level ? "高" : "低"}电平，保持 ${formatSI(bitTime, "s")}。` : "线路空闲：TX 保持高电平。"
  } else if (firstBad >= 0) {
    tone = "bad"
    note = `偏差 ${sig(Math.abs(drift))}%：误差一位位累积，从「${frame[firstBad].name}」起，采样点滑进了相邻的位。接收端读到 ${hex(rxByte)}${rxByte === byte ? "（这个字符碰巧没读错，换一个就会错）" : `，而不是 ${hex(byte)}`}${framingError ? "，停止位还读成了 0，报帧错误" : ""}。`
  } else if (drift === 0) {
    tone = "good"
    note = "两边波特率完全一致：每个采样点（竖虚线）都落在一位的正中间。"
  } else {
    tone = "good"
    note = `接收端${drift > 0 ? "快" : "慢"} ${sig(Math.abs(drift))}%：采样点一位比一位${drift > 0 ? "提前" : "滞后"}，到停止位累计偏了 ${fixed(lastShift, 2)} 位，还在位内，读到的仍是 ${hex(byte)}。`
  }
  if (!valid && pos == null) note = `输入框里不是可打印的 ASCII 字符，按 ${DEFAULT_CHAR} 发送。${note}`

  return (
    <Lab
      title="一帧串口数据"
      hint="上面一行是 TX 线上的波形，下面一行是接收端读到的每一位。拖动波特率偏差，看采样点（竖虚线）怎么跑偏。"
      onReset={() => {
        setText(DEFAULT_CHAR)
        setBaud("9600")
        setParity("none")
        setDrift(2)
        setPos(null)
      }}
    >
      <LabStage>
        <Timing
          signals={[
            { label: "TX", values: tx },
            { label: "读到", values: rx, color: trace.second },
          ]}
          spans={spans}
          marks={marks}
          cursor={pos ?? undefined}
          minSlot={28}
          ariaLabel={`串口帧时序图：字符 ${charName(byte)}，TX 线和接收端读到的位`}
        />
        <p className="mt-2 text-caption text-muted-foreground">竖虚线是接收端的采样时刻。带底色的位，采样点已经落到别的位上。</p>
      </LabStage>
      <LabControls>
        <ControlField label="要发送的字符">
          <Input aria-label="要发送的字符" className="w-16 text-center" value={text} onChange={(e) => setText(e.target.value.slice(-1))} />
          <Button onClick={() => setPos(0)}>发送一帧</Button>
        </ControlField>
        <ControlField label="波特率">
          <Segmented
            aria-label="波特率"
            value={baud}
            onValueChange={setBaud}
            options={[
              { value: "9600", label: "9600" },
              { value: "115200", label: "115200" },
            ]}
          />
        </ControlField>
        <ControlField label="校验位">
          <Segmented
            aria-label="校验位"
            value={parity}
            onValueChange={setParity}
            options={[
              { value: "none", label: "无" },
              { value: "even", label: "偶校验" },
              { value: "odd", label: "奇校验" },
            ]}
          />
        </ControlField>
        <SliderField label="接收端波特率偏差" value={drift} onChange={setDrift} min={-10} max={10} step={0.5} format={(v) => `${v > 0 ? "+" : ""}${sig(v)}%`} />
      </LabControls>
      <LabReadouts>
        <Readout label="发送" value={`${charName(byte)} = ${hex(byte)}`} sub={`二进制 ${bin(byte)}，低位先发`} />
        <Readout label="每位时长" value={formatSI(bitTime, "s")} sub={`一帧 ${frame.length} 位，${formatSI(frame.length * bitTime, "s")}`} />
        <Readout
          label="接收端读到"
          value={`${hex(rxByte)}${rxByte >= 0x20 && rxByte <= 0x7e ? ` ${charName(rxByte)}` : ""}`}
          sub={framingError ? "帧错误：停止位不是 1" : rxByte === byte ? "和发送的一致" : "读错了"}
          color={trace.second}
        />
        <Readout label="停止位处的偏移" value={`${fixed(lastShift, 2)} 位`} sub="超过 0.5 位就采错" />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

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
  SwitchField,
  Timing,
  formatSI,
  trace,
  useFrame,
  type Level,
  type TimingSpan,
} from "@/lab"
import { bin, hex, parseHex } from "./shared"

const DEFAULT_ADDR = 0x48
const DEFAULT_DATA = 0x5a
/** Animation speed of the cursor, slots per second (one bit is three slots). */
const SPEED = 10

interface Bit {
  name: string
  level: 0 | 1
  /** The slave drives SDA during this bit. */
  bySlave?: boolean
}

/**
 * Build the two waveforms of one single-byte transfer.
 * Every bit takes three slots with SCL low · high · low, so SDA (which only
 * changes at a bit boundary) always changes in the middle of an SCL-low
 * stretch and is steady while SCL is high. Start and stop are the two places
 * where SDA moves while SCL is high.
 */
function buildFrame(addr: number, read: boolean, data: number, online: boolean) {
  const bits: Bit[] = []
  for (let k = 6; k >= 0; k--) bits.push({ name: `A${k}`, level: ((addr >> k) & 1) as 0 | 1 })
  bits.push({ name: read ? "R" : "W", level: read ? 1 : 0 })
  // 9th clock: the addressed slave pulls SDA low. Nobody there: the pull-up keeps it high.
  bits.push(online ? { name: "ACK", level: 0, bySlave: true } : { name: "NACK", level: 1 })
  if (online) {
    for (let k = 7; k >= 0; k--) bits.push({ name: `D${k}`, level: ((data >> k) & 1) as 0 | 1, bySlave: read })
    // write: the slave acknowledges. read: the master answers NACK after the last byte it wants.
    bits.push(read ? { name: "NACK", level: 1 } : { name: "ACK", level: 0, bySlave: true })
  }

  // idle, idle, START (SDA falls while SCL is high), then SCL goes low
  const scl: Level[] = [1, 1, 1, 0]
  const sda: Level[] = [1, 1, 0, 0]
  const spans: TimingSpan[] = [{ from: 2, to: 4, label: "起始" }]
  for (const b of bits) {
    const from = scl.length
    scl.push(0, 1, 0)
    sda.push(b.level, b.level, b.level)
    spans.push({ from, to: from + 3, label: b.name, highlight: b.bySlave })
  }
  // SDA is brought low while SCL is low, SCL rises, then STOP: SDA rises while SCL is high
  const from = scl.length
  scl.push(0, 1, 1, 1, 1)
  sda.push(0, 0, 1, 1, 1)
  spans.push({ from, to: from + 3, label: "停止" })
  return { bits, scl, sda, spans }
}

/**
 * One I²C transfer drawn bit by bit: start, 7-bit address, R/W, ACK, a data
 * byte, ACK, stop. Take the slave off the bus and the address goes
 * unanswered (NACK), so the master stops right there.
 */
export function I2cFrameLab() {
  const [addrText, setAddrText] = React.useState("48")
  const [dataText, setDataText] = React.useState("5A")
  const [dir, setDir] = React.useState<"w" | "r">("w")
  const [online, setOnline] = React.useState(true)
  const [pos, setPos] = React.useState<number | null>(null)

  const addrParsed = parseHex(addrText, 0x7f)
  const dataParsed = parseHex(dataText, 0xff)
  const addr = addrParsed ?? DEFAULT_ADDR
  const data = dataParsed ?? DEFAULT_DATA
  const read = dir === "r"
  const { bits, scl, sda, spans } = React.useMemo(() => buildFrame(addr, read, data, online), [addr, read, data, online])
  const n = scl.length
  const firstByte = (addr << 1) | (read ? 1 : 0)
  const reserved = addr < 0x08 || addr > 0x77

  useFrame(
    (dt) =>
      setPos((p) => {
        if (p == null) return null
        const next = p + dt * SPEED
        return next >= n ? null : next
      }),
    pos != null,
  )

  let tone: "neutral" | "good" | "warn" | "bad" = "neutral"
  let note: string
  if (pos != null) {
    // spans[0] is the start condition, spans[1 … bits.length] the bits, the last one the stop condition
    const idx = spans.findIndex((s) => pos >= s.from && pos < s.to)
    const bit = idx >= 1 && idx <= bits.length ? bits[idx - 1] : undefined
    if (idx < 0) note = "总线空闲：SCL 和 SDA 都被上拉电阻拉在高电平。"
    else if (idx === 0) note = "起始条件：SCL 还是高电平，SDA 先被拉低。所有从机开始听地址。"
    else if (!bit) note = "停止条件：SCL 先回到高电平，SDA 再升高。总线空出来了。"
    else if (bit.name === "ACK") note = "应答位：从机把 SDA 拉低，表示「收到」。"
    else if (bit.name === "NACK") note = online ? "主机不拉低 SDA（NACK）：这是它要读的最后一个字节。" : "应答位：没人拉低 SDA，它停在高电平（NACK）。"
    else if (bit.name === "R" || bit.name === "W") note = `读写位 = ${bit.level}：主机要${bit.level ? "读" : "写"}。`
    else if (bit.name.startsWith("A")) note = `地址位 ${bit.name} = ${bit.level}，高位先发。`
    else note = `数据位 ${bit.name} = ${bit.level}，由${bit.bySlave ? "从机" : "主机"}送出。`
  } else if (!online) {
    tone = "bad"
    note = `地址 ${hex(addr)} 上没有从机：第 9 个时钟时没人拉低 SDA，上拉电阻让它留在高电平，这就是 NACK。主机发现后直接发停止条件，数据没有发出去。`
  } else if (read) {
    note = `读：地址后面的读写位是 1。从机应答后接管 SDA，送出 ${hex(data)}（带底色的位都由从机驱动）。主机收完最后一个字节回 NACK，意思是「不用再发了」。`
  } else {
    note = `写：主机发出地址 ${hex(addr)} 和读写位 0，从机拉低 SDA 应答；主机再发数据 ${hex(data)}，从机再应答一次，最后是停止条件。`
  }
  if (pos == null) {
    const fixes = [addrParsed == null && `地址不是 00–7F 的十六进制数，按 ${hex(DEFAULT_ADDR)} 处理。`, dataParsed == null && `数据不是 00–FF 的十六进制数，按 ${hex(DEFAULT_DATA)} 处理。`].filter(Boolean)
    if (fixes.length) note = `${fixes.join("")}${note}`
    else if (reserved && online) {
      tone = "warn"
      note = `${hex(addr)} 落在保留地址里（0x00–0x07 和 0x78–0x7F），普通器件不会用它。${note}`
    }
  }

  return (
    <Lab
      title="一次 I²C 传输"
      hint="改地址、读写方向和数据，看两根线上的波形。再把从机拿掉试试。"
      onReset={() => {
        setAddrText("48")
        setDataText("5A")
        setDir("w")
        setOnline(true)
        setPos(null)
      }}
    >
      <LabStage>
        <Timing
          signals={[
            { label: "SCL", values: scl },
            { label: "SDA", values: sda, color: trace.second },
          ]}
          spans={spans}
          cursor={pos ?? undefined}
          minSlot={9}
          ariaLabel={`I²C 时序图：向地址 ${hex(addr)} ${read ? "读" : "写"}一个字节`}
        />
        <p className="mt-2 text-caption text-muted-foreground">带底色的位由从机驱动 SDA。SDA 只在 SCL 为低时变化；只有起始和停止例外。</p>
      </LabStage>
      <LabControls>
        <ControlField label="从机地址（7 位，十六进制）">
          <span className="tabular text-small text-muted-foreground">0x</span>
          <Input aria-label="从机地址，十六进制" className="w-16" value={addrText} maxLength={4} onChange={(e) => setAddrText(e.target.value)} />
          <Button onClick={() => setPos(0)}>发送一帧</Button>
        </ControlField>
        <ControlField label="数据字节（十六进制）">
          <span className="tabular text-small text-muted-foreground">0x</span>
          <Input aria-label="数据字节，十六进制" className="w-16" value={dataText} maxLength={4} onChange={(e) => setDataText(e.target.value)} />
        </ControlField>
        <ControlField label="方向">
          <Segmented
            aria-label="方向"
            value={dir}
            onValueChange={setDir}
            options={[
              { value: "w", label: "主机写" },
              { value: "r", label: "主机读" },
            ]}
          />
        </ControlField>
        <SwitchField label="从机在线" checked={online} onChange={setOnline} hint="关掉：这个地址上没有器件" />
      </LabControls>
      <LabReadouts>
        <Readout label="7 位地址" value={hex(addr)} sub={`二进制 ${bin(addr, 7)}`} />
        <Readout label="线上的第一个字节" value={hex(firstByte)} sub="地址左移一位，末位是读写位" />
        <Readout label="数据" value={online ? hex(data) : "没发出"} sub={online ? (read ? "从机 → 主机" : "主机 → 从机") : "地址没人应答"} color={trace.second} />
        <Readout label="SCL 脉冲" value={`${bits.length} 个`} sub={`100 kHz 时约 ${formatSI(bits.length / 100e3, "s")}`} />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

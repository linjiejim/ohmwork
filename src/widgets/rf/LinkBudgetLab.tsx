import * as React from "react"
import { ControlField, Lab, LabControls, LabNote, LabReadouts, LabStage, Plot, Readout, Segmented, Select, SliderField, fixed, formatSI, sig, trace } from "@/lab"
import { formatDb } from "./kit"

/** Free-space path loss in dB, distance in metres, frequency in MHz. */
function fspl(metres: number, mhz: number) {
  return 20 * Math.log10(metres / 1000) + 20 * Math.log10(mhz) + 32.44
}

/* Typical receiver sensitivities (order of magnitude; real parts vary by a few dB with data rate and chip). */
const RECEIVERS = [
  { value: "wifi", label: "Wi-Fi 高速率：约 −75 dBm", name: "Wi-Fi", dbm: -75 },
  { value: "ble", label: "蓝牙 BLE：约 −95 dBm", name: "BLE", dbm: -95 },
  { value: "zigbee", label: "Zigbee：约 −100 dBm", name: "Zigbee", dbm: -100 },
  { value: "lora", label: "LoRa SF12：约 −137 dBm", name: "LoRa SF12", dbm: -137 },
]

const BANDS = [
  { value: "433", label: "433" },
  { value: "868", label: "868" },
  { value: "2400", label: "2400" },
  { value: "5800", label: "5800" },
]

const D_MIN = 1
const D_MAX = 20_000

function formatDistance(metres: number) {
  if (metres >= 999.5) return `${sig(metres / 1000, 3)} km`
  if (metres >= 0.995) return `${sig(metres, 3)} m`
  return `${sig(metres * 100, 2)} cm`
}

const INITIAL = { tx: 0, gt: 0, gr: 0, band: "2400", distance: 10, extra: 0, receiver: "ble" }

/** A link budget you can drag: everything in dB adds up to the received power, compared against what the receiver needs. */
export function LinkBudgetLab() {
  const [s, setS] = React.useState(INITIAL)
  const set =
    <K extends keyof typeof INITIAL>(key: K) =>
    (v: (typeof INITIAL)[K]) =>
      setS((old) => ({ ...old, [key]: v }))

  const mhz = Number(s.band)
  const receiver = RECEIVERS.find((r) => r.value === s.receiver) ?? RECEIVERS[1]
  const eirp = s.tx + s.gt
  const received = (metres: number) => eirp + s.gr - fspl(metres, mhz) - s.extra
  const loss = fspl(s.distance, mhz)
  const pr = received(s.distance)
  const margin = pr - receiver.dbm
  // the distance at which the margin runs out: solve FSPL(d) = EIRP + Gr − extra − sensitivity
  const reach = 1000 * 10 ** ((eirp + s.gr - s.extra - receiver.dbm - 32.44 - 20 * Math.log10(mhz)) / 20)

  const note: { tone: "good" | "warn" | "bad"; text: string } =
    margin < 0
      ? { tone: "bad", text: `接收功率 ${formatDb(pr, "dBm")} 比灵敏度还低 ${fixed(-margin, 1)} dB：收不到。缩短距离、加大功率、换高增益天线，或者换一种更灵敏（也更慢）的技术。` }
      : margin < 10
        ? { tone: "warn", text: `余量只有 ${fixed(margin, 1)} dB：纸面上能通，但有人走过、关一扇门就可能掉线。实际设计至少留 10–20 dB 的衰落余量。` }
        : { tone: "good", text: `余量 ${fixed(margin, 1)} dB，链路可靠。余量可以拿来换距离：每 6 dB 能让自由空间里的距离翻一倍。${reach > D_MAX ? "不过几十公里外的「理论最远」只在毫无遮挡时成立，地面上先撞上的是地形和地球曲率。" : ""}` }

  return (
    <Lab title="链路预算计算器" hint="拖动距离和额外损耗，看接收功率什么时候跌到灵敏度以下。" onReset={() => setS(INITIAL)}>
      <LabStage>
        <Plot
          height={240}
          x={{ min: D_MIN, max: D_MAX, log: true, label: "距离 (m)" }}
          y={{ min: -160, max: 40, label: "接收功率 (dBm)" }}
          series={[
            { fn: received, label: "接收功率", color: trace.voltage },
            { fn: () => receiver.dbm, label: `${receiver.name} 灵敏度 ${fixed(receiver.dbm, 0)} dBm`, color: trace.ref, dashed: true },
          ]}
          lines={reach >= D_MIN && reach <= D_MAX ? [{ x: reach, label: `理论最远 ${formatDistance(reach)}` }] : []}
          markers={[{ x: s.distance, y: pr, label: formatDb(pr, "dBm"), color: trace.voltage }]}
        />
      </LabStage>
      <LabControls>
        <SliderField label="发射功率" value={s.tx} onChange={set("tx")} min={-10} max={30} step={1} format={(v) => `${fixed(v, 0)} dBm（${formatSI(10 ** (v / 10) / 1000, "W")}）`} color={trace.voltage} />
        <SliderField label="距离" value={s.distance} onChange={set("distance")} min={D_MIN} max={D_MAX} log unit="m" />
        <SliderField label="发射天线增益" value={s.gt} onChange={set("gt")} min={-5} max={12} step={0.5} unit="dBi" />
        <SliderField label="接收天线增益" value={s.gr} onChange={set("gr")} min={-5} max={12} step={0.5} unit="dBi" />
        <SliderField label="额外损耗（墙、人体、馈线）" value={s.extra} onChange={set("extra")} min={0} max={60} step={1} unit="dB" color={trace.power} />
        <ControlField label="频率（MHz）">
          <Segmented size="sm" value={s.band} onValueChange={set("band")} options={BANDS} aria-label="频率（MHz）" />
        </ControlField>
        <ControlField label="接收机灵敏度（典型量级）">
          <Select options={RECEIVERS} value={s.receiver} onValueChange={set("receiver")} aria-label="接收机灵敏度" className="w-full" />
        </ControlField>
      </LabControls>
      <LabReadouts>
        <Readout label="EIRP" value={formatDb(eirp, "dBm")} sub="发射功率 + 发射天线增益" />
        <Readout label="自由空间路径损耗" value={formatDb(loss)} />
        <Readout label="接收功率" value={formatDb(pr, "dBm")} color={trace.voltage} />
        <Readout label="链路余量" value={formatDb(margin)} sub={`接收功率 − 灵敏度（${fixed(receiver.dbm, 0)} dBm）`} />
        <Readout label="理论最远距离" value={formatDistance(reach)} sub="自由空间，余量为 0" />
      </LabReadouts>
      <LabNote tone={note.tone}>{note.text}</LabNote>
    </Lab>
  )
}

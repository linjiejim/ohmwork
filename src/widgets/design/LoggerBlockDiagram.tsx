import { Label, Schematic, trace } from "@/lab"

/*
 * Block diagram of the lesson's running project (static figure).
 *
 *   boxes (x0..x1, y0..y1)            links (all horizontal, 40 long)
 *   电池     10..100,  20..64         电池 → 单片机    y = 42,  x 100..140   "3 V"
 *   传感器   10..100, 104..148        传感器 ↔ 单片机  y = 126, x 100..140   "I²C"
 *   单片机  140..200,  20..148        单片机 ↔ Flash   y = 42,  x 200..240   "SPI"
 *   Flash   240..330,  20..64         单片机 ↔ 调试口  y = 126, x 200..240   "SWD"
 *   调试口  240..330, 104..148
 */
function Box({ x, y, w, h, title, sub }: { x: number; y: number; w: number; h: number; title: string; sub: string }) {
  const cx = x + w / 2
  const cy = y + h / 2
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={4} fill="var(--background)" />
      <Label x={cx} y={cy - 3} weight={500}>
        {title}
      </Label>
      <Label x={cx} y={cy + 13} size={12} muted>
        {sub}
      </Label>
    </g>
  )
}

/** A horizontal link with an arrowhead at the right end, and at the left end too when `both`. */
function Link({ x0, x1, y, label, both, color }: { x0: number; x1: number; y: number; label: string; both?: boolean; color?: string }) {
  const stroke = color ?? "var(--muted-foreground)"
  return (
    <g stroke={stroke} strokeWidth={1.4}>
      <path d={`M${x0} ${y}H${x1}M${x1 - 7} ${y - 3.5}L${x1} ${y}L${x1 - 7} ${y + 3.5}`} />
      {both && <path d={`M${x0 + 7} ${y - 3.5}L${x0} ${y}L${x0 + 7} ${y + 3.5}`} />}
      <Label x={(x0 + x1) / 2} y={y - 8} color={stroke}>
        {label}
      </Label>
    </g>
  )
}

/** System block diagram of the battery-powered temperature / humidity logger. */
export function LoggerBlockDiagram() {
  return (
    <Schematic width={340} height={168} minScale={0.8} label="温湿度记录器的系统框图：电池给单片机供电，单片机通过 I²C 读传感器，通过 SPI 写 Flash，并引出下载和调试口">
      <Box x={10} y={20} w={90} h={44} title="电池" sub="CR2032" />
      <Box x={10} y={104} w={90} h={44} title="温湿度传感器" sub="SHT30" />
      <Box x={140} y={20} w={60} h={128} title="单片机" sub="低功耗" />
      <Box x={240} y={20} w={90} h={44} title="Flash 存储" sub="W25Q16" />
      <Box x={240} y={104} w={90} h={44} title="下载和调试口" sub="SWD、串口" />
      <Link x0={100} x1={140} y={42} label="3 V" color={trace.voltage} />
      <Link x0={100} x1={140} y={126} label="I²C" both />
      <Link x0={200} x1={240} y={42} label="SPI" both />
      <Link x0={200} x1={240} y={126} label="SWD" both />
    </Schematic>
  )
}

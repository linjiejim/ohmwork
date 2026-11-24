import * as React from "react"
import { catVar } from "@/lib/categorical"
import { ControlField, Lab, LabControls, LabNote, LabReadouts, LabStage, Label, Readout, Schematic, Segmented } from "@/lab"

/*
 * Cross-section of a 2-layer and a 4-layer board. Not to scale: 35 μm of
 * copper on a 1.6 mm board would be a hairline.
 *
 * Canvas 320 × 190. The section spans x 16..180; labels start at x 194.
 *   y  30..37   solder mask (top)          (opening over the pad at x 134..168)
 *   y  37..46   top copper:  trace 20..42, via pad 48..80, trace 96..120, pad 136..166
 *   y  46..148  FR-4          4-layer only: plane L2 at y 62..71, plane L3 at y 123..132,
 *                              both with a clearance hole (50..78) around the via
 *   y 148..157  bottom copper: via pad 48..80, trace 92..160
 *   y 157..164  solder mask (bottom)
 *   via: barrel walls x 56..59 and 69..72 from y 37 to 157, hole 59..69
 *   silkscreen: x 22..44, y 25.5..30
 *   call-outs above the board (baseline y 14): 丝印 at x 33, 过孔 at x 64, 焊盘 at x 151
 */
const XL = 16
const XR = 180
const COPPER = catVar("amber")
const MASK = catVar("green")
const FR4 = catVar("gray")

type Layers = "2" | "4"

interface Callout {
  /** Vertical centre of the band this label points at. */
  at: number
  /** Baseline of the label text. */
  y: number
  text: string
}

const LABELS: Record<Layers, Callout[]> = {
  "2": [
    { at: 33.5, y: 36, text: "阻焊（绿油）" },
    { at: 41.5, y: 53.5, text: "顶层铜：走线和焊盘" },
    { at: 97, y: 101, text: "FR-4 基材" },
    { at: 152.5, y: 149, text: "底层铜" },
    { at: 160.5, y: 176, text: "阻焊" },
  ],
  "4": [
    { at: 33.5, y: 36, text: "阻焊（绿油）" },
    { at: 41.5, y: 53.5, text: "L1 顶层：信号" },
    { at: 54, y: 71, text: "半固化片" },
    { at: 66.5, y: 88.5, text: "L2：地平面" },
    { at: 97, y: 106, text: "FR-4 芯板" },
    { at: 127.5, y: 123.5, text: "L3：电源平面" },
    { at: 140, y: 141, text: "半固化片" },
    { at: 152.5, y: 158.5, text: "L4 底层：信号" },
    { at: 160.5, y: 176, text: "阻焊" },
  ],
}

const copper = (x0: number, x1: number, y: number) => <rect key={`${x0}-${y}`} x={x0} y={y} width={x1 - x0} height={9} fill={COPPER} stroke="none" />

/** What a PCB is made of, seen from the side: two layers or four. */
export function StackupLab() {
  const [layers, setLayers] = React.useState<Layers>("2")
  const four = layers === "4"
  return (
    <Lab title="PCB 的截面" hint="切换双层板和四层板，看一块板子从上到下是怎么叠起来的。示意图不按比例。" onReset={() => setLayers("2")}>
      <LabStage>
        <Schematic width={320} height={190} label={four ? "四层板的截面：信号、地平面、电源平面、信号，一个过孔贯穿四层" : "双层板的截面：上下两层铜夹着 FR-4 基材，一个过孔连接两层"}>
          {/* dielectric */}
          <rect x={XL} y={46} width={XR - XL} height={102} fill={FR4} fillOpacity={0.2} stroke="none" />
          {/* solder mask, top and bottom; it also fills the gaps between outer traces */}
          <rect x={XL} y={30} width={XR - XL} height={16} fill={MASK} fillOpacity={0.6} stroke="none" />
          <rect x={XL} y={148} width={XR - XL} height={16} fill={MASK} fillOpacity={0.6} stroke="none" />
          {/* outer copper */}
          {copper(20, 42, 37)}
          {copper(48, 80, 37)}
          {copper(96, 120, 37)}
          {copper(136, 166, 37)}
          {copper(48, 80, 148)}
          {copper(92, 160, 148)}
          {/* inner planes with a clearance hole around the via */}
          {four && copper(XL, 50, 62)}
          {four && copper(78, XR, 62)}
          {four && copper(XL, 50, 123)}
          {four && copper(78, XR, 123)}
          {/* mask opening over the pad */}
          <rect x={134} y={30} width={34} height={7} fill="var(--sunken)" stroke="none" />
          {/* via: plated barrel and the drilled hole */}
          <rect x={56} y={37} width={3} height={120} fill={COPPER} stroke="none" />
          <rect x={69} y={37} width={3} height={120} fill={COPPER} stroke="none" />
          <rect x={59} y={30} width={10} height={134} fill="var(--sunken)" stroke="none" />
          {/* silkscreen ink on top of the mask */}
          <rect x={22} y={25.5} width={22} height={4.5} fill="var(--background)" stroke="var(--muted-foreground)" strokeWidth={0.75} />
          {/* call-outs above */}
          <g stroke="var(--faint-foreground)" strokeWidth={1}>
            <path d="M33 18V24M64 18V28M151 18V35" />
          </g>
          <Label x={33} y={14}>
            丝印
          </Label>
          <Label x={64} y={14}>
            过孔
          </Label>
          <Label x={151} y={14}>
            焊盘
          </Label>
          {/* layer names with leaders */}
          {LABELS[layers].map((c) => (
            <g key={c.y}>
              <path d={`M${XR + 2} ${c.at}L${XR + 10} ${c.y - 4.5}`} stroke="var(--faint-foreground)" strokeWidth={1} />
              <Label x={XR + 14} y={c.y} anchor="start">
                {c.text}
              </Label>
            </g>
          ))}
        </Schematic>
      </LabStage>
      <LabControls>
        <ControlField label="层数">
          <Segmented aria-label="层数" value={layers} onValueChange={setLayers} options={[{ value: "2", label: "双层板" }, { value: "4", label: "四层板" }]} />
        </ControlField>
      </LabControls>
      <LabReadouts>
        <Readout label="铜层" value={four ? "4 层" : "2 层"} sub={four ? "信号 – 地 – 电源 – 信号" : "顶层和底层都走线"} />
        <Readout label="常见的总板厚" value="1.6 mm" />
        <Readout label="常用铜厚" value="1 oz ≈ 35 μm" sub={four ? "内层有时用 0.5 oz" : undefined} />
      </LabReadouts>
      <LabNote>
        {four
          ? "四层板把中间两层整层铺成地和电源。每根信号线的正下方都有一片完整的地，电源也不用再到处拉线。下一课会讲这片地为什么这么重要。"
          : "双层板最便宜，够用于大多数低速电路。走线和地都挤在这两层里，所以习惯上把底层尽量留给一整片地。"}
      </LabNote>
    </Lab>
  )
}

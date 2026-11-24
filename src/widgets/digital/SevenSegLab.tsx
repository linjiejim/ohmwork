import * as React from "react"
import { ArrowDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Lab, LabControls, LabNote, LabReadouts, LabStage, Label, Readout, Schematic, SliderField, SwitchField, glow } from "@/lab"

const SEGMENTS = ["a", "b", "c", "d", "e", "f", "g"] as const

/** Which segments light for 0–F. Bit 0 is segment a … bit 6 is segment g (the usual "gfedcba" code). */
const CODES = [0x3f, 0x06, 0x5b, 0x4f, 0x66, 0x6d, 0x7d, 0x07, 0x7f, 0x6f, 0x77, 0x7c, 0x39, 0x5e, 0x79, 0x71]
const GLYPHS = "0123456789AbCdEF"

const LIT = glow.red

const hex2 = (n: number) => `0x${n.toString(16).toUpperCase().padStart(2, "0")}`

// The digit on a 140 × 196 canvas: bars a / g / d at y = 34 / 98 / 162, columns f, e at x = 40 and b, c at x = 100.
const horizontal = (cx: number, cy: number) => `${cx - 28},${cy} ${cx - 21},${cy - 7} ${cx + 21},${cy - 7} ${cx + 28},${cy} ${cx + 21},${cy + 7} ${cx - 21},${cy + 7}`
const vertical = (cx: number, cy: number) => `${cx},${cy - 30} ${cx + 7},${cy - 23} ${cx + 7},${cy + 23} ${cx},${cy + 30} ${cx - 7},${cy + 23} ${cx - 7},${cy - 23}`
const SHAPES: Record<(typeof SEGMENTS)[number], { points: string; label: [number, number] }> = {
  a: { points: horizontal(70, 34), label: [70, 19] },
  b: { points: vertical(100, 66), label: [118, 70.5] },
  c: { points: vertical(100, 130), label: [118, 134.5] },
  d: { points: horizontal(70, 162), label: [70, 185] },
  e: { points: vertical(40, 130), label: [22, 134.5] },
  f: { points: vertical(40, 66), label: [22, 70.5] },
  g: { points: horizontal(70, 98), label: [70, 85] },
}

/** Four input bits → the seven segment lines → a digit that shows 0–F. */
export function SevenSegLab() {
  const [value, setValue] = React.useState(10)
  const [anode, setAnode] = React.useState(false)
  const code = CODES[value]
  const lit = SEGMENTS.map((_, i) => ((code >> i) & 1) === 1)
  // a common-anode display lights a segment when its line is pulled low
  const level = (on: boolean) => (on !== anode ? 1 : 0)
  const wireCode = anode ? ~code & 0x7f : code
  const litNames = SEGMENTS.filter((_, i) => lit[i]).join(" ")
  const glyph = GLYPHS[value]
  return (
    <Lab
      title="七段译码器"
      hint="点 4 个输入位，或者拖滑块从 0 走到 15：译码器决定 a–g 七段里哪几段亮。"
      onReset={() => {
        setValue(10)
        setAnode(false)
      }}
    >
      <LabStage>
        <div className="grid items-center justify-center justify-items-center gap-x-10 gap-y-4 @xl:grid-cols-[auto_auto]">
          <div className="flex flex-col items-center gap-2">
            <p className="text-caption text-muted-foreground">4 位二进制输入</p>
            <div className="flex gap-1.5">
              {[3, 2, 1, 0].map((i) => {
                const on = ((value >> i) & 1) === 1
                return (
                  <div key={i} className="flex flex-col items-center gap-0.5">
                    <button
                      type="button"
                      aria-pressed={on}
                      aria-label={`输入位 D${i}（位权 ${2 ** i}），现在是 ${on ? 1 : 0}，点击翻转`}
                      onClick={() => setValue((v) => v ^ (1 << i))}
                      className={cn(
                        "tabular size-9 rounded-md border text-body font-semibold transition-colors duration-(--duration-fast)",
                        on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background text-muted-foreground hover:bg-accent",
                      )}
                    >
                      {on ? 1 : 0}
                    </button>
                    <span className="tabular text-caption text-faint-foreground">D{i}</span>
                  </div>
                )
              })}
            </div>
            <ArrowDown aria-hidden className="size-4 text-faint-foreground" />
            <p className="text-caption text-muted-foreground">译码器的 7 根输出线{anode ? "（低电平点亮）" : "（高电平点亮）"}</p>
            <div className="flex gap-1">
              {SEGMENTS.map((name, i) => (
                <div key={name} className="flex flex-col items-center gap-0.5">
                  <span
                    className={cn("tabular grid size-7 place-items-center rounded-sm border bg-background text-small font-semibold", !lit[i] && "border-input text-faint-foreground")}
                    style={lit[i] ? { borderColor: LIT, color: LIT } : undefined}
                  >
                    {level(lit[i])}
                  </span>
                  <span className="text-caption text-faint-foreground">{name}</span>
                </div>
              ))}
            </div>
          </div>
          <Schematic width={140} height={196} label={`七段数码管，显示 ${glyph}，点亮的段：${litNames}`}>
            {SEGMENTS.map((name, i) => (
              <g key={name}>
                <polygon points={SHAPES[name].points} fill={lit[i] ? LIT : "var(--input)"} fillOpacity={lit[i] ? 1 : 0.55} stroke="none" />
                <Label x={SHAPES[name].label[0]} y={SHAPES[name].label[1]} muted={!lit[i]} weight={lit[i] ? 600 : 400}>
                  {name}
                </Label>
              </g>
            ))}
          </Schematic>
        </div>
      </LabStage>
      <LabControls>
        <SliderField label="输入的数" value={value} onChange={(v) => setValue(Math.round(v))} min={0} max={15} step={1} format={(v) => `${v}（${bin4(v)}）`} />
        <SwitchField label="换成共阳数码管" checked={anode} onChange={setAnode} hint="公共端接电源，输出低电平的段才亮" />
      </LabControls>
      <LabReadouts>
        <Readout label="二进制" value={bin4(value)} />
        <Readout label="十六进制" value={`0x${glyph.toUpperCase()}`} />
        <Readout label="数码管显示" value={glyph} color={LIT} />
        <Readout label="段码（gfedcba）" value={hex2(wireCode)} sub={wireCode.toString(2).padStart(7, "0")} />
      </LabReadouts>
      <LabNote>
        输入 {bin4(value)}（十进制 {value}）：点亮 {litNames} 这 {lit.filter(Boolean).length} 段，显示「{glyph}」。
        {value === 11 || value === 13 ? "七段拼不出大写的 B 和 D（会和 8、0 长得一样），所以用小写的 b、d。" : ""}
        {anode ? "共阳接法下输出全部取反：要亮的段输出 0。" : ""}
      </LabNote>
    </Lab>
  )
}

function bin4(n: number) {
  return n.toString(2).padStart(4, "0")
}

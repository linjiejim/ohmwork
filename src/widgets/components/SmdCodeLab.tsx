import * as React from "react"
import { Button, ControlField, Input, Lab, LabControls, LabNote, LabReadouts, LabStage, Label, Readout, Schematic, Tex, formatSI, tex } from "@/lab"

/* A chip resistor seen from above: black body, white print, tinned end caps. Real-part colours, so they are data. */
const CHIP = {
  body: "#232323", // design-allow: 贴片电阻本体的实物颜色
  mark: "#f2f2f2", // design-allow: 贴片电阻丝印的实物颜色
  cap: "#c4c7ca", // design-allow: 贴片电阻焊端的实物颜色
}

const PRESETS = ["103", "472", "100", "4R7", "1002", "000"]

type Parsed = { ok: true; value: number; style: string; tolerance: string; explain: React.ReactNode; caution?: boolean } | { ok: false; explain: string }

/** Decode a chip-resistor marking: three or four digits, or an R standing in for the decimal point. Never returns NaN. */
function parseSmd(raw: string): Parsed {
  const s = raw.trim().toUpperCase()
  const jumper: Parsed = { ok: true, value: 0, style: "0 Ω 跳线", tolerance: "—", explain: "有效数字是 0：这是 0 Ω 电阻，当一根跳线用，用来跨过走线或预留选项。" }
  if (/^0{1,4}$/.test(s)) return jumper

  const withR = /^(\d*)R(\d*)$/.exec(s)
  if (withR && (s.length === 3 || s.length === 4)) {
    const value = Number(`${withR[1] || "0"}.${withR[2] || "0"}`)
    if (value === 0) return jumper
    return {
      ok: true,
      value,
      style: "R 当小数点",
      tolerance: s.length === 3 ? "通常 ±5%" : "通常 ±1%",
      explain: `R 站在小数点的位置：${s} 读作 ${withR[1] || "0"}.${withR[2] || "0"} Ω。带小数的小阻值没法用「加几个零」表示，就这样写。`,
    }
  }

  if (/^\d{3,4}$/.test(s)) {
    const nSig = s.length - 1
    const sig = Number(s.slice(0, nSig))
    const zeros = Number(s[nSig])
    if (sig === 0) return jumper
    const value = sig * 10 ** zeros
    const head = `前${nSig === 2 ? "两" : "三"}位 ${s.slice(0, nSig)} 是有效数字，最后一位 ${zeros} `
    return {
      ok: true,
      value,
      style: nSig === 2 ? "三位数字" : "四位数字",
      tolerance: nSig === 2 ? "通常 ±5%" : "通常 ±1%",
      caution: zeros === 0,
      explain:
        zeros === 0
          ? `${head}表示后面一个零也不加：${s} 是 ${formatSI(value, "Ω")}，不是 ${s} Ω。这是最容易读错的一种。`
          : (
              <>
                {head}表示后面再加 {zeros} 个零：<Tex>{String.raw`${sig} \times 10^{${zeros}}\,\Omega = ${tex.si(value, "Ω")}`}</Tex>。
              </>
            ),
    }
  }

  return { ok: false, explain: "认不出这个丝印。这里支持三位或四位数字，以及用 R 当小数点的写法，比如 103、1002、4R7。" }
}

/** Type a chip-resistor marking (103, 4R7, 1002 …) and see the value it stands for. */
export function SmdCodeLab() {
  const [text, setText] = React.useState("103")
  const parsed = parseSmd(text)
  const shown = text.trim().toUpperCase().slice(0, 4) || "?"
  return (
    <Lab title="贴片丝印读数器" hint="输入电阻上印的三位或四位代码，或者点下面的例子。" onReset={() => setText("103")}>
      <LabStage>
        <Schematic width={300} height={112} label={`一只贴片电阻，上面印着 ${shown}`}>
          <rect x={78} y={24} width={144} height={60} rx={3} fill={CHIP.cap} />
          <rect x={102} y={24} width={96} height={60} fill={CHIP.body} />
          <Label x={150} y={64} size={28} weight={600} color={CHIP.mark}>
            {shown}
          </Label>
          <Label x={150} y={104} muted>
            0603 封装的实物只有 1.6 mm × 0.8 mm
          </Label>
        </Schematic>
      </LabStage>
      <LabControls>
        <ControlField label="丝印">
          <Input className="w-28" value={text} maxLength={4} onChange={(e) => setText(e.target.value.slice(0, 4))} aria-label="贴片电阻上的丝印" spellCheck={false} autoComplete="off" />
        </ControlField>
        <ControlField label="试试这些">
          {PRESETS.map((code) => (
            <Button key={code} size="sm" className="tabular" aria-label={`填入 ${code}`} onClick={() => setText(code)}>
              {code}
            </Button>
          ))}
        </ControlField>
      </LabControls>
      <LabReadouts>
        <Readout label="阻值" value={parsed.ok ? formatSI(parsed.value, "Ω") : "—"} />
        <Readout label="写法" value={parsed.ok ? parsed.style : "—"} />
        <Readout label="精度" value={parsed.ok ? parsed.tolerance : "—"} />
      </LabReadouts>
      <LabNote tone={!parsed.ok || parsed.caution ? "warn" : "neutral"}>{parsed.explain}</LabNote>
    </Lab>
  )
}

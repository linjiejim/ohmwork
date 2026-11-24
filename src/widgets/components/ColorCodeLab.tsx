import * as React from "react"
import { ControlField, Lab, LabControls, LabNote, LabReadouts, LabStage, Label, Readout, Schematic, Segmented, Select, formatSI } from "@/lab"

type ColorKey = "black" | "brown" | "red" | "orange" | "yellow" | "green" | "blue" | "violet" | "grey" | "white" | "gold" | "silver"

interface BandColor {
  key: ColorKey
  /** The colour's name is always written beside the swatch: colour is never the only signal. */
  name: string
  hex: string
  /** Significant digit, for the colours that stand for one. */
  digit?: number
  /** Multiplier as a power of ten, for the colours used on the multiplier band. */
  exp?: number
  /** Tolerance in percent, for the colours used on the tolerance band. */
  tol?: number
}

/* The standard resistor colour code (IEC 60062). The hex values are the paint on the real part, so they are data, not theme. */
const COLORS: BandColor[] = [
  { key: "black", name: "黑", hex: "#1c1c1c", digit: 0, exp: 0 }, // design-allow: 色环是实物颜色
  { key: "brown", name: "棕", hex: "#7b4a1e", digit: 1, exp: 1, tol: 1 }, // design-allow: 色环是实物颜色
  { key: "red", name: "红", hex: "#d0281e", digit: 2, exp: 2, tol: 2 }, // design-allow: 色环是实物颜色
  { key: "orange", name: "橙", hex: "#f07f13", digit: 3, exp: 3 }, // design-allow: 色环是实物颜色
  { key: "yellow", name: "黄", hex: "#f5d10d", digit: 4, exp: 4 }, // design-allow: 色环是实物颜色
  { key: "green", name: "绿", hex: "#2e9e4b", digit: 5, exp: 5, tol: 0.5 }, // design-allow: 色环是实物颜色
  { key: "blue", name: "蓝", hex: "#2b63c9", digit: 6, exp: 6, tol: 0.25 }, // design-allow: 色环是实物颜色
  { key: "violet", name: "紫", hex: "#8e44ad", digit: 7, exp: 7, tol: 0.1 }, // design-allow: 色环是实物颜色
  { key: "grey", name: "灰", hex: "#8c8c8c", digit: 8 }, // design-allow: 色环是实物颜色
  { key: "white", name: "白", hex: "#f7f7f7", digit: 9 }, // design-allow: 色环是实物颜色
  { key: "gold", name: "金", hex: "#c9a227", exp: -1, tol: 5 }, // design-allow: 色环是实物颜色
  { key: "silver", name: "银", hex: "#bfc3c7", exp: -2, tol: 10 }, // design-allow: 色环是实物颜色
]
const BY_KEY = Object.fromEntries(COLORS.map((c) => [c.key, c])) as Record<ColorKey, BandColor>

/* Body paint: carbon-film parts (usually 4 bands) are beige, metal-film parts (usually 5 bands) are blue. */
const BODY = {
  "4": "#e3cfa4", // design-allow: 碳膜电阻本体的实物颜色
  "5": "#8fbadb", // design-allow: 金属膜电阻本体的实物颜色
}

type Role = "first" | "digit" | "mult" | "tol"
type Count = "4" | "5"

const ROLES: Record<Count, Role[]> = {
  "4": ["first", "digit", "mult", "tol"],
  "5": ["first", "digit", "digit", "mult", "tol"],
}
const ROLE_NAME: Record<Count, string[]> = {
  "4": ["第一位数字", "第二位数字", "倍率", "精度"],
  "5": ["第一位数字", "第二位数字", "第三位数字", "倍率", "精度"],
}
/** Band centres along the body (which spans x = 62 … 238). The tolerance band sits apart, as on the real part. */
const BAND_X: Record<Count, number[]> = {
  "4": [88, 110, 142, 208],
  "5": [84, 104, 124, 154, 208],
}
const INITIAL: Record<Count, ColorKey[]> = {
  "4": ["yellow", "violet", "red", "gold"], // 47 × 100 = 4.7 kΩ ±5%
  "5": ["yellow", "violet", "black", "brown", "brown"], // 470 × 10 = 4.7 kΩ ±1%
}

const MULT_TEXT: Record<number, string> = { [-2]: "0.01", [-1]: "0.1", 0: "1", 1: "10", 2: "100", 3: "1 k", 4: "10 k", 5: "100 k", 6: "1 M", 7: "10 M" }

function allowed(role: Role): BandColor[] {
  if (role === "first") return COLORS.filter((c) => c.digit != null && c.digit > 0)
  if (role === "digit") return COLORS.filter((c) => c.digit != null)
  if (role === "mult") return [...COLORS.filter((c) => c.exp != null && c.exp < 0).reverse(), ...COLORS.filter((c) => c.exp != null && c.exp >= 0)]
  return COLORS.filter((c) => c.tol != null).sort((a, b) => a.tol! - b.tol!)
}

/** What a colour means on a band with this role: "4", "×100", "±5%". */
function meaning(c: BandColor, role: Role): string {
  if (role === "mult") return `×${MULT_TEXT[c.exp ?? 0]}`
  if (role === "tol") return `±${c.tol ?? 0}%`
  return String(c.digit ?? 0)
}

/** n × 10^exp without the float dust that 47 * 0.1 would leave. */
const scale10 = (n: number, exp: number) => (exp >= 0 ? n * 10 ** exp : n / 10 ** -exp)

const E24 = [10, 11, 12, 13, 15, 16, 18, 20, 22, 24, 27, 30, 33, 36, 39, 43, 47, 51, 56, 62, 68, 75, 82, 91]
/** Standard values as three-digit significands (100 … 1000). Two-digit codes come from E24; three-digit codes from E96, and 1% parts are sold in E24 values too. */
const SERIES: Record<Count, { name: string; values: number[] }> = {
  "4": { name: "E24", values: [...E24.map((v) => v * 10), 1000] },
  "5": {
    name: "E24 / E96",
    values: [...new Set([...Array.from({ length: 96 }, (_, i) => Math.round(100 * 10 ** (i / 96))), ...E24.map((v) => v * 10), 1000])].sort((a, b) => a - b),
  },
}

/** Read a resistor's colour bands: pick 4 or 5 bands and a colour for each, get the value, tolerance and whether it is a standard value. */
export function ColorCodeLab() {
  const [count, setCount] = React.useState<Count>("4")
  const [picked, setPicked] = React.useState(INITIAL)

  const roles = ROLES[count]
  const bands = picked[count].map((key) => BY_KEY[key])
  const setBand = (index: number, key: ColorKey) => setPicked((p) => ({ ...p, [count]: p[count].map((k, i) => (i === index ? key : k)) }))

  const nDigits = roles.length - 2
  const digits = bands.slice(0, nDigits).reduce((n, c) => n * 10 + (c.digit ?? 0), 0)
  const exp = bands[nDigits].exp ?? 0
  const tol = bands[nDigits + 1].tol ?? 0
  const value = scale10(digits, exp)
  const lo = value * (1 - tol / 100)
  const hi = value * (1 + tol / 100)

  // Is it a value you can buy? Compare as a three-digit significand so both codings share one list.
  const series = SERIES[count]
  const sig3 = count === "4" ? digits * 10 : digits
  const exp3 = count === "4" ? exp - 1 : exp
  const standard = series.values.includes(sig3)
  const below = [...series.values].reverse().find((v) => v < sig3) ?? series.values[0]
  const above = series.values.find((v) => v > sig3) ?? series.values[series.values.length - 1]

  const sum = `${digits} × ${MULT_TEXT[exp]} = ${formatSI(value, "Ω")}`

  return (
    <Lab
      title="色环读数器"
      hint="先选 4 环还是 5 环，再给每一环选颜色。试着拼出 5 kΩ，看看会怎样。"
      onReset={() => {
        setCount("4")
        setPicked(INITIAL)
      }}
    >
      <LabStage>
        <Schematic width={300} height={130} label={`一只 ${count} 环电阻，色环依次是${bands.map((c) => c.name).join("、")}`}>
          <Label x={62} y={24} anchor="start" muted>
            从色环密的一端读起 →
          </Label>
          {/* leads, then the body */}
          <path d="M12 60H62M238 60H288" strokeWidth={3} />
          <rect x={62} y={38} width={176} height={44} rx={14} fill={BODY[count]} stroke="none" />
          {bands.map((c, i) => (
            <rect key={i} x={BAND_X[count][i] - 6.5} y={38.5} width={13} height={43} fill={c.hex} strokeWidth={0.75} strokeOpacity={0.45} />
          ))}
          <rect x={62} y={38} width={176} height={44} rx={14} />
          {/* every band says its colour and what it stands for */}
          {bands.map((c, i) => (
            <React.Fragment key={i}>
              <Label x={BAND_X[count][i]} y={102}>
                {c.name}
              </Label>
              <Label x={BAND_X[count][i]} y={118} muted>
                {meaning(c, roles[i])}
              </Label>
            </React.Fragment>
          ))}
        </Schematic>
      </LabStage>
      <LabControls columns={3}>
        <ControlField label="色环数">
          <Segmented
            aria-label="色环数"
            value={count}
            onValueChange={setCount}
            options={[
              { value: "4", label: "4 环" },
              { value: "5", label: "5 环" },
            ]}
          />
        </ControlField>
        {roles.map((role, i) => (
          <ControlField key={`${count}-${i}`} label={`第 ${i + 1} 环 · ${ROLE_NAME[count][i]}`}>
            <Select
              aria-label={`第 ${i + 1} 环的颜色`}
              value={bands[i].key}
              onValueChange={(key) => setBand(i, key as ColorKey)}
              options={allowed(role).map((c) => ({
                value: c.key,
                label: (
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden className="size-3 shrink-0 rounded-full border" style={{ background: c.hex }} />
                    {c.name}
                    <span className="tabular text-muted-foreground">{meaning(c, role)}</span>
                  </span>
                ),
              }))}
            />
          </ControlField>
        ))}
      </LabControls>
      <LabReadouts>
        <Readout label="阻值" value={formatSI(value, "Ω")} />
        <Readout label="精度" value={`±${tol}%`} />
        <Readout label="合格范围" value={`${formatSI(lo, "Ω", 4)} – ${formatSI(hi, "Ω", 4)}`} />
        <Readout label={`${series.name} 标准值`} value={standard ? "是" : "不是"} />
      </LabReadouts>
      {standard ? (
        <LabNote tone="good">
          {sum}，精度 ±{tol}%：实测落在 {formatSI(lo, "Ω", 4)} 到 {formatSI(hi, "Ω", 4)} 之间都算合格。它是 {series.name} 系列的标准值，买得到。
        </LabNote>
      ) : (
        <LabNote tone="warn">
          {sum}。读法没错，但它不在 {series.name} 系列里，市面上基本买不到。最接近的标准值是 {formatSI(scale10(below, exp3), "Ω")} 和 {formatSI(scale10(above, exp3), "Ω")}。
        </LabNote>
      )}
    </Lab>
  )
}

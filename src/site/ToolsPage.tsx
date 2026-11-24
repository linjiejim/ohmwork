import * as React from "react"
import { Link } from "react-router-dom"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Page, PageHeader, Section } from "@/components/ui/page"
import { Segmented } from "@/components/ui/segmented"
import { fixed, formatSI, parseSI, sig } from "@/lab/format"
import { nearestE, parallel } from "@/lab/math"
import { Tex } from "@/lab/Tex"

interface InputDef {
  key: string
  label: string
  initial: string
  /** Zero and negative values are fine (a level in dBm). Default: must be > 0. */
  anySign?: boolean
}

interface Result {
  label: string
  /** A symbol or formula set after the label, as TeX. */
  tex?: string
  value: string
}

interface Variant {
  id: string
  label: string
  inputs: InputDef[]
  compute: (v: Record<string, number>) => Result[]
}

interface CalcDef {
  id: string
  title: string
  formula: React.ReactNode
  lesson?: { to: string; label: string }
  variants: Variant[]
}

/** The smallest E24 value that is not below `value`: a resistor that keeps current at or under the target. */
function ceilE24(value: number) {
  let r = nearestE(value, "E24")
  for (let i = 0; i < 3 && r < value * 0.9999; i++) r = nearestE(r * 1.06, "E24")
  return r
}

const C0 = 299_792_458

const CALCS: CalcDef[] = [
  {
    id: "ohm",
    title: "欧姆定律与功率",
    formula: (
      <>
        <Tex>{"I = V/R"}</Tex>，<Tex>{"P = VI"}</Tex>
      </>
    ),
    lesson: { to: "/learn/basics/ohms-law", label: "欧姆定律" },
    variants: [
      {
        id: "i",
        label: "求电流",
        inputs: [
          { key: "v", label: "电压", initial: "5" },
          { key: "r", label: "电阻", initial: "1k" },
        ],
        compute: ({ v, r }) => [
          { label: "电流", value: formatSI(v / r, "A") },
          { label: "功率", value: formatSI((v * v) / r, "W") },
        ],
      },
      {
        id: "v",
        label: "求电压",
        inputs: [
          { key: "i", label: "电流", initial: "20m" },
          { key: "r", label: "电阻", initial: "150" },
        ],
        compute: ({ i, r }) => [
          { label: "电压", value: formatSI(i * r, "V") },
          { label: "功率", value: formatSI(i * i * r, "W") },
        ],
      },
      {
        id: "r",
        label: "求电阻",
        inputs: [
          { key: "v", label: "电压", initial: "3.3" },
          { key: "i", label: "电流", initial: "1m" },
        ],
        compute: ({ v, i }) => [
          { label: "电阻", value: formatSI(v / i, "Ω") },
          { label: "功率", value: formatSI(v * i, "W") },
        ],
      },
    ],
  },
  {
    id: "led",
    title: "LED 限流电阻",
    formula: <Tex>{"R = (V_s - V_f)/I_f"}</Tex>,
    lesson: { to: "/learn/semiconductors/leds-zeners", label: "LED 与稳压二极管" },
    variants: [
      {
        id: "led",
        label: "",
        inputs: [
          { key: "vs", label: "电源电压", initial: "5" },
          { key: "vf", label: "LED 压降 Vf", initial: "2.0" },
          { key: "i", label: "目标电流", initial: "10m" },
        ],
        compute: ({ vs, vf, i }) => {
          if (vs <= vf) return [{ label: "结果", value: "电源电压要高于 LED 压降" }]
          const exact = (vs - vf) / i
          const std = ceilE24(exact)
          const actual = (vs - vf) / std
          return [
            { label: "计算阻值", value: formatSI(exact, "Ω") },
            { label: "选用标准值（E24）", value: formatSI(std, "Ω") },
            { label: "实际电流", value: formatSI(actual, "A") },
            { label: "电阻功耗", value: formatSI(actual * actual * std, "W") },
          ]
        },
      },
    ],
  },
  {
    id: "divider",
    title: "分压器",
    formula: <Tex>{String.raw`V_{\mathrm{out}} = V_{\mathrm{in}} \times R_2/(R_1 + R_2)`}</Tex>,
    lesson: { to: "/learn/basics/voltage-divider", label: "分压器与基尔霍夫定律" },
    variants: [
      {
        id: "out",
        label: "求输出",
        inputs: [
          { key: "vin", label: "输入电压", initial: "12" },
          { key: "r1", label: "上电阻 R1", initial: "30k" },
          { key: "r2", label: "下电阻 R2", initial: "10k" },
        ],
        compute: ({ vin, r1, r2 }) => [
          { label: "输出电压", value: formatSI((vin * r2) / (r1 + r2), "V") },
          { label: "流过分压器的电流", value: formatSI(vin / (r1 + r2), "A") },
          { label: "输出阻抗（R1 ∥ R2）", value: formatSI(parallel(r1, r2), "Ω") },
        ],
      },
      {
        id: "pick",
        label: "选电阻",
        inputs: [
          { key: "vin", label: "输入电压", initial: "12" },
          { key: "vout", label: "想要的输出", initial: "3.3" },
          { key: "r2", label: "下电阻 R2", initial: "10k" },
        ],
        compute: ({ vin, vout, r2 }) => {
          if (vout >= vin) return [{ label: "结果", value: "分压器只能降压，输出要低于输入" }]
          const exact = r2 * (vin / vout - 1)
          const std = nearestE(exact, "E24")
          return [
            { label: "R1 计算值", value: formatSI(exact, "Ω") },
            { label: "R1 选用标准值（E24）", value: formatSI(std, "Ω") },
            { label: "实际输出", value: formatSI((vin * r2) / (std + r2), "V") },
          ]
        },
      },
    ],
  },
  {
    id: "rc",
    title: "RC 时间常数与截止频率",
    formula: (
      <>
        <Tex>{String.raw`\tau = RC`}</Tex>，<Tex>{String.raw`f_c = 1/(2\pi RC)`}</Tex>
      </>
    ),
    lesson: { to: "/learn/ac-signals/rc-filters", label: "RC 滤波器" },
    variants: [
      {
        id: "rc",
        label: "",
        inputs: [
          { key: "r", label: "电阻", initial: "10k" },
          { key: "c", label: "电容", initial: "100n" },
        ],
        compute: ({ r, c }) => [
          { label: "时间常数 τ", value: formatSI(r * c, "s") },
          { label: "基本充满（5τ）", value: formatSI(5 * r * c, "s") },
          { label: "截止频率", value: formatSI(1 / (2 * Math.PI * r * c), "Hz") },
        ],
      },
    ],
  },
  {
    id: "lc",
    title: "LC 谐振频率",
    formula: <Tex>{String.raw`f_0 = 1/(2\pi\sqrt{LC})`}</Tex>,
    lesson: { to: "/learn/ac-signals/resonance", label: "LC 谐振" },
    variants: [
      {
        id: "lc",
        label: "",
        inputs: [
          { key: "l", label: "电感", initial: "10u" },
          { key: "c", label: "电容", initial: "100p" },
        ],
        compute: ({ l, c }) => [
          { label: "谐振频率", value: formatSI(1 / (2 * Math.PI * Math.sqrt(l * c)), "Hz") },
          { label: "特性阻抗", tex: String.raw`\sqrt{L/C}`, value: formatSI(Math.sqrt(l / c), "Ω") },
        ],
      },
    ],
  },
  {
    id: "combine",
    title: "电阻串联与并联",
    formula: (
      <>
        串联相加；并联 <Tex>{"1/R = 1/R_1 + 1/R_2"}</Tex>
      </>
    ),
    lesson: { to: "/learn/basics/series-parallel", label: "串联与并联" },
    variants: [
      {
        id: "combine",
        label: "",
        inputs: [
          { key: "r1", label: "R1", initial: "10k" },
          { key: "r2", label: "R2", initial: "4.7k" },
        ],
        compute: ({ r1, r2 }) => [
          { label: "串联", value: formatSI(r1 + r2, "Ω") },
          { label: "并联", value: formatSI(parallel(r1, r2), "Ω") },
        ],
      },
    ],
  },
  {
    id: "battery",
    title: "电池续航",
    formula: "时间 = 容量 / 平均电流",
    lesson: { to: "/learn/basics/power-energy", label: "功率与能量" },
    variants: [
      {
        id: "battery",
        label: "",
        inputs: [
          { key: "cap", label: "容量（mAh）", initial: "2000" },
          { key: "i", label: "平均电流", initial: "15m" },
        ],
        compute: ({ cap, i }) => {
          const hours = cap / 1000 / i
          const text = (h: number) => (h >= 48 ? `${sig(h / 24)} 天` : h >= 1 ? `${sig(h)} 小时` : `${sig(h * 60)} 分钟`)
          return [
            { label: "理论续航", value: text(hours) },
            { label: "按 80% 可用容量估算", value: text(hours * 0.8) },
          ]
        },
      },
    ],
  },
  {
    id: "db",
    title: "分贝换算",
    formula: (
      <>
        电压比 <Tex>{String.raw`20\log`}</Tex>，功率比 <Tex>{String.raw`10\log`}</Tex>；<Tex>{String.raw`0\,\mathrm{dBm} = 1\,\mathrm{mW}`}</Tex>
      </>
    ),
    lesson: { to: "/learn/ac-signals/spectrum", label: "频谱与分贝" },
    variants: [
      {
        id: "ratio",
        label: "倍数 → dB",
        inputs: [{ key: "x", label: "倍数", initial: "10" }],
        compute: ({ x }) => [
          { label: "当作电压比", value: `${fixed(20 * Math.log10(x), 2)} dB` },
          { label: "当作功率比", value: `${fixed(10 * Math.log10(x), 2)} dB` },
        ],
      },
      {
        id: "db",
        label: "dB → 倍数",
        inputs: [{ key: "db", label: "分贝值", initial: "-3", anySign: true }],
        compute: ({ db }) => [
          { label: "电压比", value: `${sig(10 ** (db / 20), 4)} 倍` },
          { label: "功率比", value: `${sig(10 ** (db / 10), 4)} 倍` },
        ],
      },
      {
        id: "dbm",
        label: "dBm → 功率",
        inputs: [{ key: "dbm", label: "功率（dBm）", initial: "20", anySign: true }],
        compute: ({ dbm }) => {
          const w = 10 ** (dbm / 10) / 1000
          return [
            { label: "功率", value: formatSI(w, "W") },
            { label: "50 Ω 上的有效值电压", value: formatSI(Math.sqrt(w * 50), "V") },
          ]
        },
      },
    ],
  },
  {
    id: "wave",
    title: "频率与波长",
    formula: <Tex>{String.raw`\lambda = c/f`}</Tex>,
    lesson: { to: "/learn/rf/em-waves", label: "电磁波与无线电频谱" },
    variants: [
      {
        id: "wave",
        label: "",
        inputs: [{ key: "f", label: "频率", initial: "2.4G" }],
        compute: ({ f }) => [
          { label: "波长 λ", value: formatSI(C0 / f, "m") },
          { label: "半波长（偶极子总长）", value: formatSI(C0 / f / 2, "m") },
          { label: "四分之一波长（单极子）", value: formatSI(C0 / f / 4, "m") },
        ],
      },
    ],
  },
  {
    id: "adc",
    title: "ADC 分辨率",
    formula: <Tex>{String.raw`1\,\mathrm{LSB} = V_{\mathrm{ref}}/2^N`}</Tex>,
    lesson: { to: "/learn/digital/adc-dac", label: "ADC 与 DAC" },
    variants: [
      {
        id: "adc",
        label: "",
        inputs: [
          { key: "vref", label: "参考电压", initial: "3.3" },
          { key: "bits", label: "位数", initial: "12" },
        ],
        compute: ({ vref, bits }) => {
          const n = Math.min(32, Math.max(1, Math.round(bits)))
          return [
            { label: "台阶数", value: (2 ** n).toLocaleString("en-US") },
            { label: "每个台阶（1 LSB）", value: formatSI(vref / 2 ** n, "V") },
          ]
        },
      },
    ],
  },
  {
    id: "555",
    title: "555 无稳态振荡",
    formula: <Tex>{String.raw`f = 1.44/\big((R_A + 2R_B) \times C\big)`}</Tex>,
    lesson: { to: "/learn/analog/oscillators-555", label: "振荡器与 555 定时器" },
    variants: [
      {
        id: "555",
        label: "",
        inputs: [
          { key: "ra", label: "RA", initial: "10k" },
          { key: "rb", label: "RB", initial: "47k" },
          { key: "c", label: "C", initial: "10u" },
        ],
        compute: ({ ra, rb, c }) => {
          const high = Math.LN2 * (ra + rb) * c
          const low = Math.LN2 * rb * c
          return [
            { label: "频率", value: formatSI(1 / (high + low), "Hz") },
            { label: "高电平时间", value: formatSI(high, "s") },
            { label: "低电平时间", value: formatSI(low, "s") },
            { label: "占空比", value: `${fixed((high / (high + low)) * 100, 1)}%` },
          ]
        },
      },
    ],
  },
]

function Calc({ def }: { def: CalcDef }) {
  const [variantId, setVariantId] = React.useState(def.variants[0].id)
  const variant = def.variants.find((v) => v.id === variantId) ?? def.variants[0]
  const [text, setText] = React.useState<Record<string, string>>(() => Object.fromEntries(def.variants.flatMap((v) => v.inputs.map((i) => [`${v.id}.${i.key}`, i.initial]))))
  const parsed = variant.inputs.map((input) => {
    const value = parseSI(text[`${variant.id}.${input.key}`] ?? "")
    const bad = !Number.isFinite(value) || (!input.anySign && value <= 0)
    return { input, value, bad }
  })
  const results = parsed.some((p) => p.bad) ? null : variant.compute(Object.fromEntries(parsed.map((p) => [p.input.key, p.value])))
  return (
    <section aria-labelledby={`calc-${def.id}`} className="flex flex-col rounded-lg border">
      <header className="px-4 pt-3">
        <h3 id={`calc-${def.id}`} className="text-heading font-semibold">
          {def.title}
        </h3>
        <p className="mt-0.5 text-small text-muted-foreground">{def.formula}</p>
      </header>
      <div className="flex flex-1 flex-col gap-3 px-4 py-3">
        {def.variants.length > 1 && <Segmented size="sm" aria-label="计算方式" className="self-start" value={variant.id} onValueChange={setVariantId} options={def.variants.map((v) => ({ value: v.id, label: v.label }))} />}
        <div className="grid grid-cols-2 gap-3">
          {parsed.map(({ input, bad }) => (
            <Field key={`${variant.id}.${input.key}`} label={input.label} error={bad ? (input.anySign ? "填一个数字" : "填一个大于 0 的数，例如 4.7k") : undefined}>
              <Input
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
                className="tabular"
                value={text[`${variant.id}.${input.key}`] ?? ""}
                onChange={(e) => setText((t) => ({ ...t, [`${variant.id}.${input.key}`]: e.target.value }))}
              />
            </Field>
          ))}
        </div>
      </div>
      <dl aria-live="polite" className="flex flex-col gap-1.5 border-t px-4 py-3">
        {(results ?? variant.compute(Object.fromEntries(variant.inputs.map((i) => [i.key, parseSI(i.initial)]))).map((r) => ({ ...r, value: "—" }))).map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-4">
            <dt className="text-small text-muted-foreground">
              {r.label}
              {r.tex && (
                <>
                  {" "}
                  <Tex>{r.tex}</Tex>
                </>
              )}
            </dt>
            <dd className="tabular text-body font-semibold">{r.value}</dd>
          </div>
        ))}
      </dl>
      {def.lesson && (
        <p className="border-t px-4 py-2 text-caption text-faint-foreground">
          讲它的课：
          <Link to={def.lesson.to} className="text-muted-foreground underline decoration-input underline-offset-4 hover:text-foreground">
            {def.lesson.label}
          </Link>
        </p>
      )}
    </section>
  )
}

// The colour-code decoder belongs to the resistor lesson; show it here too when that lesson's widget exists.
const colorCode = import.meta.glob<Record<string, React.ComponentType>>("/src/widgets/components/ColorCodeLab.tsx")
const ColorCodeLab = Object.values(colorCode)[0] ? React.lazy(() => Object.values(colorCode)[0]().then((m) => ({ default: m.ColorCodeLab ?? (() => null) }))) : null

/** Everyday calculators. Every field takes engineering shorthand: 4.7k, 100n, 2.4G, 20mA. */
export function ToolsPage() {
  return (
    <Page width="wide">
      <PageHeader title="工具箱" info="输入框认识工程写法：4.7k、100n、2.4G、20mA、4k7 都可以。" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {CALCS.map((def) => (
          <Calc key={def.id} def={def} />
        ))}
      </div>
      {ColorCodeLab && (
        <Section title="电阻色环" className="max-w-[720px]">
          <React.Suspense fallback={<div className="h-64" aria-busy="true" />}>
            <ColorCodeLab />
          </React.Suspense>
        </Section>
      )}
    </Page>
  )
}

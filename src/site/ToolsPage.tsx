import * as React from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, ChevronRight, CircleAlert, RotateCcw } from "lucide-react"
import { Button, IconButton } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Page, PageHeader } from "@/components/ui/page"
import { Segmented } from "@/components/ui/segmented"
import { StateView } from "@/components/ui/state"
import { LESSONS, lessonPath } from "@/curriculum/curriculum"
import { fixed, formatSI, parseSI, sig } from "@/lab/format"
import { useKeptState } from "@/lab/hooks"
import { nearestE, parallel } from "@/lab/math"
import { Tex } from "@/lab/Tex"
import { cn } from "@/lib/utils"
import { TOOL_GROUPS, TOOLS, toolPath, type ToolMeta } from "@/site/tools"
import { ColorCodeLab } from "@/widgets/components/ColorCodeLab"

/*
 * The toolbox as a list–detail page: the tools on the left, one tool on the right. At lg and up the
 * page is exactly the window's height and each column scrolls on its own; every tool is laid out to
 * fit a 1280 × 720 window without scrolling. Below lg it is one column: the list, or one tool with
 * a back button. Each tool has its own URL (/tools/<id>) and keeps what you set for the rest of the visit.
 */

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
  /** The results, or one sentence saying why these inputs can't work. */
  compute: (v: Record<string, number>) => Result[] | string
}

interface CalcDef {
  formula: React.ReactNode
  variants: Variant[]
}

/** The smallest E24 value that is not below `value`: a resistor that keeps current at or under the target. */
function ceilE24(value: number) {
  let r = nearestE(value, "E24")
  for (let i = 0; i < 3 && r < value * 0.9999; i++) r = nearestE(r * 1.06, "E24")
  return r
}

const C0 = 299_792_458

/** The calculators, by tool id (see tools.ts for names and order). */
const CALCS: Record<string, CalcDef> = {
  ohm: {
    formula: (
      <>
        <Tex>{"I = V/R"}</Tex>，<Tex>{"P = VI"}</Tex>
      </>
    ),
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
  led: {
    formula: <Tex>{"R = (V_s - V_f)/I_f"}</Tex>,
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
          if (vs <= vf) return "电源电压要高于 LED 压降"
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
  divider: {
    formula: <Tex>{String.raw`V_{\mathrm{out}} = V_{\mathrm{in}} \times R_2/(R_1 + R_2)`}</Tex>,
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
          if (vout >= vin) return "分压器只能降压，输出要低于输入"
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
  rc: {
    formula: (
      <>
        <Tex>{String.raw`\tau = RC`}</Tex>，<Tex>{String.raw`f_c = 1/(2\pi RC)`}</Tex>
      </>
    ),
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
  lc: {
    formula: <Tex>{String.raw`f_0 = 1/(2\pi\sqrt{LC})`}</Tex>,
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
  "series-parallel": {
    formula: (
      <>
        串联相加；并联 <Tex>{"1/R = 1/R_1 + 1/R_2"}</Tex>
      </>
    ),
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
  battery: {
    formula: "时间 = 容量 / 平均电流",
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
  decibel: {
    formula: (
      <>
        电压比 <Tex>{String.raw`20\log`}</Tex>，功率比 <Tex>{String.raw`10\log`}</Tex>；<Tex>{String.raw`0\,\mathrm{dBm} = 1\,\mathrm{mW}`}</Tex>
      </>
    ),
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
  wavelength: {
    formula: <Tex>{String.raw`\lambda = c/f`}</Tex>,
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
  adc: {
    formula: <Tex>{String.raw`1\,\mathrm{LSB} = V_{\mathrm{ref}}/2^N`}</Tex>,
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
  "555": {
    formula: <Tex>{String.raw`f = 1.44/\big((R_A + 2R_B) \times C\big)`}</Tex>,
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
}

/** Tools that are a lesson widget rather than a calculator. They take a key to keep their state under. */
const WIDGETS: Record<string, React.ComponentType<{ keepAs?: string }>> = {
  "color-code": ColorCodeLab,
}

const SHORTHAND = "输入框认识工程写法：4.7k、100n、2.4G、20mA、4k7 都可以。"

interface CalcState {
  variant: string
  /** What is typed in each field, by "variant.input". */
  text: Record<string, string>
}

const startState = (def: CalcDef): CalcState => ({
  variant: def.variants[0].id,
  text: Object.fromEntries(def.variants.flatMap((v) => v.inputs.map((i) => [`${v.id}.${i.key}`, i.initial]))),
})

/** The result labels with no values, for while an input can't be read. */
function blankResults(v: Variant): Result[] {
  const r = v.compute(Object.fromEntries(v.inputs.map((i) => [i.key, parseSI(i.initial)])))
  return Array.isArray(r) ? r.map((x) => ({ ...x, value: "—" })) : []
}

/** Tool name as the page title; below lg, a back button to the list sits left of it. */
function ToolHeader({ tool, info, actions }: { tool: ToolMeta; info?: React.ReactNode; actions?: React.ReactNode }) {
  const navigate = useNavigate()
  return (
    <PageHeader
      back={
        <IconButton label="返回工具列表" className="lg:hidden" onClick={() => navigate("/tools")}>
          <ArrowLeft />
        </IconButton>
      }
      title={tool.title}
      info={info}
      actions={actions}
    />
  )
}

function LessonLink({ lessonKey }: { lessonKey?: string }) {
  const ref = LESSONS.find((l) => l.key === lessonKey)
  if (!ref) return null
  return (
    <p className="mt-3 text-small text-muted-foreground">
      讲它的课：
      <Link to={lessonPath(ref.key)} className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground">
        {ref.lesson.title}
      </Link>
    </p>
  )
}

/*
 * One calculator, in the lab widgets' shape: the formula where a widget has its picture, then the
 * inputs, then the results. Inputs and results share one grid (4 columns from 576 wide, else 2), so
 * the results line up with the fields above them.
 */
function Calc({ tool, def }: { tool: ToolMeta; def: CalcDef }) {
  const [state, setState] = useKeptState(`tools.${tool.id}`, () => startState(def))
  const variant = def.variants.find((v) => v.id === state.variant) ?? def.variants[0]
  const field = (key: string) => `${variant.id}.${key}`
  const parsed = variant.inputs.map((input) => {
    const value = parseSI(state.text[field(input.key)] ?? "")
    const bad = !Number.isFinite(value) || (!input.anySign && value <= 0)
    return { input, value, bad }
  })
  const out = parsed.some((p) => p.bad) ? null : variant.compute(Object.fromEntries(parsed.map((p) => [p.input.key, p.value])))
  const problem = typeof out === "string" ? out : null
  const results = Array.isArray(out) ? out : blankResults(variant)
  return (
    <>
      <ToolHeader
        tool={tool}
        info={SHORTHAND}
        actions={
          <IconButton label="恢复初始值" className="text-muted-foreground" onClick={() => setState(startState(def))}>
            <RotateCcw />
          </IconButton>
        }
      />
      <section aria-label={tool.title} className="@container divide-y overflow-hidden rounded-lg border">
        <p className="bg-sunken px-4 py-4 text-center text-heading">{def.formula}</p>
        <div className="flex flex-col gap-3 px-4 py-4">
          {def.variants.length > 1 && (
            <Segmented
              aria-label="计算方式"
              className="self-start"
              value={variant.id}
              onValueChange={(v) => setState((s) => ({ ...s, variant: v }))}
              options={def.variants.map((v) => ({ value: v.id, label: v.label }))}
            />
          )}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 @xl:grid-cols-4">
            {parsed.map(({ input, bad }) => (
              <Field key={field(input.key)} label={input.label} error={bad ? (input.anySign ? "填一个数字" : "填一个大于 0 的数，例如 4.7k") : undefined}>
                <Input
                  inputMode="text"
                  autoComplete="off"
                  spellCheck={false}
                  className="tabular"
                  value={state.text[field(input.key)] ?? ""}
                  onChange={(e) => {
                    const value = e.target.value
                    setState((s) => ({ ...s, text: { ...s.text, [field(input.key)]: value } }))
                  }}
                />
              </Field>
            ))}
          </div>
        </div>
        <div aria-live="polite">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-4 @xl:grid-cols-4">
            {results.map((r) => (
              <div key={r.label} className="min-w-0">
                <dt className="text-small text-muted-foreground">
                  {r.label}
                  {r.tex && (
                    <>
                      {" "}
                      <Tex>{r.tex}</Tex>
                    </>
                  )}
                </dt>
                <dd className="tabular text-title font-semibold">{r.value}</dd>
              </div>
            ))}
          </dl>
          {problem && (
            <p className="flex items-start gap-1.5 border-t px-4 py-2.5 text-small text-warning">
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              {problem}
            </p>
          )}
        </div>
      </section>
      <LessonLink lessonKey={tool.lesson} />
    </>
  )
}

function ToolDetail({ tool }: { tool: ToolMeta }) {
  const calc = CALCS[tool.id]
  if (calc) return <Calc tool={tool} def={calc} />
  const Widget = WIDGETS[tool.id]
  if (!Widget) return <Missing />
  return (
    <>
      <ToolHeader tool={tool} />
      {/* the widget brings the margins it has in a lesson; here the page header spaces it */}
      <div className="*:my-0">
        <Widget keepAs={`tools.${tool.id}`} />
      </div>
      <LessonLink lessonKey={tool.lesson} />
    </>
  )
}

function Missing() {
  const navigate = useNavigate()
  return <StateView kind="empty" title="找不到这个工具" action={<Button onClick={() => navigate("/tools")}>回到工具箱</Button>} />
}

const WIDE = "(min-width: 64rem)" // Tailwind's lg, where the page splits into two columns

function useMediaQuery(query: string) {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(query)
      mq.addEventListener("change", onChange)
      return () => mq.removeEventListener("change", onChange)
    },
    [query],
  )
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}

const itemClass = cn(
  "flex h-(--nav-item-h) w-full items-center gap-2 rounded-md px-2 text-body text-muted-foreground",
  "transition-colors duration-(--duration-fast) hover:bg-accent hover:text-foreground [&_svg]:size-4 [&_svg]:shrink-0",
)
// the current tool looks like the current page in the sidebar (NavItem): fill and full-strength text, no bar
const currentClass = "bg-pressed font-medium text-foreground hover:bg-pressed"

/** Everyday calculators and the colour-code reader, one at a time. */
export function ToolsPage() {
  const { toolId } = useParams()
  const navigate = useNavigate()
  const wide = useMediaQuery(WIDE)
  // a wide screen has room for a tool beside the list, so /tools opens the first one; a narrow one shows the list
  const tool = toolId === undefined ? (wide ? TOOLS[0] : undefined) : TOOLS.find((t) => t.id === toolId)
  const showDetail = tool !== undefined || toolId !== undefined
  React.useEffect(() => {
    if (toolId === undefined && wide) navigate(toolPath(TOOLS[0].id), { replace: true })
  }, [toolId, wide, navigate])

  const list = React.useRef<HTMLElement>(null)
  const detail = React.useRef<HTMLDivElement>(null)
  const refocus = React.useRef(false)

  // ↑ / ↓ or K / J step through the tools, as in every list–detail view. Keys typed into a field,
  // held with ⌘ / Ctrl / Alt, or meant for a control or a layer above the page are left alone.
  const index = tool ? TOOLS.indexOf(tool) : -1
  React.useEffect(() => {
    if (index < 0) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return
      const step = e.key === "ArrowDown" || e.key === "j" ? 1 : e.key === "ArrowUp" || e.key === "k" ? -1 : 0
      if (!step) return
      const target = e.target instanceof HTMLElement ? e.target : null
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return
      if (target?.closest('[role="listbox"], [role="menu"]') || document.querySelector('[role="dialog"], [role="alertdialog"]')) return
      const next = TOOLS[index + step]
      if (!next) return
      e.preventDefault()
      refocus.current = !!list.current?.contains(document.activeElement)
      // stepping replaces the history entry: Back leaves the toolbox instead of replaying every step
      navigate(toolPath(next.id), { replace: true })
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [index, navigate])

  // a new tool starts at its top, its row stays in view in the list, and focus follows a key press made in the list
  React.useEffect(() => {
    if (detail.current) detail.current.scrollTop = 0
    const row = list.current?.querySelector<HTMLElement>('[aria-current="page"]')
    row?.scrollIntoView({ block: "nearest" })
    if (refocus.current) row?.focus()
    refocus.current = false
  }, [tool?.id])

  return (
    <Page width="full" fill className="flex-row p-0 max-sm:p-0">
      <nav
        ref={list}
        aria-label="工具"
        className={cn(
          "w-full overflow-y-auto px-(--space-page) pb-10 pt-(--space-page) max-sm:px-4 max-sm:pt-4",
          "lg:w-60 lg:shrink-0 lg:border-r lg:px-2 lg:pb-3",
          showDetail && "max-lg:hidden",
        )}
      >
        {/* on a wide screen the sidebar already says where you are and the tool's name is the title */}
        <PageHeader title="工具箱" className="lg:hidden" />
        {TOOL_GROUPS.map((group, g) => (
          <div key={group.label} className="mt-4 first-of-type:mt-0">
            <div id={`tool-group-${g}`} className="mb-1 px-2 text-caption font-medium text-faint-foreground">
              {group.label}
            </div>
            <ul aria-labelledby={`tool-group-${g}`} className="flex flex-col gap-px">
              {group.tools.map((t) => (
                <li key={t.id}>
                  <Link to={toolPath(t.id)} aria-current={t === tool ? "page" : undefined} className={cn(itemClass, t === tool && currentClass)}>
                    <t.icon aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{t.title}</span>
                    <ChevronRight aria-hidden className="text-faint-foreground lg:hidden" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      {showDetail && (
        <div ref={detail} className="min-w-0 flex-1 overflow-y-auto px-(--space-page) py-(--space-page) max-sm:px-4 max-sm:pt-4">
          <div className="mx-auto max-w-[720px]">{tool ? <ToolDetail key={tool.id} tool={tool} /> : <Missing />}</div>
        </div>
      )}
    </Page>
  )
}

import * as React from "react"
import { CircleCheck, CircleX, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { ControlField, Lab, LabControls, LabNote, LabReadouts, LabStage, Readout, Segmented, SliderField, Tex, fixed, formatSI, trace } from "@/lab"

/*
 * A made-up LDO for teaching, "OW1117-3.3". Its numbers are modelled on the
 * AMS1117 class of parts, but it is not a real product.
 */
const SPEC = {
  absVinMax: 15,
  absTjMax: 150,
  recVinMin: 4.75,
  recVinMax: 12,
  recIoutMax: 0.8,
  recTjMax: 125,
  vout: 3.3,
  /** Dropout at 100 mA and 800 mA: typical / maximum. Linear in between, flat outside. */
  dropout: { lowI: 0.1, highI: 0.8, typ: [1.0, 1.1], max: [1.15, 1.3] },
  iqTyp: 0.005,
  iqMax: 0.01,
  ilimMin: 0.9,
  ilimTyp: 1.2,
  thetaJA: 90,
}

type Basis = "max" | "typ"
type Status = "pass" | "warn" | "fail"

function dropoutAt(i: number, basis: Basis) {
  const { lowI, highI, typ, max } = SPEC.dropout
  const [a, b] = basis === "max" ? max : typ
  const t = Math.min(1, Math.max(0, (i - lowI) / (highI - lowI)))
  return a + (b - a) * t
}

function evaluate(vin: number, iout: number, ta: number, basis: Basis) {
  const vdo = dropoutAt(iout, basis)
  const iq = basis === "max" ? SPEC.iqMax : SPEC.iqTyp
  const headroom = vin - SPEC.vout - vdo
  const vout = Math.max(0, Math.min(SPEC.vout, vin - vdo))
  const p = Math.max(0, vin - vout) * iout + vin * iq
  const tj = ta + p * SPEC.thetaJA
  return { vdo, iq, headroom, vout, p, tj }
}

const ROW = "border-t first:border-t-0"

/** Three design conditions against a teaching datasheet: absolute maximum, recommended range, dropout, current and junction temperature. */
export function DatasheetCheckLab() {
  const [vin, setVin] = React.useState(5)
  const [iout, setIout] = React.useState(0.5)
  const [ta, setTa] = React.useState(40)
  const [basis, setBasis] = React.useState<Basis>("max")

  const r = evaluate(vin, iout, ta, basis)
  const worst = evaluate(vin, iout, ta, "max")

  const checks: { title: string; status: Status; detail: React.ReactNode }[] = [
    {
      title: "输入电压 ≤ 极限参数 15 V",
      status: vin > SPEC.absVinMax ? "fail" : "pass",
      detail: vin > SPEC.absVinMax ? `输入 ${fixed(vin, 1)} V 超过极限 15 V，芯片可能当场损坏。` : `输入 ${fixed(vin, 1)} V，离极限还有 ${fixed(SPEC.absVinMax - vin, 1)} V。`,
    },
    {
      title: "输入电压在推荐范围 4.75–12 V 内",
      status: vin < SPEC.recVinMin || vin > SPEC.recVinMax ? "warn" : "pass",
      detail:
        vin > SPEC.recVinMax
          ? "超出推荐范围：芯片不一定坏，但手册不保证它的各项指标。"
          : vin < SPEC.recVinMin
            ? "低于推荐下限：手册不保证输出能稳在 3.3 V。"
            : "在推荐范围内，电气特性表里的数字都算数。",
    },
    {
      title: `压差够不够（按${basis === "max" ? "最大值" : "典型值"}）`,
      status: r.headroom >= 0 ? "pass" : "fail",
      detail:
        r.headroom >= 0
          ? `输入比 3.3 V 高 ${fixed(vin - SPEC.vout, 2)} V，${basis === "max" ? "最坏" : "典型"}压差 ${fixed(r.vdo, 2)} V，还剩 ${fixed(r.headroom, 2)} V 余量。`
          : `需要至少 ${fixed(SPEC.vout + r.vdo, 2)} V 输入，输出只能跟到约 ${fixed(r.vout, 2)} V。`,
    },
    {
      title: "输出电流 ≤ 推荐的 800 mA",
      status: iout >= SPEC.ilimMin ? "fail" : iout > SPEC.recIoutMax ? "warn" : "pass",
      detail:
        iout >= SPEC.ilimMin
          ? `${formatSI(iout, "A")} 到了限流的最小值 0.9 A：有的芯片会开始限流，输出电压往下掉。按典型值 1.2 A 设计是在赌运气。`
          : iout > SPEC.recIoutMax
            ? `${formatSI(iout, "A")} 超出推荐范围，但还没到限流的最小值 0.9 A。`
            : `${formatSI(iout, "A")}，在推荐范围内。`,
    },
    {
      title: "结温 ≤ 推荐的 125 °C",
      status: r.tj > SPEC.absTjMax ? "fail" : r.tj > SPEC.recTjMax ? "warn" : "pass",
      detail: (
        <>
          <Tex>{String.raw`T_J = ${fixed(ta, 0)}\,{}^{\circ}\mathrm{C} + ${fixed(r.p, 2)}\,\mathrm{W} \times 90\,{}^{\circ}\mathrm{C/W} \approx ${fixed(r.tj, 0)}\,{}^{\circ}\mathrm{C}`}</Tex>。
          {r.tj > SPEC.absTjMax ? "超过极限参数里的 150 °C：会触发过热保护，甚至损坏。" : r.tj > SPEC.recTjMax ? "超出推荐范围，寿命缩短，离极限很近。" : `余量 ${fixed(SPEC.recTjMax - r.tj, 0)} °C。`}
        </>
      ),
    },
  ]

  const fails = checks.filter((c) => c.status === "fail").length
  const warns = checks.filter((c) => c.status === "warn").length
  const hidden = basis === "typ" && (worst.headroom < 0 || worst.tj > SPEC.recTjMax) && r.headroom >= 0 && r.tj <= SPEC.recTjMax
  const tone = fails ? "bad" : warns || hidden ? "warn" : "good"
  const note = hidden
    ? "按典型值算，压差和结温看着都够。但典型值不保证：切回「最大值」，同样的条件就不够了。设计要按最坏情况。"
    : fails
      ? `${fails} 项不通过${warns ? `，${warns} 项要注意` : ""}。这个设计不能用：降低输入电压、减小电流，或者换一颗更合适的稳压器。`
      : warns
        ? `没有硬伤，但 ${warns} 项超出了推荐范围。手册只在推荐范围内保证性能，量产前要留出余量。`
        : basis === "max"
          ? `按最坏情况算，全部通过${r.tj > SPEC.recTjMax - 10 ? `，不过结温只剩 ${fixed(SPEC.recTjMax - r.tj, 0)} °C 余量，夏天机箱里会更热` : ""}。`
          : "按典型值算全部通过。最好再切到「最大值」核对一遍。"

  return (
    <Lab
      title="对着数据手册查设计"
      hint="拖动设计条件，下面五项检查会实时更新。再把「按哪个值设计」切到典型值，比较一下。"
      onReset={() => {
        setVin(5)
        setIout(0.5)
        setTa(40)
        setBasis("max")
      }}
    >
      <LabStage>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-body font-semibold">OW1117-3.3 低压差线性稳压器</p>
          <p className="text-caption text-muted-foreground">教学用的虚构器件，参数仿照 AMS1117 这一类芯片</p>
        </div>
        <div className="grid gap-4 text-small @xl:grid-cols-2">
          <SpecTable
            title="极限参数（超过可能损坏）"
            head={["参数", "最小", "最大"]}
            rows={[
              ["输入电压 VIN", "", "15 V"],
              ["结温 TJ", "", "150 °C"],
              ["存储温度", "−65 °C", "150 °C"],
            ]}
            cols="minmax(0,1fr) auto auto"
          />
          <SpecTable
            title="推荐工作条件"
            head={["参数", "最小", "最大"]}
            rows={[
              ["输入电压 VIN", "4.75 V", "12 V"],
              ["输出电流 IOUT", "0", "800 mA"],
              ["结温 TJ", "−40 °C", "125 °C"],
            ]}
            cols="minmax(0,1fr) auto auto"
          />
          <SpecTable
            title="电气特性（TJ = 25 °C）"
            head={["参数（条件）", "最小", "典型", "最大"]}
            rows={[
              ["输出电压（10 mA）", "3.267 V", "3.300 V", "3.333 V"],
              ["压差（100 mA）", "", "1.00 V", "1.15 V"],
              ["压差（800 mA）", "", "1.10 V", "1.30 V"],
              ["静态电流", "", "5 mA", "10 mA"],
              ["限流", "0.9 A", "1.2 A", ""],
            ]}
            cols="minmax(0,1fr) auto auto auto"
          />
          <SpecTable title="热特性" head={["参数（条件）", "典型"]} rows={[["热阻 θJA（SOT-223，标准测试板）", "90 °C/W"]]} cols="minmax(0,1fr) auto" />
        </div>
      </LabStage>
      <LabControls>
        <SliderField label="输入电压 VIN" value={vin} onChange={setVin} min={3} max={18} step={0.1} unit="V" color={trace.voltage} />
        <SliderField label="负载电流 IOUT" value={iout} onChange={setIout} min={0} max={1.2} step={0.01} unit="A" color={trace.current} />
        <SliderField label="环境温度 TA" value={ta} onChange={setTa} min={-40} max={85} step={1} format={(v) => `${fixed(v, 0)} °C`} />
        <ControlField label="按哪个值设计">
          <Segmented<Basis>
            aria-label="按哪个值设计"
            size="sm"
            value={basis}
            onValueChange={setBasis}
            options={[
              { value: "max", label: "最大值（最坏情况）" },
              { value: "typ", label: "典型值" },
            ]}
          />
        </ControlField>
      </LabControls>
      <ul aria-live="polite" className="px-4 py-1">
        {checks.map((c) => (
          <li key={c.title} className={cn("flex gap-2.5 py-2", ROW)}>
            <StatusIcon status={c.status} />
            <div className="min-w-0 text-small">
              <p className="font-medium">
                {c.title}
                <span className={cn("ml-2 text-caption font-medium", STATUS[c.status].text)}>{STATUS[c.status].label}</span>
              </p>
              <p className="text-muted-foreground">{c.detail}</p>
            </div>
          </li>
        ))}
      </ul>
      <LabReadouts>
        <Readout label="稳压器发热 P" value={formatSI(r.p, "W")} color={trace.power} sub={<Tex>{String.raw`(V_{\mathrm{IN}} - V_{\mathrm{OUT}}) \times I_{\mathrm{OUT}} + V_{\mathrm{IN}} \times I_Q`}</Tex>} />
        <Readout label="结温 TJ" value={`${fixed(r.tj, 0)} °C`} color={trace.power} />
        <Readout label="压差余量" value={`${fixed(r.headroom, 2)} V`} sub={`压差按 ${fixed(r.vdo, 2)} V 算`} />
      </LabReadouts>
      <LabNote tone={tone}>{note}</LabNote>
    </Lab>
  )
}

const STATUS: Record<Status, { label: string; text: string }> = {
  pass: { label: "通过", text: "text-success" },
  warn: { label: "注意", text: "text-warning" },
  fail: { label: "不通过", text: "text-destructive" },
}

function StatusIcon({ status }: { status: Status }) {
  const cls = cn("mt-0.5 size-4 shrink-0", STATUS[status].text)
  if (status === "pass") return <CircleCheck aria-hidden className={cls} />
  if (status === "warn") return <TriangleAlert aria-hidden className={cls} />
  return <CircleX aria-hidden className={cls} />
}

/** One block of the datasheet: a title and a small table whose first column wraps. */
function SpecTable({ title, head, rows, cols }: { title: string; head: string[]; rows: string[][]; cols: string }) {
  return (
    <section className="min-w-0">
      <p className="mb-1 text-caption font-medium text-muted-foreground">{title}</p>
      <div className="grid gap-x-3 rounded-md border bg-background px-2.5 py-1" style={{ gridTemplateColumns: cols }}>
        {head.map((h, i) => (
          <span key={`h${i}`} className={cn("py-1 text-caption text-faint-foreground", i > 0 && "text-right")}>
            {h}
          </span>
        ))}
        {rows.flatMap((row, ri) =>
          row.map((cell, ci) => (
            <span key={`${ri}-${ci}`} className={cn("tabular border-t py-1", ci > 0 && "text-right whitespace-nowrap")}>
              {cell}
            </span>
          )),
        )}
      </div>
    </section>
  )
}

import * as React from "react"
import { FlaskConical, Pause, Play, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { IconButton } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { formatSI, sig } from "./format"
import { LabContext, useInView, type Playback } from "./hooks"
import { nearestE } from "./math"

/*
 * The frame every interactive widget lives in: a title bar, then any mix of
 * <LabStage> (the picture), <LabControls> (sliders, switches), <LabReadouts>
 * (live numbers) and <LabNote> (a sentence that reacts to the state).
 * One flat card; the parts are separated by hairlines, never nested cards.
 */
export function Lab({
  title,
  hint,
  actions,
  onReset,
  className,
  children,
}: {
  title: string
  /** One line telling the learner what to try. */
  hint?: React.ReactNode
  /** Extra icon buttons in the title bar (a PlayButton, say). */
  actions?: React.ReactNode
  /** Shows a "恢复初始值" button. */
  onReset?: () => void
  className?: string
  children: React.ReactNode
}) {
  const [ref, inView] = useInView<HTMLElement>()
  const ctx = React.useMemo(() => ({ inView }), [inView])
  return (
    <LabContext.Provider value={ctx}>
      <figure ref={ref} data-lab className={cn("@container not-prose my-6 overflow-hidden rounded-lg border bg-background text-body", className)}>
        <header className="flex min-h-10 items-center gap-2 border-b px-4 py-1">
          <FlaskConical aria-hidden className="size-4 shrink-0 text-faint-foreground" />
          <figcaption className="min-w-0 flex-1 truncate text-small font-medium">{title}</figcaption>
          {actions}
          {onReset && (
            <IconButton label="恢复初始值" size="icon-sm" onClick={onReset} className="text-muted-foreground">
              <RotateCcw />
            </IconButton>
          )}
        </header>
        {hint && <p className="border-b px-4 py-2 text-small text-muted-foreground">{hint}</p>}
        <div className="divide-y">{children}</div>
      </figure>
    </LabContext.Provider>
  )
}

/** The picture: a schematic, a plot, an animation. Sits on the sunken surface. */
export function LabStage({ className, children, plain }: { className?: string; children: React.ReactNode; /** No sunken background (for plots that bring their own). */ plain?: boolean }) {
  return <div className={cn("overflow-x-auto px-4 py-4", !plain && "bg-sunken", className)}>{children}</div>
}

/** Sliders and switches. Columns follow the widget's own width (container queries), not the window's. */
export function LabControls({ className, children, columns = 2 }: { className?: string; children: React.ReactNode; columns?: 1 | 2 | 3 }) {
  return (
    <div className={cn("grid gap-x-8 gap-y-3 px-4 py-3", columns === 2 && "@md:grid-cols-2", columns === 3 && "@md:grid-cols-2 @2xl:grid-cols-3", className)}>
      {children}
    </div>
  )
}

/** A row of live numbers. */
export function LabReadouts({ className, children }: { className?: string; children: React.ReactNode }) {
  return <dl className={cn("flex flex-wrap gap-x-8 gap-y-3 px-4 py-3", className)}>{children}</dl>
}

/** One live number: a caption, the value, optionally a colour dot matching its trace or wire. */
export function Readout({ label, value, color, sub }: { label: React.ReactNode; value: React.ReactNode; color?: string; sub?: React.ReactNode }) {
  return (
    <div className="min-w-20">
      <dt className="flex items-center gap-1.5 text-caption text-faint-foreground">
        {color && <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: color }} />}
        {label}
      </dt>
      <dd className="tabular text-heading font-semibold">{value}</dd>
      {sub && <dd className="text-caption text-muted-foreground">{sub}</dd>}
    </div>
  )
}

/** A sentence that explains the current state in plain words ("电流太大，LED 会烧毁"). */
export function LabNote({ tone = "neutral", children }: { tone?: "neutral" | "good" | "warn" | "bad"; children: React.ReactNode }) {
  const color = { neutral: "text-muted-foreground", good: "text-success", warn: "text-warning", bad: "text-destructive" }[tone]
  return (
    <p aria-live="polite" className={cn("px-4 py-2.5 text-small", color)}>
      {children}
    </p>
  )
}

const SI_UNITS = new Set(["V", "A", "Ω", "F", "H", "W", "Hz", "s", "m", "J", "C", "S", "T", "Wh", "Ah", "bps", "B", "Pa"])

/** Value + unit the way the course writes them: SI units get a prefix ("4.7 kΩ"), % and ° hug the number. */
export function formatValue(value: number, unit?: string, digits = 3): string {
  if (!unit) return sig(value, digits)
  if (SI_UNITS.has(unit)) return formatSI(value, unit, digits)
  if (unit === "%" || unit === "°" || unit === "×") return `${sig(value, digits)}${unit}`
  return `${sig(value, digits)} ${unit}`
}

/**
 * The main control: a labelled slider with its live value.
 * `log` spreads decades evenly (resistance, frequency); `snap` rounds to real
 * E-series part values.
 */
export function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  format,
  log,
  snap,
  color,
  disabled,
}: {
  label: React.ReactNode
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  /** Linear step. Ignored when `log`. */
  step?: number
  unit?: string
  /** Custom value text. Defaults to formatValue(value, unit). */
  format?: (v: number) => string
  /** Logarithmic scale (min must be > 0). */
  log?: boolean
  /** Round to the nearest standard part value. Use with `log`. */
  snap?: "E12" | "E24"
  /** Dot beside the label, matching the trace or wire this controls. */
  color?: string
  disabled?: boolean
}) {
  const id = React.useId()
  const STEPS = 1000
  const toPos = (v: number) => (log ? (Math.log(v / min) / Math.log(max / min)) * STEPS : v)
  const fromPos = (p: number) => {
    if (!log) return p
    const raw = min * (max / min) ** (p / STEPS)
    const v = snap ? nearestE(raw, snap) : Number(raw.toPrecision(3))
    return Math.min(max, Math.max(min, v))
  }
  const pos = toPos(Math.min(max, Math.max(min, value)))
  const lo = log ? 0 : min
  const hi = log ? STEPS : max
  const fill = hi > lo ? ((pos - lo) / (hi - lo)) * 100 : 0
  return (
    <div className={cn("min-w-0", disabled && "opacity-60")}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="flex min-w-0 items-center gap-1.5 text-small font-medium">
          {color && <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: color }} />}
          <span className="truncate">{label}</span>
        </label>
        <output htmlFor={id} className="tabular shrink-0 text-small text-muted-foreground">
          {format ? format(value) : formatValue(value, unit)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        className="lab-range"
        min={lo}
        max={hi}
        step={log ? 1 : (step ?? (max - min) / 100)}
        value={pos}
        disabled={disabled}
        onChange={(e) => onChange(fromPos(Number(e.target.value)))}
        style={{ "--fill": `${fill}%` } as React.CSSProperties}
        aria-valuetext={format ? format(value) : formatValue(value, unit)}
      />
    </div>
  )
}

/** An on/off control with its label, for the controls grid. */
export function SwitchField({ label, checked, onChange, hint }: { label: React.ReactNode; checked: boolean; onChange: (v: boolean) => void; hint?: React.ReactNode }) {
  const id = React.useId()
  return (
    <div className="flex min-h-(--control-md) items-center justify-between gap-3">
      <label htmlFor={id} className="min-w-0 text-small font-medium">
        {label}
        {hint && <span className="block text-caption font-normal text-muted-foreground">{hint}</span>}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

/** A labelled slot in the controls grid for a Segmented, a Select or a button row. */
export function ControlField({ label, className, children }: { label: React.ReactNode; /** e.g. "col-span-full" for a wide Segmented. */ className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <span className="text-small font-medium">{label}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

/** Play / pause for a looping animation. Put it in <Lab actions>. */
export function PlayButton({ playback }: { playback: Playback }) {
  return (
    <IconButton label={playback.playing ? "暂停动画" : "播放动画"} size="icon-sm" onClick={playback.toggle} className="text-muted-foreground">
      {playback.playing ? <Pause /> : <Play />}
    </IconButton>
  )
}

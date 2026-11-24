import * as React from "react"
import { Check, CircleQuestionMark, X } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * A one-question check after a concept. Wrong answers can be retried; the
 * explanation appears once the learner has answered, right or wrong, and the
 * icon plus the words say which it was (colour is never the only signal).
 */
export function Quiz({
  question,
  options,
  answer,
  explain,
}: {
  question: React.ReactNode
  options: React.ReactNode[]
  /** Index of the correct option. */
  answer: number
  /** Why that answer is right. Shown after answering. */
  explain?: React.ReactNode
}) {
  const [picked, setPicked] = React.useState<number | null>(null)
  const name = React.useId()
  const right = picked === answer
  return (
    <div className="not-prose my-6 rounded-lg border text-body">
      <div className="flex items-start gap-2 px-4 pt-3">
        <CircleQuestionMark aria-hidden className="mt-0.5 size-4 shrink-0 text-faint-foreground" />
        <p className="min-w-0 flex-1 font-medium">{question}</p>
      </div>
      <div role="radiogroup" aria-label="选项" className="flex flex-col gap-1.5 px-4 py-3">
        {options.map((opt, i) => {
          const chosen = picked === i
          const showRight = picked != null && i === answer && right
          const showWrong = chosen && !right
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={chosen}
              name={name}
              onClick={() => setPicked(i)}
              className={cn(
                "flex min-h-(--control-lg) items-center gap-2.5 rounded-md border px-3 py-1.5 text-left",
                "transition-colors duration-(--duration-fast) hover:bg-accent",
                showRight && "border-success bg-success-subtle hover:bg-success-subtle",
                showWrong && "border-destructive bg-destructive-subtle hover:bg-destructive-subtle",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full border border-input text-caption font-medium text-muted-foreground [&_svg]:size-3.5",
                  showRight && "border-success bg-success text-background",
                  showWrong && "border-destructive bg-destructive text-background",
                )}
              >
                {showRight ? <Check /> : showWrong ? <X /> : String.fromCharCode(65 + i)}
              </span>
              <span className="min-w-0 flex-1">{opt}</span>
            </button>
          )
        })}
      </div>
      {picked != null && (
        <div aria-live="polite" className="border-t px-4 py-3 text-small">
          <span className={cn("font-medium", right ? "text-success" : "text-destructive")}>{right ? "答对了。" : "不对，再想想。"}</span>
          {right && explain && <span className="text-muted-foreground"> {explain}</span>}
        </div>
      )}
    </div>
  )
}

import * as React from "react"
import katex from "katex"
import { cn } from "@/lib/utils"
import { formatSI } from "./format"

/**
 * A formula set by KaTeX, the same engine the lesson text uses, so a widget's
 * "I = V / R" reads like the one in the paragraph above it.
 *
 *   <Tex>{String.raw`I = \frac{V}{R}`}</Tex>
 *   <Tex>{`I = ${tex.si(v, "V")} \\div ${tex.si(r, "Ω")}`}</Tex>
 *   <Tex block>…</Tex>            centred on its own line
 *
 * Inside SVG use plain text instead: KaTeX renders HTML.
 */
export function Tex({ children, block, className }: { children: string; block?: boolean; className?: string }) {
  const html = React.useMemo(
    // inline text style would shrink a fraction's numbers to ~11px, under the 12px floor; \displaystyle keeps them full size
    () => katex.renderToString(block ? children : `\\displaystyle ${children}`, { displayMode: !!block, throwOnError: false, strict: false, output: "html" }),
    [children, block],
  )
  const Tag = block ? "div" : "span"
  return <Tag className={cn(block && "overflow-x-auto overflow-y-hidden py-1", className)} dangerouslySetInnerHTML={{ __html: html }} />
}

const UNIT_TEX: Record<string, string> = { "μ": "\\mu ", "µ": "\\mu ", "Ω": "\\Omega ", "°": "^{\\circ}", "%": "\\%" }

/** Helpers that turn live values into TeX fragments. */
export const tex = {
  /** formatSI as TeX: tex.si(0.00417, "A") → "4.17\,\mathrm{mA}". */
  si(value: number, unit = "", digits = 3): string {
    const s = formatSI(value, unit, digits)
    const space = s.indexOf(" ")
    const num = tex.num(space < 0 ? s : s.slice(0, space))
    if (space < 0) return num
    const u = s
      .slice(space + 1)
      .split("")
      .map((ch) => UNIT_TEX[ch] ?? ch)
      .join("")
    return `${num}\\,\\mathrm{${u}}`
  },
  /** A plain number string ("−1.5", "∞") as TeX. */
  num(s: string): string {
    return s.replace(/−/g, "-").replace(/∞/g, "\\infty ")
  },
}

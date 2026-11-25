import * as React from "react"
import { useParams, useSearchParams } from "react-router-dom"
import type { FilmDef } from "./kit"

/*
 * Development only (/dev/film/<chapter>/<lesson>): a contact sheet of one film,
 * many moments side by side, for reviewing a film without playing it.
 * scripts/films/frames.mjs screenshots this page and runs window.__filmAudit().
 *
 *   ?step=2            a frame every 2 s (default)
 *   ?t=12,13.5,20      these moments
 *   ?w=480&cols=4      frame width and columns
 */
const modules = import.meta.glob<{ film: FilmDef }>("/src/films/*/*/Film.tsx")

export default function FilmSheet() {
  const { chapter, slug } = useParams()
  const [params] = useSearchParams()
  const [film, setFilm] = React.useState<FilmDef | null | undefined>(undefined)
  const key = `/src/films/${chapter}/${slug}/Film.tsx`

  React.useEffect(() => {
    const load = modules[key]
    if (!load) return setFilm(null)
    load().then((m) => setFilm(m.film))
  }, [key])

  React.useEffect(() => {
    if (!film) return
    document.fonts.ready.then(() => requestAnimationFrame(() => (document.body.dataset.ready = "1")))
    return () => {
      delete document.body.dataset.ready
    }
  }, [film])

  if (film === undefined) return null
  if (film === null) return <p className="p-6 text-body">No film at {key}</p>

  const width = Number(params.get("w") ?? 480)
  const cols = Number(params.get("cols") ?? 4)
  const step = Number(params.get("step") ?? 2)
  const times = params.get("t")
    ? params.get("t")!.split(",").map(Number)
    : Array.from({ length: Math.floor(film.timing.duration / step) + 1 }, (_, i) => Math.round(i * step * 100) / 100)

  return (
    <div className="grid w-max gap-3 bg-background p-3 text-foreground" style={{ gridTemplateColumns: `repeat(${cols}, ${width}px)` }}>
      {times.map((t) => {
        const caption = [...film.timing.captions].reverse().find((c) => c.start <= t + 0.05 && t < c.end + 0.8)
        return (
          <div key={t} className="flex flex-col gap-1">
            <div data-frame={t} className="@container relative aspect-video w-full overflow-hidden rounded-md border bg-sunken text-foreground">
              <film.Stage t={t} b={film.timing.beats} still={false} />
            </div>
            <div className="tabular truncate text-caption text-muted-foreground">
              {t.toFixed(1)}s {caption ? `· ${caption.text}` : ""}
            </div>
          </div>
        )
      })}
    </div>
  )
}

declare global {
  interface Window {
    __filmAudit?: () => { t: number; issue: string }[]
  }
}

/** Text that sits outside the stage, or on top of other text, in any frame on the sheet. */
if (typeof window !== "undefined") {
  window.__filmAudit = () => {
    const out: { t: number; issue: string }[] = []
    const seen = (el: Element, frame: Element) => {
      let o = 1
      for (let n: Element | null = el; n && n !== frame; n = n.parentElement) o *= Number(getComputedStyle(n).opacity)
      return o
    }
    for (const frame of document.querySelectorAll("[data-frame]")) {
      const t = Number(frame.getAttribute("data-frame"))
      const fr = frame.getBoundingClientRect()
      const texts = [...frame.querySelectorAll("[data-film-text]")]
        .map((el) => ({ el, r: el.getBoundingClientRect(), o: seen(el, frame), s: (el.textContent ?? "").trim().slice(0, 16) }))
        .filter((x) => x.o > 0.5 && x.r.width > 0 && x.s)
      for (const x of texts) {
        if (x.r.left < fr.left - 2 || x.r.right > fr.right + 2 || x.r.top < fr.top - 2 || x.r.bottom > fr.bottom + 2) out.push({ t, issue: `outside the stage: "${x.s}"` })
      }
      for (let i = 0; i < texts.length; i++)
        for (let j = i + 1; j < texts.length; j++) {
          const a = texts[i]
          const b = texts[j]
          // a Sub inside its own formula piece is meant to sit next to it
          if (a.el.contains(b.el) || b.el.contains(a.el)) continue
          const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left)
          const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top)
          if (w > 1 && h > 1 && w * h > Math.min(a.r.width * a.r.height, b.r.width * b.r.height) * 0.12) out.push({ t, issue: `overlap: "${a.s}" × "${b.s}"` })
        }
    }
    return out
  }
}

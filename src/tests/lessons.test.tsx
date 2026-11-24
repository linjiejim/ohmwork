/**
 * Every lesson must render, contain at least one live widget, and survive
 * having each of its controls pushed to both ends. Run one chapter with
 *   npx vitest run src/tests/lessons.test.tsx -t "basics/"
 */
import type * as React from "react"
import { describe, expect, it } from "vitest"
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { MDXProvider } from "@mdx-js/react"
import { LESSONS } from "@/curriculum/curriculum"
import { TooltipProvider } from "@/components/ui/tooltip"
import { mdxComponents } from "@/mdx/components"

const modules = import.meta.glob<{ default: React.ComponentType }>("/src/content/*/*.mdx")

const BROKEN = /NaN|undefined|\[object Object\]/

describe("lessons", () => {
  for (const { key } of LESSONS) {
    const load = modules[`/src/content/${key}.mdx`]
    it.skipIf(!load)(`${key} renders and its controls work`, async () => {
      const { default: Content } = await load()
      const { container } = render(
        <TooltipProvider>
          <MemoryRouter>
            <MDXProvider components={mdxComponents}>
              <article className="lesson">
                <Content />
              </article>
            </MDXProvider>
          </MemoryRouter>
        </TooltipProvider>,
      )
      expect(container.querySelectorAll("h2").length, "a lesson has sections (## headings)").toBeGreaterThan(1)
      expect(container.querySelectorAll("[data-lab]").length, "a lesson has at least one <Lab> widget").toBeGreaterThan(0)
      expect(container.querySelectorAll("[role=radiogroup]").length, "a lesson has at least one <Quiz>").toBeGreaterThan(0)
      expect(container.textContent).not.toMatch(BROKEN)

      // push every slider to both ends
      for (const input of container.querySelectorAll<HTMLInputElement>("[data-lab] input[type=range]")) {
        for (const value of [input.min, input.max]) {
          act(() => {
            fireEvent.change(input, { target: { value } })
          })
          expect(container.textContent, `slider at ${value}`).not.toMatch(BROKEN)
        }
      }
      // flip every switch, press every option and button inside the widgets
      for (const el of container.querySelectorAll<HTMLElement>("[data-lab] [role=switch], [data-lab] [role=radio], [data-lab] button:not([role=combobox]), [data-lab] [role=button]")) {
        act(() => {
          fireEvent.click(el)
        })
        expect(container.textContent, `after clicking ${el.getAttribute("aria-label") ?? el.textContent}`).not.toMatch(BROKEN)
      }
      // nothing in the pictures may be drawn at NaN coordinates
      const bad = [...container.querySelectorAll("svg *")].filter((n) => [...n.attributes].some((a) => /NaN|undefined/.test(a.value)))
      expect(bad.map((n) => n.outerHTML.slice(0, 120)), "SVG attributes with NaN").toEqual([])
      cleanup()
    })
  }

  it("has no content file outside the curriculum", () => {
    const known = new Set(LESSONS.map((l) => `/src/content/${l.key}.mdx`))
    expect(Object.keys(modules).filter((p) => !known.has(p))).toEqual([])
  })
})
